// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Importar comandos curl (bash, PowerShell com curl.exe e cmd do Windows). */
import { API_LIMITS as L } from '../limits'
import type { Auth, KeyValue, Body } from '../schema'
import {
  ImportError, Warnings, authFromHeaders, clip, defaultName, findHeader, kv, looksLikeForm, makeRequest, parseForm, rawBody, splitUrl,
  type ParsedImport
} from './common'

type Flavor = 'bash' | 'powershell' | 'cmd'

function detectFlavor(src: string): Flavor {
  if (/\^\r?\n/.test(src) || /\^"/.test(src)) return 'cmd'
  if (/`\r?\n/.test(src) || /^\s*curl\.exe\b/m.test(src)) return 'powershell'
  return 'bash'
}

/** Junta as linhas continuadas e tira o escape do cmd (^). */
function normalize(src: string, flavor: Flavor): string {
  let s = src.replace(/\r\n/g, '\n')
  if (flavor === 'cmd') s = s.replace(/\^\n/g, ' ').replace(/\^(.)/gs, '$1')
  else if (flavor === 'powershell') s = s.replace(/`\n/g, ' ')
  return s.replace(/\\\n/g, ' ')
}

const ANSI_ESC: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' }

/** Separa em argumentos como um shell (aspas simples e duplas, escapes, $'...'). */
export function tokenize(src: string, flavor: Flavor): string[] {
  const ps = flavor === 'powershell'
  const out: string[] = []
  let cur = ''
  let has = false
  let i = 0
  const flush = (): void => {
    if (has) out.push(cur)
    cur = ''
    has = false
  }
  while (i < src.length) {
    const c = src[i]!
    if (/\s/.test(c)) {
      flush()
      i++
      continue
    }
    has = true
    if (c === "'") {
      i++
      while (i < src.length) {
        if (src[i] === "'") {
          if (ps && src[i + 1] === "'") {
            cur += "'"
            i += 2
            continue
          }
          break
        }
        cur += src[i++]
      }
      i++
    } else if (c === '$' && src[i + 1] === "'" && !ps) {
      i += 2
      while (i < src.length && src[i] !== "'") {
        if (src[i] === '\\' && i + 1 < src.length) {
          const n = src[i + 1]!
          if (n === 'u' && /^[0-9a-fA-F]{4}/.test(src.slice(i + 2, i + 6))) {
            cur += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16))
            i += 6
            continue
          }
          cur += ANSI_ESC[n] ?? n
          i += 2
        } else cur += src[i++]
      }
      i++
    } else if (c === '"') {
      i++
      while (i < src.length) {
        const d = src[i]!
        if (d === '"') {
          if (ps && src[i + 1] === '"') {
            cur += '"'
            i += 2
            continue
          }
          break
        }
        if (d === '\\' && '"\\$`'.includes(src[i + 1] ?? '')) {
          cur += src[i + 1]
          i += 2
        } else if (ps && d === '`' && i + 1 < src.length) {
          const n = src[i + 1]!
          cur += n === 'n' ? '\n' : n === 't' ? '\t' : n
          i += 2
        } else cur += src[i++]
      }
      i++
    } else if (c === '\\' && !ps && i + 1 < src.length) {
      cur += src[i + 1]
      i += 2
    } else if (c === '`' && ps && i + 1 < src.length) {
      cur += src[i + 1]
      i += 2
    } else {
      cur += c
      i++
    }
  }
  flush()
  return out
}

/** Opções curl que recebem um argumento. */
const SHORT_WITH_ARG = new Set(['X', 'H', 'd', 'F', 'u', 'b', 'A', 'e', 'm', 'x', 'o', 'T', 'w', 'c', 'K', 'E', 'D', 'r', 'y', 'Y', 'z', 'C'])
const LONG_WITH_ARG = new Set([
  'request', 'header', 'data', 'data-raw', 'data-binary', 'data-ascii', 'data-urlencode', 'form', 'form-string', 'user', 'cookie', 'user-agent',
  'referer', 'max-time', 'proxy', 'output', 'upload-file', 'url', 'json', 'max-redirs', 'connect-timeout', 'oauth2-bearer', 'cacert', 'cert', 'key',
  'write-out', 'cookie-jar', 'config', 'range', 'retry', 'resolve', 'http-version'
])
const SHORT_TO_LONG: Record<string, string> = {
  X: 'request', H: 'header', d: 'data', F: 'form', u: 'user', b: 'cookie', A: 'user-agent', e: 'referer', m: 'max-time', x: 'proxy', o: 'output', T: 'upload-file',
  I: 'head', G: 'get', k: 'insecure', L: 'location'
}
/** Opções sem efeito na requisição que não geram aviso. */
const IGNORED = new Set(['s', 'S', 'v', 'i', 'f', 'O', 'silent', 'show-error', 'verbose', 'include', 'fail', 'compressed', 'progress-bar', 'no-progress-meter', 'http1.1', 'http2', 'http1.0', 'globoff', 'g', 'output', 'remote-name', 'fail-with-body', 'no-keepalive', 'ipv4', 'ipv6', '4', '6', 'write-out', 'w', 'location-trusted', 'tr-encoding', 'path-as-is', 'http-version', 'retry', 'cookie-jar', 'c'])

interface CurlState {
  method?: string
  url?: string
  headers: KeyValue[]
  data: { text: string; encode: boolean; file?: boolean }[]
  forms: { key: string; value?: string; path?: string }[]
  user?: string
  jsonBody?: string
  get: boolean
  head: boolean
  insecure: boolean
  location: boolean
  maxTime?: number
  bearer?: string
  unsupported: boolean
}

function parseTokens(tokens: string[]): CurlState {
  const st: CurlState = { headers: [], data: [], forms: [], get: false, head: false, insecure: false, location: false, unsupported: false }
  const apply = (name: string, value: string | undefined): void => {
    const v = value ?? ''
    switch (name) {
      case 'request': st.method = v.toUpperCase(); break
      case 'header': {
        const i = v.indexOf(':')
        if (i > 0) st.headers.push(kv(v.slice(0, i).trim(), v.slice(i + 1).trim()))
        break
      }
      case 'data': case 'data-raw': case 'data-ascii': st.data.push({ text: v, encode: false, file: name === 'data' && v.startsWith('@') && v.length > 1 }); break
      case 'data-binary': st.data.push({ text: v, encode: false, file: v.startsWith('@') && v.length > 1 }); break
      case 'data-urlencode': st.data.push({ text: v, encode: true }); break
      case 'json': st.jsonBody = v; break
      case 'form': case 'form-string': {
        const eq = v.indexOf('=')
        if (eq < 0) break
        const key = v.slice(0, eq)
        const val = v.slice(eq + 1)
        if (name === 'form' && val.startsWith('@')) st.forms.push({ key, path: val.slice(1).split(';')[0] })
        else st.forms.push({ key, value: name === 'form' ? val.split(';type=')[0] : val })
        break
      }
      case 'user': st.user = v; break
      case 'cookie': if (v.includes('=')) st.headers.push(kv('Cookie', v)); break
      case 'user-agent': st.headers.push(kv('User-Agent', v)); break
      case 'referer': st.headers.push(kv('Referer', v)); break
      case 'max-time': st.maxTime = Number(v) || undefined; break
      case 'url': st.url = v; break
      case 'oauth2-bearer': st.bearer = v; break
      case 'head': st.head = true; break
      case 'get': st.get = true; break
      case 'insecure': st.insecure = true; break
      case 'location': st.location = true; break
      default:
        if (!IGNORED.has(name)) st.unsupported = true
    }
  }
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i]!
    if (tok.startsWith('--') && tok.length > 2) {
      let name = tok.slice(2)
      let value: string | undefined
      const eq = name.indexOf('=')
      if (eq > 0) {
        value = name.slice(eq + 1)
        name = name.slice(0, eq)
      }
      if (LONG_WITH_ARG.has(name) && value === undefined) value = tokens[++i]
      apply(name, value)
    } else if (tok.startsWith('-') && tok.length > 1) {
      for (let j = 1; j < tok.length; j++) {
        const ch = tok[j]!
        if (SHORT_WITH_ARG.has(ch)) {
          const rest = tok.slice(j + 1)
          apply(SHORT_TO_LONG[ch] ?? ch, rest !== '' ? rest : tokens[++i])
          break
        }
        apply(SHORT_TO_LONG[ch] ?? ch, undefined)
      }
    } else if (st.url === undefined) st.url = tok
  }
  return st
}

function toRequest(st: CurlState, warnings: Warnings) {
  if (st.unsupported) warnings.add('unsupportedOption')
  let headers = st.headers
  const contentType = findHeader(headers, 'Content-Type')
  let body: Body = { type: 'none' }
  if (st.jsonBody !== undefined) {
    body = rawBody(st.jsonBody, 'application/json')
    if (!contentType) headers = [...headers, kv('Content-Type', 'application/json')]
  } else if (st.forms.length > 0) {
    body = { type: 'multipart', parts: st.forms.map((f) => (f.path !== undefined ? { kind: 'file' as const, key: f.key, path: f.path, enabled: true } : { kind: 'text' as const, key: f.key, value: f.value ?? '', enabled: true })) }
  } else if (st.data.length > 0) {
    const first = st.data[0]!
    if (first.file && st.data.length === 1) body = { type: 'binary', path: first.text.slice(1) }
    else if (st.data.every((d) => d.encode) || (!contentType && st.data.every((d) => d.encode || looksLikeForm(d.text))) || contentType?.toLowerCase().includes('x-www-form-urlencoded')) {
      const fields: KeyValue[] = []
      for (const d of st.data) {
        if (d.encode) {
          const eq = d.text.indexOf('=')
          fields.push(eq < 0 ? kv('', d.text) : kv(d.text.slice(0, eq), d.text.slice(eq + 1)))
        } else fields.push(...parseForm(d.text))
      }
      body = { type: 'urlencoded', fields }
      if (!contentType) headers = [...headers, kv('Content-Type', 'application/x-www-form-urlencoded')]
    } else body = rawBody(st.data.map((d) => d.text).join('&'), contentType)
  }
  const hasBody = body.type !== 'none'
  const method = st.head ? 'HEAD' : (st.method ?? (hasBody && !st.get ? 'POST' : 'GET'))

  // Content-Type de formulário e de multipart é implícito no corpo; o resto fica como cabeçalho.
  if (body.type === 'urlencoded') headers = headers.filter((h) => h.key.toLowerCase() !== 'content-type')
  if (body.type === 'multipart') headers = headers.filter((h) => h.key.toLowerCase() !== 'content-type')

  let auth: Auth | undefined
  if (st.user !== undefined) {
    const i = st.user.indexOf(':')
    auth = { type: 'basic', username: clip(i < 0 ? st.user : st.user.slice(0, i), L.valueChars), password: clip(i < 0 ? '' : st.user.slice(i + 1), L.valueChars) }
  } else if (st.bearer !== undefined) auth = { type: 'bearer', token: st.bearer, prefix: 'Bearer' }
  else {
    const r = authFromHeaders(headers)
    auth = r.auth ?? undefined
    headers = r.headers
  }

  const { url, params } = splitUrl(st.url ?? '')
  // -G manda os dados na query em vez do corpo.
  let extraParams: KeyValue[] = []
  if (st.get && st.data.length > 0) {
    extraParams = st.data.flatMap((d) => parseForm(d.text))
    body = { type: 'none' }
  }
  return makeRequest(
    {
      name: defaultName(method, st.url ?? ''),
      method,
      url,
      params: [...params, ...extraParams],
      headers,
      auth,
      body,
      settings: { verifyTls: !st.insecure, followRedirects: st.location, ...(st.maxTime ? { timeoutMs: st.maxTime * 1000 } : {}) }
    },
    warnings
  )
}

export function parseCurl(text: string): ParsedImport {
  const trimmed = text.trim()
  const flavor = detectFlavor(trimmed)
  const normalized = normalize(trimmed, flavor)
  // Um comando por linha que começa com "curl".
  const commands = normalized
    .split(/\n(?=\s*(?:[$>]\s*)?curl(?:\.exe)?\s)/)
    .map((c) => c.trim().replace(/^[$>]\s*/, ''))
    .filter((c) => /^curl(\.exe)?\s/.test(c))
  if (commands.length === 0) throw new ImportError('unknownFormat')
  const warnings = new Warnings()
  const items: ParsedImport['items'] = []
  for (const cmd of commands) {
    const tokens = tokenize(cmd, flavor)
    if (!/^curl(\.exe)?$/.test(tokens[0] ?? '')) continue
    const st = parseTokens(tokens)
    if (!st.url) {
      warnings.add('invalidItem')
      continue
    }
    items.push({ folder: '', request: toRequest(st, warnings) })
  }
  if (items.length === 0) throw new ImportError('invalid')
  return { name: 'curl', items, environments: [], variables: [], warnings: warnings.list() }
}
