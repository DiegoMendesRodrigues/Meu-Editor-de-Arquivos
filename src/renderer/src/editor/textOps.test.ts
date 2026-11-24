// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { collapseDoubleSpaces, convertCaseText, sentenceCaser, trimLine } from './textOps'

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
