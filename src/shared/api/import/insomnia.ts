// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Importar exportações do Insomnia v4 (JSON com "resources"). */
import { API_LIMITS as L } from '../limits'
import type { Auth, Body, KeyValue } from '../schema'
import { ImportError, Warnings, cleanFolder, clip, defaultName, kv, makeEnvironment, makeRequest, splitUrl, type ParsedImport } from './common'

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))

/** As etiquetas de variável do Insomnia ({{ _.nome }}) viram {{nome}}. */
const tags = (s: string): string => s.replace(/\{\{\s*_\.([A-Za-z_$][\w.$-]*)\s*\}\}/g, '{{$1}}')

function convertAuth(raw: unknown, warnings: Warnings): Auth | undefined {
  if (!isObj(raw) || raw.disabled === true) return undefined
  const type = str(raw.type)
  if (type === 'bearer') return { type: 'bearer', token: clip(tags(str(raw.token)), L.valueChars), prefix: str(raw.prefix) || 'Bearer' }
  if (type === 'basic') return { type: 'basic', username: clip(tags(str(raw.username)), L.valueChars), password: clip(tags(str(raw.password)), L.valueChars) }
  if (type === 'apikey') return { type: 'apiKey', key: clip(tags(str(raw.key)), L.keyChars), value: clip(tags(str(raw.value)), L.valueChars), in: raw.addTo === 'queryParams' ? 'query' : 'header' }
  if (type !== '' && type !== 'none') warnings.add('unsupportedAuth')
  return undefined
}

function convertBody(raw: unknown, warnings: Warnings): Body {
  if (!isObj(raw) || (raw.mimeType === undefined && raw.text === undefined && raw.params === undefined)) return { type: 'none' }
  const mime = str(raw.mimeType)
  if (mime.includes('x-www-form-urlencoded')) {
    return { type: 'urlencoded', fields: (Array.isArray(raw.params) ? raw.params : []).filter(isObj).map((p) => kv(str(p.name), tags(str(p.value)), p.disabled !== true)) }
  }
  if (mime.includes('multipart')) {
    return {
      type: 'multipart',
      parts: (Array.isArray(raw.params) ? raw.params : []).filter(isObj).map((p) =>
        p.type === 'file'
          ? { kind: 'file' as const, key: clip(str(p.name), L.keyChars), path: clip(str(p.fileName), 4096), enabled: p.disabled !== true }
          : { kind: 'text' as const, key: clip(str(p.name), L.keyChars), value: clip(tags(str(p.value)), L.valueChars), enabled: p.disabled !== true }
      )
    }
  }
  if (mime.includes('graphql')) {
    try {
      const g = JSON.parse(str(raw.text)) as Json
      return { type: 'graphql', query: clip(str(g.query), L.bodyChars), variables: g.variables ? JSON.stringify(g.variables, null, 2) : '' }
    } catch {
      return { type: 'raw', language: 'json', text: clip(tags(str(raw.text)), L.bodyChars) }
    }
  }
  if (mime.includes('octet-stream') || mime === 'application/binary') {
    warnings.add('unsupportedBody')
    return { type: 'none' }
  }
  const language = mime.includes('json') ? 'json' : mime.includes('xml') ? 'xml' : mime.includes('html') ? 'html' : 'text'
  return { type: 'raw', language, text: clip(tags(str(raw.text)), L.bodyChars) }
}

export function parseInsomnia(data: unknown): ParsedImport {
  if (!isObj(data) || !Array.isArray(data.resources)) throw new ImportError('invalid')
  const warnings = new Warnings()
  const resources = data.resources.filter(isObj)
  const byId = new Map(resources.map((r) => [str(r._id), r]))
  const folderPath = (parentId: string): string[] => {
    const parts: string[] = []
    let cur = byId.get(parentId)
    for (let guard = 0; cur && str(cur._type) === 'request_group' && guard < 50; guard++) {
      parts.unshift(str(cur.name))
      cur = byId.get(str(cur.parentId))
    }
    return parts
  }

  const items: ParsedImport['items'] = []
  const environments: ParsedImport['environments'] = []
  let name = 'Insomnia'
  for (const r of resources) {
    const type = str(r._type)
    try {
      if (type === 'workspace') name = str(r.name) || name
      else if (type === 'environment') {
        const dataObj = isObj(r.data) ? r.data : {}
        const vars = Object.entries(dataObj)
          .filter(([, v]) => typeof v !== 'object' || v === null)
          .map(([key, v]) => ({ key, value: tags(str(v)) }))
        if (vars.length > 0) environments.push(makeEnvironment(str(r.name) || 'Ambiente', vars, warnings))
      } else if (type === 'request') {
        const { url, params: fromUrl } = splitUrl(tags(str(r.url)))
        const queryParams: KeyValue[] = (Array.isArray(r.parameters) ? r.parameters : []).filter(isObj).map((p) => kv(str(p.name), tags(str(p.value)), p.disabled !== true))
        const headers = (Array.isArray(r.headers) ? r.headers : []).filter(isObj).map((h) => kv(str(h.name), tags(str(h.value)), h.disabled !== true))
        const method = str(r.method) || 'GET'
        const body = convertBody(r.body, warnings)
        items.push({
          folder: cleanFolder(folderPath(str(r.parentId))),
          request: makeRequest(
            {
              name: str(r.name) || defaultName(method, url),
              description: str(r.description) || undefined,
              method,
              url,
              params: [...fromUrl, ...queryParams],
              headers: body.type === 'urlencoded' || body.type === 'multipart' ? headers.filter((h) => h.key.toLowerCase() !== 'content-type') : headers,
              auth: convertAuth(r.authentication, warnings),
              body
            },
            warnings
          )
        })
      }
    } catch {
      warnings.add('invalidItem')
    }
  }
  return { name: clip(name, L.nameChars), items, environments, variables: [], warnings: warnings.list() }
}
