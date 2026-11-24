// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { ApiImportFormat } from '../protocol'

export type DetectedFormat = Exclude<ApiImportFormat, 'auto'>

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Descobre o formato pelo conteúdo; null se não reconhecer. */
export function detectFormat(text: string): DetectedFormat | null {
  const t = text.replace(/^\uFEFF/, '').trim()
  if (t === '') return null
  if (/^(?:[$>]\s*)?curl(?:\.exe)?\s/.test(t)) return 'curl'
  if (t.startsWith('{')) {
    try {
      const data: unknown = JSON.parse(t)
      if (isObj(data)) {
        if (isObj(data.info) && Array.isArray(data.item)) return 'postman'
        if (Array.isArray(data.values) && ('_postman_variable_scope' in data || 'name' in data)) return 'postman'
        if (typeof data.openapi === 'string' || typeof data.swagger === 'string') return 'openapi'
        if (Array.isArray(data.resources) && (data._type === 'export' || '__export_format' in data)) return 'insomnia'
        if (isObj(data.log) && Array.isArray(data.log.entries)) return 'har'
      }
    } catch {
      /* não é JSON válido: segue para os outros testes */
    }
    return null
  }
  if (/^(?:openapi|swagger)\s*:/m.test(t)) return 'openapi'
  if (/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+/im.test(t) || /^###/m.test(t)) return 'http'
  return null
}
