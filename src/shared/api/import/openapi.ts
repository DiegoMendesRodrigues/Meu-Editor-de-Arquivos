// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Importar OpenAPI 3.0/3.1 e Swagger 2.0: uma requisição por operação, com exemplos e teste de status. */
import { API_LIMITS as L } from '../limits'
import type { Assertion, Auth, Body, KeyValue } from '../schema'
import {
  ImportError, Warnings, cleanFolder, cleanVariables, clip, kv, makeRequest,
  type ParsedImport
} from './common'

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']

/** Segue "$ref": "#/..." dentro do documento (com limite de profundidade contra ciclos). */
function deref(root: Json, node: unknown, depth = 0): unknown {
  if (!isObj(node) || typeof node.$ref !== 'string' || depth > 20) return node
  const ref = node.$ref
  if (!ref.startsWith('#/')) return {}
  let cur: unknown = root
  for (const part of ref.slice(2).split('/')) {
    if (!isObj(cur)) return {}
    cur = cur[part.replace(/~1/g, '/').replace(/~0/g, '~')]
  }
  return deref(root, cur, depth + 1)
}

/** Valor de exemplo gerado a partir do schema (profundidade limitada). */
function sample(root: Json, schemaRaw: unknown, depth = 0): unknown {
  const schema = deref(root, schemaRaw)
  if (!isObj(schema) || depth > 6) return null
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0]
  const allOf = schema.allOf
  if (Array.isArray(allOf)) {
    const merged: Json = {}
    for (const part of allOf) {
      const s = sample(root, part, depth + 1)
      if (isObj(s)) Object.assign(merged, s)
    }
    return merged
  }
  for (const key of ['oneOf', 'anyOf']) {
    const list = schema[key]
    if (Array.isArray(list) && list.length > 0) return sample(root, list[0], depth + 1)
  }
  const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') : schema.type
  switch (type) {
    case 'object': {
      const out: Json = {}
      const props = isObj(schema.properties) ? schema.properties : {}
      for (const [k, v] of Object.entries(props)) out[k] = sample(root, v, depth + 1)
      return out
    }
    case 'array': return [sample(root, schema.items, depth + 1)]
    case 'integer': return 0
    case 'number': return 0
    case 'boolean': return false
    case 'string': return schema.format === 'date-time' ? '2026-01-01T00:00:00Z' : schema.format === 'date' ? '2026-01-01' : 'string'
    default: return isObj(schema.properties) ? sample(root, { ...schema, type: 'object' }, depth) : null
  }
}

const scalar = (v: unknown): string => (v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))

function paramValue(root: Json, p: Json): string {
  if (p.example !== undefined) return scalar(p.example)
  if (p.default !== undefined) return scalar(p.default)
  const schema = deref(root, p.schema)
  if (isObj(schema)) return scalar(schema.example ?? schema.default ?? (Array.isArray(schema.enum) ? schema.enum[0] : ''))
  return ''
}

interface Security {
  /** Esquemas por nome → autorização equivalente. */
  schemes: Record<string, Auth | null>
}

function convertSecurityScheme(raw: unknown): Auth | null {
  if (!isObj(raw)) return null
  const type = str(raw.type)
  if (type === 'http') {
    const scheme = str(raw.scheme).toLowerCase()
    if (scheme === 'bearer') return { type: 'bearer', token: '{{token}}', prefix: 'Bearer' }
    if (scheme === 'basic') return { type: 'basic', username: '{{usuario}}', password: '{{senha}}' }
    return null
  }
  if (type === 'basic') return { type: 'basic', username: '{{usuario}}', password: '{{senha}}' }
  if (type === 'apiKey') return { type: 'apiKey', key: clip(str(raw.name), L.keyChars), value: '{{apiKey}}', in: raw.in === 'query' ? 'query' : 'header' }
  if (type === 'oauth2' || type === 'openIdConnect') return { type: 'bearer', token: '{{token}}', prefix: 'Bearer' }
  return null
}

export function parseOpenApi(data: unknown): ParsedImport {
  if (!isObj(data) || !isObj(data.paths)) throw new ImportError('invalid')
  const isV2 = typeof data.swagger === 'string'
  if (!isV2 && typeof data.openapi !== 'string') throw new ImportError('invalid')
  const warnings = new Warnings()
  const info = isObj(data.info) ? data.info : {}

  // URL base: servers[0] (3.x) ou schemes + host + basePath (2.0).
  let baseUrl = ''
  if (isV2) {
    const schemes = Array.isArray(data.schemes) ? data.schemes.map(str) : []
    const host = str(data.host)
    if (host) baseUrl = `${schemes.includes('https') || schemes.length === 0 ? 'https' : schemes[0]}://${host}${str(data.basePath).replace(/\/$/, '')}`
  } else if (Array.isArray(data.servers) && isObj(data.servers[0])) {
    baseUrl = str(data.servers[0].url).replace(/\/$/, '')
    const vars = isObj(data.servers[0].variables) ? data.servers[0].variables : {}
    for (const [k, v] of Object.entries(vars)) if (isObj(v)) baseUrl = baseUrl.split(`{${k}}`).join(str(v.default))
  }
  const variables = cleanVariables(baseUrl ? [{ key: 'baseUrl', value: baseUrl }] : [], warnings)

  // Esquemas de segurança.
  const rawSchemes = isV2 ? (isObj(data.securityDefinitions) ? data.securityDefinitions : {}) : isObj(data.components) && isObj(data.components.securitySchemes) ? data.components.securitySchemes : {}
  const sec: Security = { schemes: {} }
  for (const [name, def] of Object.entries(rawSchemes)) sec.schemes[name] = convertSecurityScheme(deref(data, def))
  const authFor = (requirements: unknown): Auth | undefined => {
    if (!Array.isArray(requirements) || requirements.length === 0) return undefined
    const first = requirements[0]
    if (!isObj(first)) return undefined
    const name = Object.keys(first)[0]
    if (name === undefined) return undefined
    const auth = sec.schemes[name]
    if (auth === undefined) return undefined
    if (auth === null) {
      warnings.add('unsupportedAuth')
      return undefined
    }
    return auth
  }

  const items: ParsedImport['items'] = []
  for (const [path, pathItemRaw] of Object.entries(data.paths)) {
    const pathItem = deref(data, pathItemRaw)
    if (!isObj(pathItem)) continue
    for (const m of METHODS) {
      const opRaw = pathItem[m]
      if (!isObj(opRaw)) continue
      try {
        items.push(convertOperation(data, isV2, m, path, pathItem, opRaw, authFor, warnings))
      } catch {
        warnings.add('invalidItem')
      }
    }
  }
  return { name: clip(str(info.title) || 'OpenAPI', L.nameChars), items, environments: [], variables, warnings: warnings.list() }
}

function convertOperation(
  root: Json, isV2: boolean, method: string, path: string, pathItem: Json, op: Json,
  authFor: (r: unknown) => Auth | undefined, warnings: Warnings
): ParsedImport['items'][number] {
  const tags = Array.isArray(op.tags) ? op.tags.map(str) : []
  const upper = method.toUpperCase()
  // {id} vira :id (seção de path params do construtor); a base fica na variável baseUrl.
  const url = `{{baseUrl}}${path.replace(/\{([^}]+)\}/g, ':$1')}`

  const rawParams = [...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []), ...(Array.isArray(op.parameters) ? op.parameters : [])]
    .map((p) => deref(root, p))
    .filter(isObj)
  const params: KeyValue[] = []
  const headers: KeyValue[] = []
  const formFields: Json[] = []
  let v2Body: Json | undefined
  for (const p of rawParams) {
    const where = str(p.in)
    const name = str(p.name)
    if (where === 'query') params.push(kv(name, paramValue(root, p), p.required === true, str(p.description) || undefined))
    else if (where === 'header') headers.push(kv(name, paramValue(root, p), p.required === true, str(p.description) || undefined))
    else if (where === 'formData') formFields.push(p)
    else if (where === 'body') v2Body = p
  }

  let body: Body = { type: 'none' }
  if (isV2) {
    const consumes = (Array.isArray(op.consumes) ? op.consumes : Array.isArray(root.consumes) ? root.consumes : []).map(str)
    if (v2Body) {
      const s = sample(root, v2Body.schema)
      body = { type: 'raw', language: 'json', text: JSON.stringify(s, null, 2) }
      if (!consumes.includes('application/json') && consumes.length > 0 && consumes[0]!.includes('xml')) body = { type: 'raw', language: 'xml', text: '' }
    } else if (formFields.length > 0) {
      const multipart = consumes.includes('multipart/form-data') || formFields.some((f) => f.type === 'file')
      body = multipart
        ? { type: 'multipart', parts: formFields.map((f) => ({ kind: 'text' as const, key: clip(str(f.name), L.keyChars), value: paramValue(root, f), enabled: f.required === true })) }
        : { type: 'urlencoded', fields: formFields.map((f) => kv(str(f.name), paramValue(root, f), f.required === true)) }
    }
  } else {
    const rb = deref(root, op.requestBody)
    const content = isObj(rb) && isObj(rb.content) ? rb.content : {}
    const types = Object.keys(content)
    const pick = types.find((t) => t.includes('json')) ?? types.find((t) => t.includes('x-www-form-urlencoded')) ?? types.find((t) => t.includes('multipart')) ?? types.find((t) => t.includes('xml')) ?? types[0]
    if (pick) {
      const media = isObj(content[pick]) ? (content[pick] as Json) : {}
      const example = media.example !== undefined ? media.example : isObj(media.examples) && isObj(Object.values(media.examples)[0]) ? (deref(root, Object.values(media.examples)[0]) as Json).value : sample(root, media.schema)
      if (pick.includes('json')) body = { type: 'raw', language: 'json', text: clip(JSON.stringify(example, null, 2) ?? '', L.bodyChars) }
      else if (pick.includes('xml')) body = { type: 'raw', language: 'xml', text: typeof example === 'string' ? example : '' }
      else if (pick.includes('x-www-form-urlencoded') || pick.includes('multipart')) {
        const schema = deref(root, media.schema)
        const props = isObj(schema) && isObj(schema.properties) ? schema.properties : {}
        const required = isObj(schema) && Array.isArray(schema.required) ? schema.required.map(str) : []
        const entries = Object.entries(props)
        body = pick.includes('multipart')
          ? { type: 'multipart', parts: entries.map(([k, v]) => ({ kind: 'text' as const, key: clip(k, L.keyChars), value: scalar(isObj(deref(root, v)) ? ((deref(root, v) as Json).example ?? '') : ''), enabled: required.includes(k) })) }
          : { type: 'urlencoded', fields: entries.map(([k, v]) => kv(k, scalar(isObj(deref(root, v)) ? ((deref(root, v) as Json).example ?? '') : ''), required.includes(k))) }
      } else body = { type: 'raw', language: 'text', text: typeof example === 'string' ? example : scalar(example) }
    }
  }

  // Teste de status: o primeiro código 2xx declarado.
  const tests: Assertion[] = []
  if (isObj(op.responses)) {
    const code = Object.keys(op.responses).find((c) => /^2\d\d$/.test(c))
    if (code) tests.push({ target: 'status', op: 'eq', expected: Number(code), enabled: true })
  }

  const auth = authFor(op.security ?? root.security)
  const name = str(op.summary) || str(op.operationId) || `${upper} ${path}`
  const request = makeRequest(
    { name, description: str(op.description) || undefined, method: upper, url, params, headers, auth: auth ?? { type: 'inherit' }, body, tests },
    warnings
  )
  return { folder: cleanFolder(tags.slice(0, 1)), request }
}
