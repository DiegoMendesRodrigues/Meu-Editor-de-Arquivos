import { describe, expect, it } from 'vitest'
import { makeLink, setHeading, stripFormatting, tableTemplate, toggleBulletList, toggleNumberedList, toggleWrap } from './format'

describe('formatação Markdown', () => {
  it('aplica e troca níveis de título', () => {
    expect(setHeading('Introdução', 2)).toBe('## Introdução')
    expect(setHeading('## Introdução', 1)).toBe('# Introdução')
    expect(setHeading('### Introdução', 0)).toBe('Introdução')
  })

  it('liga e desliga lista com marcadores, preservando linhas em branco', () => {
    expect(toggleBulletList(['a', '', 'b'])).toEqual(['- a', '', '- b'])
    expect(toggleBulletList(['- a', '- b'])).toEqual(['a', 'b'])
    expect(toggleBulletList(['1. a', '2. b'])).toEqual(['- a', '- b'])
  })

  it('liga e desliga lista numerada', () => {
    expect(toggleNumberedList(['a', 'b', 'c'])).toEqual(['1. a', '2. b', '3. c'])
    expect(toggleNumberedList(['1. a', '2. b'])).toEqual(['a', 'b'])
    expect(toggleNumberedList(['  - a'])).toEqual(['  1. a'])
  })

  it('envolve e desenvolve ênfases', () => {
    expect(toggleWrap('texto', '**')).toBe('**texto**')
    expect(toggleWrap('**texto**', '**')).toBe('texto')
    expect(toggleWrap('~~x~~', '~~')).toBe('x')
    expect(toggleWrap('**negrito**', '*')).toBe('***negrito***')
  })

  it('cria links e tabelas', () => {
    expect(makeLink('site')).toBe('[site](https://)')
    expect(makeLink('https://a.com')).toBe('[https://a.com](https://a.com)')
    expect(tableTemplate(2, 1).split('\n')).toEqual(['| Coluna 1 | Coluna 2 |', '| --- | --- |', '|     |     |'])
  })

  it('remove formatação', () => {
    expect(stripFormatting('## **Olá** _mundo_ [link](http://x) `code` ~~x~~')).toBe('Olá mundo link code x')
    expect(stripFormatting('- item\r\n1. outro')).toBe('item\r\noutro')
  })
})
