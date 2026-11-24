// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiResponseResult, ApiRunProgress, ApiSendResult } from '@shared/api/protocol'
import { runInputSchema } from '@shared/api/protocol'
import { newApiRequest, type ApiRequest } from '@shared/api/schema'
import { executeRequest } from './engine'
import { effectiveIterations, runCollection, type ParsedRunInput } from './runner'

vi.mock('./engine', () => ({ executeRequest: vi.fn() }))
const exec = vi.mocked(executeRequest)

function response(over: Partial<ApiResponseResult> = {}): ApiResponseResult {
  return {
    ok: true,
    runId: 'x',
    status: 200,
    statusText: 'OK',
    httpVersion: '1.1',
    headers: [],
    cookies: [],
    timings: { dns: 0, tcp: 0, tls: 0, firstByte: 0, download: 0, total: 12.4 },
    size: { headers: 0, body: 0 },
    body: { encoding: 'utf8', text: '', contentType: '', truncated: false },
    sentRequest: { method: 'GET', url: 'http://127.0.0.1/x', headers: [] },
    redirects: [],
    tests: [],
    extracted: [],
    missingVariables: [],
    ...over
  }
}

function req(name: string, patch: Partial<ApiRequest> = {}): ApiRequest {
  return { ...newApiRequest(name), url: `http://127.0.0.1/${name}`, ...patch }
}

function input(names: string[], over: Record<string, unknown> = {}): ParsedRunInput {
  return runInputSchema.parse({
    runId: crypto.randomUUID(),
    name: 'col',
    items: names.map((n) => ({ path: `/c/${n}.apireq`, folder: '', request: req(n) })),
    ...over
  })
}

const run = (i: ParsedRunInput, signal = new AbortController().signal) => {
  const events: ApiRunProgress[] = []
  return runCollection(i, { signal, onProgress: (p) => events.push(p) }).then((results) => ({ results, events }))
}

beforeEach(() => exec.mockReset())

describe('executor de coleção', () => {
  it('executa as requisições em ordem e informa o andamento por item', async () => {
    exec.mockResolvedValue(response())
    const { results, events } = await run(input(['a', 'b']))
    expect(results.map((r) => r.name)).toEqual(['a', 'b'])
    expect(results[0]).toMatchObject({ iteration: 1, status: 200, timeMs: 12 })
    expect(events[0]).toMatchObject({ done: 0, total: 2 })
    expect(events.filter((e) => e.item).map((e) => e.done)).toEqual([1, 2])
    expect(events.at(-1)).toMatchObject({ finished: true, done: 2 })
  })

  it('repete por iteração', async () => {
    exec.mockResolvedValue(response())
    const { results } = await run(input(['a'], { iterations: 3 }))
    expect(results.map((r) => r.iteration)).toEqual([1, 2, 3])
  })

  it('com arquivo de dados faz uma iteração por linha e passa as colunas como variáveis', async () => {
    exec.mockResolvedValue(response())
    const i = input(['a'], { iterations: 5, data: [{ user: 'ana' }, { user: 'bia', 'bad key': 'x' }] })
    expect(effectiveIterations(i)).toBe(2)
    await run(i)
    expect(exec).toHaveBeenCalledTimes(2)
    expect(exec.mock.calls[0][0].temporary).toEqual({ user: 'ana' })
    expect(exec.mock.calls[1][0].temporary).toEqual({ user: 'bia' })
  })

  it('encadeia extrações não secretas nas requisições seguintes', async () => {
    exec
      .mockResolvedValueOnce(
        response({
          extracted: [
            { to: 'token', secret: false, ok: true, value: 'abc' },
            { to: 'senha', secret: true, ok: true, value: 'nao-deve-passar' },
            { to: 'falhou', secret: false, ok: false }
          ]
        })
      )
      .mockResolvedValue(response())
    await run(input(['login', 'lista']))
    expect(exec.mock.calls[1][0].temporary).toEqual({ token: 'abc' })
  })

  it('transforma os testes da resposta em nomes legíveis e marca falhas', async () => {
    const r = req('t', {
      tests: [
        { target: 'status', op: 'eq', expected: 200, enabled: true },
        { target: 'jsonPath', path: '$.id', op: 'exists', enabled: true }
      ]
    })
    exec.mockResolvedValue(response({ tests: [{ index: 0, passed: true }, { index: 1, passed: false, actual: 'undefined' }] }))
    const i = runInputSchema.parse({ runId: crypto.randomUUID(), name: 'c', items: [{ path: 'p', request: r }] })
    const { results } = await run(i)
    expect(results[0].tests).toEqual([
      { name: 'status eq 200', passed: true },
      { name: 'jsonPath $.id exists', passed: false, actual: 'undefined' }
    ])
  })

  it('registra o código de erro de rede', async () => {
    exec.mockResolvedValue({ ok: false, runId: 'x', code: 'ECONNREFUSED' } as ApiSendResult)
    const { results } = await run(input(['a']))
    expect(results[0]).toMatchObject({ errorCode: 'ECONNREFUSED', tests: [] })
    expect(results[0].status).toBeUndefined()
  })

  it('para na primeira falha quando pedido', async () => {
    exec
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response({ tests: [{ index: 0, passed: false }] }))
      .mockResolvedValue(response())
    const { results, events } = await run(input(['a', 'b', 'c'], { stopOnFailure: true }))
    expect(results.map((r) => r.name)).toEqual(['a', 'b'])
    expect(events.at(-1)).toMatchObject({ finished: true, done: 2, total: 3 })
    expect(events.at(-1)?.cancelled).toBeUndefined()
  })

  it('segue adiante sem stopOnFailure', async () => {
    exec.mockResolvedValueOnce({ ok: false, runId: 'x', code: 'timeout' } as ApiSendResult).mockResolvedValue(response())
    const { results } = await run(input(['a', 'b']))
    expect(results).toHaveLength(2)
  })

  it('cancelamento interrompe, descarta a requisição em curso e marca cancelled', async () => {
    const controller = new AbortController()
    exec
      .mockImplementationOnce(async () => response())
      .mockImplementationOnce(async () => {
        controller.abort()
        return response()
      })
    const { results, events } = await run(input(['a', 'b', 'c']), controller.signal)
    expect(results.map((r) => r.name)).toEqual(['a'])
    expect(events.at(-1)).toMatchObject({ finished: true, cancelled: true })
    expect(exec).toHaveBeenCalledTimes(2)
  })

  it('o atraso espera entre as requisições e acorda no cancelamento', async () => {
    exec.mockResolvedValue(response())
    vi.useFakeTimers()
    try {
      const controller = new AbortController()
      const p = run(input(['a', 'b'], { delayMs: 5000 }), controller.signal)
      await vi.advanceTimersByTimeAsync(100)
      expect(exec).toHaveBeenCalledTimes(1)
      controller.abort()
      const { results } = await p
      expect(results).toHaveLength(1)
      expect(exec).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('passa a confirmação de produção e o ambiente adiante', async () => {
    exec.mockResolvedValue(response())
    const env = { id: 'e1', name: 'prod', production: true, variables: [] }
    await run(input(['a'], { environment: env, productionConfirmed: true }))
    expect(exec.mock.calls[0][0]).toMatchObject({ productionConfirmed: true, environment: env, saveToFile: false })
  })
})
