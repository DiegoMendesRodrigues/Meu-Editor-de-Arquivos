// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { applyEol, countEols, fromStoredText, predominantEol, toStoredText } from './eol'

describe('quebras de linha', () => {
  it('conta cada tipo sem confundir CRLF com CR e LF', () => {
    expect(countEols('a\r\nb\rc\nd\r\n')).toEqual({ CRLF: 2, LF: 1, CR: 1 })
  })

  it('identifica a predominante', () => {
    expect(predominantEol('a\rb\rc\n')).toBe('CR')
    expect(predominantEol('a\r\nb\r\nc\n')).toBe('CRLF')
    expect(predominantEol('a\nb')).toBe('LF')
    expect(predominantEol('sem quebra')).toBeNull()
  })

  it('documentos CR usam LF no app e CR ao gravar', () => {
    expect(fromStoredText('a\rb\r\nc', 'CR')).toBe('a\nb\nc')
    expect(toStoredText('a\nb\r\nc', 'CR')).toBe('a\rb\rc')
    expect(toStoredText('a\nb', 'LF')).toBe('a\nb')
  })

  it('converte todas as quebras para o formato escolhido', () => {
    expect(applyEol('a\r\nb\rc\nd', 'CRLF')).toBe('a\r\nb\r\nc\r\nd')
    expect(applyEol('a\r\nb\rc\nd', 'LF')).toBe('a\nb\nc\nd')
    expect(applyEol('a\r\nb\rc\nd', 'CR')).toBe('a\nb\nc\nd')
  })
})
