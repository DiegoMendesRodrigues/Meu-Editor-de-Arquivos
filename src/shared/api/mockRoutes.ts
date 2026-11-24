// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Geração das rotas do servidor mock (lógica pura): a partir dos exemplos salvos de uma coleção
 * (.apiresp listados em request.examples) ou de um documento OpenAPI 3.x / Swagger 2.
 */
import { parse as parseYaml } from 'yaml'
import type { ApiMockRoute } from './protocol'
import type { CollectionTree } from './collectionTypes'
import { savedResponseSchema } from './schema'

export type MockRoute = Pick<ApiMockRoute, 'method' | 'path' | 'status' | 'headers' | 'body' | 'example' | 'delayMs'>

/** Cabeçalhos que não fazem sentido repetir no mock (hop-by-hop, tamanho e codificação já resolvidos). */
const SKIP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
  'set-cookie'
])

/** Caminho da URL da requisição, sem host nem {{baseUrl}}, com :params. Sempre começa com "/". */
export function mockPathFromUrl(url: string): string {
  let rest = url.trim()
  // {{baseUrl}} (ou outra variável) no início faz o papel do host.
  rest = rest.replace(/^\{\{[^{}]*\}\}/, '')
  rest = rest.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '')
  rest = rest.split('#')[0]!.split('?')[0]!
  // {{var}} dentro do caminho vira :var.
  rest = rest.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, ':$1')
  if (!rest.startsWith('/')) rest = `/${rest}`
  return rest
}

/** Resolve um caminho relativo (de request.examples) a partir do .apireq, preservando o separador. */
export function examplePath(requestPath: string, rel: string): string {
  const back = requestPath.includes('\\')
  const parts = requestPath.replace(/\\/g, '/').split('/')
  parts.pop()
  for (const seg of rel.replace(/\\/g, '/').split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') parts.pop()
    else parts.push(seg)
  }
  const out = parts.join('/')
  return back ? out.replace(/\//g, '\\') : out
}

/** Caminhos de todos os exemplos referenciados pela coleção (para o Renderer ler). */
export function collectionExamplePaths(tree: CollectionTree): string[] {
  const set = new Set<string>()
  for (const item of tree.requests) for (const rel of item.request.examples) set.add(examplePath(item.path, rel))
  return [...set]
}

const baseName = (p: string): string => p.replace(/\\/g, '/').split('/').pop() ?? p

/** Rotas dos exemplos salvos. `contents` mapeia o caminho (de examplePath) ao texto do .apiresp. */
export function routesFromCollection(tree: CollectionTree, contents: Record<string, string>): MockRoute[] {
  const routes: MockRoute[] = []
  for (const item of tree.requests) {
    const path = mockPathFromUrl(item.request.url)
    for (const rel of item.request.examples) {
      const text = contents[examplePath(item.path, rel)]
      if (text === undefined) continue
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        continue
      }
      const parsed = savedResponseSchema.safeParse(json)
      if (!parsed.success) continue
      const res = parsed.data
      // Só corpo em texto: binário (base64) ou em arquivo ao lado não vira exemplo.
      if (!('encoding' in res.body) || res.body.encoding !== 'utf8') continue
      routes.push({
        method: item.request.method.toUpperCase(),
        path,
        status: Math.min(599, Math.max(100, res.status)),
        headers: res.headers.filter((h) => !SKIP_HEADERS.has(h.key.toLowerCase())).map((h) => ({ key: h.key, value: h.value })),
        body: res.body.text,
        example: baseName(rel).replace(/\.apiresp$/i, ''),
        delayMs: 0
      })
    }
  }
  return routes
}

/* ------------------------------------------------------------------ OpenAPI / Swagger */

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

const MAX_DEPTH = 5
const MAX_PROPS = 30
const MAX_ARRAY = 2
const MAX_NODES = 2000
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

/** Valor de exemplo para formatos comuns de string. */
function stringFor(format: unknown): string {
  switch (format) {
    case 'date':
      return '2024-01-15'
    case 'date-time':
      return '2024-01-15T10:30:00Z'
    case 'email':
      return 'usuario@exemplo.com.br'
    case 'uuid':
      return '3fa85f64-5717-4562-b3fc-2c963f66afa6'
    case 'uri':
    case 'url':
      return 'https://api.exemplo.com.br/recurso'
    case 'hostname':
      return 'api.exemplo.com.br'
    case 'ipv4':
      return '127.0.0.1'
    case 'byte':
      return 'ZXhlbXBsbw=='
    case 'password':
      return '********'
    default:
      return 'texto'
  }
}

function resolveRef(root: Json, ref: string): unknown {
  if (!ref.startsWith('#/')) return undefined
  let cur: unknown = root
  for (const part of ref.slice(2).split('/')) {
    if (!isObj(cur)) return undefined
    cur = cur[part.replace(/~1/g, '/').replace(/~0/g, '~')]
  }
  return cur
}

/** Gera um JSON de exemplo a partir de um schema (tipos, enum, formatos; profundidade e tamanho limitados). */
export function sampleFromSchema(schema: unknown, root: Json = {}): unknown {
  const state = { nodes: 0 }
  const walk = (s: unknown, depth: number, seen: string[]): unknown => {
    if (!isObj(s) || depth > MAX_DEPTH || ++state.nodes > MAX_NODES) return null
    if (typeof s.$ref === 'string') {
      if (seen.includes(s.$ref)) return null
      return walk(resolveRef(root, s.$ref), depth + 1, [...seen, s.$ref])
    }
    if ('example' in s) return s.example
    if ('default' in s) return s.default
    if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0]
    if ('const' in s) return s.const
    if (Array.isArray(s.allOf)) {
      const merged: Json = {}
      for (const part of s.allOf) {
        const v = walk(part, depth + 1, seen)
        if (isObj(v)) Object.assign(merged, v)
      }
      return merged
    }
    for (const key of ['oneOf', 'anyOf'] as const) {
      const alts = s[key]
      if (Array.isArray(alts) && alts.length > 0) return walk(alts[0], depth + 1, seen)
    }
    let type = s.type
    if (Array.isArray(type)) type = type.find((t) => t !== 'null') ?? 'null'
    if (!type) type = isObj(s.properties) ? 'object' : s.items ? 'array' : undefined
    switch (type) {
      case 'object': {
        const out: Json = {}
        const props = isObj(s.properties) ? Object.entries(s.properties).slice(0, MAX_PROPS) : []
        for (const [k, v] of props) out[k] = walk(v, depth + 1, seen)
        return out
      }
      case 'array': {
        const item = walk(s.items, depth + 1, seen)
        return item === null ? [] : Array.from({ length: MAX_ARRAY }, () => item)
      }
      case 'integer':
        return typeof s.minimum === 'number' ? s.minimum : 1
      case 'number':
        return typeof s.minimum === 'number' ? s.minimum : 1.5
      case 'boolean':
        return true
      case 'string':
        return stringFor(s.format)
      case 'null':
        return null
      default:
        return null
    }
  }
  return walk(schema, 0, [])
}

/** Caminho do OpenAPI: {id} vira :id. */
const openApiPath = (path: string): string => (path.startsWith('/') ? path : `/${path}`).replace(/\{([^{}/]+)\}/g, ':$1')

/** Escolhe a resposta 2xx (a menor); sem ela, "default" ou a primeira declarada. */
function pickResponse(responses: Json): { status: number; response: Json } | null {
  const codes = Object.keys(responses)
  const ok = codes.filter((c) => /^2\d\d$/.test(c)).sort()[0]
  const code = ok ?? (codes.includes('default') ? 'default' : codes[0])
  if (code === undefined) return null
  const response = responses[code]
  if (!isObj(response)) return null
  return { status: /^\d{3}$/.test(code) ? Number(code) : 200, response }
}

const pretty = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v, null, 2))

/** Rotas de um documento OpenAPI 3.x ou Swagger 2 (texto JSON ou YAML). Devolve null se não for reconhecido. */
export function routesFromOpenApi(text: string): MockRoute[] | null {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    try {
      doc = parseYaml(text)
    } catch {
      return null
    }
  }
  if (!isObj(doc) || !isObj(doc.paths)) return null
  const swagger2 = typeof doc.swagger === 'string' && doc.swagger.startsWith('2')
  if (!swagger2 && !(typeof doc.openapi === 'string' && doc.openapi.startsWith('3'))) return null
  const basePath = swagger2 && typeof doc.basePath === 'string' && doc.basePath !== '/' ? doc.basePath.replace(/\/+$/, '') : ''

  const routes: MockRoute[] = []
  for (const [rawPath, item] of Object.entries(doc.paths)) {
    if (!isObj(item)) continue
    for (const method of HTTP_METHODS) {
      const op = item[method]
      if (!isObj(op) || !isObj(op.responses)) continue
      const picked = pickResponse(op.responses)
      if (!picked) continue
      const path = `${basePath}${openApiPath(rawPath)}`
      const base = { method: method.toUpperCase(), path, status: picked.status, delayMs: 0 }
      const res = picked.response
      const resolved = typeof res.$ref === 'string' && isObj(resolveRef(doc, res.$ref)) ? (resolveRef(doc, res.$ref) as Json) : res
      const json = { key: 'Content-Type', value: 'application/json' }

      if (swagger2) {
        const examples = isObj(resolved.examples) ? resolved.examples : null
        const first = examples ? Object.entries(examples)[0] : undefined
        if (first) routes.push({ ...base, headers: [{ key: 'Content-Type', value: first[0] }], body: pretty(first[1]), example: '' })
        else if (resolved.schema !== undefined) routes.push({ ...base, headers: [json], body: pretty(sampleFromSchema(resolved.schema, doc)), example: '' })
        else routes.push({ ...base, headers: [], body: '', example: '' })
        continue
      }

      const content = isObj(resolved.content) ? resolved.content : {}
      const type = Object.keys(content).find((t) => /json/i.test(t)) ?? Object.keys(content)[0]
      const media = type ? content[type] : undefined
      if (!type || !isObj(media)) {
        routes.push({ ...base, headers: [], body: '', example: '' })
        continue
      }
      const header = { key: 'Content-Type', value: type }
      const named = isObj(media.examples) ? Object.entries(media.examples).filter(([, v]) => isObj(v) && 'value' in v) : []
      if (named.length > 0) {
        for (const [name, v] of named) routes.push({ ...base, headers: [header], body: pretty((v as Json).value), example: name.slice(0, 200) })
      } else if ('example' in media) {
        routes.push({ ...base, headers: [header], body: pretty(media.example), example: '' })
      } else if (media.schema !== undefined) {
        routes.push({ ...base, headers: [header], body: pretty(sampleFromSchema(media.schema, doc)), example: '' })
      } else {
        routes.push({ ...base, headers: [header], body: '', example: '' })
      }
    }
  }
  return routes
}
