// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { API_LIMITS } from '@shared/api/limits'
import type { ApiOAuthProgress, ApiOAuthResult, ApiOAuthTokenInfo } from '@shared/api/protocol'
import type { Auth } from '@shared/api/schema'
import { tm } from '../../i18n'
import { secretVault } from '../vault'
import { startLoopback } from './loopback'
import { codeChallengeS256, createCodeVerifier, randomToken } from './pkce'

export type OAuth2Auth = Extract<Auth, { type: 'oauth2' }>
type FailCode = Extract<ApiOAuthResult, { ok: false }>['code']

/** Falha conhecida do OAuth: só o código chega ao usuário, nunca a mensagem do servidor. */
export class OAuthError extends Error {
  constructor(readonly code: FailCode) {
    super(code)
  }
}

export interface OAuth2Options {
  verifyTls: boolean
  signal?: AbortSignal
  /** Resolve {{variáveis}} (ambiente, coleção e cofre) num texto. */
  resolve: (text: string) => string
}

export interface AuthorizeOptions extends OAuth2Options {
  /** Abre o navegador do sistema (só http/https; conferido aqui antes de chamar). */
  openExternal: (url: string) => Promise<void> | void
  onProgress?: (progress: Omit<ApiOAuthProgress, 'runId'>) => void
  /** Padrão: API_LIMITS.oauthTimeoutMs. */
  timeoutMs?: number
  /** Espera entre as consultas do Device Code (injetável nos testes). */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

const MAX_RESPONSE_BYTES = 1024 * 1024
const REQUEST_TIMEOUT_MS = 30_000
/** Renova antes de expirar de fato, para o token não vencer no caminho. */
const EXPIRY_MARGIN_MS = 30_000

const refreshName = (tokenVar: string): string => `${tokenVar}.__refresh`
const expiresName = (tokenVar: string): string => `${tokenVar}.__expiresAt`

/* ------------------------------------------------------------------ HTTP */

interface TokenHttpResponse {
  status: number
  json: Record<string, unknown> | null
}

/** POST x-www-form-urlencoded no endpoint do provedor; resposta JSON de até 1 MB; sem seguir redirecionamentos. */
function postForm(
  url: string,
  params: URLSearchParams,
  headers: Record<string, string>,
  opts: Pick<OAuth2Options, 'verifyTls' | 'signal'>
): Promise<TokenHttpResponse> {
  return new Promise((resolve, reject) => {
    let target: URL
    try {
      target = new URL(url)
    } catch {
      return reject(new OAuthError('invalidConfig'))
    }
    if (!tokenEndpointAllowed(target)) return reject(new OAuthError('invalidConfig'))
    if (opts.signal?.aborted) return reject(new OAuthError('cancelled'))

    const body = params.toString()
    const doRequest = target.protocol === 'https:' ? httpsRequest : httpRequest
    const req = doRequest(
      target,
      {
        method: 'POST',
        rejectUnauthorized: opts.verifyTls,
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'content-length': Buffer.byteLength(body),
          accept: 'application/json',
          ...headers
        }
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (c: Buffer) => {
          size += c.length
          if (size > MAX_RESPONSE_BYTES) {
            req.destroy(new OAuthError('invalidResponse'))
          } else chunks.push(c)
        })
        res.on('end', () => {
          let json: Record<string, unknown> | null = null
          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) json = parsed as Record<string, unknown>
          } catch {
            // Não é JSON: quem chamou trata como resposta inválida.
          }
          resolve({ status: res.statusCode ?? 0, json })
        })
        res.on('error', () => reject(new OAuthError('network')))
      }
    )
    const onAbort = (): void => void req.destroy(new OAuthError('cancelled'))
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    req.setTimeout(REQUEST_TIMEOUT_MS, () => void req.destroy(new OAuthError('timeout')))
    req.on('error', (err) => {
      opts.signal?.removeEventListener('abort', onAbort)
      reject(err instanceof OAuthError ? err : new OAuthError('network'))
    })
    req.on('close', () => opts.signal?.removeEventListener('abort', onAbort))
    req.end(body)
  })
}

/** Autenticação do cliente no endpoint de token: client_secret_basic quando há segredo (RFC 6749, 2.3.1). */
function clientAuth(clientId: string, clientSecret: string | undefined, params: URLSearchParams): Record<string, string> {
  if (!clientSecret) {
    params.set('client_id', clientId)
    return {}
  }
  const form = (s: string): string => encodeURIComponent(s).replace(/%20/g, '+')
  return { authorization: `Basic ${Buffer.from(`${form(clientId)}:${form(clientSecret)}`, 'utf8').toString('base64')}` }
}

/* ------------------------------------------------------------------ configuração */

interface Resolved {
  authUrl?: string
  tokenUrl: string
  clientId: string
  clientSecret?: string
  scope: string
  audience?: string
  username?: string
  password?: string
}

/** Endpoint de token: https em qualquer host; http só em loopback (o segredo do cliente não trafega aberto). */
export function tokenEndpointAllowed(target: URL): boolean {
  if (target.protocol === 'https:') return true
  return target.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname.toLowerCase())
}

const httpUrl = (value: string): boolean => {
  try {
    const p = new URL(value).protocol
    return p === 'https:' || p === 'http:'
  } catch {
    return false
  }
}

/** Resolve as {{variáveis}}; uma variável sem valor (ainda "{{x}}" no texto) é configuração inválida. */
function resolveConfig(auth: OAuth2Auth, resolve: (text: string) => string): Resolved {
  const res = (text: string): string => {
    const out = resolve(text).trim()
    if (/\{\{[^{}]*\}\}/.test(out)) throw new OAuthError('invalidConfig')
    return out
  }
  const opt = (text: string | undefined): string | undefined => (text ? res(text) || undefined : undefined)
  const r: Resolved = {
    authUrl: opt(auth.authUrl),
    tokenUrl: res(auth.tokenUrl),
    clientId: res(auth.clientId),
    clientSecret: opt(auth.clientSecret),
    scope: auth.scopes.map(res).filter(Boolean).join(' '),
    audience: opt(auth.audience),
    username: opt(auth.username),
    password: opt(auth.password)
  }
  if (!r.clientId || !httpUrl(r.tokenUrl) || !tokenEndpointAllowed(new URL(r.tokenUrl))) throw new OAuthError('invalidConfig')
  if (r.authUrl && !httpUrl(r.authUrl)) throw new OAuthError('invalidConfig')
  return r
}

/* ------------------------------------------------------------------ cofre */

async function storeTokens(scope: string, tokenVar: string, json: Record<string, unknown>, previousRefresh?: string): Promise<{ expiresAt?: string; hasRefreshToken: boolean }> {
  const access = json.access_token
  if (typeof access !== 'string' || !access) throw new OAuthError('invalidResponse')
  const expiresIn = Number(json.expires_in)
  const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined
  const refresh = typeof json.refresh_token === 'string' && json.refresh_token ? json.refresh_token : previousRefresh
  try {
    await secretVault.set(scope, tokenVar, access)
    if (expiresAt) await secretVault.set(scope, expiresName(tokenVar), expiresAt)
    else await secretVault.delete(scope, expiresName(tokenVar))
    if (refresh) await secretVault.set(scope, refreshName(tokenVar), refresh)
    else await secretVault.delete(scope, refreshName(tokenVar))
  } catch {
    throw new OAuthError('noVault')
  }
  return { expiresAt, hasRefreshToken: !!refresh }
}

/** Estado do token no cofre, sem o valor. */
export async function oauthTokenInfo(scope: string, tokenVar: string): Promise<ApiOAuthTokenInfo> {
  const exists = await secretVault.has(scope, tokenVar)
  if (!exists) return { exists: false, hasRefreshToken: false }
  return {
    exists: true,
    expiresAt: await secretVault.get(scope, expiresName(tokenVar)),
    hasRefreshToken: await secretVault.has(scope, refreshName(tokenVar))
  }
}

export async function clearOAuthToken(scope: string, tokenVar: string): Promise<void> {
  await secretVault.delete(scope, tokenVar)
  await secretVault.delete(scope, refreshName(tokenVar))
  await secretVault.delete(scope, expiresName(tokenVar))
}

/* ------------------------------------------------------------------ requisições ao token endpoint */

/** Faz a requisição, interpreta erros do protocolo e devolve o JSON de sucesso. */
async function tokenRequest(url: string, params: URLSearchParams, headers: Record<string, string>, opts: OAuth2Options): Promise<Record<string, unknown>> {
  const { status, json } = await postForm(url, params, headers, opts)
  if (status >= 200 && status < 300 && json) return json
  if (json && typeof json.error === 'string') {
    // Erros do servidor viram códigos; a descrição crua nunca é repassada.
    if (json.error === 'authorization_pending' || json.error === 'slow_down' || json.error === 'expired_token') throw new PendingError(json.error)
    throw new OAuthError(status >= 400 && status < 500 ? 'denied' : 'invalidResponse')
  }
  throw new OAuthError('invalidResponse')
}

class PendingError extends Error {
  constructor(readonly kind: 'authorization_pending' | 'slow_down' | 'expired_token') {
    super(kind)
  }
}

async function refreshToken(scope: string, auth: OAuth2Auth, cfg: Resolved, refresh: string, opts: OAuth2Options): Promise<string> {
  const params = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh })
  const headers = clientAuth(cfg.clientId, cfg.clientSecret, params)
  const json = await tokenRequest(cfg.tokenUrl, params, headers, opts)
  await storeTokens(scope, auth.tokenVar, json, refresh)
  return json.access_token as string
}

async function clientCredentials(scope: string, auth: OAuth2Auth, cfg: Resolved, opts: OAuth2Options): Promise<{ expiresAt?: string; hasRefreshToken: boolean }> {
  const params = new URLSearchParams({ grant_type: 'client_credentials' })
  if (cfg.scope) params.set('scope', cfg.scope)
  if (cfg.audience) params.set('audience', cfg.audience)
  const headers = clientAuth(cfg.clientId, cfg.clientSecret, params)
  return storeTokens(scope, auth.tokenVar, await tokenRequest(cfg.tokenUrl, params, headers, opts))
}

async function passwordGrant(scope: string, auth: OAuth2Auth, cfg: Resolved, opts: OAuth2Options): Promise<{ expiresAt?: string; hasRefreshToken: boolean }> {
  if (!cfg.username || cfg.password === undefined) throw new OAuthError('invalidConfig')
  const params = new URLSearchParams({ grant_type: 'password', username: cfg.username, password: cfg.password })
  if (cfg.scope) params.set('scope', cfg.scope)
  if (cfg.audience) params.set('audience', cfg.audience)
  const headers = clientAuth(cfg.clientId, cfg.clientSecret, params)
  return storeTokens(scope, auth.tokenVar, await tokenRequest(cfg.tokenUrl, params, headers, opts))
}

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function callbackPage(title: string, message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#27272a}h1{font-size:1.25rem}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></body></html>`
}

async function authorizationCode(scope: string, auth: OAuth2Auth, cfg: Resolved, opts: AuthorizeOptions): Promise<{ expiresAt?: string; hasRefreshToken: boolean }> {
  if (!cfg.authUrl) throw new OAuthError('invalidConfig')
  const state = randomToken(16)
  const verifier = createCodeVerifier()
  const loop = await startLoopback({
    state,
    timeoutMs: opts.timeoutMs ?? API_LIMITS.oauthTimeoutMs,
    signal: opts.signal,
    pages: {
      success: callbackPage(tm('apiClient.oauth.pageOkTitle'), tm('apiClient.oauth.pageOk')),
      failure: callbackPage(tm('apiClient.oauth.pageFailTitle'), tm('apiClient.oauth.pageFail'))
    }
  })
  try {
    const url = new URL(cfg.authUrl)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', cfg.clientId)
    url.searchParams.set('redirect_uri', loop.redirectUri)
    url.searchParams.set('state', state)
    if (cfg.scope) url.searchParams.set('scope', cfg.scope)
    if (cfg.audience) url.searchParams.set('audience', cfg.audience)
    if (auth.pkce) {
      url.searchParams.set('code_challenge', codeChallengeS256(verifier))
      url.searchParams.set('code_challenge_method', 'S256')
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new OAuthError('invalidConfig')
    await opts.openExternal(url.toString())

    const outcome = await loop.result
    if (!outcome.ok) throw new OAuthError(outcome.code)

    const params = new URLSearchParams({ grant_type: 'authorization_code', code: outcome.code, redirect_uri: loop.redirectUri })
    if (auth.pkce) params.set('code_verifier', verifier)
    const headers = clientAuth(cfg.clientId, cfg.clientSecret, params)
    return storeTokens(scope, auth.tokenVar, await tokenRequest(cfg.tokenUrl, params, headers, opts))
  } finally {
    loop.close()
  }
}

const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const t = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
    function done(): void {
      clearTimeout(t)
      signal?.removeEventListener('abort', done)
      resolve()
    }
  })

/** Device Code (RFC 8628): authUrl é o endpoint de autorização do dispositivo. */
async function deviceCode(scope: string, auth: OAuth2Auth, cfg: Resolved, opts: AuthorizeOptions): Promise<{ expiresAt?: string; hasRefreshToken: boolean }> {
  if (!cfg.authUrl) throw new OAuthError('invalidConfig')
  const startParams = new URLSearchParams()
  if (cfg.scope) startParams.set('scope', cfg.scope)
  if (cfg.audience) startParams.set('audience', cfg.audience)
  const startHeaders = clientAuth(cfg.clientId, cfg.clientSecret, startParams)
  const { status, json } = await postForm(cfg.authUrl, startParams, startHeaders, opts)
  if (!(status >= 200 && status < 300) || !json) throw new OAuthError(json && typeof json.error === 'string' && status < 500 ? 'denied' : 'invalidResponse')

  const deviceCodeValue = json.device_code
  const userCode = json.user_code
  const verificationUri = json.verification_uri ?? json.verification_url
  if (typeof deviceCodeValue !== 'string' || typeof userCode !== 'string' || typeof verificationUri !== 'string' || !httpUrl(verificationUri)) {
    throw new OAuthError('invalidResponse')
  }
  const expiresIn = Number(json.expires_in)
  const lifetimeMs = Math.min(Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : Infinity, opts.timeoutMs ?? API_LIMITS.oauthTimeoutMs)
  const baseInterval = Number(json.interval)
  let intervalMs = (Number.isFinite(baseInterval) && baseInterval >= 0 ? baseInterval : 5) * 1000
  opts.onProgress?.({ verificationUri, userCode, expiresIn: Number.isFinite(lifetimeMs) ? Math.floor(lifetimeMs / 1000) : undefined })

  const deadline = Date.now() + lifetimeMs
  const sleep = opts.sleep ?? defaultSleep
  for (;;) {
    await sleep(intervalMs, opts.signal)
    if (opts.signal?.aborted) throw new OAuthError('cancelled')
    if (Date.now() > deadline) throw new OAuthError('timeout')
    const params = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', device_code: deviceCodeValue })
    const headers = clientAuth(cfg.clientId, cfg.clientSecret, params)
    try {
      return await storeTokens(scope, auth.tokenVar, await tokenRequest(cfg.tokenUrl, params, headers, opts))
    } catch (err) {
      if (!(err instanceof PendingError)) throw err
      if (err.kind === 'expired_token') throw new OAuthError('timeout')
      // slow_down: aumenta o intervalo em 5 s (RFC 8628, 3.5).
      if (err.kind === 'slow_down') intervalMs += 5000
    }
  }
}

/** Obtém um token pelo fluxo configurado e o guarda no cofre. Nunca lança: devolve o código da falha. */
export async function authorizeOAuth2(scope: string, auth: OAuth2Auth, opts: AuthorizeOptions): Promise<ApiOAuthResult> {
  try {
    if (opts.signal?.aborted) throw new OAuthError('cancelled')
    const cfg = resolveConfig(auth, opts.resolve)
    let stored: { expiresAt?: string; hasRefreshToken: boolean }
    switch (auth.flow) {
      case 'authorizationCode':
        stored = await authorizationCode(scope, auth, cfg, opts)
        break
      case 'clientCredentials':
        stored = await clientCredentials(scope, auth, cfg, opts)
        break
      case 'deviceCode':
        stored = await deviceCode(scope, auth, cfg, opts)
        break
      case 'password':
        stored = await passwordGrant(scope, auth, cfg, opts)
        break
    }
    return { ok: true, tokenVar: auth.tokenVar, ...stored }
  } catch (err) {
    if (err instanceof OAuthError) return { ok: false, code: err.code }
    if (err instanceof PendingError) return { ok: false, code: err.kind === 'expired_token' ? 'timeout' : 'invalidResponse' }
    return { ok: false, code: 'unknown' }
  }
}

/* ------------------------------------------------------------------ token para o envio */

/** Renovações em andamento: duas requisições seguidas não gastam o mesmo refresh token duas vezes. */
const pending = new Map<string, Promise<string | undefined>>()

/**
 * Token de acesso guardado no cofre (escopo = id do ambiente, ou "globals"), renovado com o refresh
 * token quando expirado e autoRefresh estiver ligado. undefined = sem token (o usuário precisa obter).
 */
export async function getOAuth2AccessToken(scope: string, auth: OAuth2Auth, opts: OAuth2Options): Promise<string | undefined> {
  const token = await secretVault.get(scope, auth.tokenVar)
  const expiresAt = await secretVault.get(scope, expiresName(auth.tokenVar))
  const expired = !!expiresAt && Date.parse(expiresAt) - EXPIRY_MARGIN_MS <= Date.now()
  if (token && !expired) return token
  // Client Credentials não depende do usuário: sem token, ou vencido sem refresh, pede outro sozinho.
  if (!auth.autoRefresh && !(token === undefined && auth.flow === 'clientCredentials')) return undefined

  const key = `${scope}\u0000${auth.tokenVar}`
  const running = pending.get(key)
  if (running) return running
  const job = (async (): Promise<string | undefined> => {
    try {
      const cfg = resolveConfig(auth, opts.resolve)
      const refresh = await secretVault.get(scope, refreshName(auth.tokenVar))
      if (refresh) {
        try {
          return await refreshToken(scope, auth, cfg, refresh, opts)
        } catch (err) {
          if (err instanceof OAuthError && err.code === 'cancelled') return undefined
          // Refresh recusado ou fora do ar: tenta o fluxo sem usuário, se houver.
        }
      }
      if (auth.flow === 'clientCredentials') {
        await clientCredentials(scope, auth, cfg, opts)
        return await secretVault.get(scope, auth.tokenVar)
      }
      return undefined
    } catch {
      return undefined
    } finally {
      pending.delete(key)
    }
  })()
  pending.set(key, job)
  return job
}
