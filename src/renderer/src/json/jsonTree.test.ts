// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { childEntries, formatPath, getAtPath, locateJsonError, parseJson, summary } from './jsonTree'

describe('JSON Viewer', () => {
  it('interpreta JSON válido', () => {
    const r = parseJson('{"a": [1, 2]}')
    expect(r.ok && r.value).toEqual({ a: [1, 2] })
  })

  it('informa linha e coluna de um erro', () => {
    const r = parseJson('{\n  "a": 1,\n  "b": \n}')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.line).toBe(4)
      expect(r.column).toBe(1)
      expect(r.message).toBe('Valor inesperado: "}"')
    }
  })

  it('localiza erros comuns', () => {
    expect(locateJsonError('[1, 2,]')?.message).toBe('Vírgula sobrando antes de "]"')
    expect(locateJsonError('{a: 1}')?.message).toMatch(/chave entre aspas/)
    expect(locateJsonError('{"a": 1')?.message).toMatch(/fim do arquivo/)
    expect(locateJsonError('{"a": "x\\q"}')?.message).toMatch(/escape/)
    expect(locateJsonError('{"a": [1, {"b": null}], "c": -1.5e3}')).toBeNull()
  })

  it('formata caminhos com chaves especiais', () => {
    expect(formatPath([])).toBe('$')
    expect(formatPath(['usuarios', 0, 'nome completo'])).toBe('$.usuarios[0]["nome completo"]')
  })

  it('navega por caminho e lista filhos', () => {
    const data = { a: [{ b: true }] }
    expect(getAtPath(data, ['a', 0, 'b'])).toBe(true)
    expect(getAtPath(data, ['x', 'y'])).toBeUndefined()
    expect(childEntries([10, 20])).toEqual([[0, 10], [1, 20]])
  })

  it('resume objetos e arrays', () => {
    expect(summary([1])).toBe('[ 1 item ]')
    expect(summary({ a: 1, b: 2 })).toBe('{ 2 chaves }')
  })
})
