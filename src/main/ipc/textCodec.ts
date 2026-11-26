// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { Encoding, Eol } from '@shared/ipc'
import { fromStoredText, predominantEol } from '@shared/eol'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

/**
 * Decodifica um arquivo de texto, detectando BOM UTF-8 e o tipo de quebra de linha.
 * Arquivos no formato Mac (CR) chegam com LF; a conversão de volta é feita ao gravar.
 */
export function decodeText(buf: Buffer): { content: string; encoding: Encoding; eol: Eol } {
  const hasBom = buf.length >= 3 && buf.subarray(0, 3).equals(UTF8_BOM)
  const raw = (hasBom ? buf.subarray(3) : buf).toString('utf8')
  const eol = detectEol(raw)
  return { content: fromStoredText(raw, eol), encoding: hasBom ? 'UTF-8 BOM' : 'UTF-8', eol }
}

export function encodeText(content: string, encoding: Encoding): Buffer {
  const body = Buffer.from(content, 'utf8')
  return encoding === 'UTF-8 BOM' ? Buffer.concat([UTF8_BOM, body]) : body
}

/** Usa a quebra de linha predominante; arquivos sem quebra seguem o padrão da plataforma. */
export function detectEol(content: string): Eol {
  return predominantEol(content) ?? (process.platform === 'win32' ? 'CRLF' : 'LF')
}
