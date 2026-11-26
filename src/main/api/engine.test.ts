// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ store: new Map<string, Map<string, string>>(), trusted: new Map<string, Set<string>>() }))

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9', getPath: () => '.' }, session: {} }))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))
vi.mock('../ipc/access', () => ({ assertAuthorized: async (p: string) => p, assertAuthorizedForMain: async (p: string) => p }))
vi.mock('./vault', () => ({
  secretVault: {
    get: async (s: string, n: string) => h.store.get(s)?.get(n),
    set: async (s: string, n: string, v: string) => {
      if (!h.store.has(s)) h.store.set(s, new Map())
      h.store.get(s)!.set(n, v)
    },
    names: async (s: string) => [...(h.store.get(s)?.keys() ?? [])]
  }
}))
vi.mock('./trust', () => ({
  isHostTrusted: async (scopes: Iterable<string>, host: string) => [...scopes].every((sc) => h.trusted.get(sc)?.has(host)),
  trustHost: async (scopes: Iterable<string>, host: string) => {
    for (const sc of scopes) h.trusted.set(sc, (h.trusted.get(sc) ?? new Set()).add(host))
  }
}))
vi.mock('./assert', () => ({
  evaluateResponse: async (tests: unknown[], extract: { path: string }[], r: { body: string; status: number }) => ({
    tests: tests.map((_t, index) => ({ index, passed: r.status === 200 })),
    extracted: extract.map((e) => (JSON.parse(r.body) as Record<string, string>)[e.path])
  })
}))

import { MASK, sendInputSchema } from '@shared/api/protocol'
import { getJar } from './cookies'
import { executeRequest } from './engine'
import { sendHttp } from './http'

interface Seen {
  method?: string
  url?: string
  headers: IncomingMessage['headers']
  body: Buffer
}
let server: Server
let base = ''
let last: Seen
const handlers = new Map<string, (req: IncomingMessage, res: ServerResponse) => void>()

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      last = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) }
      const hd = handlers.get((req.url ?? '').split('?')[0]!)
      if (hd) return hd(req, res)
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: true, token: 'abc123' }))
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
  h.store.clear()
  h.trusted.clear()
  handlers.clear()
})

const make = (over: Record<string, unknown> = {}, request: Record<string, unknown> = {}) =>
  sendInputSchema.parse({
    runId: randomUUID(),
    request: { $schema: 'meu-editor/api-request@1', id: 'r1', method: 'GET', url: `${base}/x`, ...request },
    ...over
  })
const hostOf = (): string => base.replace('http://', '')
const run = async (input = make(), extra = {}) => { const r = await executeRequest(input, { signal: new AbortController().signal, ...extra }); if (!r.ok && process.env.DBG) console.log('FALHA', r.code); return r }

describe('executeRequest', () => {
  it('GET com params, User-Agent e Accept padrão', async () => {
    const r = await run(make({}, { url: `${base}/x/:id?q=1`, params: [{ key: ':id', value: 'a b' }, { key: 'q', value: 'nao-anexa' }], responseType: 'json' }))
    expect(r.ok).toBe(true)
    expect(last.url).toBe('/x/a%20b?q=1')
    expect(last.headers['user-agent']).toBe('MeuEditorDeArquivos/9.9.9')
    expect(last.headers.accept).toBe('application/json')
    if (r.ok) {
      expect(r.status).toBe(200)
      expect(JSON.parse(r.body.text)).toMatchObject({ ok: true })
    }
  })

  it('JSON, urlencoded e multipart (com arquivo)', async () => {
    await run(make({}, { method: 'POST', body: { type: 'raw', language: 'json', text: '{"a":1}' } }))
    expect(last.headers['content-type']).toBe('application/json')
    expect(last.body.toString()).toBe('{"a":1}')

    await run(make({}, { method: 'POST', body: { type: 'urlencoded', fields: [{ key: 'a b', value: 'c&d' }] } }))
    expect(last.headers['content-type']).toBe('application/x-www-form-urlencoded')
    expect(last.body.toString()).toBe('a+b=c%26d')

    const dir = mkdtempSync(join(tmpdir(), 'apif-'))
    writeFileSync(join(dir, 'a.txt'), 'conteudo-arquivo')
    const parts = [{ kind: 'text', key: 'k', value: 'v' }, { kind: 'file', key: 'f', path: 'a.txt' }]
    // sem documentPath o caminho relativo é recusado
    expect(await run(make({}, { method: 'POST', body: { type: 'multipart', parts } }))).toMatchObject({ ok: false, code: 'fileNotFound' })
    const ok = await run(make({ documentPath: join(dir, 'r.apireq') }, { method: 'POST', body: { type: 'multipart', parts } }))
    expect(ok.ok).toBe(true)
    expect(last.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/)
    const text = last.body.toString()
    expect(text).toContain('name="k"\r\n\r\nv')
    expect(text).toContain('filename="a.txt"')
    expect(text).toContain('conteudo-arquivo')
  })

  it('GraphQL envia JSON {query, variables}', async () => {
    await run(make({}, { method: 'POST', body: { type: 'graphql', query: '{ a }', variables: '{"x":1}' } }))
    expect(JSON.parse(last.body.toString())).toEqual({ query: '{ a }', variables: { x: 1 } })
  })

  it('SOAP 1.1 usa text/xml e o cabeçalho SOAPAction; 1.2 põe a ação no Content-Type', async () => {
    const env = '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body/></soap:Envelope>'
    await run(make({}, { method: 'POST', body: { type: 'soap', version: '1.1', action: 'http://exemplo.com.br/Op', envelope: env } }))
    expect(last.headers['content-type']).toBe('text/xml; charset=utf-8')
    expect(last.headers.soapaction).toBe('"http://exemplo.com.br/Op"')
    expect(last.body.toString()).toBe(env)

    await run(make({}, { method: 'POST', body: { type: 'soap', version: '1.2', action: 'http://exemplo.com.br/Op', envelope: env } }))
    expect(last.headers['content-type']).toBe('application/soap+xml; charset=utf-8; action="http://exemplo.com.br/Op"')
    expect(last.headers.soapaction).toBeUndefined()
  })

  it('escopos: temporária > ambiente > coleção > globais, e variável que falta', async () => {
    h.store.set('globals', new Map([['g', 'GLOB'], ['v', 'glob-v']]))
    const r = await run(
      make(
        {
          confirmSecretHost: hostOf(),
          temporary: { t: 'TEMP' },
          environment: { id: 'e1', name: 'E', variables: [{ key: 'v', value: 'env-v' }, { key: 't', value: 'env-t' }] },
          collection: { id: 'c1', variables: [{ key: 'v', value: 'col-v' }, { key: 'c', value: 'COL' }] }
        },
        { headers: [{ key: 'X-A', value: '{{t}}|{{v}}|{{c}}|{{g}}|{{nao}}' }] }
      )
    )
    expect(last.headers['x-a']).toBe('TEMP|env-v|COL|GLOB|{{nao}}')
    expect(r.ok && r.missingVariables).toEqual(['nao'])
  })

  it('segredos vêm do cofre e saem mascarados em sentRequest', async () => {
    h.store.set('e1', new Map([['senha', 'S3gredo!']]))
    const r = await run(
      make(
        { confirmSecretHost: hostOf(), environment: { id: 'e1', name: 'E', variables: [{ key: 'senha', secret: true }] } },
        { url: `${base}/x?k={{senha}}`, headers: [{ key: 'X-Custom', value: 'pre-{{senha}}' }], auth: { type: 'bearer', token: '{{senha}}', prefix: 'Bearer' } }
      )
    )
    expect(last.headers['x-custom']).toBe('pre-S3gredo!')
    expect(last.headers.authorization).toBe('Bearer S3gredo!')
    expect(r.ok).toBe(true)
    if (r.ok) {
      const dump = JSON.stringify(r.sentRequest)
      expect(dump).not.toContain('S3gredo')
      expect(dump).toContain(MASK)
    }
  })

  it('autorização herdada da coleção, basic e apiKey na query', async () => {
    await run(make({ collection: { id: 'c1', variables: [], auth: { type: 'basic', username: 'u', password: 'p' } } }, { auth: { type: 'inherit' } }))
    expect(last.headers.authorization).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`)
    await run(make({}, { auth: { type: 'apiKey', key: 'api_key', value: 'zz', in: 'query' } }))
    expect(last.url).toBe('/x?api_key=zz')
  })

  it('produção exige confirmação em métodos de escrita', async () => {
    const env = { id: 'p', name: 'Prod', production: true, variables: [] }
    expect(await run(make({ environment: env }, { method: 'DELETE' }))).toMatchObject({ ok: false, code: 'productionNotConfirmed' })
    expect((await run(make({ environment: env }, { method: 'GET' }))).ok).toBe(true)
    expect((await run(make({ environment: env, productionConfirmed: true }, { method: 'DELETE' }))).ok).toBe(true)
  })

  it('esquemas e URLs inválidas', async () => {
    expect(await run(make({}, { url: 'file:///etc/passwd' }))).toMatchObject({ code: 'schemeNotAllowed' })
    expect(await run(make({}, { url: 'javascript:alert(1)' }))).toMatchObject({ code: 'schemeNotAllowed' })
    expect(await run(make({}, { url: 'ws://127.0.0.1/x' }))).toMatchObject({ code: 'schemeNotAllowed' })
    expect(await run(make({}, { url: 'http://{{x}}' }))).toMatchObject({ ok: false })
  })

  it('conexão recusada vira código traduzível', async () => {
    expect(await run(make({}, { url: 'http://127.0.0.1:1/' }))).toMatchObject({ ok: false, code: 'ECONNREFUSED' })
  })

  it('cookies: guarda Set-Cookie por ambiente e reenvia', async () => {
    handlers.set('/login', (_q, res) => {
      res.setHeader('Set-Cookie', ['sid=abc; Path=/; HttpOnly'])
      res.end('{}')
    })
    const env = { id: 'envCk', name: 'E', variables: [] }
    const a = await run(make({ environment: env }, { url: `${base}/login` }))
    expect(a.ok && a.cookies[0]).toMatchObject({ name: 'sid', value: 'abc', httpOnly: true })
    await run(make({ environment: env }, { url: `${base}/x` }))
    expect(last.headers.cookie).toBe('sid=abc')
    await run(make({}, { url: `${base}/x` }))
    expect(last.headers.cookie).toBeUndefined()
    await run(make({ environment: env }, { url: `${base}/x`, settings: { sendCookies: false } }))
    expect(last.headers.cookie).toBeUndefined()
    getJar('envCk').clear()
  })

  it('redirecionamento: 303 vira GET e o Authorization cai ao trocar de host', async () => {
    const other = createServer((req, res) => {
      last = { method: req.method, url: req.url, headers: req.headers, body: Buffer.alloc(0) }
      res.end('fim')
    })
    await new Promise<void>((r) => other.listen(0, '127.0.0.1', r))
    const otherPort = (other.address() as AddressInfo).port
    handlers.set('/a', (_q, res) => {
      res.statusCode = 303
      res.setHeader('Location', '/b')
      res.end()
    })
    handlers.set('/b', (_q, res) => res.end('b'))
    // "localhost" é outro host que 127.0.0.1; o servidor escuta em IPv4 e o Node tenta os dois endereços.
    handlers.set('/c', (_q, res) => {
      res.statusCode = 302
      res.setHeader('Location', `http://localhost:${otherPort}/z`)
      res.end()
    })
    const auth = { type: 'bearer', token: 'tok', prefix: 'Bearer' }
    const same = await run(make({}, { method: 'POST', url: `${base}/a`, auth, body: { type: 'raw', language: 'text', text: 'x' } }))
    expect(same.ok && same.redirects).toHaveLength(1)
    expect(last.method).toBe('GET')
    expect(last.headers.authorization).toBe('Bearer tok')
    const cross = await run(make({}, { url: `${base}/c`, auth }))
    expect(cross.ok && cross.body.text).toBe('fim')
    expect(last.headers.authorization).toBeUndefined()
    other.closeAllConnections()
    other.close()
    handlers.set('/loop', (_q, res) => {
      res.statusCode = 302
      res.setHeader('Location', '/loop')
      res.end()
    })
    expect(await run(make({}, { url: `${base}/loop`, settings: { maxRedirects: 2 } }))).toMatchObject({ code: 'tooManyRedirects' })
    const nofollow = await run(make({}, { url: `${base}/a`, settings: { followRedirects: false } }))
    expect(nofollow.ok && nofollow.status).toBe(303)
  })

  it('tempo limite e cancelamento', async () => {
    handlers.set('/slow', () => undefined)
    expect(await run(make({}, { url: `${base}/slow`, settings: { timeoutMs: 1000 } }))).toMatchObject({ code: 'timeout' })
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 100)
    expect(await executeRequest(make({}, { url: `${base}/slow` }), { signal: ac.signal })).toMatchObject({ code: 'cancelled' })
  })

  it('limite de tamanho e bomba gzip (depois de descomprimir)', async () => {
    handlers.set('/big', (_q, res) => res.end(Buffer.alloc(2000, 97)))
    handlers.set('/bomb', (_q, res) => {
      res.setHeader('Content-Encoding', 'gzip')
      res.end(gzipSync(Buffer.alloc(5_000_000, 0)))
    })
    const limits = { memoryBytes: 1000, displayBytes: 500 }
    expect(await run(make({}, { url: `${base}/big` }), { limits })).toMatchObject({ code: 'tooLarge' })
    expect(await run(make({}, { url: `${base}/bomb` }), { limits })).toMatchObject({ code: 'tooLarge' })
    const shown = await run(make({}, { url: `${base}/big` }), { limits: { memoryBytes: 10_000, displayBytes: 500 } })
    expect(shown.ok && shown.body.truncated).toBe(true)
    expect(shown.ok && shown.body.text).toHaveLength(500)
    expect(shown.ok && shown.size.body).toBe(2000)
  })

  it('descomprime gzip e informa o tamanho comprimido; binário vai em base64', async () => {
    handlers.set('/gz', (_q, res) => {
      res.setHeader('Content-Encoding', 'gzip')
      res.setHeader('Content-Type', 'text/plain')
      res.end(gzipSync('olá mundo'))
    })
    handlers.set('/img', (_q, res) => {
      res.setHeader('Content-Type', 'image/png')
      res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    })
    const g = await run(make({}, { url: `${base}/gz` }))
    expect(g.ok && g.body.text).toBe('olá mundo')
    expect(g.ok && g.size.compressed).toBeGreaterThan(0)
    const i = await run(make({}, { url: `${base}/img` }))
    expect(i.ok && i.body).toMatchObject({ encoding: 'base64', text: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64') })
  })

  it('saveToFile grava o corpo inteiro', async () => {
    handlers.set('/big', (_q, res) => res.end(Buffer.alloc(3000, 98)))
    const path = join(mkdtempSync(join(tmpdir(), 'apis-')), 'out.bin')
    const r = await run(make({ saveToFile: true }, { url: `${base}/big` }), { saveToPath: path, limits: { memoryBytes: 1000, displayBytes: 100 } })
    expect(r.ok && r.body.savedTo).toBe(path)
    expect(readFileSync(path)).toHaveLength(3000)
    expect(r.ok && r.body.truncated).toBe(true)
  })

  it('testes e extrações: secreta vai ao cofre sem voltar; comum volta em value', async () => {
    const r = await run(
      make(
        { environment: { id: 'e9', name: 'E', variables: [] } },
        {
          tests: [{ target: 'status', op: 'eq', expected: 200 }, { target: 'status', op: 'eq', expected: 1, enabled: false }],
          extract: [{ from: 'jsonPath', path: 'token', to: 'tok', secret: true }, { from: 'jsonPath', path: 'ok', to: 'plain' }]
        }
      )
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.tests).toEqual([{ index: 0, passed: true }])
      expect(r.extracted[0]).toEqual({ to: 'tok', secret: true, ok: true })
      expect(r.extracted[1]).toMatchObject({ to: 'plain', secret: false, ok: true })
    }
    expect(h.store.get('e9')?.get('tok')).toBe('abc123')
  })

  it('certificado autoassinado é recusado por padrão (e aceito sem verificar)', async () => {
    const { selfSigned } = await import('./testkit/selfSigned')
    const cert = selfSigned()
    if (!cert) return // sem openssl na máquina
    const https = await import('node:https')
    const srv = https.createServer({ key: cert.key, cert: cert.cert }, (_q, res) => res.end('seguro'))
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r))
    const url = `https://127.0.0.1:${(srv.address() as AddressInfo).port}/`
    expect(await run(make({}, { url }))).toMatchObject({ ok: false, code: 'DEPTH_ZERO_SELF_SIGNED_CERT' })
    const ok = await run(make({}, { url, settings: { verifyTls: false } }))
    expect(ok.ok && ok.tls).toMatchObject({ authorized: false })
    expect(ok.ok && ok.body.text).toBe('seguro')
    const h2 = await run(make({}, { url, settings: { verifyTls: false, http2: true } }))
    expect(h2.ok && h2.body.text).toBe('seguro')
    expect(h2.ok && h2.httpVersion).toBe('1.1') // o servidor não fala h2: volta para HTTP/1.1
    srv.closeAllConnections()
    srv.close()
  })
})

describe('segurança dos segredos', () => {
  const env = { id: 'e1', name: 'E', variables: [{ key: 'senha', secret: true }] }

  it('host não confirmado: recusa sem enviar, e a confirmação fica gravada', async () => {
    h.store.set('e1', new Map([['senha', 'S3gredo!']]))
    last = undefined as unknown as Seen
    const req = { headers: [{ key: 'X-Custom', value: '{{senha}}' }] }
    const bad = await run(make({ environment: env }, req))
    expect(bad).toMatchObject({ ok: false, code: 'secretHostNotConfirmed', host: hostOf() })
    expect(last).toBeUndefined()
    // Confirmação errada (outro host) não vale.
    expect(await run(make({ environment: env, confirmSecretHost: 'outro.exemplo.com.br' }, req))).toMatchObject({ code: 'secretHostNotConfirmed' })
    expect((await run(make({ environment: env, confirmSecretHost: hostOf() }, req))).ok).toBe(true)
    // Já confirmado: não precisa mais.
    expect((await run(make({ environment: env }, req))).ok).toBe(true)
  })

  it('sem segredo em uso, não pede confirmação', async () => {
    expect((await run(make({ environment: env }))).ok).toBe(true)
  })

  it('máscara no corpo, nos cabeçalhos da resposta e no actual dos testes', async () => {
    h.store.set('e1', new Map([['senha', 'S3gredo!']]))
    handlers.set('/eco', (_q, res) => {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('X-Eco', 'v=S3gredo!')
      res.end(JSON.stringify({ eco: 'S3gredo!' }))
    })
    const r = await run(make({ environment: env, confirmSecretHost: hostOf() }, { url: `${base}/eco`, headers: [{ key: 'X-Custom', value: '{{senha}}' }] }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.body.text).not.toContain('S3gredo')
      expect(r.body.text).toContain(MASK)
      expect(JSON.stringify(r.headers)).not.toContain('S3gredo')
    }
  })

  it('redirecionamento para outro host descarta X-Api-Key e cabeçalho com segredo', async () => {
    h.store.set('e1', new Map([['senha', 'S3gredo!']]))
    const other = createServer((req, res) => {
      last = { method: req.method, url: req.url, headers: req.headers, body: Buffer.alloc(0) }
      res.end('fim')
    })
    await new Promise<void>((r) => other.listen(0, '127.0.0.1', r))
    const otherPort = (other.address() as AddressInfo).port
    handlers.set('/c', (_q, res) => {
      res.statusCode = 302
      res.setHeader('Location', `http://localhost:${otherPort}/z`)
      res.end()
    })
    const r = await run(
      make(
        { environment: env, confirmSecretHost: hostOf() },
        { url: `${base}/c`, headers: [{ key: 'X-Api-Key', value: 'literal' }, { key: 'X-Meu', value: 'a-{{senha}}' }, { key: 'X-Livre', value: 'ok' }] }
      )
    )
    // Com segredo em uso, o redirecionamento para outro host não é seguido: nada chega ao outro servidor.
    expect(r.ok && r.status).toBe(302)
    expect(r.ok && r.body.text).not.toBe('fim')
    other.closeAllConnections()
    other.close()
  })

  it('proxy manual do documento também precisa ser host confirmado quando há segredo', async () => {
    h.store.set('e1', new Map([['senha', 'S3gredo!']]))
    last = undefined as unknown as Seen
    const req = { headers: [{ key: 'X-Custom', value: '{{senha}}' }], settings: { proxy: 'manual', proxyUrl: 'proxy.exemplo.com.br:3128' } }
    expect(await run(make({ environment: env, confirmSecretHost: hostOf() }, req))).toMatchObject({ ok: false, code: 'secretHostNotConfirmed', host: 'proxy.exemplo.com.br:3128' })
    expect(last).toBeUndefined()
  })

  it('saveToFile: acima do teto, apaga o arquivo e devolve tooLarge', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'apisave-')), 'out.bin')
    handlers.set('/big2', (_q, res) => res.end(Buffer.alloc(5000, 1)))
    const r = await run(make({ saveToFile: true }, { url: `${base}/big2` }), { saveToPath: path, limits: { memoryBytes: 1000, displayBytes: 100, fileBytes: 1000 } })
    expect(r).toMatchObject({ ok: false, code: 'tooLarge' })
    expect(existsSync(path)).toBe(false)
  })
})

describe('sendHttp direto', () => {
  it('esquema não permitido no destino', async () => {
    await expect(
      sendHttp({ method: 'GET', url: new URL('ftp://x/'), headers: [], settings: { timeoutMs: 1000, followRedirects: true, maxRedirects: 1, verifyTls: true, minTlsVersion: 'TLSv1.2', http2: false } })
    ).rejects.toMatchObject({ code: 'schemeNotAllowed' })
  })
})
