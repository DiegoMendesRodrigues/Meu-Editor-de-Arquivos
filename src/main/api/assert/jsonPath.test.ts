// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { evalJsonPath, JsonPathError } from './jsonPath'

const data = {
  loja: { nome: 'Exemplo', itens: [{ id: 1, tipo: 'a', preco: 10 }, { id: 2, tipo: 'b', preco: 25 }, { id: 3, tipo: 'a' }] },
  'chave com espaço': 7,
  lista: [1, 2, 3, 4, 5]
}

describe('jsonPath', () => {
  it('raiz e propriedades', () => {
    expect(evalJsonPath(data, '$').value).toBe(data)
    expect(evalJsonPath(data, '$.loja.nome').value).toBe('Exemplo')
    expect(evalJsonPath(data, "$['chave com espaço']").value).toBe(7)
    expect(evalJsonPath(data, '$.nada').value).toBeUndefined()
  })
  it('índices positivos e negativos', () => {
    expect(evalJsonPath(data, '$.lista[0]').value).toBe(1)
    expect(evalJsonPath(data, '$.lista[-1]').value).toBe(5)
    expect(evalJsonPath(data, '$.lista[9]').value).toBeUndefined()
  })
  it('curinga devolve lista', () => {
    const r = evalJsonPath(data, '$.loja.itens[*].id')
    expect(r.multi).toBe(true)
    expect(r.value).toEqual([1, 2, 3])
  })
  it('descendente', () => {
    expect(evalJsonPath(data, '$..id').value).toEqual([1, 2, 3])
    expect(evalJsonPath(data, '$..nome').value).toEqual(['Exemplo'])
  })
  it('união e fatia', () => {
    expect(evalJsonPath(data, '$.lista[0,2]').value).toEqual([1, 3])
    expect(evalJsonPath(data, '$.lista[1:3]').value).toEqual([2, 3])
    expect(evalJsonPath(data, '$.lista[:2]').value).toEqual([1, 2])
    expect(evalJsonPath(data, '$.lista[-2:]').value).toEqual([4, 5])
  })
  it('filtros', () => {
    expect(evalJsonPath(data, "$.loja.itens[?(@.tipo == 'a')].id").value).toEqual([1, 3])
    expect(evalJsonPath(data, "$.loja.itens[?(@.tipo != 'a')].id").value).toEqual([2])
    expect(evalJsonPath(data, '$.loja.itens[?(@.preco > 10)].id').value).toEqual([2])
    expect(evalJsonPath(data, '$.loja.itens[?(@.preco >= 10)].id').value).toEqual([1, 2])
    expect(evalJsonPath(data, '$.loja.itens[?(@.preco < 25)].id').value).toEqual([1])
    expect(evalJsonPath(data, '$.loja.itens[?(@.preco <= 25)].id').value).toEqual([1, 2])
    expect(evalJsonPath(data, '$.loja.itens[?(@.preco)].id').value).toEqual([1, 2])
  })
  it('expressão inválida lança JsonPathError', () => {
    for (const p of ['loja', '$.', '$[', '$.a[?(x)]', "$['a", '$.a[abc]']) {
      expect(() => evalJsonPath(data, p), p).toThrow(JsonPathError)
    }
  })
  it('limita a profundidade sem estourar a pilha', () => {
    let deep: unknown = { id: 1 }
    for (let i = 0; i < 5000; i++) deep = { n: deep }
    expect(() => evalJsonPath(deep, '$..id')).not.toThrow()
  })
})
