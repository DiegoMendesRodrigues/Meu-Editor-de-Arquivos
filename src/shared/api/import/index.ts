// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Importadores do Cliente de API. Funções puras sobre texto: rodam numa thread do Main (importWorker.ts)
 * e também nos testes. Nada é enviado pela rede na importação.
 */
import { parse as parseYaml } from 'yaml'
import type { ApiImportFormat, ApiImportResponse } from '../protocol'
import { ImportError, type ParsedImport } from './common'
import { parseCurl } from './curl'
import { detectFormat, type DetectedFormat } from './detect'
import { parseHar } from './har'
import { parseHttp } from './http'
import { parseInsomnia } from './insomnia'
import { parseOpenApi } from './openapi'
import { parsePostman } from './postman'
import { urlFromParams } from '../urlParams'

export { detectFormat } from './detect'

function parseStructured(text: string, yamlAllowed: boolean): unknown {
  const t = text.replace(/^\uFEFF/, '')
  try {
    return JSON.parse(t)
  } catch (err) {
    if (!yamlAllowed) throw err
    return parseYaml(t, { maxAliasCount: 100 })
  }
}

function run(text: string, format: DetectedFormat): ParsedImport {
  switch (format) {
    case 'curl': return parseCurl(text)
    case 'http': return parseHttp(text)
    case 'postman': return parsePostman(parseStructured(text, false))
    case 'openapi': return parseOpenApi(parseStructured(text, true))
    case 'insomnia': return parseInsomnia(parseStructured(text, false))
    case 'har': return parseHar(parseStructured(text, false))
  }
}

/** Analisa o texto no formato dado (ou detectado, com "auto"). Nunca lança: devolve o código do problema. */
export function parseImport(text: string, format: ApiImportFormat = 'auto'): ApiImportResponse {
  const resolved = format === 'auto' ? detectFormat(text) : format
  if (!resolved) return { ok: false, code: 'unknownFormat' }
  try {
    const parsed = run(text, resolved)
    // Convenção do .apireq: a URL traz a query (a tabela Params é a mesma query, sincronizada no construtor).
    const items = parsed.items.map((it) => ({ ...it, request: { ...it.request, url: urlFromParams(it.request.url, it.request.params) } }))
    return { ok: true, format: resolved, ...parsed, items }
  } catch (err) {
    if (err instanceof ImportError) return { ok: false, code: err.code }
    return { ok: false, code: 'invalid' }
  }
}
