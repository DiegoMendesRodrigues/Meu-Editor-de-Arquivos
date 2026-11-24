// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Exportar como OpenAPI 3.1 básico (YAML): uma operação por requisição, com exemplos do corpo. */
import { stringify } from 'yaml'
import type { ApiRequest } from '../schema'
import type { ExportInput } from './types'

type Json = Record<string, unknown>

/** Separa a base (origem ou {{variável}}) do caminho. */
function splitBase(url: string): { base: string; path: string } {
  const m = /^(\{\{[^}]*\}\}|[a-z][a-z0-9+.-]*:\/\/[^/?#]*)(.*)$/i.exec(url)
  const base = m ? m[1]! : ''
  const rest = m ? m[2]! : url
  const path = (rest.split(/[?#]/)[0] ?? '') || '/'
  return { base, path: path.startsWith('/') ? path : `/${path}` }
}

const toOpenApiPath = (path: string): string => path.replace(/:([A-Za-z_][\w-]*)/g, '{$1}')
const operationId = (name: string, used: Set<string>): string => {
  const base = name.replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : '')).replace(/^[^A-Za-z]+/, '') || 'operation'
  let id = base[0]!.toLowerCase() + base.slice(1)
  for (let n = 2; used.has(id); n++) id = `${base[0]!.toLowerCase() + base.slice(1)}${n}`
  used.add(id)
  return id
}

function bodyContent(request: ApiRequest): Json | undefined {
  const b = request.body
  if (b.type === 'raw') {
    if (b.language === 'json') {
      let example: unknown = b.text
      try {
        example = JSON.parse(b.text)
      } catch {
        /* texto que não é JSON válido fica como texto */
      }
      return { required: true, content: { 'application/json': { example } } }
    }
    const type = b.language === 'xml' ? 'application/xml' : b.language === 'html' ? 'text/html' : 'text/plain'
    return { required: true, content: { [type]: { example: b.text } } }
  }
  if (b.type === 'urlencoded') {
    const properties = Object.fromEntries(b.fields.filter((f) => f.key).map((f) => [f.key, { type: 'string', example: f.value }]))
    return { required: true, content: { 'application/x-www-form-urlencoded': { schema: { type: 'object', properties } } } }
  }
  if (b.type === 'multipart') {
    const properties = Object.fromEntries(b.parts.filter((p) => p.key).map((p) => [p.key, p.kind === 'file' ? { type: 'string', format: 'binary' } : { type: 'string', example: p.value }]))
    return { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties } } } }
  }
  if (b.type === 'graphql') return { required: true, content: { 'application/json': { example: { query: b.query } } } }
  if (b.type === 'soap') return { required: true, content: { 'text/xml': { example: b.envelope } } }
  if (b.type === 'binary') return { required: true, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }
  return undefined
}

export function exportOpenApi(input: ExportInput): string {
  const used = new Set<string>()
  const servers = new Map<string, true>()
  const paths: Record<string, Json> = {}
  const schemes: Record<string, Json> = {}

  for (const { folder, request } of input.items) {
    const { base, path } = splitBase(request.url)
    const baseVar = /^\{\{([^}]*)\}\}$/.exec(base)
    const baseValue = baseVar ? (input.variables.find((v) => v.key === baseVar[1]!.trim())?.value ?? '') : base
    if (baseValue) servers.set(baseValue.replace(/\/$/, ''), true)
    const oaPath = toOpenApiPath(path)
    const method = request.method.toLowerCase()
    const item = (paths[oaPath] ??= {})
    if (item[method]) continue

    const parameters: Json[] = []
    for (const m of path.matchAll(/:([A-Za-z_][\w-]*)/g)) parameters.push({ name: m[1], in: 'path', required: true, schema: { type: 'string' } })
    for (const p of request.params.filter((x) => x.key)) parameters.push({ name: p.key, in: 'query', required: p.enabled, schema: { type: 'string' }, ...(p.value ? { example: p.value } : {}), ...(p.description ? { description: p.description } : {}) })
    const skip = new Set(['content-type', 'authorization', 'accept'])
    for (const h of request.headers.filter((x) => x.key && !skip.has(x.key.toLowerCase()))) parameters.push({ name: h.key, in: 'header', required: h.enabled, schema: { type: 'string' }, ...(h.value ? { example: h.value } : {}) })

    const op: Json = {
      operationId: operationId(request.name || `${method} ${path}`, used),
      summary: request.name || `${request.method} ${path}`,
      ...(request.description ? { description: request.description } : {}),
      ...(folder ? { tags: [folder.split('/')[0]] } : {}),
      ...(parameters.length > 0 ? { parameters } : {})
    }
    const body = bodyContent(request)
    if (body && !['get', 'head'].includes(method)) op.requestBody = body
    const expected = request.tests.find((t) => t.target === 'status' && t.op === 'eq' && typeof t.expected === 'number')
    op.responses = { [String(expected?.expected ?? 200)]: { description: 'Resposta' } }

    const a = request.auth
    if (a.type === 'bearer') {
      schemes.bearerAuth = { type: 'http', scheme: 'bearer' }
      op.security = [{ bearerAuth: [] }]
    } else if (a.type === 'basic') {
      schemes.basicAuth = { type: 'http', scheme: 'basic' }
      op.security = [{ basicAuth: [] }]
    } else if (a.type === 'apiKey' && a.key) {
      schemes.apiKeyAuth = { type: 'apiKey', name: a.key, in: a.in }
      op.security = [{ apiKeyAuth: [] }]
    }
    item[method] = op
  }

  const doc: Json = {
    openapi: '3.1.0',
    info: { title: input.name, version: '1.0.0', ...(input.description ? { description: input.description } : {}) },
    ...(servers.size > 0 ? { servers: [...servers.keys()].map((url) => ({ url })) } : {}),
    paths,
    ...(Object.keys(schemes).length > 0 ? { components: { securitySchemes: schemes } } : {})
  }
  return stringify(doc, { lineWidth: 0 })
}
