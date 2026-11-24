// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { isIP } from 'node:net'
import type { ApiCookie, ApiCookieJarEntry } from '@shared/api/protocol'

/**
 * Pote de cookies (RFC 6265), só na memória, um por ambiente. Implementação própria para não
 * depender de biblioteca: domain, path, expires/max-age, secure, httpOnly e sameSite.
 */

export interface StoredCookie {
  name: string
  value: string
  /** Minúsculas, sem o ponto inicial. */
  domain: string
  /** Sem Domain no Set-Cookie: só o host exato recebe o cookie de volta. */
  hostOnly: boolean
  path: string
  /** Epoch em ms; ausente = cookie de sessão. */
  expires?: number
  secure: boolean
  httpOnly: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  created: number
}

const MAX_COOKIES = 3000
const MAX_PER_DOMAIN = 50
const MAX_COOKIE_BYTES = 4096

/** Sufixos públicos comuns: um cookie com Domain= igual a um deles valeria para um site de terceiros. */
const PUBLIC_SUFFIXES = new Set([
  'com', 'net', 'org', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'io', 'dev', 'app', 'br', 'pt', 'de', 'fr', 'es', 'uk', 'us',
  'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'com.pt', 'org.pt', 'co.jp', 'com.au',
  'github.io', 'gitlab.io', 'herokuapp.com', 'appspot.com', 'azurewebsites.net', 'cloudfront.net', 'vercel.app', 'netlify.app',
  'pages.dev', 'workers.dev', 'blogspot.com', 'web.app', 'firebaseapp.com'
])

/** Domínio de um só rótulo ou sufixo público conhecido (não pode ser alvo de Domain=). */
export const isPublicSuffix = (domain: string): boolean => !domain.includes('.') || PUBLIC_SUFFIXES.has(domain)

/** O host casa com o domínio do cookie (RFC 6265 §5.1.3)? */
export function domainMatches(host: string, domain: string): boolean {
  if (host === domain) return true
  return host.endsWith(`.${domain}`) && isIP(host) === 0
}

/** Caminho padrão do cookie (RFC 6265 §5.1.4). */
export function defaultPath(requestPath: string): string {
  if (!requestPath.startsWith('/')) return '/'
  const last = requestPath.lastIndexOf('/')
  return last <= 0 ? '/' : requestPath.slice(0, last)
}

/** O caminho da requisição casa com o do cookie (RFC 6265 §5.1.4)? */
export function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath) return true
  if (!requestPath.startsWith(cookiePath)) return false
  return cookiePath.endsWith('/') || requestPath[cookiePath.length] === '/'
}

/** Lê um cabeçalho Set-Cookie (RFC 6265 §5.2). null = cookie recusado. */
export function parseSetCookie(header: string, url: URL, now = Date.now()): StoredCookie | null {
  const parts = header.split(';')
  const pair = parts.shift() ?? ''
  const eq = pair.indexOf('=')
  if (eq < 0) return null
  const name = pair.slice(0, eq).trim()
  const value = pair.slice(eq + 1).trim()
  if (!name || Buffer.byteLength(name) + Buffer.byteLength(value) > MAX_COOKIE_BYTES) return null

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  let domain = host
  let hostOnly = true
  let path = defaultPath(url.pathname)
  let expires: number | undefined
  let maxAge: number | undefined
  let secure = false
  let httpOnly = false
  let sameSite: StoredCookie['sameSite']

  for (const attr of parts) {
    const i = attr.indexOf('=')
    const key = (i < 0 ? attr : attr.slice(0, i)).trim().toLowerCase()
    const val = i < 0 ? '' : attr.slice(i + 1).trim()
    switch (key) {
      case 'domain': {
        const d = val.replace(/^\./, '').toLowerCase()
        if (!d) break
        // Sufixo público (com, com.br, github.io...) ou domínio de um rótulo só vale se for o próprio host.
        if (!domainMatches(host, d) || (isPublicSuffix(d) && d !== host)) return null
        domain = d
        hostOnly = false
        break
      }
      case 'path':
        if (val.startsWith('/')) path = val
        break
      case 'expires': {
        const t = Date.parse(val)
        if (!Number.isNaN(t)) expires = t
        break
      }
      case 'max-age':
        if (/^-?\d+$/.test(val)) maxAge = Number(val)
        break
      case 'secure':
        secure = true
        break
      case 'httponly':
        httpOnly = true
        break
      case 'samesite': {
        const v = val.toLowerCase()
        sameSite = v === 'strict' ? 'Strict' : v === 'lax' ? 'Lax' : v === 'none' ? 'None' : undefined
        break
      }
    }
  }
  // Max-Age tem precedência sobre Expires.
  if (maxAge !== undefined) expires = maxAge <= 0 ? 0 : now + maxAge * 1000
  return { name, value, domain, hostOnly, path, expires, secure, httpOnly, sameSite, created: now }
}

const keyOf = (c: Pick<StoredCookie, 'domain' | 'path' | 'name'>): string => `${c.domain}\n${c.path}\n${c.name}`

export class CookieJar {
  private cookies = new Map<string, StoredCookie>()

  /** Guarda os Set-Cookie recebidos de uma resposta; devolve os cookies aceitos. */
  store(setCookies: string[], url: URL, now = Date.now()): ApiCookie[] {
    const accepted: ApiCookie[] = []
    for (const header of setCookies) {
      const cookie = parseSetCookie(header, url, now)
      if (!cookie) continue
      accepted.push(toApiCookie(cookie))
      const key = keyOf(cookie)
      const old = this.cookies.get(key)
      // Expirado (Max-Age=0 ou data no passado) = remove o cookie.
      if (cookie.expires !== undefined && cookie.expires <= now) {
        this.cookies.delete(key)
        continue
      }
      if (old) cookie.created = old.created
      this.cookies.set(key, cookie)
      this.evict(cookie.domain)
    }
    return accepted
  }

  private evict(domain: string): void {
    const oldest = (list: StoredCookie[]): StoredCookie | undefined => list.sort((a, b) => a.created - b.created)[0]
    const all = [...this.cookies.values()]
    const same = all.filter((c) => c.domain === domain)
    if (same.length > MAX_PER_DOMAIN) this.cookies.delete(keyOf(oldest(same)!))
    if (all.length > MAX_COOKIES) this.cookies.delete(keyOf(oldest(all)!))
  }

  private purge(now: number): void {
    for (const [key, c] of this.cookies) if (c.expires !== undefined && c.expires <= now) this.cookies.delete(key)
  }

  /** Valor do cabeçalho Cookie para a URL (undefined = nenhum cookie se aplica). */
  header(url: URL, now = Date.now()): string | undefined {
    this.purge(now)
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    const https = url.protocol === 'https:'
    const matching = [...this.cookies.values()].filter(
      (c) => (c.hostOnly ? c.domain === host : domainMatches(host, c.domain)) && pathMatches(url.pathname || '/', c.path) && (!c.secure || https)
    )
    if (matching.length === 0) return undefined
    // Caminhos mais longos primeiro; depois os mais antigos (RFC 6265 §5.4).
    matching.sort((a, b) => b.path.length - a.path.length || a.created - b.created)
    return matching.map((c) => `${c.name}=${c.value}`).join('; ')
  }

  list(now = Date.now()): ApiCookieJarEntry[] {
    this.purge(now)
    return [...this.cookies.values()].map((c) => ({ ...toApiCookie(c), domain: c.domain }))
  }

  /** Sem argumentos apaga tudo; com domínio, os do domínio; com domínio e nome, só esse cookie. */
  clear(domain?: string, name?: string): void {
    for (const [key, c] of this.cookies) {
      if ((domain === undefined || c.domain === domain.toLowerCase()) && (name === undefined || c.name === name)) this.cookies.delete(key)
    }
  }
}

export function toApiCookie(c: StoredCookie): ApiCookie {
  return {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires !== undefined ? new Date(c.expires).toISOString() : undefined,
    httpOnly: c.httpOnly || undefined,
    secure: c.secure || undefined,
    sameSite: c.sameSite
  }
}

const jars = new Map<string, CookieJar>()

/** Pote do ambiente (ou "default" sem ambiente). */
export function getJar(id: string | null | undefined): CookieJar {
  const key = id || 'default'
  let jar = jars.get(key)
  if (!jar) jars.set(key, (jar = new CookieJar()))
  return jar
}

export const listCookies = (jarId: string): ApiCookieJarEntry[] => getJar(jarId).list()
export const clearCookies = (jarId: string, domain?: string, name?: string): void => getJar(jarId).clear(domain, name)
