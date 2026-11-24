// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import type { CollectionTree } from './collectionTypes'
import { generateCollectionMarkdown } from './docs'
import { MASK } from './protocol'
import { newApiRequest, type ApiRequest } from './schema'

const make = (name: string, patch: Partial<ApiRequest>): ApiRequest => ({ ...newApiRequest(name), ...patch })

const tree = (requests: CollectionTree['requests']): CollectionTree => ({
  dir: 'C:\\col\\Minha API',
  location: 'disk',
  collection: {
    $schema: 'meu-editor/api-collection@1',
    id: 'c1',
    name: 'Minha API',
    description: 'Exemplo.',
    auth: { type: 'none' },
    variables: [
      { key: 'baseUrl', value: 'http://127.0.0.1', secret: false },
      { key: 'token', secret: true }
    ],
    order: [],
    syncResponses: false
  },
  requests,
  environments: []
})

describe('documentação da coleção em Markdown', () => {
  const md = generateCollectionMarkdown(
    tree([
      {
        path: '/c/usuarios/criar.apireq',
        folder: 'usuarios',
        request: make('Criar usuário', {
          method: 'POST',
          url: '{{baseUrl}}/usuarios',
          description: 'Cria um usuário.',
          params: [
            { key: 'dry', value: '1', enabled: true },
            { key: 'api_key', value: 'segredo-123', enabled: true }
          ],
          headers: [
            { key: 'Authorization', value: 'Bearer abc.def', enabled: true },
            { key: 'X-Trace', value: 'on', enabled: true },
            { key: 'X-Off', value: 'no', enabled: false }
          ],
          body: { type: 'raw', language: 'json', text: '{"nome":"Ana | Bia"}' },
          tests: [{ target: 'status', op: 'eq', expected: 201, enabled: true }],
          extract: [{ from: 'jsonPath', path: '$.id', to: 'userId', secret: false, enabled: true }]
        })
      },
      { path: '/c/raiz.apireq', folder: '', request: make('Saúde', { url: '{{baseUrl}}/health' }) }
    ])
  )

  it('traz título, índice, variáveis e endpoints', () => {
    expect(md).toContain('# Minha API')
    expect(md).toContain('## Índice')
    expect(md).toContain('### POST Criar usuário')
    expect(md).toContain('### GET Saúde')
    expect(md).toContain('`{{baseUrl}}/usuarios`')
    expect(md).toContain('| `baseUrl` | `http://127.0.0.1` |')
    expect(md).toMatch(/\| `token` \| \*secreta\* \|/)
  })

  it('mascara Authorization e parâmetros sensíveis, e omite cabeçalhos desligados', () => {
    expect(md).toContain(`| \`Authorization\` | \`${MASK}\` |`)
    expect(md).not.toContain('Bearer abc.def')
    expect(md).not.toContain('segredo-123')
    expect(md).toContain('X-Trace')
    expect(md).not.toContain('X-Off')
  })

  it('inclui o corpo de exemplo, os testes e as extrações', () => {
    expect(md).toContain('```json\n{"nome":"Ana | Bia"}\n```')
    expect(md).toContain('| status | eq | `201` |')
    expect(md).toContain('| jsonPath $.id | `userId` |')
  })

  it('coleção sem requisições avisa em vez de gerar índice vazio', () => {
    expect(generateCollectionMarkdown(tree([]))).toContain('Nenhuma requisição')
  })

  it('usa a pasta como nome quando não há collection.apicol', () => {
    const t = tree([])
    t.collection = null
    expect(generateCollectionMarkdown(t).startsWith('# Minha API')).toBe(true)
  })
})
