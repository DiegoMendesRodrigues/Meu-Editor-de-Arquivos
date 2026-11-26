// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import {
  apiCollectionSchema,
  apiEnvironmentSchema,
  isAllowedUrl,
  newApiRequest,
  parseApiRequest,
  savedResponseSchema,
  serializeApiRequest,
  type ApiRequest
} from './schema'
import { API_LIMITS } from './limits'

const example = {
  $schema: 'meu-editor/api-request@1',
  id: '8f0c2b7e-5d1a-4b8e-9a63-2f4c1d7e9b10',
  name: 'Listar produtos',
  method: 'get',
  url: '{{baseUrl}}/produtos',
  params: [{ key: 'pagina', value: '2' }, { key: 'categoria', value: '', enabled: false }],
  headers: [{ key: 'Accept', value: 'application/json' }],
  tests: [
    { target: 'status', op: 'eq', expected: 200 },
    { target: 'jsonPath', path: '$.itens', op: 'lengthGt', expected: 0 }
  ],
  extract: [{ from: 'jsonPath', path: '$.proximaPagina', to: 'proximaPagina' }]
}

const parse = (value: unknown) => parseApiRequest(typeof value === 'string' ? value : JSON.stringify(value))
const ok = (value: unknown): ApiRequest => {
  const r = parse(value)
  if (!r.ok) throw new Error(JSON.stringify(r.error))
  return r.request
}

describe('arquivo .apireq', () => {
  it('lê o exemplo do plano, completa os padrões e põe o método em maiúsculas', () => {
    const req = ok(example)
    expect(req.method).toBe('GET')
    expect(req.params[0]).toEqual({ key: 'pagina', value: '2', enabled: true })
    expect(req.auth).toEqual({ type: 'inherit' })
    expect(req.body).toEqual({ type: 'none' })
    expect(req.settings).toMatchObject({ timeoutMs: 30_000, verifyTls: true, followRedirects: true, maxRedirects: 10 })
    expect(req.extract[0]).toMatchObject({ to: 'proximaPagina', secret: false })
    expect(req.scripts).toBeUndefined()
  })

  it('grava com as chaves sempre na mesma ordem, e ler de novo dá o mesmo texto', () => {
    const shuffled = Object.fromEntries(Object.entries(example).reverse())
    const a = serializeApiRequest(ok(example))
    const b = serializeApiRequest(ok(shuffled))
    expect(a).toBe(b)
    expect(serializeApiRequest(ok(a))).toBe(a)
    expect(Object.keys(JSON.parse(a)).slice(0, 5)).toEqual(['$schema', 'id', 'name', 'method', 'url'])
    expect(a.endsWith('}\n')).toBe(true)
  })

  it('texto vazio vira uma requisição nova', () => {
    const req = ok('   ')
    expect(req.method).toBe('GET')
    expect(req.url).toBe('')
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('cada requisição nova tem um id diferente', () => {
    expect(newApiRequest().id).not.toBe(newApiRequest().id)
    expect(newApiRequest('Teste').name).toBe('Teste')
  })

  it('recusa JSON inválido, outros JSON e versões futuras com códigos conhecidos', () => {
    expect(parse('{ quebrado')).toMatchObject({ ok: false, error: { code: 'json' } })
    expect(parse([1, 2])).toEqual({ ok: false, error: { code: 'notRequest' } })
    expect(parse({ name: 'sem schema' })).toEqual({ ok: false, error: { code: 'notRequest' } })
    expect(parse({ ...example, $schema: 'meu-editor/api-request@9' })).toEqual({ ok: false, error: { code: 'newerVersion', version: 9 } })
  })

  it('aponta o campo inválido', () => {
    const r = parse({ ...example, settings: { timeoutMs: 10 } })
    expect(r).toMatchObject({ ok: false, error: { code: 'invalid' } })
    if (!r.ok && r.error.code === 'invalid') expect(r.error.detail).toBe('settings.timeoutMs')
    expect(parse({ ...example, method: 'GET /x' })).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect(parse({ ...example, auth: { type: 'kerberos' } })).toMatchObject({ ok: false, error: { code: 'invalid' } })
  })

  it('respeita os limites de tamanho', () => {
    expect(parse({ ...example, url: 'x'.repeat(API_LIMITS.urlChars + 1) })).toMatchObject({ ok: false, error: { code: 'invalid' } })
    const rows = Array.from({ length: API_LIMITS.keyValueRows + 1 }, (_, i) => ({ key: `k${i}` }))
    expect(parse({ ...example, headers: rows })).toMatchObject({ ok: false, error: { code: 'invalid' } })
    expect(parseApiRequest(' '.repeat(API_LIMITS.requestFileChars + 1))).toEqual({ ok: false, error: { code: 'tooLarge' } })
  })

  it('aceita os tipos de autorização e de corpo previstos', () => {
    expect(ok({ ...example, auth: { type: 'bearer', token: '{{token}}' } }).auth).toEqual({ type: 'bearer', token: '{{token}}', prefix: 'Bearer' })
    expect(ok({ ...example, auth: { type: 'oauth2', tokenUrl: 'https://auth/token', clientId: 'app' } }).auth).toMatchObject({ flow: 'authorizationCode', pkce: true, tokenVar: 'token' })
    expect(ok({ ...example, body: { type: 'raw', text: '{"a":1}' } }).body).toEqual({ type: 'raw', language: 'json', text: '{"a":1}' })
    expect(ok({ ...example, body: { type: 'multipart', parts: [{ kind: 'file', key: 'f', path: 'C:/a.png' }] } }).body).toMatchObject({ type: 'multipart' })
  })
})

describe('ambiente, coleção e resposta salva', () => {
  const env = { $schema: 'meu-editor/api-environment@1', id: 'c3d1', name: 'Homologação' }

  it('variáveis secretas não podem ter valor no arquivo', () => {
    expect(apiEnvironmentSchema.safeParse({ ...env, variables: [{ key: 'token', secret: true }] }).success).toBe(true)
    expect(apiEnvironmentSchema.safeParse({ ...env, variables: [{ key: 'token', secret: true, value: 'abc' }] }).success).toBe(false)
  })

  it('recusa variáveis repetidas e nomes inválidos', () => {
    expect(apiEnvironmentSchema.safeParse({ ...env, variables: [{ key: 'a', value: '1' }, { key: 'a', value: '2' }] }).success).toBe(false)
    expect(apiEnvironmentSchema.safeParse({ ...env, variables: [{ key: 'com espaço', value: '1' }] }).success).toBe(false)
  })

  it('coleção começa sem autorização e sem sincronizar respostas', () => {
    const col = apiCollectionSchema.parse({ $schema: 'meu-editor/api-collection@1', id: 'x', name: 'Loja' })
    expect(col).toMatchObject({ auth: { type: 'none' }, syncResponses: false, order: [] })
  })

  it('resposta salva aceita corpo em texto ou em arquivo ao lado', () => {
    const base = {
      $schema: 'meu-editor/api-response@1', requestId: 'r1', sentAt: '2026-11-24T10:42:12Z',
      request: { method: 'GET', url: 'https://h/p', headers: [] }, status: 200, statusText: 'OK', httpVersion: '1.1',
      headers: [], timings: { dns: 1, tcp: 2, tls: 3, firstByte: 50, download: 4, total: 60 }, size: { headers: 120, body: 3400 }
    }
    expect(savedResponseSchema.safeParse({ ...base, body: { encoding: 'utf8', text: '{}' } }).success).toBe(true)
    expect(savedResponseSchema.safeParse({ ...base, body: { file: 'corpo.bin' } }).success).toBe(true)
    expect(savedResponseSchema.safeParse({ ...base, status: 42, body: { file: 'x' } }).success).toBe(false)
  })
})

describe('URLs permitidas', () => {
  it('aceita http, https, ws e wss e recusa os demais esquemas', () => {
    expect(['http://localhost:3000', 'https://api.exemplo.com.br/v1', 'ws://h', 'wss://h/x'].every(isAllowedUrl)).toBe(true)
    expect(['file:///C:/x', 'data:text/plain,a', 'javascript:alert(1)', 'ftp://h', '{{baseUrl}}/x', ''].some(isAllowedUrl)).toBe(false)
  })
})
