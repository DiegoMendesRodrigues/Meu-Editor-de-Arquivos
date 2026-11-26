// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Leitura segura de XML (respostas SOAP e arquivos WSDL), usada no Main e nas threads.
 * DOCTYPE é recusado de saída: sem DTD não há entidades externas (XXE) nem expansão exponencial.
 */
import { DOMParser } from '@xmldom/xmldom'

export const XML_MAX_CHARS = 20 * 1024 * 1024

export class XmlError extends Error {}

export function parseXmlSafe(text: string, maxChars = XML_MAX_CHARS): Document {
  const src = text.replace(/^\uFEFF/, '')
  if (src.length > maxChars || /<!DOCTYPE/i.test(src) || /<!ENTITY/i.test(src)) throw new XmlError('xml')
  try {
    const doc = new DOMParser({
      onError: (level: string, msg: string) => {
        if (level !== 'warning') throw new XmlError(msg)
      }
    }).parseFromString(src, 'text/xml') as unknown as Document
    if (!doc || !doc.documentElement) throw new XmlError('xml')
    return doc
  } catch {
    throw new XmlError('xml')
  }
}
