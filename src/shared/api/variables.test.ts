// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { findVariables, layeredLookup, resolveTemplate, variableNames, VARIABLE_NAME_RE } from './variables'

describe('variáveis {{nome}}', () => {
  it('encontra as variáveis com posição, aceitando espaços dentro das chaves', () => {
    expect(findVariables('{{baseUrl}}/produtos/{{ id }}')).toEqual([
      { name: 'baseUrl', start: 0, end: 11 },
      { name: 'id', start: 21, end: 29 }
    ])
  })

  it('ignora chaves que não formam uma variável válida', () => {
    expect(findVariables('{{}} {{1abc}} {{a b}} {single} {{ok.nome-1}}').map((t) => t.name)).toEqual(['ok.nome-1'])
  })

  it('lista os nomes sem repetir', () => {
    expect(variableNames('{{a}} {{b}} {{a}}')).toEqual(['a', 'b'])
  })

  it('valida nomes de variável', () => {
    expect(['token', '_x', '$guid', 'oauth.token', 'a-b'].every((n) => VARIABLE_NAME_RE.test(n))).toBe(true)
    expect(['', '1a', 'a b', 'a{', 'x'.repeat(101)].some((n) => VARIABLE_NAME_RE.test(n))).toBe(false)
  })
})

describe('resolução', () => {
  it('o escopo mais forte vence', () => {
    const lookup = layeredLookup({ token: 'temporario' }, { token: 'ambiente', baseUrl: 'https://hml' }, () => 'global')
    expect(lookup('token')).toBe('temporario')
    expect(lookup('baseUrl')).toBe('https://hml')
    expect(lookup('qualquer')).toBe('global')
  })

  it('não confunde propriedades herdadas do objeto com variáveis', () => {
    expect(layeredLookup({})('toString')).toBeUndefined()
  })

  it('troca as variáveis e informa as que faltam', () => {
    const r = resolveTemplate('{{baseUrl}}/produtos/{{id}}', layeredLookup({ baseUrl: 'https://api.exemplo.com.br' }))
    expect(r).toEqual({ text: 'https://api.exemplo.com.br/produtos/{{id}}', missing: ['id'] })
  })

  it('resolve variáveis dentro de variáveis e para nos ciclos', () => {
    expect(resolveTemplate('{{url}}', layeredLookup({ url: '{{host}}/v1', host: 'https://h' })).text).toBe('https://h/v1')
    const cycle = resolveTemplate('{{a}}', layeredLookup({ a: '{{b}}', b: '{{a}}' }))
    expect(cycle.missing.length).toBe(1)
  })

  it('gera as variáveis dinâmicas', () => {
    const r = resolveTemplate('{{$guid}}|{{$timestamp}}|{{$randomInt}}|{{$randomEmail}}', () => undefined)
    const [guid, ts, n, email] = r.text.split('|')
    expect(guid).toMatch(/^[0-9a-f-]{36}$/)
    expect(Number(ts)).toBeGreaterThan(1_700_000_000)
    expect(Number(n)).toBeGreaterThanOrEqual(0)
    expect(email).toMatch(/@exemplo\.com$/)
    expect(r.missing).toEqual([])
  })
})
