import type { Encoding, Eol } from '@shared/ipc'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

/** Decodifica um arquivo de texto, detectando BOM UTF-8 e o tipo de quebra de linha. */
export function decodeText(buf: Buffer): { content: string; encoding: Encoding; eol: Eol } {
  const hasBom = buf.length >= 3 && buf.subarray(0, 3).equals(UTF8_BOM)
  const content = (hasBom ? buf.subarray(3) : buf).toString('utf8')
  return { content, encoding: hasBom ? 'UTF-8 BOM' : 'UTF-8', eol: detectEol(content) }
}

export function encodeText(content: string, encoding: Encoding): Buffer {
  const body = Buffer.from(content, 'utf8')
  return encoding === 'UTF-8 BOM' ? Buffer.concat([UTF8_BOM, body]) : body
}

/** Usa a quebra de linha predominante; arquivos sem quebra seguem o padrão da plataforma. */
export function detectEol(content: string): Eol {
  const crlf = (content.match(/\r\n/g) ?? []).length
  const lf = (content.match(/\n/g) ?? []).length - crlf
  if (crlf === 0 && lf === 0) return process.platform === 'win32' ? 'CRLF' : 'LF'
  return crlf > lf ? 'CRLF' : 'LF'
}
