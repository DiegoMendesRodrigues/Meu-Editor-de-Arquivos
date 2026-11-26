// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { splitBlocks, splitInline } from './markdown'

describe('splitBlocks', () => {
  it('separa texto e blocos de código com a linguagem', () => {
    const b = splitBlocks('Veja:\n\n```ts\nconst a = 1\nconst b = 2\n```\n\nPronto.')
    expect(b).toEqual([
      { type: 'text', text: 'Veja:' },
      { type: 'code', lang: 'ts', text: 'const a = 1\nconst b = 2', closed: true },
      { type: 'text', text: 'Pronto.' }
    ])
  })
  it('bloco ainda aberto durante o streaming', () => {
    expect(splitBlocks('Texto\n```py\nprint(1)')).toEqual([
      { type: 'text', text: 'Texto' },
      { type: 'code', lang: 'py', text: 'print(1)', closed: false }
    ])
  })
  it('cerca mais longa aceita ``` dentro do código', () => {
    const b = splitBlocks('````md\n```js\nx\n```\n````')
    expect(b).toEqual([{ type: 'code', lang: 'md', text: '```js\nx\n```', closed: true }])
  })
  it('não interpreta HTML: só devolve o texto', () => {
    expect(splitBlocks('<img src=x onerror=alert(1)>')).toEqual([{ type: 'text', text: '<img src=x onerror=alert(1)>' }])
  })
})

describe('splitInline', () => {
  it('reconhece código e negrito', () => {
    expect(splitInline('use `npm i` e **cuidado** sempre')).toEqual([
      { kind: 'text', text: 'use ' },
      { kind: 'code', text: 'npm i' },
      { kind: 'text', text: ' e ' },
      { kind: 'bold', text: 'cuidado' },
      { kind: 'text', text: ' sempre' }
    ])
  })
})
