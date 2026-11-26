// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import type { ApiRequest, KeyValue } from '@shared/api/schema'
import { newApiRequest } from '@shared/api/schema'
import { effectiveRequest, pathParamNames, paramsFromUrl, urlFromParams, withPathParams } from './urlParams'

const kv = (key: string, value: string, enabled = true): KeyValue => ({ key, value, enabled })

describe('params e URL', () => {
  it('lê a query da URL e mantém as linhas desligadas', () => {
    const rows = [kv('a', '1'), kv('x', 'off', false), kv('b', '2')]
    const out = paramsFromUrl('https://api.exemplo.com.br/p?a=9&c=3', rows)
    expect(out.map((r) => `${r.key}=${r.value}:${r.enabled}`)).toEqual(['a=9:true', 'x=off:false', 'c=3:true'])
  })

  it('monta a query só com as linhas ligadas e preserva {{variáveis}}', () => {
    const url = urlFromParams('{{base}}/p?velho=1#topo', [kv('q', 'a b'), kv('t', '{{token}}'), kv('off', 'x', false), kv(':id', '7')])
    expect(url).toBe('{{base}}/p?q=a%20b&t={{token}}#topo')
  })

  it('remove a query quando não há linhas ligadas', () => {
    expect(urlFromParams('http://127.0.0.1/p?a=1', [])).toBe('http://127.0.0.1/p')
  })

  it('acha path params e ignora a porta e o esquema', () => {
    expect(pathParamNames('http://127.0.0.1:8080/produtos/:id/itens/:item?x=:y')).toEqual(['id', 'item'])
    expect(pathParamNames('{{base}}/:id')).toEqual(['id'])
  })

  it('cria linhas para os path params e remove as que sumiram', () => {
    const out = withPathParams('http://x/a/:id', [kv(':velho', '1'), kv('q', '1')])
    expect(out.map((r) => r.key)).toEqual(['q', ':id'])
  })

  it('a requisição enviada troca os path params e não repete a query', () => {
    const req: ApiRequest = { ...newApiRequest(), url: 'http://127.0.0.1:1/p/:id?a=1', params: [kv(':id', 'a b'), kv('a', '1')] }
    const eff = effectiveRequest(req)
    expect(eff.url).toBe('http://127.0.0.1:1/p/a%20b?a=1')
    expect(eff.params).toEqual([])
  })

  it('sem query na URL, usa as linhas ligadas da tabela', () => {
    const req: ApiRequest = { ...newApiRequest(), url: 'http://127.0.0.1:1/p', params: [kv('a', '1'), kv('b', '2', false)] }
    expect(effectiveRequest(req).url).toBe('http://127.0.0.1:1/p?a=1')
  })
})
