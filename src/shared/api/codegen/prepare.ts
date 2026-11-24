// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Visão achatada de uma requisição para gerar código, .http, HAR e curl: URL completa, cabeçalhos
 * (inclusive os da autorização) e corpo já reduzido a poucos tipos. Só texto: variáveis e segredos
 * continuam como {{nome}} e nunca são resolvidos aqui.
 */
import type { ApiRequest } from '../schema'

export interface PreparedHeader {
  key: string
  value: string
}

export type PreparedBody =
  | { kind: 'none' }
  | { kind: 'text'; text: string }
  | { kind: 'form'; fields: PreparedHeader[] }
  | { kind: 'multipart'; parts: { key: string; value?: string; path?: string }[] }
  | { kind: 'file'; path: string }

export interface PreparedRequest {
  method: string
  /** URL com a query dos params já anexada. */
  url: string
  headers: PreparedHeader[]
  body: PreparedBody
  /** Autorização básica, quando pedida separada (curl -u). */
  basic?: { username: string; password: string }
  verifyTls: boolean
  followRedirects: boolean
  timeoutMs: number
}

const TOKEN_SPLIT = /(\{\{[^}]*\}\})/

/** Codifica para URL preservando os marcadores {{variável}}. */
export function encodeKeepingVariables(text: string): string {
  return text
    .split(TOKEN_SPLIT)
    .map((part) => (part.startsWith('{{') && part.endsWith('}}') ? part : encodeURIComponent(part)))
    .join('')
}

export function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/**
 * URL do documento (que já traz a query; a tabela Params é a mesma query) com os path params (:id)
 * trocados e a query extra (API Key em query) anexada.
 */
export function fullUrl(request: ApiRequest, extraQuery: PreparedHeader[] = []): string {
  request = { ...request, url: applyPathParamsText(request) }
  const pairs = [...extraQuery]
  if (pairs.length === 0) return request.url
  const [base, hash] = splitHash(request.url)
  const query = pairs.map((p) => `${encodeKeepingVariables(p.key)}=${encodeKeepingVariables(p.value)}`).join('&')
  const sep = base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?'
  return `${base}${sep}${query}${hash}`
}

function applyPathParamsText(request: ApiRequest): string {
  const [beforeQuery, rest] = ((i) => (i < 0 ? [request.url, ''] : [request.url.slice(0, i), request.url.slice(i)]))(request.url.search(/[?#]/))
  let path = beforeQuery
  for (const p of request.params) {
    if (!p.enabled || !p.key.startsWith(':') || p.key.length < 2) continue
    const name = p.key.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    path = path.replace(new RegExp(`/:${name}(?=/|$)`, 'g'), `/${p.value}`)
  }
  return path + rest
}

function splitHash(url: string): [string, string] {
  const i = url.indexOf('#')
  return i < 0 ? [url, ''] : [url.slice(0, i), url.slice(i)]
}

const hasHeader = (headers: PreparedHeader[], name: string): boolean => headers.some((h) => h.key.toLowerCase() === name.toLowerCase())

export const headerValue = (headers: PreparedHeader[], name: string): string | undefined =>
  headers.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value

const RAW_TYPES: Record<string, string> = { json: 'application/json', xml: 'application/xml', html: 'text/html', text: 'text/plain' }

export function prepareRequest(request: ApiRequest, options: { basicAsHeader?: boolean } = {}): PreparedRequest {
  const basicAsHeader = options.basicAsHeader ?? true
  const headers: PreparedHeader[] = request.headers.filter((h) => h.enabled && h.key !== '').map((h) => ({ key: h.key, value: h.value }))
  const extraQuery: PreparedHeader[] = []
  let basic: PreparedRequest['basic']

  const a = request.auth
  if (a.type === 'bearer') {
    headers.push({ key: 'Authorization', value: `${a.prefix ? `${a.prefix} ` : ''}${a.token}` })
  } else if (a.type === 'basic') {
    if (basicAsHeader) {
      const pair = `${a.username}:${a.password}`
      headers.push({ key: 'Authorization', value: `Basic ${pair.includes('{{') ? `{{base64(${pair})}}` : base64Utf8(pair)}` })
    } else basic = { username: a.username, password: a.password }
  } else if (a.type === 'apiKey' && a.key) {
    if (a.in === 'query') extraQuery.push({ key: a.key, value: a.value })
    else headers.push({ key: a.key, value: a.value })
  } else if (a.type === 'oauth2') {
    headers.push({ key: 'Authorization', value: `Bearer {{${a.tokenVar}}}` })
  }

  let body: PreparedBody = { kind: 'none' }
  const b = request.body
  const addType = (type: string): void => {
    if (!hasHeader(headers, 'Content-Type')) headers.push({ key: 'Content-Type', value: type })
  }
  if (b.type === 'raw') {
    body = { kind: 'text', text: b.text }
    addType(RAW_TYPES[b.language] ?? 'text/plain')
  } else if (b.type === 'urlencoded') {
    body = { kind: 'form', fields: b.fields.filter((f) => f.enabled && f.key !== '').map((f) => ({ key: f.key, value: f.value })) }
    addType('application/x-www-form-urlencoded')
  } else if (b.type === 'multipart') {
    body = { kind: 'multipart', parts: b.parts.filter((p) => p.enabled && p.key !== '').map((p) => (p.kind === 'file' ? { key: p.key, path: p.path } : { key: p.key, value: p.value })) }
  } else if (b.type === 'binary' && b.path) {
    body = { kind: 'file', path: b.path }
    addType('application/octet-stream')
  } else if (b.type === 'graphql') {
    const payload: Record<string, unknown> = { query: b.query }
    const vars = b.variables.trim()
    if (vars) {
      try {
        payload.variables = JSON.parse(vars)
      } catch {
        payload.variables = vars
      }
    }
    if (b.operationName) payload.operationName = b.operationName
    body = { kind: 'text', text: JSON.stringify(payload) }
    addType('application/json')
  } else if (b.type === 'soap') {
    body = { kind: 'text', text: b.envelope }
    if (b.version === '1.2') addType(`application/soap+xml; charset=utf-8${b.action ? `; action="${b.action}"` : ''}`)
    else {
      addType('text/xml; charset=utf-8')
      if (!hasHeader(headers, 'SOAPAction')) headers.push({ key: 'SOAPAction', value: `"${b.action}"` })
    }
  }

  return {
    method: request.method,
    url: fullUrl(request, extraQuery),
    headers,
    body,
    basic,
    verifyTls: request.settings.verifyTls,
    followRedirects: request.settings.followRedirects,
    timeoutMs: request.settings.timeoutMs
  }
}
