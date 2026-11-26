// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { decodeText, detectEol, encodeText } from './textCodec'

describe('textCodec', () => {
  it('detecta e remove o BOM UTF-8', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('olá\n', 'utf8')])
    const r = decodeText(buf)
    expect(r.encoding).toBe('UTF-8 BOM')
    expect(r.content).toBe('olá\n')
  })

  it('preserva o BOM ao gravar', () => {
    const out = encodeText('a', 'UTF-8 BOM')
    expect([...out.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(encodeText('a', 'UTF-8').length).toBe(1)
  })

  it('identifica a quebra de linha predominante', () => {
    expect(detectEol('a\r\nb\r\nc\n')).toBe('CRLF')
    expect(detectEol('a\nb\nc\r\n')).toBe('LF')
    expect(detectEol('a\rb\rc\n')).toBe('CR')
  })

  it('entrega arquivos no formato Mac (CR) com LF', () => {
    const r = decodeText(Buffer.from('a\rb\rc', 'utf8'))
    expect(r.eol).toBe('CR')
    expect(r.content).toBe('a\nb\nc')
  })
})
