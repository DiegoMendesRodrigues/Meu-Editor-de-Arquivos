// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MASK } from '@shared/api/protocol'

const h = vi.hoisted(() => ({ store: new Map<string, Map<string, string>>() }))

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9', getPath: () => '' }, session: {} }))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))
vi.mock('./vault', () => ({
  secretVault: {
    get: async (s: string, n: string) => h.store.get(s)?.get(n),
    set: async () => undefined,
    names: async (s: string) => [...(h.store.get(s)?.keys() ?? [])]
  }
}))

import { buildResolver } from './resolve'

const v = (key: string, value: string, secret = false) => ({ key, value, secret })
const env = (variables: ReturnType<typeof v>[]) => ({ id: 'env1', name: 'Ambiente', production: false, variables })
const col = (variables: ReturnType<typeof v>[]) => ({ id: 'col1', variables, auth: { type: 'none' as const } })

beforeEach(() => h.store.clear())

describe('buildResolver: escopos', () => {
  it('temporárias vencem ambiente, que vence coleção, que vence globais', async () => {
    h.store.set('globals', new Map([['x', 'glob'], ['g', 'so-global']]))
    const r = await buildResolver({
      environment: env([v('x', 'amb'), v('t', 'amb-t')]),
      collection: col([v('x', 'col'), v('c', 'so-col')]),
      temporary: { t: 'temp' }
    })
    expect(r.resolve('{{x}} {{t}} {{c}} {{g}}')).toBe('amb temp so-col so-global')
  })

  it('o segredo da coleção vem do cofre e registra o escopo da coleção', async () => {
    h.store.set('globals', new Map([['k', 'glob']]))
    h.store.set('col1', new Map([['k', 'seg-col']]))
    const r = await buildResolver({ environment: null, collection: col([v('k', '', true)]), temporary: {} })
    expect(r.resolve('{{k}}')).toBe('seg-col')
    expect([...r.secretScopes]).toEqual(['col1'])
  })

  it('segredo ausente no cofre cai para o escopo mais fraco', async () => {
    h.store.set('col1', new Map([['k', 'da-colecao']]))
    const r = await buildResolver({ environment: env([v('k', '', true)]), collection: col([v('k', '', true)]), temporary: {} })
    expect(r.resolve('{{k}}')).toBe('da-colecao')
  })
})

describe('buildResolver: dinâmicas, ausentes e profundidade', () => {
  it('resolve variáveis dinâmicas sem marcá-las como ausentes', async () => {
    const r = await buildResolver({ environment: null, collection: null, temporary: {} })
    expect(r.resolve('{{$guid}}')).toMatch(/^[0-9a-f-]{36}$/)
    expect(r.resolve('{{$timestamp}}')).toMatch(/^\d+$/)
    expect(r.missing.size).toBe(0)
  })

  it('variável ausente fica como está e entra em missing', async () => {
    const r = await buildResolver({ environment: null, collection: null, temporary: {} })
    expect(r.resolve('a {{nada}} b')).toBe('a {{nada}} b')
    expect([...r.missing]).toEqual(['nada'])
  })

  it('variável dentro de variável resolve; ciclo para no limite de profundidade', async () => {
    const r = await buildResolver({ environment: env([v('a', '{{b}}!'), v('b', 'ok'), v('p', '{{q}}'), v('q', '{{p}}')]), collection: null, temporary: {} })
    expect(r.resolve('{{a}}')).toBe('ok!')
    expect(r.resolve('{{p}}')).toMatch(/^\{\{[pq]\}\}$/)
    expect(r.missing.size).toBeGreaterThan(0)
  })

  it('valor vazio no ambiente vale (não cai para a coleção)', async () => {
    const r = await buildResolver({ environment: env([v('e', '')]), collection: col([v('e', 'col')]), temporary: {} })
    expect(r.resolve('[{{e}}]')).toBe('[]')
  })
})

describe('buildResolver: segredos e mascaramento', () => {
  it('só usar o segredo registra valor e escopo; mask troca o valor e a forma codificada', async () => {
    h.store.set('env1', new Map([['tok', 'a b&c']]))
    const r = await buildResolver({ environment: env([v('tok', '', true), v('url', 'http://x')]), collection: null, temporary: {} })
    expect(r.resolve('{{url}}')).toBe('http://x')
    expect(r.secretScopes.size).toBe(0)
    expect(r.resolve('t={{tok}}')).toBe('t=a b&c')
    expect([...r.secretScopes]).toEqual(['env1'])
    expect(r.mask(`x a b&c y ${encodeURIComponent('a b&c')}`)).toBe(`x ${MASK} y ${MASK}`)
  })

  it('snapshot não marca segredo como usado; lookup marca', async () => {
    h.store.set('env1', new Map([['tok', 'zzz']]))
    const r = await buildResolver({ environment: env([v('tok', '', true)]), collection: null, temporary: {} })
    expect(r.snapshot().secretNames).toEqual(['tok'])
    expect(r.secretScopes.size).toBe(0)
    expect(r.lookup('tok')).toBe('zzz')
    expect(r.secretScopes.has('env1')).toBe(true)
  })

  it('o escopo de gravação é o ambiente, ou globals sem ambiente', async () => {
    expect((await buildResolver({ environment: env([]), collection: null, temporary: {} })).scope).toBe('env1')
    expect((await buildResolver({ environment: null, collection: null, temporary: {} })).scope).toBe('globals')
  })
})

describe('equivalência com o antigo resolvedor do OAuth', () => {
  it('ambiente, coleção e globais, nessa ordem, com segredos do cofre', async () => {
    h.store.set('env1', new Map([['client_secret', 'S-env']]))
    h.store.set('globals', new Map([['audience', 'aud-glob']]))
    const r = await buildResolver({
      environment: env([v('base', 'https://auth.exemplo.com.br'), v('client_secret', '', true)]),
      collection: col([v('base', 'https://outra.exemplo.com.br'), v('client_id', 'cid')]),
      temporary: {}
    })
    expect(r.resolve('{{base}}/token')).toBe('https://auth.exemplo.com.br/token')
    expect(r.resolve('{{client_id}}:{{client_secret}}:{{audience}}')).toBe('cid:S-env:aud-glob')
    expect(r.resolve('{{falta}}')).toBe('{{falta}}')
  })

  it('funciona sem ambiente e sem coleção, só com globais', async () => {
    h.store.set('globals', new Map([['g', '1']]))
    const r = await buildResolver({ environment: null, collection: null, temporary: {} })
    expect(r.resolve('{{g}}-{{h}}')).toBe('1-{{h}}')
  })

  it('o método resolve pode ser passado solto (sem this), como o OAuth faz', async () => {
    const r = await buildResolver({ environment: env([v('a', '1')]), collection: null, temporary: {} })
    const { resolve } = r
    expect(resolve('{{a}}')).toBe('1')
  })
})
