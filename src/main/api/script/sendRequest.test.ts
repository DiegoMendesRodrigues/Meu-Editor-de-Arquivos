// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ store: new Map<string, Map<string, string>>(), trusted: true }))

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9', getPath: () => '' }, session: {} }))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))
vi.mock('../../ipc/access', () => ({ assertAuthorized: async (p: string) => p }))
vi.mock('../vault', () => ({
  secretVault: {
    get: async (s: string, n: string) => h.store.get(s)?.get(n),
    set: async () => undefined,
    names: async (s: string) => [...(h.store.get(s)?.keys() ?? [])]
  }
}))
vi.mock('../trust', () => ({ isHostTrusted: async () => h.trusted, trustHost: async () => undefined }))

import { runScriptCore } from './core'
import { createScriptSender } from './netSend'
import { buildResolver } from '../resolve'
import { runInWorker } from './runner'
import type { ScriptInput, ScriptNetReply, ScriptOutput, ScriptWorkerLike } from './types'

let server: Server
let base = ''
let hits: { method?: string; url?: string; headers: IncomingMessage['headers']; body: string }[] = []

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      hits.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() })
      const reply = (): void => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('X-Origem', 'teste')
        res.end(JSON.stringify({ token: 'tk-123', caminho: req.url, eco: Buffer.concat(chunks).toString() }))
      }
      if (req.url === '/lento') setTimeout(reply, 1500)
      else reply()
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => {
  server.closeAllConnections()
  server.close()
})
beforeEach(() => {
  hits = []
  h.trusted = true
  h.store.clear()
})

async function run(code: string, extra: Partial<ScriptInput> = {}, withSecret = false) {
  if (withSecret) h.store.set('env1', new Map([['token', 's3cr3t']]))
  const variables = [{ key: 'host', value: base, secret: false }, ...(withSecret ? [{ key: 'token', value: '', secret: true }] : [])]
  const r = await buildResolver({ environment: { id: 'env1', name: 'Teste', production: false, variables }, collection: null, temporary: {} })
  const snap = r.snapshot()
  const input: ScriptInput = {
    phase: 'post',
    code,
    cpuMs: 1000,
    memoryBytes: 32 * 1024 * 1024,
    maxLogLines: 1000,
    values: snap.values,
    secretNames: snap.secretNames,
    req: { method: 'GET', url: `${base}/x`, headers: [], body: '' },
    res: { status: 200, statusText: 'OK', headers: [], body: '{}', responseTime: 1 },
    ...extra
  }
  return runScriptCore(input, { send: createScriptSender(r) })
}

describe('pm.sendRequest', () => {
  it('string de URL (GET) com callback (err, res)', async () => {
    const out = await run(`
      pm.sendRequest('{{host}}/a?x=1', function (err, res) {
        pm.test('sem erro', function () { expect(err).to.equal(null) })
        pm.test('resposta', function () {
          expect(res.code).to.equal(200)
          expect(res.status).to.equal('OK')
          expect(res.headers.get('x-origem')).to.equal('teste')
          expect(res.json().caminho).to.equal('/a?x=1')
          expect(res.text()).to.contain('tk-123')
          expect(res.responseTime).to.be.a('number')
        })
      })`)
    expect(out.error).toBeUndefined()
    expect(out.tests.map((t) => [t.name, t.passed, t.error])).toEqual([['sem erro', true, undefined], ['resposta', true, undefined]])
    expect(hits).toHaveLength(1)
    expect(hits[0]!.method).toBe('GET')
    expect(hits[0]!.headers['user-agent']).toContain('MeuEditorDeArquivos')
  })

  it('objeto com POST JSON e cabeçalhos (lista e mapa)', async () => {
    const out = await run(`
      pm.sendRequest({ url: '{{host}}/login', method: 'post', header: [{ key: 'X-A', value: '1' }, { key: 'X-Off', value: '2', disabled: true }], body: { mode: 'raw', raw: JSON.stringify({ u: 'ana' }) } }, function (err, res) {
        pm.test('post', function () { expect(res.json().eco).to.equal('{"u":"ana"}') })
      })
      pm.sendRequest({ url: '{{host}}/f', method: 'POST', header: { 'X-B': '3' }, body: { mode: 'urlencoded', urlencoded: [{ key: 'a', value: 'b c' }] } }, function (err, res) {
        pm.test('form', function () { expect(res.json().eco).to.equal('a=b+c') })
      })`)
    expect(out.tests.map((t) => [t.name, t.passed])).toEqual([['post', true], ['form', true]])
    expect(hits[0]!.method).toBe('POST')
    expect(hits[0]!.headers['content-type']).toBe('application/json')
    expect(hits[0]!.headers['x-a']).toBe('1')
    expect(hits[0]!.headers['x-off']).toBeUndefined()
    expect(hits[1]!.headers['x-b']).toBe('3')
    expect(hits[1]!.headers['content-type']).toBe('application/x-www-form-urlencoded')
  })

  it('await devolve a resposta e usa o resultado no script', async () => {
    const out = await run(`
      (async function () {
        const res = await pm.sendRequest('{{host}}/token')
        pm.environment.set('tok', res.json().token)
        try { await pm.sendRequest('javascript:alert(1)') } catch (e) { console.log('erro', e.code) }
      })()`)
    expect(out.envSets).toEqual([{ name: 'tok', value: 'tk-123', secret: false }])
    expect(out.logs.map((l) => l.text)).toContain('erro schemeNotAllowed')
    expect(hits).toHaveLength(1)
  })

  it('o "antes" aplica no pedido o que o callback buscou', async () => {
    const out = await run(`pm.sendRequest('{{host}}/t', function (err, res) { req.headers['X-Token'] = res.json().token })`, { phase: 'pre', res: undefined })
    expect(out.req?.headers).toContainEqual(['X-Token', 'tk-123'])
  })

  it('erro de rede chega como err.code, sem mensagem crua', async () => {
    const out = await run(`
      pm.sendRequest('http://127.0.0.1:1/x', function (err, res) {
        pm.test('erro', function () { expect(res).to.equal(undefined); expect(err.code).to.equal('ECONNREFUSED'); expect(err.message).to.equal('ECONNREFUSED') })
      })`)
    expect(out.tests).toEqual([{ name: 'erro', passed: true }])
  })

  it('no máximo 10 chamadas por script', async () => {
    const out = await run(`
      var codes = []
      for (var i = 0; i < 12; i++) pm.sendRequest('{{host}}/n' + i, function (err) { codes.push(err ? err.code : 'ok'); if (codes.length === 12) console.log(codes.join(',')) })`)
    expect(hits).toHaveLength(10)
    const line = out.logs.map((l) => l.text).find((t) => t.includes('ok'))!
    expect(line.split(',').filter((c) => c === 'tooManyRequests')).toHaveLength(2)
  })

  it('host de segredo não confirmado: erro para o script e nada é enviado', async () => {
    h.trusted = false
    const out = await run(
      `
      pm.sendRequest({ url: '{{host}}/s', header: { Authorization: 'Bearer {{token}}' } }, function (err) { console.log('a', err && err.code) })
      pm.sendRequest({ url: '{{host}}/s', header: { Authorization: 'Bearer ' + env.get('token') } }, function (err) { console.log('b', err && err.code) })`,
      {},
      true
    )
    expect(hits).toHaveLength(0)
    expect(out.logs.map((l) => l.text)).toEqual(['a secretHostNotConfirmed', 'b secretHostNotConfirmed'])
  })

  it('host de segredo confirmado envia o valor', async () => {
    const out = await run(`pm.sendRequest({ url: '{{host}}/s', header: { Authorization: 'Bearer {{token}}' } }, function (err, res) { pm.test('ok', function () { expect(res.code).to.equal(200) }) })`, {}, true)
    expect(out.tests).toEqual([{ name: 'ok', passed: true }])
    expect(hits[0]!.headers.authorization).toBe('Bearer s3cr3t')
  })

  it('o tempo de rede não conta como CPU (resposta de 1,5 s com limite de 1 s)', async () => {
    const t0 = Date.now()
    const out = await run(`pm.sendRequest('{{host}}/lento', function (err, res) { pm.test('veio', function () { expect(res.code).to.equal(200) }) })`, { cpuMs: 1000 })
    expect(Date.now() - t0).toBeGreaterThanOrEqual(1400)
    expect(out.error).toBeUndefined()
    expect(out.tests).toEqual([{ name: 'veio', passed: true }])
  })

  it('laço de CPU depois da espera ainda estoura o limite', async () => {
    const out = await run(`pm.sendRequest('{{host}}/lento', function () { while (true) {} })`, { cpuMs: 300 })
    expect(out.error).toBe('scriptTimeout')
  })

  it('sem o host de envio, a chamada falha com invalidRequest', async () => {
    const out = await runScriptCore({
      phase: 'post',
      code: `pm.sendRequest('http://127.0.0.1/', function (err) { console.log(err.code) })`,
      cpuMs: 500,
      memoryBytes: 16 * 1024 * 1024,
      maxLogLines: 100,
      values: {},
      secretNames: [],
      req: { method: 'GET', url: 'http://x', headers: [], body: '' },
      res: { status: 200, statusText: 'OK', headers: [], body: '', responseTime: 1 }
    })
    expect(out.logs[0]!.text).toBe('invalidRequest')
  })
})

describe('runInWorker com pedidos de rede', () => {
  const ok: ScriptOutput = { ok: true, logs: [], tests: [], envSets: [], varSets: [], secretsRead: [] }
  const input = { phase: 'post', code: '', cpuMs: 100, memoryBytes: 1, maxLogLines: 1, values: {}, secretNames: [], req: { method: 'GET', url: '', headers: [], body: '' } } as ScriptInput

  it('repassa o pedido ao Main, devolve a resposta e amplia o prazo de parede', async () => {
    const replies: ScriptNetReply[] = []
    let onMessage: (m: ScriptOutput | { netRequest: number; json: string }) => void = () => undefined
    const worker: ScriptWorkerLike = {
      postMessage: (m) => {
        if ('netReply' in m) {
          replies.push(m)
          onMessage(ok)
        } else setTimeout(() => onMessage({ netRequest: 7, json: '{"a":1}' }), 20)
      },
      terminate: () => undefined,
      on: ((ev: string, fn: never) => {
        if (ev === 'message') onMessage = fn
      }) as ScriptWorkerLike['on']
    }
    // Prazo de parede de 60 ms; o envio leva 150 ms e só passa porque o pedido amplia o prazo.
    const out = await runInWorker(() => worker, input, 60, async (json) => {
      await new Promise((r) => setTimeout(r, 150))
      return `eco:${json}`
    }, 1000)
    expect(out.ok).toBe(true)
    expect(replies).toEqual([{ netReply: 7, json: 'eco:{"a":1}' }])
  })
})
