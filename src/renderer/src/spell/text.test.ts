// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadModule } from 'hunspell-asm'
import { extractWords, maskNonProse } from './text'

const words = (text: string, language = 'markdown'): string[] => extractWords(maskNonProse(text, language)).map((w) => w.word)

describe('maskNonProse', () => {
  it('mantém o tamanho e as quebras de linha', () => {
    const text = '# Título\n\n```js\nconst x = 1\n```\nTexto `codigo` fim\r\n'
    const masked = maskNonProse(text, 'markdown')
    expect(masked).toHaveLength(text.length)
    expect(masked.split(/\r?\n/)).toHaveLength(text.split(/\r?\n/).length)
  })

  it('ignora código, links, HTML, front matter e endereços no Markdown', () => {
    const text = [
      '---',
      'titel: xpto',
      '---',
      'Veja o [manual](docs/manuall.md) e <span class="classe">isto</span>.',
      '```',
      'funcaoo()',
      '```',
      'Use `varr` ou acesse https://exemplo.com/paginaa e mail@dominioo.com.',
      '[ref]: http://xyz.com/abcc'
    ].join('\n')
    expect(words(text)).toEqual(['Veja', 'manual', 'isto', 'Use', 'ou', 'acesse'])
  })

  it('em LaTeX ignora comandos, matemática e comentários', () => {
    expect(words('\\section{Introdução} texto $x^2$ % comentárioo', 'latex')).toEqual(['Introdução', 'texto'])
  })
})

describe('extractWords', () => {
  it('pula siglas, camelCase, letras soltas e palavras coladas a números', () => {
    expect(words('A ONU usa JavaScript e v2beta; o item_um é útil.', 'plaintext')).toEqual(['usa', 'útil'])
  })

  it('mantém apóstrofos e hífens dentro da palavra, com o deslocamento certo', () => {
    const list = extractWords(maskNonProse("l'homme guarda-chuva", 'plaintext'))
    expect(list).toEqual([
      { word: "l'homme", offset: 0 },
      { word: 'guarda-chuva', offset: 8 }
    ])
  })
})

describe('dicionários dos seis idiomas', () => {
  const cases: [string, string, string][] = [
    ['pt', 'coração', 'coracão'],
    ['pt-pt', 'facto', 'factu'],
    ['en', 'house', 'hosue'],
    ['es', 'canción', 'cancion'],
    ['fr', 'maison', 'maisson'],
    ['de', 'Straße', 'Strase']
  ]
  it.each(cases)('dictionary-%s reconhece "%s" e rejeita "%s"', async (pkg, good, bad) => {
    const f = await loadModule()
    const aff = f.mountBuffer(readFileSync(`node_modules/dictionary-${pkg}/index.aff`), `${pkg}.aff`)
    const dic = f.mountBuffer(readFileSync(`node_modules/dictionary-${pkg}/index.dic`), `${pkg}.dic`)
    const h = f.create(aff, dic)
    expect(h.spell(good)).toBe(true)
    expect(h.spell(bad)).toBe(false)
    expect(h.suggest(bad).length).toBeGreaterThan(0)
    h.dispose()
  })
})
