// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { collapseDoubleSpaces, convertCaseText, sentenceCaser, toggleUrlEncoding, trimLine } from './textOps'

describe('conversão de letras', () => {
  it('maiúsculas e minúsculas, com acentos', () => {
    expect(convertCaseText('Ação rápida', 'upper')).toBe('AÇÃO RÁPIDA')
    expect(convertCaseText('AÇÃO RÁPIDA', 'lower')).toBe('ação rápida')
  })

  it('modo Título: só a primeira letra de cada frase em maiúscula', () => {
    expect(convertCaseText('O EDITOR ESTÁ PRONTO. AGORA VAMOS TESTAR! TUDO BEM?', 'sentence')).toBe(
      'O editor está pronto. Agora vamos testar! Tudo bem?'
    )
    expect(convertCaseText('versão 1.1.0 DO EDITOR', 'sentence')).toBe('Versão 1.1.0 do editor')
    expect(convertCaseText('primeira LINHA\nsegunda LINHA', 'sentence')).toBe('Primeira linha\nSegunda linha')
    expect(convertCaseText('ELE DISSE "FIM." DEPOIS SAIU', 'sentence')).toBe('Ele disse "fim." Depois saiu')
  })

  it('modo Título em partes mantém o estado entre elas', () => {
    const caser = sentenceCaser()
    expect(caser('UMA FRASE. ') + caser('OUTRA FRASE')).toBe('Uma frase. Outra frase')
  })
})

describe('operações com espaços', () => {
  it('limpa à direita, à esquerda e dos dois lados', () => {
    expect(trimLine(' \t texto  \t', 'right')).toBe(' \t texto')
    expect(trimLine(' \t texto  \t', 'left')).toBe('texto  \t')
    expect(trimLine(' \t texto  \t', 'both')).toBe('texto')
  })

  it('troca espaços duplos por um, preservando a indentação', () => {
    expect(collapseDoubleSpaces('um  dois   três')).toBe('um dois três')
    expect(collapseDoubleSpaces('    if (a  ==  b)\n  - item  um')).toBe('    if (a == b)\n  - item um')
  })
})

describe('codificar/decodificar URL', () => {
  it('codifica trechos soltos por completo e endereços mantendo a estrutura', () => {
    expect(toggleUrlEncoding('a b&c=ç')).toEqual({ text: 'a%20b%26c%3D%C3%A7', mode: 'encoded' })
    expect(toggleUrlEncoding('https://exemplo.com/minha página?q=ação&x=1')).toEqual({
      text: 'https://exemplo.com/minha%20p%C3%A1gina?q=a%C3%A7%C3%A3o&x=1',
      mode: 'encoded'
    })
  })

  it('decodifica o que já está codificado', () => {
    expect(toggleUrlEncoding('a%20b%26c%3D%C3%A7')).toEqual({ text: 'a b&c=ç', mode: 'decoded' })
    expect(toggleUrlEncoding('https://exemplo.com/minha%20p%C3%A1gina')).toEqual({ text: 'https://exemplo.com/minha página', mode: 'decoded' })
  })

  it('codifica o "%" solto em vez de falhar', () => {
    expect(toggleUrlEncoding('100% certo')).toEqual({ text: '100%25%20certo', mode: 'encoded' })
    expect(toggleUrlEncoding('%E0%A4%A')).toEqual({ text: '%25E0%25A4%25A', mode: 'encoded' })
  })
})
