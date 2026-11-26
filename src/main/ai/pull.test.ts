// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AI_RECOMMENDED_MODELS, DEFAULT_AI_SETTINGS, isValidModelName, type AiSettings } from '@shared/ai'
import { deleteModel, pullModel, type PullProgress } from './pull'

let server: Server
let settings: AiSettings
const seen: { method: string; path: string; body: string }[] = []
let handler: (req: IncomingMessage, res: ServerResponse) => void = () => undefined

const line = (res: ServerResponse, obj: unknown): boolean => res.write(JSON.stringify(obj) + '\n')

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      seen.push({ method: req.method ?? '', path: req.url ?? '', body: raw })
      handler(req, res)
    })
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  settings = { ...DEFAULT_AI_SETTINGS, host: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }
})

afterAll(() => {
  server.closeAllConnections()
  server.close()
})

describe('nome do modelo', () => {
  it('aceita só [a-z0-9._:/-] até 100 caracteres', () => {
    for (const ok of ['llama3.2:3b', 'qwen2.5-coder:7b', 'hf.co/org/modelo:q4_k_m', 'phi4-mini']) expect(isValidModelName(ok), ok).toBe(true)
    for (const bad of ['', 'Llama3', 'a b', 'a;b', '../x', '-x', '/x', 'a\nb', 'x'.repeat(101), 'modelo$']) expect(isValidModelName(bad), bad).toBe(false)
    expect(isValidModelName('x'.repeat(100))).toBe(true)
  })

  it('os recomendados são nomes válidos, sem repetição', () => {
    expect(AI_RECOMMENDED_MODELS.length).toBeGreaterThanOrEqual(4)
    const names = AI_RECOMMENDED_MODELS.map((m) => m.name)
    expect(new Set(names).size).toBe(names.length)
    for (const m of AI_RECOMMENDED_MODELS) expect(isValidModelName(m.name)).toBe(true)
  })

  it('o pull recusa nome inválido sem chamar a rede', async () => {
    seen.length = 0
    const out = await pullModel(settings, 'Nome Ruim; rm', () => undefined, new AbortController().signal)
    expect(out).toEqual({ ok: false, code: 'modelNameInvalid' })
    expect(seen).toHaveLength(0)
  })
})

describe('pull', () => {
  it('lê o NDJSON de progresso e termina em success', async () => {
    handler = (_req, res) => {
      line(res, { status: 'pulling manifest' })
      line(res, { status: 'pulling abc123', digest: 'sha256:abc', total: 1000, completed: 250 })
      // Uma linha partida entre dois pedaços de rede.
      const l = JSON.stringify({ status: 'pulling abc123', total: 1000, completed: 1000 }) + '\n'
      res.write(l.slice(0, 15))
      setTimeout(() => {
        res.write(l.slice(15))
        line(res, { status: 'verifying sha256 digest' })
        line(res, { status: 'success' })
        res.end()
      }, 10)
    }
    seen.length = 0
    const events: PullProgress[] = []
    const out = await pullModel(settings, 'llama3.2:3b', (p) => events.push(p), new AbortController().signal)
    expect(out).toEqual({ ok: true })
    expect(JSON.parse(seen[0]!.body)).toEqual({ model: 'llama3.2:3b', stream: true })
    expect(seen[0]).toMatchObject({ method: 'POST', path: '/api/pull' })
    expect(events[0]).toEqual({ status: 'pulling manifest', completed: 0, total: 0 })
    expect(events[1]).toEqual({ status: 'pulling abc123', completed: 250, total: 1000 })
    expect(events[2]).toEqual({ status: 'pulling abc123', completed: 1000, total: 1000 })
    expect(events.at(-1)!.status).toBe('success')
  })

  it('erro do servidor vira código (modelo inexistente e outros)', async () => {
    handler = (_req, res) => (line(res, { error: 'pull model manifest: file does not exist' }), void res.end())
    expect(await pullModel(settings, 'nao-existe', () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'modelNotFound' })
    handler = (_req, res) => (line(res, { error: 'disk quota exceeded for /home/ana/.ollama' }), void res.end())
    expect(await pullModel(settings, 'llama3.2:3b', () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'pullFailed' })
  })

  it('fluxo que acaba sem success e linha inválida são falhas', async () => {
    handler = (_req, res) => (line(res, { status: 'pulling manifest' }), void res.end())
    expect(await pullModel(settings, 'llama3.2:3b', () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'pullFailed' })
    handler = (_req, res) => void res.end('isto não é json\n')
    expect(await pullModel(settings, 'llama3.2:3b', () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'pullFailed' })
  })

  it('cancela no meio', async () => {
    handler = (_req, res) => {
      line(res, { status: 'pulling abc', total: 100, completed: 1 })
      const t = setInterval(() => line(res, { status: 'pulling abc', total: 100, completed: 2 }), 10)
      res.on('close', () => clearInterval(t))
    }
    const c = new AbortController()
    const out = await pullModel(settings, 'llama3.2:3b', () => c.abort(), c.signal)
    expect(out).toEqual({ ok: false, code: 'cancelled' })
  })

  it('tempo ocioso esgotado devolve timeout', async () => {
    handler = (_req, res) => void line(res, { status: 'pulling manifest' })
    const out = await pullModel(settings, 'llama3.2:3b', () => undefined, new AbortController().signal, { connectMs: 1000, idleMs: 50 })
    expect(out).toEqual({ ok: false, code: 'timeout' })
  })

  it('só fala com loopback, a menos que o servidor remoto esteja liberado', async () => {
    const remote = { ...DEFAULT_AI_SETTINGS, host: 'http://ollama.exemplo.com.br:11434' }
    expect(await pullModel(remote, 'llama3.2:3b', () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'hostNotAllowed' })
    expect(await deleteModel(remote, 'llama3.2:3b')).toEqual({ ok: false, code: 'hostNotAllowed' })
  })

  it('Ollama parado devolve ollamaNotRunning', async () => {
    const dead = { ...DEFAULT_AI_SETTINGS, host: 'http://127.0.0.1:1' }
    expect(await pullModel(dead, 'llama3.2:3b', () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'ollamaNotRunning' })
  })
})

describe('excluir modelo', () => {
  it('chama DELETE /api/delete com o nome', async () => {
    handler = (_req, res) => void res.end()
    seen.length = 0
    expect(await deleteModel(settings, 'llama3.2:3b')).toEqual({ ok: true })
    expect(seen[0]).toMatchObject({ method: 'DELETE', path: '/api/delete' })
    expect(JSON.parse(seen[0]!.body)).toEqual({ model: 'llama3.2:3b' })
  })

  it('404 vira modelNotFound e nome vazio é recusado', async () => {
    handler = (_req, res) => ((res.statusCode = 404), void res.end())
    expect(await deleteModel(settings, 'x')).toEqual({ ok: false, code: 'modelNotFound' })
    expect(await deleteModel(settings, '  ')).toEqual({ ok: false, code: 'modelNameInvalid' })
  })
})
