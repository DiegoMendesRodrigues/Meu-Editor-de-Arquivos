// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { EventEmitter } from 'node:events'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({ app: { getPath: () => h.dir } }))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))

import { DEFAULT_AI_SETTINGS, type AiChunk, type AiSettings } from '@shared/ai'
import { cancelOwned, startChat } from './generations'
import { checkHost, getStatus, streamChat } from './ollama'
import { readAiSettings, writeAiSettings } from './settings'

/** Servidor que imita o Ollama: /api/version, /api/tags e /api/chat em NDJSON. */
let server: Server
let base = ''
const requests: { path: string; body: string }[] = []
let chatHandler: (req: IncomingMessage, res: ServerResponse, body: { model: string }) => void = () => undefined

const send = (res: ServerResponse, obj: unknown): boolean => res.write(JSON.stringify(obj) + '\n')
const chunkLine = (content: string, done = false) => ({ model: 'm', message: { role: 'assistant', content }, done })

beforeAll(async () => {
  h.dir = mkdtempSync(join(tmpdir(), 'ai-test-'))
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      requests.push({ path: req.url ?? '', body: raw })
      if (req.url === '/api/version') return void res.end(JSON.stringify({ version: '0.5.1' }))
      if (req.url === '/api/tags') return void res.end(JSON.stringify({ models: [{ name: 'llama3.2:3b' }, { name: 'qwen2.5-coder:7b' }] }))
      if (req.url === '/api/chat') return chatHandler(req, res, JSON.parse(raw))
      res.statusCode = 404
      res.end()
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

const settings = (over: Partial<AiSettings> = {}): AiSettings => ({ ...DEFAULT_AI_SETTINGS, host: base, model: 'llama3.2:3b', ...over })

/** WebContents de mentira: recebe os pedaços e avisa quando é destruído. */
class FakeOwner extends EventEmitter {
  chunks: AiChunk[] = []
  destroyed = false
  send(_channel: string, chunk: AiChunk): void {
    this.chunks.push(chunk)
  }
  isDestroyed(): boolean {
    return this.destroyed
  }
}
const asOwner = (o: FakeOwner) => o as unknown as Electron.WebContents
const until = async (cond: () => boolean): Promise<void> => {
  for (let i = 0; i < 200 && !cond(); i++) await new Promise((r) => setTimeout(r, 10))
  expect(cond()).toBe(true)
}

describe('checkHost', () => {
  it('aceita só loopback por padrão', () => {
    expect(checkHost('http://127.0.0.1:11434', false)).toEqual({ ok: true, origin: 'http://127.0.0.1:11434' })
    expect(checkHost('http://localhost:11434/', false).ok).toBe(true)
    expect(checkHost('http://[::1]:11434', false).ok).toBe(true)
    expect(checkHost('http://192.168.0.10:11434', false)).toEqual({ ok: false, code: 'hostNotAllowed' })
    expect(checkHost('https://ia.exemplo.com.br', false)).toEqual({ ok: false, code: 'hostNotAllowed' })
  })
  it('libera host remoto só com a opção, e só http/https sem credenciais', () => {
    expect(checkHost('https://ia.exemplo.com.br', true).ok).toBe(true)
    expect(checkHost('ftp://127.0.0.1', true)).toEqual({ ok: false, code: 'invalidSettings' })
    expect(checkHost('file:///etc/passwd', true).ok).toBe(false)
    expect(checkHost('http://u:p@127.0.0.1', true).ok).toBe(false)
    expect(checkHost('isso não é url', true).ok).toBe(false)
  })
})

describe('getStatus', () => {
  it('lê a versão e a lista de modelos', async () => {
    expect(await getStatus(settings())).toEqual({ ok: true, version: '0.5.1', models: ['llama3.2:3b', 'qwen2.5-coder:7b'] })
  })
  it('sem servidor: ollamaNotRunning', async () => {
    const s = createServer()
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r))
    const port = (s.address() as AddressInfo).port
    await new Promise<void>((r) => s.close(() => r()))
    expect(await getStatus(settings({ host: `http://127.0.0.1:${port}` }))).toMatchObject({ ok: false, code: 'ollamaNotRunning', models: [] })
  })
  it('host remoto sem permissão: hostNotAllowed, sem tocar a rede', async () => {
    const before = requests.length
    expect(await getStatus(settings({ host: 'http://203.0.113.5:11434' }))).toMatchObject({ ok: false, code: 'hostNotAllowed' })
    expect(requests.length).toBe(before)
  })
  it('servidor que não responde a tempo: timeout', async () => {
    const slow = createServer(() => undefined)
    await new Promise<void>((r) => slow.listen(0, '127.0.0.1', r))
    const port = (slow.address() as AddressInfo).port
    const r = await getStatus(settings({ host: `http://127.0.0.1:${port}` }), { connectMs: 80, idleMs: 80 })
    slow.closeAllConnections()
    await new Promise<void>((res) => slow.close(() => res()))
    expect(r).toMatchObject({ ok: false, code: 'timeout' })
  })
})

describe('streamChat', () => {
  it('entrega os pedaços em streaming e envia modelo, mensagens e temperatura', async () => {
    chatHandler = (_req, res) => {
      send(res, chunkLine('Olá'))
      setTimeout(() => {
        send(res, chunkLine(', mundo'))
        send(res, chunkLine('', true))
        res.end()
      }, 20)
    }
    const parts: string[] = []
    const r = await streamChat(settings({ temperature: 0.2 }), [{ role: 'user', content: 'oi' }], (t) => parts.push(t), new AbortController().signal)
    expect(r).toEqual({ ok: true })
    expect(parts).toEqual(['Olá', ', mundo'])
    const sent = JSON.parse(requests.filter((q) => q.path === '/api/chat').at(-1)!.body)
    expect(sent).toMatchObject({ model: 'llama3.2:3b', stream: true, options: { temperature: 0.2 }, messages: [{ role: 'user', content: 'oi' }] })
  })
  it('junta linhas partidas entre pedaços de rede', async () => {
    chatHandler = (_req, res) => {
      const line = JSON.stringify(chunkLine('inteiro')) + '\n' + JSON.stringify(chunkLine('', true)) + '\n'
      res.write(line.slice(0, 15))
      setTimeout(() => {
        res.write(line.slice(15))
        res.end()
      }, 20)
    }
    const parts: string[] = []
    expect(await streamChat(settings(), [{ role: 'user', content: 'x' }], (t) => parts.push(t), new AbortController().signal)).toEqual({ ok: true })
    expect(parts).toEqual(['inteiro'])
  })
  it('cancelamento encerra sem erro', async () => {
    chatHandler = (_req, res) => void send(res, chunkLine('começo'))
    const ctl = new AbortController()
    const parts: string[] = []
    const p = streamChat(settings(), [{ role: 'user', content: 'x' }], (t) => (parts.push(t), ctl.abort()), ctl.signal)
    expect(await p).toEqual({ ok: true })
    expect(parts).toEqual(['começo'])
  })
  it('modelo inexistente (404): modelNotFound, sem repassar a mensagem do servidor', async () => {
    chatHandler = (_req, res) => {
      res.statusCode = 404
      res.end(JSON.stringify({ error: "model 'xyz' not found" }))
    }
    expect(await streamChat(settings({ model: 'xyz' }), [{ role: 'user', content: 'x' }], () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'modelNotFound' })
  })
  it('sem modelo escolhido: modelNotFound', async () => {
    expect(await streamChat(settings({ model: '' }), [{ role: 'user', content: 'x' }], () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'modelNotFound' })
  })
  it('erro no meio do stream: unknown', async () => {
    chatHandler = (_req, res) => {
      send(res, chunkLine('a'))
      send(res, { error: 'segredo interno do servidor' })
      res.end()
    }
    expect(await streamChat(settings(), [{ role: 'user', content: 'x' }], () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'unknown' })
  })
  it('stream que acaba sem "done": unknown', async () => {
    chatHandler = (_req, res) => {
      send(res, chunkLine('a'))
      res.end()
    }
    expect(await streamChat(settings(), [{ role: 'user', content: 'x' }], () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'unknown' })
  })
  it('inatividade do stream: timeout', async () => {
    chatHandler = (_req, res) => void send(res, chunkLine('a'))
    const r = await streamChat(settings(), [{ role: 'user', content: 'x' }], () => undefined, new AbortController().signal, { connectMs: 1000, idleMs: 80 })
    expect(r).toEqual({ ok: false, code: 'timeout' })
  })
  it('host não permitido: hostNotAllowed', async () => {
    expect(await streamChat(settings({ host: 'http://10.0.0.5:11434' }), [{ role: 'user', content: 'x' }], () => undefined, new AbortController().signal)).toEqual({ ok: false, code: 'hostNotAllowed' })
  })
  it('redirecionamento não é seguido', async () => {
    chatHandler = (_req, res) => {
      res.statusCode = 307
      res.setHeader('Location', 'http://203.0.113.9/api/chat')
      res.end()
    }
    const r = await streamChat(settings(), [{ role: 'user', content: 'x' }], () => undefined, new AbortController().signal)
    expect(r.ok).toBe(false)
  })
})

describe('startChat (gerações por janela)', () => {
  const msg = (id: string, content = 'oi') => ({ id, messages: [{ role: 'user', content }] })

  it('envia os pedaços ao dono e termina com done', async () => {
    chatHandler = (_req, res) => {
      send(res, chunkLine('abc'))
      send(res, chunkLine('', true))
      res.end()
    }
    const owner = new FakeOwner()
    expect(startChat(asOwner(owner), msg('g1'), settings())).toEqual({ ok: true })
    await until(() => owner.chunks.some((c) => c.done))
    expect(owner.chunks).toEqual([
      { id: 'g1', text: 'abc', done: false },
      { id: 'g1', text: '', done: true }
    ])
  })
  it('reporta erro por código no evento final', async () => {
    chatHandler = (_req, res) => {
      res.statusCode = 404
      res.end('{"error":"model not found"}')
    }
    const owner = new FakeOwner()
    startChat(asOwner(owner), msg('g2'), settings())
    await until(() => owner.chunks.some((c) => c.done))
    expect(owner.chunks.at(-1)).toEqual({ id: 'g2', text: '', done: true, code: 'modelNotFound' })
  })
  it('recusa contexto grande demais e entrada inválida', () => {
    const owner = new FakeOwner()
    expect(startChat(asOwner(owner), msg('g3', 'x'.repeat(200_001)), settings())).toEqual({ ok: false, code: 'tooLarge' })
    expect(startChat(asOwner(owner), { id: '../x', messages: [] }, settings())).toEqual({ ok: false, code: 'unknown' })
  })
  it('no máximo 2 gerações por janela e cancelamento ao fechar', async () => {
    chatHandler = (_req, res) => void send(res, chunkLine('…'))
    const owner = new FakeOwner()
    expect(startChat(asOwner(owner), msg('a1'), settings()).ok).toBe(true)
    expect(startChat(asOwner(owner), msg('a2'), settings()).ok).toBe(true)
    expect(startChat(asOwner(owner), msg('a3'), settings())).toEqual({ ok: false, code: 'tooManyGenerations' })
    expect(startChat(asOwner(owner), msg('a1'), settings())).toEqual({ ok: false, code: 'tooManyGenerations' })
    // Outra janela tem a própria cota.
    const other = new FakeOwner()
    expect(startChat(asOwner(other), msg('b1'), settings()).ok).toBe(true)
    owner.destroyed = true
    owner.emit('destroyed')
    other.destroyed = true
    cancelOwned(asOwner(other))
    // Libera a cota: uma nova janela volta a poder gerar.
    const fresh = new FakeOwner()
    expect(startChat(asOwner(fresh), msg('c1'), settings()).ok).toBe(true)
    cancelOwned(asOwner(fresh))
  })
})

describe('configuração em disco', () => {
  it('grava e lê; arquivo inválido ou host indevido volta ao padrão local', async () => {
    expect(await readAiSettings()).toEqual(DEFAULT_AI_SETTINGS)
    const s: AiSettings = { host: 'http://localhost:11434', model: 'llama3.2:3b', temperature: 1.1, allowRemote: false }
    await writeAiSettings(s)
    expect(await readAiSettings()).toEqual(s)
    writeFileSync(join(h.dir, 'ai-settings.json'), JSON.stringify({ host: 'http://203.0.113.5:1', model: 'x', temperature: 0.3, allowRemote: false }))
    expect(await readAiSettings()).toMatchObject({ host: DEFAULT_AI_SETTINGS.host, model: 'x', temperature: 0.3 })
    writeFileSync(join(h.dir, 'ai-settings.json'), '{ quebrado')
    expect(await readAiSettings()).toEqual(DEFAULT_AI_SETTINGS)
    writeFileSync(join(h.dir, 'ai-settings.json'), JSON.stringify({ temperature: 9 }))
    expect(await readAiSettings()).toEqual(DEFAULT_AI_SETTINGS)
    expect(readFileSync(join(h.dir, 'ai-settings.json'), 'utf8')).toContain('temperature')
  })
})
