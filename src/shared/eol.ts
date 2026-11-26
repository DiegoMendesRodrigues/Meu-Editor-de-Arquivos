// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { Eol } from './ipc'

/**
 * Quebras de linha. O Monaco só trabalha com LF e CRLF; por isso, um documento no formato
 * Mac (CR) fica com LF dentro do aplicativo e só é convertido para CR ao gravar.
 */

/** Conta as quebras de linha de cada tipo no texto. */
export function countEols(content: string): Record<Eol, number> {
  let crlf = 0
  let lf = 0
  let cr = 0
  for (let i = 0; i < content.length; i++) {
    const c = content.charCodeAt(i)
    if (c === 13) {
      if (content.charCodeAt(i + 1) === 10) {
        crlf++
        i++
      } else cr++
    } else if (c === 10) lf++
  }
  return { CRLF: crlf, LF: lf, CR: cr }
}

/** Quebra de linha predominante; null quando o texto não tem nenhuma. */
export function predominantEol(content: string): Eol | null {
  const n = countEols(content)
  if (n.CRLF === 0 && n.LF === 0 && n.CR === 0) return null
  if (n.CR > n.CRLF && n.CR > n.LF) return 'CR'
  return n.CRLF > n.LF ? 'CRLF' : 'LF'
}

/** Texto lido do disco (ou da nuvem) como o aplicativo o guarda: documentos CR passam a usar LF. */
export function fromStoredText(content: string, eol: Eol): string {
  return eol === 'CR' ? content.replace(/\r\n?/g, '\n') : content
}

/** Texto do aplicativo como deve ser gravado: documentos CR voltam a usar CR. */
export function toStoredText(content: string, eol: Eol): string {
  return eol === 'CR' ? content.replace(/\r\n|\n/g, '\r') : content
}

/** Troca todas as quebras de linha do texto pela sequência usada dentro do aplicativo para `eol`. */
export function applyEol(content: string, eol: Eol): string {
  return content.replace(/\r\n|\r|\n/g, eol === 'CRLF' ? '\r\n' : '\n')
}
