// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Peças comuns dos importadores: montar requisições válidas no schema e cuidar dos limites. */
import { API_LIMITS as L } from '../limits'
import { apiRequestSchema, type ApiEnvironment, type ApiRequest, type Auth, type Body, type KeyValue } from '../schema'
import { VARIABLE_NAME_RE } from '../variables'

export interface ParsedImport {
  name: string
  items: { folder: string; request: ApiRequest }[]
  environments: ApiEnvironment[]
  variables: { key: string; value: string }[]
  warnings: string[]
}

export class ImportError extends Error {
  constructor(public readonly code: 'invalid' | 'unknownFormat') {
    super(code)
  }
}

/** Avisos sem repetição, por código. */
export class Warnings {
  private readonly set = new Set<string>()
  add(code: string): void {
    this.set.add(code)
  }
  list(): string[] {
    return [...this.set]
  }
}

export const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, max) : s)

export const kv = (key: string, value = '', enabled = true, description?: string): KeyValue => ({
  key: clip(key, L.keyChars),
  value: clip(value, L.valueChars),
  enabled,
  ...(description ? { description: clip(description, L.descriptionChars) } : {})
})

/** Troca a barra invertida e limpa os segmentos de uma pasta ("a/b"). */
export const cleanFolder = (parts: string[]): string =>
  parts
    .map((p) => p.replace(/[\\/:*?"<>|]+/g, '-').trim())
    .filter(Boolean)
    .join('/')

/** Separa a URL em base (sem query) e parâmetros; as {{variáveis}} ficam como estão. */
export function splitUrl(url: string): { url: string; params: KeyValue[] } {
  const hashAt = url.indexOf('#')
  const noHash = hashAt < 0 ? url : url.slice(0, hashAt)
  const q = noHash.indexOf('?')
  if (q < 0) return { url: noHash, params: [] }
  const params = noHash
    .slice(q + 1)
    .split('&')
    .filter((p) => p !== '')
    .map((pair) => {
      const eq = pair.indexOf('=')
      return kv(safeDecode(eq < 0 ? pair : pair.slice(0, eq)), eq < 0 ? '' : safeDecode(pair.slice(eq + 1)))
    })
  return { url: noHash.slice(0, q), params }
}

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    return s
  }
}

/** Corpo bruto: a linguagem vem do Content-Type (e, sem ele, do formato do texto). */
export function rawBody(text: string, contentType?: string): Body {
  const ct = (contentType ?? '').toLowerCase()
  let language: 'json' | 'xml' | 'text' | 'html' = 'text'
  if (ct.includes('json')) language = 'json'
  else if (ct.includes('xml')) language = 'xml'
  else if (ct.includes('html')) language = 'html'
  else if (!ct) {
    const t = text.trimStart()
    if (t.startsWith('{') || t.startsWith('[')) language = 'json'
    else if (t.startsWith('<')) language = 'xml'
  }
  return { type: 'raw', language, text: clip(text, L.bodyChars) }
}

/** Campos de formulário "a=1&b=2" (valores decodificados). */
export function parseForm(text: string): KeyValue[] {
  return text
    .split('&')
    .filter((p) => p !== '')
    .map((pair) => {
      const eq = pair.indexOf('=')
      return kv(safeDecode(eq < 0 ? pair : pair.slice(0, eq)), eq < 0 ? '' : safeDecode(pair.slice(eq + 1)))
    })
}

export const looksLikeForm = (text: string): boolean => /^[^\s=&{}[\]"<>]+=[^\s]*(&[^\s=&]+=[^\s]*)*$/.test(text.trim())

export function findHeader(headers: KeyValue[], name: string): string | undefined {
  return headers.find((h) => h.key.toLowerCase() === name.toLowerCase())?.value
}

export function removeHeader(headers: KeyValue[], name: string): KeyValue[] {
  return headers.filter((h) => h.key.toLowerCase() !== name.toLowerCase())
}

function decodeBase64(s: string): string | null {
  try {
    const bin = atob(s)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** Se o cabeçalho Authorization é Bearer ou Basic, vira a autorização da requisição e sai dos cabeçalhos. */
export function authFromHeaders(headers: KeyValue[]): { auth: Auth | null; headers: KeyValue[] } {
  const value = findHeader(headers, 'Authorization')
  if (value === undefined) return { auth: null, headers }
  const bearer = /^Bearer\s+(.*)$/i.exec(value)
  if (bearer) return { auth: { type: 'bearer', token: clip(bearer[1]!, L.valueChars), prefix: 'Bearer' }, headers: removeHeader(headers, 'Authorization') }
  const basic = /^Basic\s+(.*)$/i.exec(value)
  if (basic && !basic[1]!.includes('{{')) {
    const decoded = decodeBase64(basic[1]!.trim())
    const i = decoded?.indexOf(':') ?? -1
    if (decoded !== null && i >= 0) {
      return { auth: { type: 'basic', username: clip(decoded.slice(0, i), L.valueChars), password: clip(decoded.slice(i + 1), L.valueChars) }, headers: removeHeader(headers, 'Authorization') }
    }
  }
  return { auth: null, headers }
}

export interface RequestDraft {
  name?: string
  description?: string
  method?: string
  url?: string
  params?: KeyValue[]
  headers?: KeyValue[]
  auth?: Auth
  body?: Body
  settings?: { verifyTls?: boolean; followRedirects?: boolean; timeoutMs?: number }
  scripts?: { pre: string; post: string }
  tests?: ApiRequest['tests']
}

/** Monta a requisição passando pelo schema (limites de linhas e de tamanho aplicados, com aviso). */
export function makeRequest(draft: RequestDraft, warnings: Warnings): ApiRequest {
  const cut = <T>(rows: T[] | undefined): T[] => {
    const list = rows ?? []
    if (list.length > L.keyValueRows) warnings.add('truncated')
    return list.slice(0, L.keyValueRows)
  }
  const method = /^[A-Za-z][A-Za-z0-9_-]{0,19}$/.test(draft.method ?? '') ? draft.method! : 'GET'
  const settings: Record<string, unknown> = {}
  if (draft.settings?.verifyTls !== undefined) settings.verifyTls = draft.settings.verifyTls
  if (draft.settings?.followRedirects !== undefined) settings.followRedirects = draft.settings.followRedirects
  if (draft.settings?.timeoutMs !== undefined) settings.timeoutMs = Math.min(L.timeoutMaxMs, Math.max(L.timeoutMinMs, draft.settings.timeoutMs))
  return apiRequestSchema.parse({
    $schema: 'meu-editor/api-request@1',
    id: globalThis.crypto.randomUUID(),
    name: clip(draft.name ?? '', L.nameChars),
    ...(draft.description ? { description: clip(draft.description, L.requestDescriptionChars) } : {}),
    method,
    url: clip(draft.url ?? '', L.urlChars),
    params: cut(draft.params),
    headers: cut(draft.headers),
    auth: draft.auth ?? { type: 'inherit' },
    body: draft.body ?? { type: 'none' },
    settings,
    ...(draft.tests ? { tests: draft.tests.slice(0, L.assertions) } : {}),
    ...(draft.scripts ? { scripts: draft.scripts } : {})
  })
}

/** Nome padrão: "MÉTODO caminho". */
export function defaultName(method: string, url: string): string {
  const noVars = url.replace(/^\{\{[^}]*\}\}/, '')
  let path = noVars
  try {
    const u = new URL(url)
    path = u.pathname
  } catch {
    /* URL com variáveis: usa o texto sem a base */
  }
  return clip(`${method} ${path || url}`.trim(), L.nameChars)
}

export function makeEnvironment(name: string, vars: { key: string; value?: string; secret?: boolean }[], warnings: Warnings): ApiEnvironment {
  const seen = new Set<string>()
  const variables: ApiEnvironment['variables'] = []
  for (const v of vars) {
    if (!VARIABLE_NAME_RE.test(v.key) || seen.has(v.key)) {
      warnings.add('invalidItem')
      continue
    }
    seen.add(v.key)
    variables.push(v.secret ? { key: v.key, secret: true } : { key: v.key, value: clip(v.value ?? '', L.valueChars), secret: false })
  }
  if (variables.length > L.variables) warnings.add('truncated')
  return {
    $schema: 'meu-editor/api-environment@1',
    id: globalThis.crypto.randomUUID(),
    name: clip(name || 'Ambiente', L.nameChars),
    production: false,
    variables: variables.slice(0, L.variables)
  }
}

/** Variáveis da coleção sem repetição e com nome válido. */
export function cleanVariables(vars: { key: string; value: string }[], warnings: Warnings): { key: string; value: string }[] {
  const seen = new Set<string>()
  const out: { key: string; value: string }[] = []
  for (const v of vars) {
    if (!VARIABLE_NAME_RE.test(v.key) || seen.has(v.key)) {
      warnings.add('invalidItem')
      continue
    }
    seen.add(v.key)
    out.push({ key: v.key, value: clip(v.value, L.valueChars) })
  }
  return out.slice(0, L.variables)
}
