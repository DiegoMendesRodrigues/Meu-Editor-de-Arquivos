// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Apoio à leitura de WSDL com import/include: resolve os caminhos relativos (sempre com "/") e lista as
 * referências de um documento. Funções puras: o Main lê os arquivos e a thread só recebe o mapa de textos.
 */
import { parseXmlSafe } from '../xmlSafe'

type El = ReturnType<typeof parseXmlSafe>['documentElement']

/** Limites da leitura de arquivos referenciados. */
export const WSDL_FILE_LIMITS = { depth: 10, files: 50, fileBytes: 2 * 1024 * 1024 } as const

/** Arquivos lidos junto com o WSDL inicial: mapa {caminhoRelativo: texto} e avisos já conhecidos pelo Main. */
export interface WsdlFilesOption {
  /** Chave do próprio WSDL no mapa (nome do arquivo, relativo à pasta base). */
  mainKey: string
  files: Record<string, string>
  warnings?: string[]
}

/** URL com esquema (http, file...), unidade do Windows ou caminho absoluto: nada disso é lido. */
export const isRemoteOrAbsolute = (location: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(location) || /^[\\/]/.test(location)

/**
 * Chave relativa à pasta base do arquivo referenciado a partir de `fromKey`, ou null quando a referência
 * é inválida: absoluta, URL, vazia ou que sai da pasta base com "..".
 */
export function resolveWsdlLocation(fromKey: string, location: string): string | null {
  const loc = location.trim().split('#')[0].replace(/\\/g, '/')
  if (loc === '' || isRemoteOrAbsolute(loc) || loc.includes('\0')) return null
  const parts = fromKey.split('/').slice(0, -1)
  for (const seg of loc.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (parts.length === 0) return null
      parts.pop()
    } else parts.push(seg)
  }
  return parts.length === 0 ? null : parts.join('/')
}

const kidsOf = (el: El, local: string): El[] => {
  const out: El[] = []
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1 && (n as El).localName === local) out.push(n as El)
  return out
}

/** Locais referenciados por wsdl:import, xsd:import e xsd:include (inclusive os de schemas dentro de types). */
export function listWsdlReferences(root: El): string[] {
  const out: string[] = []
  const schemaRefs = (schema: El): void => {
    for (const tag of ['import', 'include', 'redefine']) for (const e of kidsOf(schema, tag)) out.push(e.getAttribute('schemaLocation') ?? '')
  }
  if (root.localName === 'schema') schemaRefs(root)
  else {
    for (const e of kidsOf(root, 'import')) out.push(e.getAttribute('location') ?? '')
    for (const types of kidsOf(root, 'types')) for (const schema of kidsOf(types, 'schema')) schemaRefs(schema)
  }
  return out.filter((l) => l.trim() !== '')
}
