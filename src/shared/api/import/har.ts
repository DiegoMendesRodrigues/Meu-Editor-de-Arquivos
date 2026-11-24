// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Importar HAR 1.2 (exportação do navegador): uma requisição por entrada. */
import { API_LIMITS as L } from '../limits'
import type { Body, KeyValue } from '../schema'
import { ImportError, Warnings, authFromHeaders, defaultName, kv, makeRequest, rawBody, splitUrl, type ParsedImport } from './common'

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))

const MAX_ENTRIES = 2000
/** Cabeçalhos que o navegador calcula sozinho e que só atrapalhariam ao reenviar. */
const SKIP_HEADERS = new Set(['content-length', 'host', 'connection', 'accept-encoding', 'upgrade-insecure-requests'])

function convertBody(post: unknown): { body: Body; contentType: string } {
  if (!isObj(post)) return { body: { type: 'none' }, contentType: '' }
  const mime = str(post.mimeType)
  const params = Array.isArray(post.params) ? post.params.filter(isObj) : []
  if (mime.includes('x-www-form-urlencoded') && params.length > 0) {
    return { body: { type: 'urlencoded', fields: params.map((p) => kv(str(p.name), str(p.value))) }, contentType: mime }
  }
  if (mime.includes('multipart') && params.length > 0) {
    return { body: { type: 'multipart', parts: params.map((p) => ({ kind: 'text' as const, key: str(p.name), value: str(p.value), enabled: true })) }, contentType: mime }
  }
  const text = str(post.text)
  return { body: text ? rawBody(text, mime) : { type: 'none' }, contentType: mime }
}

export function parseHar(data: unknown): ParsedImport {
  if (!isObj(data) || !isObj(data.log) || !Array.isArray(data.log.entries)) throw new ImportError('invalid')
  const warnings = new Warnings()
  const items: ParsedImport['items'] = []
  const entries = data.log.entries
  if (entries.length > MAX_ENTRIES) warnings.add('truncated')
  for (const entry of entries.slice(0, MAX_ENTRIES)) {
    if (!isObj(entry) || !isObj(entry.request)) continue
    try {
      const r = entry.request
      const { url, params } = splitUrl(str(r.url))
      let headers: KeyValue[] = (Array.isArray(r.headers) ? r.headers : [])
        .filter(isObj)
        .filter((h) => !str(h.name).startsWith(':') && !SKIP_HEADERS.has(str(h.name).toLowerCase()))
        .map((h) => kv(str(h.name), str(h.value)))
      const { body } = convertBody(r.postData)
      if (body.type === 'urlencoded' || body.type === 'multipart') headers = headers.filter((h) => h.key.toLowerCase() !== 'content-type')
      const withAuth = authFromHeaders(headers)
      const method = str(r.method) || 'GET'
      items.push({ folder: '', request: makeRequest({ name: defaultName(method, str(r.url).split('?')[0] ?? ''), method, url, params, headers: withAuth.headers, auth: withAuth.auth ?? undefined, body }, warnings) })
    } catch {
      warnings.add('invalidItem')
    }
  }
  const creator = isObj(data.log.creator) ? str(data.log.creator.name) : ''
  return { name: creator ? `HAR (${creator})`.slice(0, L.nameChars) : 'HAR', items, environments: [], variables: [], warnings: warnings.list() }
}
