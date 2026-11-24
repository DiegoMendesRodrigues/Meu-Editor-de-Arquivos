// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { exportCurl } from '../export/curl'
import { exportHar } from '../export/har'
import { exportHttp } from '../export/http'
import { exportOpenApi } from '../export/openapi'
import { exportPostman } from '../export/postman'
import type { ExportInput } from '../export/types'
import type { ApiImportResult } from '../protocol'
import { apiRequestSchema, newApiRequest, type ApiRequest } from '../schema'
import { detectFormat, parseImport } from './index'

function ok(text: string, format: Parameters<typeof parseImport>[1] = 'auto'): ApiImportResult {
  const r = parseImport(text, format)
  if (!r.ok) throw new Error(`falhou: ${r.code}`)
  return r
}

const req = (patch: Partial<ApiRequest>): ApiRequest => apiRequestSchema.parse({ ...newApiRequest('x'), ...patch })

describe('importar curl', () => {
  it('bash: método, cabeçalhos, JSON e continuação de linha', () => {
    const r = ok(`curl -X POST 'https://api.exemplo.com.br/v1/itens?page=2&q=a%20b' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer {{token}}' \\
  --data-raw '{"nome":"caneta","qtd":2}' -k -L`)
    expect(r.format).toBe('curl')
    const q = r.items[0]!.request
    expect(q.method).toBe('POST')
    expect(q.url).toBe('https://api.exemplo.com.br/v1/itens?page=2&q=a%20b')
    expect(q.params.map((p) => [p.key, p.value])).toEqual([['page', '2'], ['q', 'a b']])
    expect(q.auth).toEqual({ type: 'bearer', token: '{{token}}', prefix: 'Bearer' })
    expect(q.body).toEqual({ type: 'raw', language: 'json', text: '{"nome":"caneta","qtd":2}' })
    expect(q.settings.verifyTls).toBe(false)
    expect(q.settings.followRedirects).toBe(true)
    expect(q.headers.find((h) => h.key === 'Authorization')).toBeUndefined()
  })

  it('bash: -u vira autorização básica e -d sem método vira POST de formulário', () => {
    const q = ok(`curl -u maria:{{senha}} -d 'a=1&b=dois' https://127.0.0.1:8080/login`).items[0]!.request
    expect(q.auth).toEqual({ type: 'basic', username: 'maria', password: '{{senha}}' })
    expect(q.method).toBe('POST')
    expect(q.body).toMatchObject({ type: 'urlencoded', fields: [{ key: 'a', value: '1' }, { key: 'b', value: 'dois' }] })
  })

  it('bash: aspa simples escapada e multipart com arquivo', () => {
    const q = ok(`curl https://127.0.0.1/up -F 'nome=Jo'\\''ao' -F 'arq=@/tmp/a.txt;type=text/plain'`).items[0]!.request
    expect(q.body).toMatchObject({ type: 'multipart', parts: [{ kind: 'text', key: 'nome', value: "Jo'ao" }, { kind: 'file', key: 'arq', path: '/tmp/a.txt' }] })
  })

  it('PowerShell com curl.exe e crase de continuação', () => {
    const r = ok("curl.exe -X PUT 'https://127.0.0.1/p/1' `\n  -H 'X-Teste: it''s' `\n  --data-raw '{\"a\":1}'")
    const q = r.items[0]!.request
    expect(q.method).toBe('PUT')
    expect(q.headers).toMatchObject([{ key: 'X-Teste', value: "it's" }])
    expect(q.body).toMatchObject({ type: 'raw', text: '{"a":1}' })
  })

  it('cmd do Windows com ^ e aspas escapadas', () => {
    const q = ok('curl ^"https://127.0.0.1/api^" ^\n  -H ^"content-type: application/json^" ^\n  --data-raw ^"^{^\\^"a^\\^":1^}^"').items[0]!.request
    expect(q.url).toBe('https://127.0.0.1/api')
    expect(q.body).toEqual({ type: 'raw', language: 'json', text: '{"a":1}' })
  })

  it('vários comandos viram várias requisições e opção desconhecida gera aviso', () => {
    const r = ok('curl https://127.0.0.1/a\ncurl --foo-bar -I https://127.0.0.1/b')
    expect(r.items.map((i) => i.request.method)).toEqual(['GET', 'HEAD'])
    expect(r.warnings).toContain('unsupportedOption')
  })

  it('ida e volta: exportar curl bash e PowerShell e importar de novo', () => {
    const original = req({
      name: 'Criar',
      method: 'POST',
      url: 'https://api.exemplo.com.br/itens?v=1',
      params: [{ key: 'v', value: '1', enabled: true }],
      headers: [{ key: 'X-Id', value: "a'b", enabled: true }],
      auth: { type: 'bearer', token: '{{token}}', prefix: 'Bearer' },
      body: { type: 'raw', language: 'json', text: '{"a":"b c"}' },
      settings: { ...newApiRequest().settings, followRedirects: true }
    })
    const input: ExportInput = { name: 'c', variables: [], items: [{ folder: '', request: original }] }
    for (const shell of ['bash', 'powershell'] as const) {
      const back = ok(exportCurl(input, shell).replace(/^# .*\n/, '')).items[0]!.request
      expect(back.method).toBe('POST')
      expect(back.url).toBe(original.url)
      expect(back.params[0]).toMatchObject({ key: 'v', value: '1' })
      expect(back.auth).toMatchObject({ type: 'bearer', token: '{{token}}' })
      expect(back.body).toMatchObject({ type: 'raw', text: '{"a":"b c"}' })
      expect(back.headers.find((h) => h.key === 'X-Id')?.value).toBe("a'b")
    }
  })
})

describe('Postman 2.1', () => {
  const colecao = JSON.stringify({
    info: { name: 'Loja', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
    variable: [{ key: 'baseUrl', value: 'https://api.exemplo.com.br' }],
    item: [
      {
        name: 'Produtos',
        item: [
          {
            name: 'Listar',
            request: { method: 'GET', header: [{ key: 'Accept', value: 'application/json' }], url: { raw: '{{baseUrl}}/produtos?limite=10&x=1', query: [{ key: 'limite', value: '10' }, { key: 'x', value: '1', disabled: true }] } },
            event: [{ listen: 'test', script: { exec: ['pm.test("ok", () => {});'] } }]
          },
          {
            name: 'Criar',
            request: { method: 'POST', auth: { type: 'basic', basic: [{ key: 'username', value: 'u' }, { key: 'password', value: '{{p}}' }] }, url: '{{baseUrl}}/produtos', body: { mode: 'raw', raw: '{"a":1}', options: { raw: { language: 'json' } } } }
          }
        ]
      },
      { name: 'Raiz', request: { method: 'DELETE', url: { raw: '{{baseUrl}}/x' }, auth: { type: 'oauth1' } } }
    ]
  })

  it('pastas, autorização herdada, variáveis e scripts guardados', () => {
    const r = ok(colecao)
    expect(r.format).toBe('postman')
    expect(r.name).toBe('Loja')
    expect(r.variables).toEqual([{ key: 'baseUrl', value: 'https://api.exemplo.com.br' }])
    expect(r.items.map((i) => [i.folder, i.request.name])).toEqual([['Produtos', 'Listar'], ['Produtos', 'Criar'], ['', 'Raiz']])
    const listar = r.items[0]!.request
    expect(listar.url).toBe('{{baseUrl}}/produtos?limite=10')
    expect(listar.params).toMatchObject([{ key: 'limite', enabled: true }, { key: 'x', enabled: false }])
    expect(listar.auth).toMatchObject({ type: 'bearer', token: '{{token}}' })
    expect(listar.scripts).toEqual({ pre: '', post: 'pm.test("ok", () => {});' })
    expect(r.items[1]!.request.auth).toMatchObject({ type: 'basic', username: 'u' })
    expect(r.items[1]!.request.body).toMatchObject({ type: 'raw', language: 'json' })
    expect(r.warnings).toEqual(expect.arrayContaining(['scriptsStored', 'unsupportedAuth']))
  })

  it('ambiente do Postman: segredos sem valor', () => {
    const r = ok(JSON.stringify({ name: 'Homolog', _postman_variable_scope: 'environment', values: [{ key: 'host', value: 'h', enabled: true }, { key: 'chave', value: 'segredo', type: 'secret', enabled: true }] }))
    expect(r.environments).toHaveLength(1)
    expect(r.environments[0]!.variables).toEqual([{ key: 'host', value: 'h', secret: false }, { key: 'chave', secret: true }])
  })

  it('ida e volta: exportar v2.1 e importar mantém pastas e dados', () => {
    const a = ok(colecao)
    const input: ExportInput = { name: a.name, variables: a.variables, items: a.items }
    const text = exportPostman(input)
    expect(JSON.parse(text).info.schema).toContain('v2.1.0')
    const b = ok(text)
    expect(b.items.map((i) => [i.folder, i.request.name, i.request.method, i.request.url])).toEqual(a.items.map((i) => [i.folder, i.request.name, i.request.method, i.request.url]))
    expect(b.items[0]!.request.params).toEqual(a.items[0]!.request.params)
    expect(b.items[1]!.request.auth).toEqual(a.items[1]!.request.auth)
    expect(b.items[0]!.request.scripts?.post).toContain('pm.test')
    expect(b.variables).toEqual(a.variables)
  })
})

describe('OpenAPI e Swagger', () => {
  const yamlDoc = `openapi: 3.1.0
info: { title: Catálogo, version: '1.0' }
servers:
  - url: https://api.exemplo.com.br/v1
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer }
paths:
  /produtos/{id}:
    get:
      tags: [Produtos]
      summary: Buscar produto
      parameters:
        - { name: id, in: path, required: true, schema: { type: string } }
        - { name: detalhe, in: query, schema: { type: boolean, default: true } }
      security: [{ bearerAuth: [] }]
      responses:
        '200': { description: ok }
  /produtos:
    post:
      operationId: criarProduto
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                nome: { type: string, example: Caneta }
                preco: { type: number }
      responses:
        '201': { description: criado }
`

  it('OpenAPI 3.1 em YAML: uma requisição por operação', () => {
    const r = ok(yamlDoc)
    expect(r.format).toBe('openapi')
    expect(r.variables).toEqual([{ key: 'baseUrl', value: 'https://api.exemplo.com.br/v1' }])
    const buscar = r.items.find((i) => i.request.name === 'Buscar produto')!
    expect(buscar.folder).toBe('Produtos')
    expect(buscar.request.url).toBe('{{baseUrl}}/produtos/:id')
    expect(buscar.request.params).toMatchObject([{ key: 'detalhe', value: 'true', enabled: false }])
    expect(buscar.request.auth).toMatchObject({ type: 'bearer' })
    expect(buscar.request.tests).toMatchObject([{ target: 'status', op: 'eq', expected: 200 }])
    const criar = r.items.find((i) => i.request.name === 'criarProduto')!
    expect(criar.request.body).toMatchObject({ type: 'raw', language: 'json' })
    expect(JSON.parse((criar.request.body as { text: string }).text)).toEqual({ nome: 'Caneta', preco: 0 })
    expect(criar.request.tests).toMatchObject([{ expected: 201 }])
  })

  it('Swagger 2.0 em JSON', () => {
    const r = ok(JSON.stringify({
      swagger: '2.0', info: { title: 'Antigo', version: '1' }, host: 'api.exemplo.com.br', basePath: '/v2', schemes: ['https'],
      paths: { '/pets': { post: { summary: 'Criar pet', consumes: ['application/json'], parameters: [{ in: 'body', name: 'b', schema: { type: 'object', properties: { nome: { type: 'string', example: 'Rex' } } } }, { in: 'header', name: 'X-Trace', type: 'string' }], responses: { '200': {} } } } }
    }))
    expect(r.variables[0]).toEqual({ key: 'baseUrl', value: 'https://api.exemplo.com.br/v2' })
    const q = r.items[0]!.request
    expect(q.method).toBe('POST')
    expect(q.headers).toMatchObject([{ key: 'X-Trace', enabled: false }])
    expect(JSON.parse((q.body as { text: string }).text)).toEqual({ nome: 'Rex' })
  })

  it('ida e volta: exportar OpenAPI 3.1 e importar de novo', () => {
    const a = ok(yamlDoc)
    const text = exportOpenApi({ name: a.name, variables: a.variables, items: a.items })
    const doc = parseYaml(text) as { openapi: string; paths: Record<string, unknown> }
    expect(doc.openapi).toBe('3.1.0')
    expect(Object.keys(doc.paths).sort()).toEqual(['/produtos', '/produtos/{id}'])
    const b = ok(text)
    expect(b.items.map((i) => [i.request.method, i.request.url]).sort()).toEqual(a.items.map((i) => [i.request.method, i.request.url]).sort())
    expect(b.items.find((i) => i.request.name === 'Buscar produto')!.request.auth).toMatchObject({ type: 'bearer' })
  })
})

describe('HAR 1.2', () => {
  const har = JSON.stringify({
    log: {
      version: '1.2', creator: { name: 'Navegador', version: '1' },
      entries: [
        { request: { method: 'POST', url: 'https://api.exemplo.com.br/login?x=1', headers: [{ name: ':authority', value: 'x' }, { name: 'Content-Length', value: '9' }, { name: 'Content-Type', value: 'application/json' }, { name: 'Authorization', value: 'Bearer abc' }], postData: { mimeType: 'application/json', text: '{"u":1}' } } },
        { request: { method: 'GET', url: 'https://127.0.0.1/z', headers: [] } }
      ]
    }
  })

  it('importa entradas sem cabeçalhos calculados pelo navegador', () => {
    const r = ok(har)
    expect(r.format).toBe('har')
    expect(r.items).toHaveLength(2)
    const a = r.items[0]!.request
    expect(a.url).toBe('https://api.exemplo.com.br/login?x=1')
    expect(a.params).toMatchObject([{ key: 'x', value: '1' }])
    expect(a.headers.map((h) => h.key)).toEqual(['Content-Type'])
    expect(a.auth).toMatchObject({ type: 'bearer', token: 'abc' })
    expect(a.body).toMatchObject({ type: 'raw', language: 'json' })
  })

  it('ida e volta: exportar HAR e importar de novo', () => {
    const a = ok(har)
    const out = exportHar({ name: 'h', variables: [], items: a.items })
    expect(JSON.parse(out).log.version).toBe('1.2')
    const b = ok(out)
    expect(b.items.map((i) => [i.request.method, i.request.url])).toEqual(a.items.map((i) => [i.request.method, i.request.url]))
    expect(b.items[0]!.request.auth).toMatchObject({ type: 'bearer', token: 'abc' })
    expect(b.items[0]!.request.body).toEqual(a.items[0]!.request.body)
  })
})

describe('Insomnia v4', () => {
  it('pastas, ambiente, corpo e autenticação', () => {
    const r = ok(JSON.stringify({
      _type: 'export', __export_format: 4,
      resources: [
        { _id: 'wrk_1', _type: 'workspace', name: 'Meu espaço' },
        { _id: 'fld_1', _type: 'request_group', parentId: 'wrk_1', name: 'Clientes' },
        { _id: 'req_1', _type: 'request', parentId: 'fld_1', name: 'Novo cliente', method: 'POST', url: '{{ _.base }}/clientes?a=1', headers: [{ name: 'X-A', value: '1' }, { name: 'X-B', value: '2', disabled: true }], body: { mimeType: 'application/json', text: '{"n":1}' }, authentication: { type: 'bearer', token: '{{ _.token }}' } },
        { _id: 'env_1', _type: 'environment', parentId: 'wrk_1', name: 'Base Environment', data: { base: 'https://api.exemplo.com.br', n: 3 } }
      ]
    }))
    expect(r.format).toBe('insomnia')
    expect(r.name).toBe('Meu espaço')
    const q = r.items[0]!
    expect(q.folder).toBe('Clientes')
    expect(q.request.url).toBe('{{base}}/clientes?a=1')
    expect(q.request.headers).toMatchObject([{ key: 'X-A', enabled: true }, { key: 'X-B', enabled: false }])
    expect(q.request.auth).toMatchObject({ type: 'bearer', token: '{{token}}' })
    expect(r.environments[0]!.variables).toEqual([{ key: 'base', value: 'https://api.exemplo.com.br', secret: false }, { key: 'n', value: '3', secret: false }])
  })
})

describe('.http', () => {
  const http = `@host = https://127.0.0.1:3000
@token = abc

### Listar usuários
GET {{host}}/usuarios?pagina=1
Accept: application/json
Authorization: Bearer {{token}}

### Criar usuário
POST {{host}}/usuarios HTTP/1.1
Content-Type: application/json

{
  "nome": "Ana"
}

###
# @name login
POST {{host}}/login
Content-Type: application/x-www-form-urlencoded

user=ana&senha=1
`

  it('variáveis de arquivo, nomes e corpos', () => {
    const r = ok(http)
    expect(r.format).toBe('http')
    expect(r.variables).toEqual([{ key: 'host', value: 'https://127.0.0.1:3000' }, { key: 'token', value: 'abc' }])
    expect(r.items.map((i) => i.request.name)).toEqual(['Listar usuários', 'Criar usuário', 'login'])
    const [a, b, c] = r.items.map((i) => i.request)
    expect(a!.params).toMatchObject([{ key: 'pagina', value: '1' }])
    expect(a!.auth).toMatchObject({ type: 'bearer', token: '{{token}}' })
    expect(JSON.parse((b!.body as { text: string }).text)).toEqual({ nome: 'Ana' })
    expect(c!.body).toMatchObject({ type: 'urlencoded', fields: [{ key: 'user', value: 'ana' }, { key: 'senha', value: '1' }] })
  })

  it('ida e volta: exportar .http e importar de novo', () => {
    const a = ok(http)
    const b = ok(exportHttp({ name: 'x', variables: a.variables, items: a.items }))
    expect(b.variables).toEqual(a.variables)
    expect(b.items.map((i) => [i.request.name, i.request.method, i.request.url])).toEqual(a.items.map((i) => [i.request.name, i.request.method, i.request.url]))
    expect(b.items[1]!.request.body).toEqual(a.items[1]!.request.body)
    expect(b.items[2]!.request.body).toEqual(a.items[2]!.request.body)
    expect(b.items[0]!.request.auth).toMatchObject({ type: 'bearer' })
  })
})

describe('detecção e erros', () => {
  it('detecta cada formato', () => {
    expect(detectFormat('curl https://x')).toBe('curl')
    expect(detectFormat('{"info":{"name":"a"},"item":[]}')).toBe('postman')
    expect(detectFormat('openapi: 3.0.0\npaths: {}')).toBe('openapi')
    expect(detectFormat('{"swagger":"2.0","paths":{}}')).toBe('openapi')
    expect(detectFormat('{"log":{"entries":[]}}')).toBe('har')
    expect(detectFormat('{"_type":"export","resources":[]}')).toBe('insomnia')
    expect(detectFormat('GET https://x/y')).toBe('http')
    expect(detectFormat('texto qualquer')).toBeNull()
  })

  it('formato desconhecido e conteúdo inválido viram código, sem lançar', () => {
    expect(parseImport('olá', 'auto')).toEqual({ ok: false, code: 'unknownFormat' })
    expect(parseImport('{ quebrado', 'postman')).toEqual({ ok: false, code: 'invalid' })
    expect(parseImport('{}', 'har')).toEqual({ ok: false, code: 'invalid' })
  })

  it('os itens importados passam pelo schema da requisição', () => {
    const r = ok('curl -X post https://127.0.0.1/a -H "A: b"')
    expect(apiRequestSchema.safeParse(r.items[0]!.request).success).toBe(true)
    expect(r.items[0]!.request.method).toBe('POST')
  })
})
