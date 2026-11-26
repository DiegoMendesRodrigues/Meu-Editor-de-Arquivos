// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import type { CollectionTree } from './collectionTypes'
import { collectionExamplePaths, examplePath, mockPathFromUrl, routesFromCollection, routesFromOpenApi, sampleFromSchema } from './mockRoutes'
import { newApiRequest } from './schema'

describe('mockPathFromUrl', () => {
  it('tira host, baseUrl, query e converte variáveis em :params', () => {
    expect(mockPathFromUrl('{{baseUrl}}/produtos/:id?x=1')).toBe('/produtos/:id')
    expect(mockPathFromUrl('https://api.exemplo.com.br/v1/pedidos/{{id}}#a')).toBe('/v1/pedidos/:id')
    expect(mockPathFromUrl('http://127.0.0.1:8080')).toBe('/')
  })
})

describe('routesFromCollection', () => {
  const resp = (over: object = {}): string =>
    JSON.stringify({
      $schema: 'meu-editor/api-response@1',
      requestId: 'r1',
      sentAt: '2024-01-01T00:00:00Z',
      request: { method: 'GET', url: 'http://x', headers: [] },
      status: 201,
      statusText: 'Created',
      httpVersion: '1.1',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Content-Length', value: '9' },
        { key: 'Connection', value: 'close' },
        { key: 'X-Id', value: '1' }
      ],
      cookies: [],
      timings: { dns: 0, tcp: 0, tls: 0, firstByte: 1, download: 1, total: 2 },
      size: { headers: 1, body: 2 },
      body: { encoding: 'utf8', text: '{"a":1}' },
      truncated: false,
      ...over
    })

  it('gera uma rota por exemplo, sem hop-by-hop e só com corpo utf8', () => {
    const req = { ...newApiRequest('lista'), method: 'POST', url: '{{baseUrl}}/itens/:id', examples: ['.respostas/lista/a.apiresp', '.respostas/lista/b.apiresp'] }
    const tree: CollectionTree = { dir: 'C:\\col', location: 'disk', collection: null, requests: [{ path: 'C:\\col\\lista.apireq', folder: '', request: req }], environments: [] }
    const [pa, pb] = collectionExamplePaths(tree)
    expect(pa).toBe('C:\\col\\.respostas\\lista\\a.apiresp')
    const routes = routesFromCollection(tree, { [pa!]: resp(), [pb!]: resp({ body: { encoding: 'base64', text: 'AAA=' } }) })
    expect(routes).toHaveLength(1)
    expect(routes[0]).toMatchObject({ method: 'POST', path: '/itens/:id', status: 201, example: 'a', body: '{"a":1}' })
    expect(routes[0]!.headers.map((h) => h.key)).toEqual(['Content-Type', 'X-Id'])
  })

  it('resolve caminho relativo com ..', () => {
    expect(examplePath('/a/b/c.apireq', '../x/y.apiresp')).toBe('/a/x/y.apiresp')
  })
})

describe('OpenAPI', () => {
  const doc = {
    openapi: '3.0.3',
    paths: {
      '/pets/{id}': {
        get: {
          responses: {
            '404': { description: 'nada' },
            '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Pet' } } } }
          }
        }
      },
      '/ok': { post: { responses: { '201': { content: { 'application/json': { examples: { a: { value: { x: 1 } }, b: { value: { x: 2 } } } } } } } } }
    },
    components: {
      schemas: {
        Pet: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nome: { type: 'string' },
            nasc: { type: 'string', format: 'date' },
            tipo: { enum: ['cao', 'gato'] },
            tags: { type: 'array', items: { type: 'string' } },
            dono: { $ref: '#/components/schemas/Pet' }
          }
        }
      }
    }
  }

  it('gera rotas com :id, exemplo gerado do schema e exemplos nomeados', () => {
    const routes = routesFromOpenApi(JSON.stringify(doc))!
    expect(routes.map((r) => `${r.method} ${r.path} ${r.status} ${r.example}`)).toEqual(['GET /pets/:id 200 ', 'POST /ok 201 a', 'POST /ok 201 b'])
    const body = JSON.parse(routes[0]!.body)
    expect(body).toMatchObject({ id: 1, nome: 'texto', nasc: '2024-01-15', tipo: 'cao', tags: ['texto', 'texto'] })
  })

  it('aceita YAML e Swagger 2 e recusa o resto', () => {
    const yml = 'swagger: "2.0"\nbasePath: /v1\npaths:\n  /a/{x}:\n    get:\n      responses:\n        "200":\n          schema:\n            type: boolean\n'
    const r = routesFromOpenApi(yml)!
    expect(r[0]).toMatchObject({ path: '/v1/a/:x', body: 'true' })
    expect(routesFromOpenApi('{"foo":1}')).toBeNull()
  })

  it('limita a profundidade do schema', () => {
    let s: Record<string, unknown> = { type: 'string' }
    for (let i = 0; i < 20; i++) s = { type: 'object', properties: { n: s } }
    expect(JSON.stringify(sampleFromSchema(s)).length).toBeLessThan(200)
  })
})
