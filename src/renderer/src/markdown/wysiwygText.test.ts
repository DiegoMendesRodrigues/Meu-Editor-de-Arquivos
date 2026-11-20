// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { finishMarkdown, hasHtml, splitFrontMatter } from './wysiwygText'

describe('splitFrontMatter', () => {
  it('separa o bloco inicial e mantém o resto', () => {
    expect(splitFrontMatter('---\ntitle: A\n---\n# T\n')).toEqual({ frontMatter: '---\ntitle: A\n---\n', body: '# T\n' })
    expect(splitFrontMatter('# T\n\n---\n')).toEqual({ frontMatter: '', body: '# T\n\n---\n' })
  })
})

describe('hasHtml', () => {
  it('encontra HTML fora do código e ignora o que está em código', () => {
    expect(hasHtml('Texto <div>x</div>')).toBe(true)
    expect(hasHtml('<!-- nota -->')).toBe(true)
    expect(hasHtml('Use `<div>` aqui')).toBe(false)
    expect(hasHtml('```html\n<div></div>\n```\n')).toBe(false)
    expect(hasHtml('a < b e c > d')).toBe(false)
  })
})

describe('finishMarkdown', () => {
  it('remove linhas em branco duplicadas fora do código e mantém as do código', () => {
    expect(finishMarkdown('a\n\n\n\nb\n```\nx\n\n\ny\n```', 'a\n')).toBe('a\n\nb\n```\nx\n\n\ny\n```\n')
  })
  it('segue a quebra de linha final e o CRLF do original', () => {
    expect(finishMarkdown('a\n\nb', 'x\r\n')).toBe('a\r\n\r\nb\r\n')
    expect(finishMarkdown('a\n', 'x')).toBe('a\n')
  })
})
