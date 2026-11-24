// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Executor de coleção: núcleo sem Electron (testável). Envia cada requisição por executeRequest, em
 * sequência, repete por iteração (linhas do arquivo de dados viram variáveis temporárias) e encadeia as
 * extrações não secretas nas requisições seguintes. Extrações secretas já vão direto ao cofre no engine.
 */
import { randomUUID } from 'node:crypto'
import { API_LIMITS } from '@shared/api/limits'
import type { ApiRunItemResult, ApiRunProgress, ApiSendResult, runInputSchema } from '@shared/api/protocol'
import type { Assertion } from '@shared/api/schema'
import { VARIABLE_NAME_RE } from '@shared/api/variables'
import type { z } from 'zod'
import { executeRequest } from './engine'
import { isItemFailed } from '@shared/api/reports'

export type ParsedRunInput = z.output<typeof runInputSchema>

/** Quantas iterações o executor faz: com arquivo de dados, uma por linha; sem, o número pedido. */
export const effectiveIterations = (input: Pick<ParsedRunInput, 'iterations' | 'data'>): number =>
  input.data.length > 0 ? input.data.length : input.iterations

export const expectedExecutions = (input: Pick<ParsedRunInput, 'iterations' | 'data' | 'items'>): number =>
  effectiveIterations(input) * input.items.length

/** Descrição curta de uma asserção, para o relatório. */
export function assertionName(a: Assertion): string {
  const where = a.target === 'header' || a.target === 'cookie' ? (a.name ?? '') : (a.path ?? '')
  const exp = a.expected === undefined ? '' : Array.isArray(a.expected) ? a.expected.join(', ') : String(a.expected)
  return [a.target, where, a.op, exp].filter((p) => p !== '').join(' ').slice(0, 500)
}

/** Espera `ms`, acordando antes se o sinal abortar. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done(): void {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

const clip = (s: string): string => (s.length > API_LIMITS.valueChars ? s.slice(0, API_LIMITS.valueChars) : s)

/** Só chaves válidas e sem __proto__ viram variáveis temporárias. */
function safeRow(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) if (VARIABLE_NAME_RE.test(k) && k !== '__proto__') out[k] = clip(v)
  return out
}

function toItemResult(
  iteration: number,
  entry: ParsedRunInput['items'][number],
  result: ApiSendResult
): ApiRunItemResult {
  const { request } = entry
  const base = { iteration, path: entry.path, folder: entry.folder, name: request.name || request.url, method: request.method }
  const assertions = request.tests
  if (!result.ok) {
    return { ...base, url: request.url, errorCode: result.code, tests: [] }
  }
  const tests = result.tests.map((t) => ({
    name: assertions[t.index] ? assertionName(assertions[t.index]) : `#${t.index + 1}`,
    passed: t.passed,
    ...(t.actual !== undefined ? { actual: t.actual } : {}),
    ...(t.error !== undefined ? { error: t.error } : {})
  }))
  return { ...base, url: result.sentRequest.url, status: result.status, timeMs: Math.round(result.timings.total), tests }
}

export interface RunOptions {
  signal: AbortSignal
  onProgress: (progress: ApiRunProgress) => void
}

/**
 * Executa e informa o andamento por item. Termina com `finished` (e `cancelled` se o sinal abortou).
 * Quem chama já validou a entrada (runInputSchema) e a confirmação de produção.
 */
export async function runCollection(input: ParsedRunInput, { signal, onProgress }: RunOptions): Promise<ApiRunItemResult[]> {
  const iterations = effectiveIterations(input)
  const total = iterations * input.items.length
  const results: ApiRunItemResult[] = []
  const chain: Record<string, string> = {}
  let done = 0
  let stop = false
  onProgress({ runId: input.runId, done: 0, total })

  for (let it = 0; it < iterations && !stop && !signal.aborted; it++) {
    if (input.data.length > 0) Object.assign(chain, safeRow(input.data[it]))
    for (let i = 0; i < input.items.length && !signal.aborted; i++) {
      if (done > 0 && input.delayMs > 0) {
        await sleep(input.delayMs, signal)
        if (signal.aborted) break
      }
      const entry = input.items[i]
      const result = await executeRequest(
        {
          runId: randomUUID(),
          request: entry.request,
          environment: input.environment,
          collection: input.collection,
          temporary: { ...chain },
          documentPath: entry.path || null,
          saveToFile: false,
          productionConfirmed: input.productionConfirmed
        },
        { signal }
      )
      // Cancelado no meio de uma requisição: ela não entra no relatório.
      if (signal.aborted) break
      if (result.ok) {
        for (const x of result.extracted) {
          if (x.ok && !x.secret && x.value !== undefined && VARIABLE_NAME_RE.test(x.to) && x.to !== '__proto__') chain[x.to] = clip(x.value)
        }
      }
      const item = toItemResult(it + 1, entry, result)
      results.push(item)
      done++
      onProgress({ runId: input.runId, done, total, item })
      if (input.stopOnFailure && isItemFailed(item)) {
        stop = true
        break
      }
    }
  }
  onProgress({ runId: input.runId, done, total, finished: true, ...(signal.aborted ? { cancelled: true } : {}) })
  return results
}
