// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { buildGlobFilter, buildRegex, replaceText, searchText } from './search'

const opts = { query: 'foo', caseSensitive: false, wholeWord: false, regex: false }

describe('busca', () => {
  it('encontra com linha e coluna e ignora maiúsculas por padrão', () => {
    const m = searchText('a\nxFOOy foo\n', buildRegex(opts))
    expect(m.map((x) => [x.line, x.column])).toEqual([
      [2, 2],
      [2, 7]
    ])
  })

  it('respeita maiúsculas, palavra inteira e texto literal', () => {
    expect(searchText('Foo foo', buildRegex({ ...opts, caseSensitive: true }))).toHaveLength(1)
    expect(searchText('foo foobar', buildRegex({ ...opts, wholeWord: true }))).toHaveLength(1)
    expect(searchText('a.b axb', buildRegex({ ...opts, query: 'a.b' }))).toHaveLength(1)
    expect(searchText('a.b axb', buildRegex({ ...opts, query: 'a.b', regex: true }))).toHaveLength(2)
  })

  it('palavra inteira funciona com acentos', () => {
    expect(searchText('ação ações', buildRegex({ ...opts, query: 'ação', wholeWord: true }))).toHaveLength(1)
  })

  it('regex inválida lança erro em português; consulta vazia também', () => {
    expect(() => buildRegex({ ...opts, query: '(', regex: true })).toThrow(/inválida/)
    expect(() => buildRegex({ ...opts, query: '' })).toThrow()
  })

  it('não trava com padrões que casam vazio e respeita o limite', () => {
    expect(searchText('abc', buildRegex({ ...opts, query: 'x*', regex: true }))).toEqual([])
    expect(searchText('a a a a', buildRegex({ ...opts, query: 'a' }), 2)).toHaveLength(2)
  })

  it('substitui literal e com grupos de captura', () => {
    expect(replaceText('a a', buildRegex({ ...opts, query: 'a' }), '$1', false)).toEqual({ text: '$1 $1', count: 2 })
    const re = buildRegex({ ...opts, query: '(\\w+)@(?<d>\\w+)', regex: true })
    expect(replaceText('ana@x', re, '$<d>:$1 $$', true)).toEqual({ text: 'x:ana $', count: 1 })
  })

  it('filtro de arquivos por glob', () => {
    const f = buildGlobFilter('*.ts, docs/**')!
    expect(f('src/a.ts')).toBe(true)
    expect(f('docs/x/y.md')).toBe(true)
    expect(f('src/a.js')).toBe(false)
    expect(buildGlobFilter('  ')).toBeNull()
  })
})
