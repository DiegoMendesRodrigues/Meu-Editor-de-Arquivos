// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { ApiCookie, ApiResponseResult, ApiTimings, ApiTlsInfo, AssertionResult } from '@shared/api/protocol'
import { savedResponseSchema, type KeyValue, type SavedResponse } from '@shared/api/schema'

/** O que o painel mostra: serve para a resposta recém-chegada e para o arquivo .apiresp. */
export interface ViewResponse {
  status: number
  statusText: string
  httpVersion: string
  headers: KeyValue[]
  cookies: ApiCookie[]
  timings: ApiTimings
  tls?: Partial<ApiTlsInfo> & Pick<ApiTlsInfo, 'protocol' | 'issuer' | 'subject' | 'validTo' | 'authorized'>
  size: { headers: number; body: number; compressed?: number }
  body: { encoding: 'utf8' | 'base64'; text: string; contentType: string; truncated: boolean; savedTo?: string; file?: string }
  sentRequest: { method: string; url: string; headers: KeyValue[] }
  redirects: { status: number; url: string }[]
  /** Só na resposta recém-chegada (o arquivo salvo não guarda os testes). */
  tests?: AssertionResult[]
  missingVariables: string[]
  sentAt?: string
  environment?: string
}

export const fromResult = (r: ApiResponseResult, sentAt?: string | null, environment?: string | null): ViewResponse => ({
  status: r.status,
  statusText: r.statusText,
  httpVersion: r.httpVersion,
  headers: r.headers,
  cookies: r.cookies,
  timings: r.timings,
  tls: r.tls,
  size: r.size,
  body: r.body,
  sentRequest: r.sentRequest,
  redirects: r.redirects,
  tests: r.tests,
  missingVariables: r.missingVariables,
  sentAt: sentAt ?? undefined,
  environment: environment ?? undefined
})

export const fromSaved = (s: SavedResponse): ViewResponse => {
  const headerValue = (name: string): string => s.headers.find((h) => h.key.toLowerCase() === name)?.value ?? ''
  return {
    status: s.status,
    statusText: s.statusText,
    httpVersion: s.httpVersion,
    headers: s.headers,
    cookies: s.cookies,
    timings: s.timings,
    tls: s.tls,
    size: s.size,
    body: {
      encoding: 'file' in s.body ? 'utf8' : s.body.encoding,
      text: 'file' in s.body ? '' : s.body.text,
      contentType: headerValue('content-type'),
      truncated: s.truncated,
      file: 'file' in s.body ? s.body.file : undefined
    },
    sentRequest: s.request,
    redirects: [],
    missingVariables: [],
    sentAt: s.sentAt,
    environment: s.environment
  }
}

/** Monta o .apiresp a partir da resposta (a requisição enviada já vem com os segredos mascarados). */
export function toSavedResponse(r: ViewResponse, requestId: string): SavedResponse | null {
  const parsed = savedResponseSchema.safeParse({
    $schema: 'meu-editor/api-response@1',
    requestId,
    sentAt: r.sentAt ?? new Date().toISOString(),
    environment: r.environment,
    request: { method: r.sentRequest.method, url: r.sentRequest.url, headers: r.sentRequest.headers.slice(0, 100) },
    status: r.status,
    statusText: r.statusText,
    httpVersion: r.httpVersion,
    headers: r.headers.slice(0, 500),
    cookies: r.cookies.slice(0, 200).map((c) => ({ ...c, value: c.value.slice(0, 8192) })),
    timings: r.timings,
    tls: r.tls ? { protocol: r.tls.protocol, issuer: r.tls.issuer, subject: r.tls.subject, validTo: r.tls.validTo, authorized: r.tls.authorized } : undefined,
    size: r.size,
    body: { encoding: r.body.encoding, text: r.body.text },
    truncated: r.body.truncated
  })
  return parsed.success ? parsed.data : null
}

export type BodyKind = 'json' | 'xml' | 'html' | 'image' | 'text' | 'binary'

const IMAGE_TYPES = /^image\/(png|jpe?g|gif|webp)\b/i

/** Como exibir o corpo: o tipo da requisição manda; em "auto", vale o Content-Type recebido. */
export function bodyKind(body: ViewResponse['body'], forced: string = 'auto'): BodyKind {
  const ct = body.contentType.toLowerCase()
  if (IMAGE_TYPES.test(ct) && body.encoding === 'base64') return 'image'
  if (forced === 'json' || forced === 'xml' || forced === 'html' || forced === 'text') return forced
  if (forced === 'binary') return body.encoding === 'base64' ? 'binary' : 'text'
  if (/json/.test(ct)) return 'json'
  if (/xml/.test(ct)) return 'xml'
  if (/html/.test(ct)) return 'html'
  if (body.encoding === 'base64') return 'binary'
  return 'text'
}

/** Texto do corpo (utf8). Corpos em base64 que viram texto (ex.: tipo forçado) são decodificados. */
export function bodyText(body: ViewResponse['body']): string {
  if (body.encoding === 'utf8') return body.text
  try {
    const bin = atob(body.text)
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
  } catch {
    return ''
  }
}

export const statusClass = (status: number): string =>
  status >= 500 ? 'text-red-600' : status >= 400 ? 'text-amber-700' : status >= 300 ? 'text-sky-600' : status >= 200 ? 'text-emerald-700' : 'text-zinc-600'

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export const formatMs = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`)
