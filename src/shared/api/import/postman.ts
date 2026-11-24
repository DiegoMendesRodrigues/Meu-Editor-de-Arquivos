// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Importar Postman Collection v2.0/v2.1 e arquivos de ambiente do Postman. */
import { API_LIMITS as L } from '../limits'
import type { Auth, Body, KeyValue } from '../schema'
import {
  ImportError, Warnings, authFromHeaders, cleanFolder, cleanVariables, clip, defaultName, kv, makeEnvironment, makeRequest, splitUrl,
  type ParsedImport, type RequestDraft
} from './common'

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** Lista [{key, value}] do Postman (bearer, basic, apikey) como mapa. */
function authMap(list: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of arr(list)) if (isObj(e) && typeof e.key === 'string') out[e.key] = str(e.value)
  return out
}

function convertAuth(raw: unknown, warnings: Warnings): Auth | undefined {
  if (!isObj(raw)) return undefined
  const type = str(raw.type)
  if (type === 'noauth') return { type: 'none' }
  const m = authMap(raw[type])
  switch (type) {
    case 'bearer': return { type: 'bearer', token: clip(m.token ?? '', L.valueChars), prefix: 'Bearer' }
    case 'basic': return { type: 'basic', username: clip(m.username ?? '', L.valueChars), password: clip(m.password ?? '', L.valueChars) }
    case 'apikey': return { type: 'apiKey', key: clip(m.key ?? '', L.keyChars), value: clip(m.value ?? '', L.valueChars), in: m.in === 'query' ? 'query' : 'header' }
    default:
      warnings.add('unsupportedAuth')
      return undefined
  }
}

function scriptText(event: unknown, listen: string): string {
  for (const e of arr(event)) {
    if (!isObj(e) || e.listen !== listen || !isObj(e.script)) continue
    const exec = e.script.exec
    return Array.isArray(exec) ? exec.map(str).join('\n') : str(exec)
  }
  return ''
}

function convertBody(raw: unknown, headers: KeyValue[], warnings: Warnings): Body {
  if (!isObj(raw)) return { type: 'none' }
  switch (raw.mode) {
    case 'raw': {
      const options = isObj(raw.options) && isObj(raw.options.raw) ? raw.options.raw : {}
      const lang = str(options.language)
      const language = lang === 'json' || lang === 'xml' || lang === 'html' ? lang : 'text'
      return { type: 'raw', language, text: clip(str(raw.raw), L.bodyChars) }
    }
    case 'urlencoded':
      return { type: 'urlencoded', fields: arr(raw.urlencoded).filter(isObj).map((f) => kv(str(f.key), str(f.value), f.disabled !== true, str(f.description) || undefined)) }
    case 'formdata':
      return {
        type: 'multipart',
        parts: arr(raw.formdata).filter(isObj).map((f) =>
          f.type === 'file'
            ? { kind: 'file' as const, key: clip(str(f.key), L.keyChars), path: clip(str(Array.isArray(f.src) ? f.src[0] : f.src), 4096), enabled: f.disabled !== true }
            : { kind: 'text' as const, key: clip(str(f.key), L.keyChars), value: clip(str(f.value), L.valueChars), enabled: f.disabled !== true }
        )
      }
    case 'graphql': {
      const g = isObj(raw.graphql) ? raw.graphql : {}
      return { type: 'graphql', query: clip(str(g.query), L.bodyChars), variables: clip(str(g.variables), L.bodyChars) }
    }
    case 'file': {
      const f = isObj(raw.file) ? raw.file : {}
      return { type: 'binary', path: clip(str(f.src), 4096) }
    }
    default:
      void headers
      warnings.add('unsupportedBody')
      return { type: 'none' }
  }
}

function convertUrl(raw: unknown): { url: string; params: KeyValue[] } {
  if (typeof raw === 'string') return splitUrl(raw)
  if (!isObj(raw)) return { url: '', params: [] }
  const base = str(raw.raw)
  const fromRaw = splitUrl(base)
  const query = arr(raw.query).filter(isObj)
  // A lista "query" do Postman guarda também os desligados; a URL bruta só traz os ligados.
  const params = query.length > 0 ? query.map((q) => kv(str(q.key), str(q.value), q.disabled !== true, str(q.description) || undefined)) : fromRaw.params
  return { url: fromRaw.url, params }
}

interface Ctx {
  warnings: Warnings
  items: ParsedImport['items']
}

function walk(list: unknown[], path: string[], inherited: Auth | undefined, ctx: Ctx): void {
  for (const node of list) {
    if (!isObj(node)) continue
    const name = str(node.name)
    if (Array.isArray(node.item)) {
      const folderAuth = convertAuth(node.auth, ctx.warnings)
      walk(node.item, [...path, name], folderAuth ?? inherited, ctx)
      continue
    }
    try {
      ctx.items.push({ folder: cleanFolder(path), request: convertRequest(node, inherited, ctx.warnings) })
    } catch {
      ctx.warnings.add('invalidItem')
    }
  }
}

function convertRequest(node: Json, inherited: Auth | undefined, warnings: Warnings) {
  // "request" pode ser só a URL (texto).
  const req: Json = isObj(node.request) ? node.request : { url: node.request }
  let headers = arr(req.header).filter(isObj).map((h) => kv(str(h.key), str(h.value), h.disabled !== true))
  const { url, params } = convertUrl(req.url)
  let auth = convertAuth(req.auth, warnings)
  if (!auth) {
    const fromHeader = authFromHeaders(headers)
    if (fromHeader.auth) {
      auth = fromHeader.auth
      headers = fromHeader.headers
    } else if (inherited) auth = inherited
  }
  const pre = scriptText(node.event, 'prerequest')
  const post = scriptText(node.event, 'test')
  if (pre || post) warnings.add('scriptsStored')
  const method = str(req.method) || 'GET'
  const draft: RequestDraft = {
    name: str(node.name) || defaultName(method, url),
    description: typeof req.description === 'string' ? req.description : isObj(req.description) ? str(req.description.content) : undefined,
    method,
    url,
    params,
    headers,
    auth,
    body: convertBody(req.body, headers, warnings),
    ...(pre || post ? { scripts: { pre, post } } : {})
  }
  return makeRequest(draft, warnings)
}

export function parsePostman(data: unknown): ParsedImport {
  if (!isObj(data)) throw new ImportError('invalid')
  const warnings = new Warnings()

  // Arquivo de ambiente (exportação de um ambiente do Postman).
  if (Array.isArray(data.values) && !Array.isArray(data.item)) {
    const vars = arr(data.values).filter(isObj).filter((v) => v.enabled !== false).map((v) => ({ key: str(v.key), value: str(v.value), secret: v.type === 'secret' }))
    return { name: str(data.name) || 'Postman', items: [], environments: [makeEnvironment(str(data.name), vars, warnings)], variables: [], warnings: warnings.list() }
  }

  if (!isObj(data.info) || !Array.isArray(data.item)) throw new ImportError('invalid')
  const ctx: Ctx = { warnings, items: [] }
  const collectionAuth = convertAuth(data.auth, warnings)
  walk(data.item, [], collectionAuth, ctx)
  // Scripts da coleção: guardados como aviso (o formato guarda scripts só por requisição).
  if (scriptText(data.event, 'prerequest') || scriptText(data.event, 'test')) warnings.add('scriptsStored')
  const variables = cleanVariables(
    arr(data.variable).filter(isObj).filter((v) => v.disabled !== true).map((v) => ({ key: str(v.key), value: str(v.value) })),
    warnings
  )
  return { name: clip(str(data.info.name) || 'Postman', L.nameChars), items: ctx.items, environments: [], variables, warnings: warnings.list() }
}
