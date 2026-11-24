// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ store: new Map<string, Map<string, string>>(), userData: '' }))

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9', getPath: () => h.userData }, session: {} }))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))
vi.mock('../../ipc/access', () => ({ assertAuthorized: async (p: string) => p }))
vi.mock('../vault', () => ({
  secretVault: {
    get: async (s: string, n: string) => h.store.get(s)?.get(n),
    set: async (s: string, n: string, v: string) => {
      if (!h.store.has(s)) h.store.set(s, new Map())
      h.store.get(s)!.set(n, v)
    },
    names: async (s: string) => [...(h.store.get(s)?.keys() ?? [])]
  }
}))
vi.mock('../trust', () => ({ isHostTrusted: async () => true, trustHost: async () => undefined }))
vi.mock('../assert', () => ({ evaluateResponse: async () => ({ tests: [], extracted: [] }) }))
// Sem thread nos testes: o mesmo núcleo do sandbox, direto.
vi.mock('./index', async () => {
  const { runScriptCore } = await import('./core')
  const { maskOutput } = await import('./mask')
  return {
    runScript: async (input: Parameters<typeof runScriptCore>[0]) => {
      const out = await runScriptCore(input)
      const secrets = input.secretNames.map((n) => input.values[n]).filter((v): v is string => typeof v === 'string')
      return maskOutput(out, [...secrets, ...out.envSets.filter((e) => e.secret).map((e) => e.value)])
    }
  }
})

import { sendInputSchema } from '@shared/api/protocol'
import { executeRequest } from '../engine'
import { COLLECTION_FILE, resetScriptTrustCache, scriptHash, trustHashes, requestKeyOf, collectionKeyOf } from '../scriptTrust'

let server: Server
let base = ''
let last: { headers: IncomingMessage['headers']; body: string }
let hits = 0

beforeAll(async () => {
  h.userData = mkdtempSync(join(tmpdir(), 'apitrust-'))
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      hits++
      last = { headers: req.headers, body: Buffer.concat(chunks).toString() }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ id: 7, token: 'abc123' }))
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
  hits = 0
  h.userData = mkdtempSync(join(tmpdir(), 'apitrust-'))
  resetScriptTrustCache()
})

const make = (scripts: { pre?: string; post?: string } | undefined, over: Record<string, unknown> = {}, request: Record<string, unknown> = {}) =>
  sendInputSchema.parse({
    runId: randomUUID(),
    request: { $schema: 'meu-editor/api-request@1', id: 'r1', method: 'GET', url: `${base}/x`, ...(scripts ? { scripts: { pre: '', post: '', ...scripts } } : {}), ...request },
    ...over
  })
const run = (input: ReturnType<typeof make>) => executeRequest(input, { signal: new AbortController().signal })
const trust = (scripts: { pre?: string; post?: string }, key = 'doc-1') => trustHashes(requestKeyOf(key), [scriptHash(scripts.pre ?? '', scripts.post ?? '')])

describe('executeRequest com scripts', () => {
  it('sem scripts nada muda (e nenhuma confiança é consultada)', async () => {
    const r = await run(make(undefined))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.scriptTests).toBeUndefined()
      expect(r.scriptLogs).toBeUndefined()
    }
    const r2 = await run(make({ pre: '   ', post: '' }))
    expect(r2.ok).toBe(true)
  })

  it('script não confiado: nada é enviado e volta scriptsNotTrusted', async () => {
    const r = await run(make({ pre: "req.headers['X-A'] = '1'" }, { scriptKey: 'doc-1' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('scriptsNotTrusted')
    expect(hits).toBe(0)
  })

  it('o "antes" muda um cabeçalho e o "depois" aprova um teste', async () => {
    const scripts = {
      pre: "req.headers['X-Assinatura'] = crypto.sha256(req.url); console.log('indo para', req.method)",
      post: "pm.test('status 200', () => pm.response.to.have.status(200)); pm.environment.set('token', pm.response.json().token); console.log('token ok')"
    }
    await trust(scripts)
    const r = await run(make(scripts, { scriptKey: 'doc-1' }))
    expect(r.ok).toBe(true)
    expect(last.headers['x-assinatura']).toMatch(/^[0-9a-f]{64}$/)
    if (r.ok) {
      expect(r.scriptTests).toEqual([{ name: 'status 200', passed: true }])
      expect(r.scriptLogs?.map((l) => [l.phase, l.text])).toEqual([
        ['pre', 'indo para GET'],
        ['post', 'token ok']
      ])
      expect(r.extracted).toEqual([{ to: 'token', secret: false, ok: true, value: 'abc123' }])
      expect(r.sentRequest.headers.find((x) => x.key === 'X-Assinatura')).toBeTruthy()
    }
  })

  it('o "antes" muda método, URL e corpo; as variáveis do script valem no envio', async () => {
    const scripts = { pre: "vars.set('id', 42); req.method = 'POST'; req.url = req.url + '/itens/{{id}}'; req.body = JSON.stringify({ n: 1 })" }
    await trust(scripts)
    const r = await run(make(scripts, { scriptKey: 'doc-1' }, { body: { type: 'raw', language: 'json', text: '' } }))
    expect(r.ok).toBe(true)
    expect(last.body).toBe('{"n":1}')
    if (r.ok) expect(r.sentRequest.url).toContain('/x/itens/42')
  })

  it('erro no "antes" aborta o envio com o console e o código', async () => {
    const scripts = { pre: "console.log('a')\nnaoExiste()" }
    await trust(scripts)
    const r = await run(make(scripts, { scriptKey: 'doc-1' }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('scriptError')
      expect(r.scriptLogs?.[r.scriptLogs.length - 1]?.text).toMatch(/^script:2: ReferenceError/)
    }
    expect(hits).toBe(0)
  })

  it('laço infinito no "antes" vira scriptTimeout', async () => {
    const scripts = { pre: 'while (true) {}' }
    await trust(scripts)
    const r = await run(make(scripts, { scriptKey: 'doc-1' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('scriptTimeout')
  }, 20_000)

  it('erro no "depois" mantém a resposta e acrescenta um teste reprovado', async () => {
    const scripts = { post: 'naoExiste()' }
    await trust(scripts)
    const r = await run(make(scripts, { scriptKey: 'doc-1' }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.scriptTests).toEqual([{ name: 'script', passed: false, code: 'scriptError' }])
  })

  it('a confiança cai quando o script muda', async () => {
    await trust({ pre: "req.headers['X-A'] = '1'" })
    const ok = await run(make({ pre: "req.headers['X-A'] = '1'" }, { scriptKey: 'doc-1' }))
    expect(ok.ok).toBe(true)
    const changed = await run(make({ pre: "req.headers['X-A'] = '2'" }, { scriptKey: 'doc-1' }))
    expect(changed.ok).toBe(false)
    if (!changed.ok) expect(changed.code).toBe('scriptsNotTrusted')
  })

  it('confiança da coleção vale para as requisições dentro da pasta', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apicol-'))
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, COLLECTION_FILE), '{}')
    const scripts = { pre: "console.log('x')" }
    await trustHashes(collectionKeyOf(dir), [scriptHash(scripts.pre, '')])
    const r = await run(make(scripts, { documentPath: join(dir, 'sub', 'a.apireq') }))
    expect(r.ok).toBe(true)
    const other = await run(make(scripts, { documentPath: join(tmpdir(), 'fora', 'a.apireq') }))
    expect(other.ok).toBe(false)
  })

  it('segredo lido pelo script não aparece no console e o env.set secreto vai ao cofre', async () => {
    h.store.set('env1', new Map([['chave', 'S3GR3D0-LONGO']]))
    const scripts = { pre: "console.log('chave=' + env.get('chave')); req.headers['X-Chave'] = env.get('chave'); env.set('novo', 'zzz-segredo', { secret: true })" }
    await trust(scripts)
    const input = make(scripts, {
      scriptKey: 'doc-1',
      environment: { id: 'env1', name: 'Dev', variables: [{ key: 'chave', secret: true }] }
    })
    const r = await run(input)
    expect(r.ok).toBe(true)
    expect(last.headers['x-chave']).toBe('S3GR3D0-LONGO')
    expect(h.store.get('env1')?.get('novo')).toBe('zzz-segredo')
    if (r.ok) {
      expect(JSON.stringify(r)).not.toContain('S3GR3D0-LONGO')
      expect(r.scriptLogs?.[0]?.text).toBe('chave=••••••')
      expect(r.extracted).toEqual([{ to: 'novo', secret: true, ok: true }])
    }
  })
})
