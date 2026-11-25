// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { randomUUID } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'
import { API_LIMITS } from '@shared/api/limits'
import { MASK, type ApiErrorCode, type ApiHistoryEntry } from '@shared/api/protocol'
import { apiRequestSchema, type ApiRequest, type Auth, type Body } from '@shared/api/schema'
import { findVariables } from '@shared/api/variables'

/** Histórico de envios em userData/api-history.json: o mais novo primeiro, sem o corpo da resposta. */
const historyPath = (): string => join(app.getPath('userData'), 'api-history.json')

/** Cabeçalhos cujo valor nunca entra no histórico. */
const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization', 'x-api-key', 'set-cookie', 'x-auth-token', 'x-access-token', 'x-csrf-token', 'x-xsrf-token', 'x-amz-security-token', 'api-key', 'apikey'])

/** Nome de param, query ou cabeçalho que costuma levar segredo. */
const SENSITIVE_NAME_RE = /^(token|key|apikey|api[-_]?key|secret|password|passwd|senha|access[-_]?token|refresh[-_]?token|client[-_]?secret|auth|sig|signature)$|(token|secret|password|senha|api[-_]?key)/i

const isSensitiveName = (name: string): boolean => {
  const n = name.trim().replace(/^:/, '')
  return SENSITIVE_HEADERS.has(n.toLowerCase()) || SENSITIVE_NAME_RE.test(n)
}

/** Valor que é só uma referência {{variável}} não é segredo: pode ficar como está. */
const isReference = (value: string): boolean => {
  const tokens = findVariables(value)
  return tokens.length > 0 && tokens.map((t) => value.slice(t.start, t.end)).join('') === value.trim()
}

const maskLiteral = (value: string | undefined): string | undefined => (value === undefined || value === '' || isReference(value) ? value : MASK)

function maskAuth(auth: Auth): Auth {
  switch (auth.type) {
    case 'apiKey':
      return { ...auth, value: maskLiteral(auth.value) ?? '' }
    case 'basic':
      return { ...auth, password: maskLiteral(auth.password) ?? '' }
    case 'bearer':
      return { ...auth, token: maskLiteral(auth.token) ?? '' }
    case 'oauth1':
      return { ...auth, consumerSecret: maskLiteral(auth.consumerSecret) ?? '', token: maskLiteral(auth.token), tokenSecret: maskLiteral(auth.tokenSecret) }
    case 'oauth2':
      return { ...auth, clientSecret: maskLiteral(auth.clientSecret), username: maskLiteral(auth.username), password: maskLiteral(auth.password) }
    default:
      return auth
  }
}

const maskRow = <T extends { key: string; value: string }>(row: T): T => (isSensitiveName(row.key) && row.value !== '' && !isReference(row.value) ? { ...row, value: MASK } : row)

/** Troca a senha de "usuario:senha@" e os valores literais de parâmetros sensíveis na query da URL. */
function maskUrl(url: string): string {
  let out = url.replace(/^([a-z][a-z0-9+.-]*:\/\/[^/:@?#]*):([^/@?#]*)@/i, (m, head: string, pass: string) => (pass === '' || isReference(pass) ? m : `${head}:${MASK}@`))
  const q = out.indexOf('?')
  if (q >= 0) {
    const hash = out.indexOf('#', q)
    const query = out.slice(q + 1, hash < 0 ? undefined : hash)
    const masked = query
      .split('&')
      .map((pair) => {
        const eq = pair.indexOf('=')
        if (eq < 0) return pair
        const key = pair.slice(0, eq)
        const value = pair.slice(eq + 1)
        let decoded = key
        try {
          decoded = decodeURIComponent(key)
        } catch {
          // chave com escape inválido: usa como está
        }
        return isSensitiveName(decoded) && value !== '' && !isReference(value) ? `${key}=${MASK}` : pair
      })
      .join('&')
    out = out.slice(0, q + 1) + masked + (hash < 0 ? '' : out.slice(hash))
  }
  return out
}

/** Mascara valores de chaves sensíveis num JSON (em qualquer nível); texto que não é JSON cai para um padrão chave:valor. */
function maskJsonText(text: string): string {
  if (text.trim() === '') return text
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (isSensitiveName(k) && val !== null && typeof val !== 'object') o[k] = typeof val === 'string' && (val === '' || isReference(val)) ? val : MASK
        else o[k] = walk(val)
      }
      return o
    }
    return v
  }
  try {
    return JSON.stringify(walk(JSON.parse(text)), null, 2)
  } catch {
    // Não é JSON (XML, texto, JSON com {{variáveis}} soltas): troca pares "chave": valor, chave=valor e <chave>valor</chave>.
    return text
      .replace(/("([^"\\]{1,100})"\s*:\s*)("(?:[^"\\]|\\.)*"|[^\s,}\]]+)/g, (m, head: string, key: string, val: string) => (isSensitiveName(key) && !isReference(val.replace(/^"|"$/g, '')) && val !== '""' ? `${head}"${MASK}"` : m))
      .replace(/(^|[&\s])([A-Za-z0-9_.-]{1,100})=([^&\s]+)/g, (m, pre: string, key: string, val: string) => (isSensitiveName(key) && !isReference(val) ? `${pre}${key}=${MASK}` : m))
      .replace(/<([A-Za-z0-9_.:-]{1,100})>([^<]+)<\/\1>/g, (m, key: string, val: string) => (isSensitiveName(key) && !isReference(val) ? `<${key}>${MASK}</${key}>` : m))
  }
}

function maskBody(body: Body): Body {
  switch (body.type) {
    case 'raw':
      return { ...body, text: maskJsonText(body.text) }
    case 'urlencoded':
      return { ...body, fields: body.fields.map(maskRow) }
    case 'multipart':
      return { ...body, parts: body.parts.map((p) => (p.kind === 'text' && isSensitiveName(p.key) && p.value !== '' && !isReference(p.value) ? { ...p, value: MASK } : p)) }
    case 'graphql':
      return { ...body, variables: maskJsonText(body.variables) }
    case 'soap':
      return { ...body, envelope: maskJsonText(body.envelope) }
    default:
      return body
  }
}

/** Troca usuário e senha de "usuario:senha@" na URL do proxy (referências {{variável}} ficam). */
function maskProxyUrl(url: string): string {
  return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)([^/@?#]*)@/i, (m, head: string, info: string) => (info === '' || isReference(info) ? m : `${head}${MASK}@`))
}

/** A requisição como estava, com os valores sensíveis (URL, params, cabeçalhos e autorização digitados) mascarados. */
export function maskRequestForHistory(request: ApiRequest): ApiRequest {
  return {
    ...request,
    url: maskUrl(request.url),
    params: request.params.map(maskRow),
    headers: request.headers.map(maskRow),
    auth: maskAuth(request.auth),
    body: maskBody(request.body),
    settings: { ...request.settings, proxyUrl: maskProxyUrl(request.settings.proxyUrl) }
  }
}

let cache: ApiHistoryEntry[] | null = null
let writing: Promise<void> = Promise.resolve()

async function load(): Promise<ApiHistoryEntry[]> {
  if (cache) return cache
  let entries: ApiHistoryEntry[] = []
  try {
    const data = JSON.parse(await readFile(historyPath(), 'utf8')) as { entries?: unknown }
    if (Array.isArray(data.entries)) {
      for (const e of data.entries.slice(0, API_LIMITS.historyEntries)) {
        const request = apiRequestSchema.safeParse((e as { request?: unknown })?.request)
        if (request.success && typeof (e as ApiHistoryEntry).id === 'string') entries.push({ ...(e as ApiHistoryEntry), request: request.data })
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') log.warn('Cliente de API: histórico ilegível, começando vazio')
    entries = []
  }
  return (cache = entries)
}

/** Gravação atômica (arquivo temporário e rename), em fila: a última sempre vence. */
function persist(): Promise<void> {
  const text = JSON.stringify({ version: 1, entries: cache ?? [] })
  writing = writing
    .then(async () => {
      const tmp = `${historyPath()}.tmp`
      await writeFile(tmp, text, 'utf8')
      await rename(tmp, historyPath())
    })
    .catch(() => log.warn('Cliente de API: falha ao gravar o histórico'))
  return writing
}

export interface HistoryRecord {
  /** Requisição como no documento (com {{variáveis}}). */
  request: ApiRequest
  status?: number
  timeMs?: number
  errorCode?: ApiErrorCode
  environment?: string
}

export async function addHistory(rec: HistoryRecord): Promise<void> {
  const list = await load()
  const entry: ApiHistoryEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    method: rec.request.method,
    url: maskUrl(rec.request.url),
    status: rec.status,
    timeMs: rec.timeMs,
    errorCode: rec.errorCode,
    environment: rec.environment,
    request: maskRequestForHistory(rec.request)
  }
  list.unshift(entry)
  if (list.length > API_LIMITS.historyEntries) list.length = API_LIMITS.historyEntries
  await persist()
}

export const listHistory = async (): Promise<ApiHistoryEntry[]> => [...(await load())]

export async function clearHistory(): Promise<void> {
  cache = []
  await persist()
}

/** Só para os testes: esquece o cache em memória. */
export const resetHistoryCache = (): void => {
  cache = null
}
