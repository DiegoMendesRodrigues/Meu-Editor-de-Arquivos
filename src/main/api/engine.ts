// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { app } from 'electron'
import type { z } from 'zod'
import { API_LIMITS } from '@shared/api/limits'
import {
  MASK,
  type ApiCookie,
  type ApiErrorCode,
  type ApiResponseResult,
  type ApiSendResult,
  type AssertionResult,
  type ExtractionResult,
  type sendInputSchema
} from '@shared/api/protocol'
import type { Auth, KeyValue } from '@shared/api/schema'
import { evaluateResponse } from './assert'
import { signOAuth1 } from './auth/oauth1'
import { getOAuth2AccessToken } from './auth/oauth2'
import { buildBody } from './body'
import { CookieJar, getJar } from './cookies'
import { ApiFail, toApiErrorCode } from './errors'
import { readAuthorizedFile } from './files'
import { sendHttp } from './http'
import { chooseProxy } from './proxy'
import { buildResolver, type Resolver } from './resolve'
import { loadTlsMaterial } from './tls'
import { isHostTrusted, trustHost } from './trust'
import { secretVault } from './vault'

export type ParsedSendInput = z.output<typeof sendInputSchema>

export interface ExecuteOptions {
  signal: AbortSignal
  /** Caminho escolhido para gravar o corpo (saveToFile), já decidido pelo chamador. */
  saveToPath?: string
  /** Só para os testes: limites menores que os padrão. */
  limits?: { memoryBytes: number; displayBytes: number; fileBytes?: number }
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const ACCEPT: Record<string, string> = {
  json: 'application/json',
  xml: 'application/xml, text/xml',
  html: 'text/html',
  text: 'text/plain',
  binary: '*/*',
  auto: '*/*'
}

/** Cabeçalhos cujo valor aparece sempre mascarado em sentRequest. */
const SENSITIVE_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'x-api-key'])

/** Texto sem esquema ganha http://; "javascript:", "data:" e similares são recusados. */
function normalizeUrlText(text: string): string {
  const t = text.trim().split('#')[0]!
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(t)) throw new ApiFail('schemeNotAllowed')
  return `http://${t}`
}

function buildUrl(text: string, params: [string, string][], encode: boolean): URL {
  let base = normalizeUrlText(text)
  if (params.length > 0) {
    const enc = (s: string): string => (encode ? encodeURIComponent(s) : s)
    const query = params.map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&')
    base += base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') + query : `?${query}`
  }
  let url: URL
  try {
    url = new URL(base)
  } catch {
    throw new ApiFail('badUrl')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ApiFail('schemeNotAllowed')
  if (!url.hostname) throw new ApiFail('badUrl')
  return url
}

/** Troca "/:nome" no caminho pelo valor (só antes de "?" ou "#"); sem o segmento, não faz nada (idempotente). */
export function applyPathParams(text: string, pathParams: [string, string][], encode: boolean): string {
  if (pathParams.length === 0) return text
  const cut = text.search(/[?#]/)
  let path = cut < 0 ? text : text.slice(0, cut)
  const rest = cut < 0 ? '' : text.slice(cut)
  for (const [name, value] of pathParams) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    path = path.replace(new RegExp(`/:${esc}(?=/|$)`, 'g'), () => `/${encode ? encodeURIComponent(value) : value}`)
  }
  return path + rest
}

const hasHeader = (list: [string, string][], name: string): boolean => list.some(([k]) => k.toLowerCase() === name)

function displayHeader(key: string, value: string, r: Resolver): string {
  const lower = key.toLowerCase()
  if (lower === 'authorization' || lower === 'proxy-authorization') {
    const scheme = /^(\S+)\s+\S/.exec(value)
    return scheme ? `${scheme[1]} ${MASK}` : MASK
  }
  return SENSITIVE_HEADERS.has(lower) ? MASK : r.mask(value)
}

/** Esconde a senha de uma URL com usuário:senha@. */
const hideUrlPassword = (href: string): string => href.replace(/^([a-z]+:\/\/[^/:@]*):[^/@]*@/i, `$1:${MASK}@`)

const TEXT_TYPE_RE = /^(text\/|application\/(json|xml|javascript|ecmascript|x-www-form-urlencoded|yaml|x-yaml|graphql|soap\+xml|xhtml\+xml)|[^;]*\+(json|xml|yaml))/i
const BINARY_TYPE_RE = /^(image\/(?!svg)|audio\/|video\/|font\/|application\/(octet-stream|pdf|zip|gzip|x-gzip|x-tar|x-7z|vnd\.|msword|wasm))/i

/** Texto (utf8) ou binário (base64)? Conforme o tipo escolhido, o Content-Type e, na dúvida, o conteúdo. */
function isTextBody(buf: Buffer, contentType: string, responseType: string): boolean {
  if (responseType === 'binary') return false
  if (['json', 'xml', 'html', 'text'].includes(responseType)) return true
  if (TEXT_TYPE_RE.test(contentType)) return true
  if (BINARY_TYPE_RE.test(contentType)) return false
  return !buf.subarray(0, 8000).includes(0)
}

function encodeBody(buf: Buffer, text: boolean, truncated: boolean): string {
  if (text) return buf.toString('utf8')
  // base64 de um corte que não termina em múltiplo de 3 teria preenchimento no meio do texto.
  return (truncated ? buf.subarray(0, buf.length - (buf.length % 3)) : buf).toString('base64')
}

/**
 * Núcleo do envio (usado pelo canal api:send e pelo executor): resolve variáveis e segredos, aplica a
 * autorização, envia, mede, avalia os testes e as extrações e devolve o resultado mascarado.
 */
export async function executeRequest(input: ParsedSendInput, options: ExecuteOptions): Promise<ApiSendResult> {
  const { runId, request, environment, collection } = input
  let resolver: Resolver | null = null
  const fail = (code: ApiErrorCode, host?: string): ApiSendResult => {
    const missing = resolver ? [...resolver.missing] : []
    return { ok: false, runId, code, ...(missing.length > 0 ? { missingVariables: missing } : {}), ...(host ? { host } : {}) }
  }
  try {
    if (environment?.production && WRITE_METHODS.has(request.method) && !input.productionConfirmed) return fail('productionNotConfirmed')
    if (options.signal.aborted) return fail('cancelled')

    resolver = await buildResolver({ environment, collection, temporary: input.temporary })
    const r = resolver
    const s = request.settings
    const docPath = input.documentPath

    // Autorização efetiva: "inherit" usa a da coleção (sem coleção, nenhuma).
    let auth: Auth = request.auth
    if (auth.type === 'inherit') auth = collection?.auth && collection.auth.type !== 'inherit' ? collection.auth : { type: 'none' }

    // Cabeçalhos e params do usuário.
    const headers: [string, string][] = request.headers.filter((h) => h.enabled && h.key.trim() !== '').map((h) => [r.resolve(h.key).trim(), r.resolve(h.value)])
    // A URL do documento já traz a query; os params não são anexados. Só os path params (":id") são trocados.
    const pathParams: [string, string][] = request.params.filter((p) => p.enabled && p.key.startsWith(':') && p.key.length > 1).map((p) => [r.resolve(p.key).slice(1), r.resolve(p.value)])
    const params: [string, string][] = []
    const authHeaders: [string, string][] = []

    switch (auth.type) {
      case 'apiKey': {
        const key = r.resolve(auth.key)
        if (key) (auth.in === 'query' ? params : authHeaders).push([key, r.resolve(auth.value)])
        break
      }
      case 'basic':
        authHeaders.push(['Authorization', `Basic ${Buffer.from(`${r.resolve(auth.username)}:${r.resolve(auth.password)}`).toString('base64')}`])
        break
      case 'bearer': {
        const prefix = r.resolve(auth.prefix).trim()
        authHeaders.push(['Authorization', `${prefix ? `${prefix} ` : ''}${r.resolve(auth.token)}`])
        break
      }
      case 'oauth2': {
        const token = await getOAuth2AccessToken(r.scope, auth, { verifyTls: s.verifyTls, signal: options.signal, resolve: r.resolve })
        if (token) {
          r.addSecret(token)
          authHeaders.push(['Authorization', `Bearer ${token}`])
        }
        break
      }
      default:
        break
    }

    // O usuário manda: cabeçalho próprio com o mesmo nome vence o da autorização.
    for (const h of authHeaders) if (!hasHeader(headers, h[0].toLowerCase())) headers.push(h)

    let url = buildUrl(applyPathParams(r.resolve(request.url), pathParams, s.encodeUrl), params, s.encodeUrl)

    // Corpo com variáveis resolvidas.
    let body = request.body
    switch (body.type) {
      case 'raw':
        body = { ...body, text: r.resolve(body.text) }
        break
      case 'urlencoded':
        body = { ...body, fields: body.fields.map((f): KeyValue => ({ ...f, key: r.resolve(f.key), value: r.resolve(f.value) })) }
        break
      case 'multipart':
        body = {
          ...body,
          parts: body.parts.map((p) => (p.kind === 'text' ? { ...p, key: r.resolve(p.key), value: r.resolve(p.value) } : { ...p, key: r.resolve(p.key), path: r.resolve(p.path) }))
        }
        break
      case 'binary':
        body = { ...body, path: r.resolve(body.path) }
        break
      case 'graphql':
        body = { ...body, query: r.resolve(body.query), variables: r.resolve(body.variables), operationName: body.operationName ? r.resolve(body.operationName) : undefined }
        break
      case 'soap':
        body = { ...body, action: r.resolve(body.action), envelope: r.resolve(body.envelope) }
        break
      default:
        break
    }

    // OAuth 1.0a assina a URL final e os campos do formulário.
    if (auth.type === 'oauth1') {
      let signed
      // Chave privada (RSA-SHA1): arquivo autorizado, relativo ao documento quando não for absoluto.
      const privateKey = auth.privateKeyPath ? (await readAuthorizedFile(r.resolve(auth.privateKeyPath), docPath)).toString('utf8') : undefined
      try {
        signed = signOAuth1({
          method: request.method,
          url: url.href,
          bodyParams: body.type === 'urlencoded' ? body.fields.filter((f) => f.enabled && f.key !== '').map((f): [string, string] => [f.key, f.value]) : [],
          consumerKey: r.resolve(auth.consumerKey),
          consumerSecret: r.resolve(auth.consumerSecret),
          token: auth.token ? r.resolve(auth.token) : undefined,
          tokenSecret: auth.tokenSecret ? r.resolve(auth.tokenSecret) : undefined,
          signature: auth.signature,
          privateKey,
          realm: auth.realm ? r.resolve(auth.realm) : undefined,
          placement: auth.placement
        })
      } catch {
        throw new ApiFail('invalidRequest')
      }
      if (signed.header && !hasHeader(headers, 'authorization')) headers.push(['Authorization', signed.header])
      if (signed.queryParams?.length) url = buildUrl(url.href, signed.queryParams, s.encodeUrl)
      if (signed.bodyParams?.length) {
        const extra = signed.bodyParams.map(([key, value]): KeyValue => ({ key, value, enabled: true }))
        body = body.type === 'urlencoded' ? { ...body, fields: [...body.fields, ...extra] } : body.type === 'none' ? { type: 'urlencoded', fields: extra } : body
      }
    }

    const built = await buildBody({ body, documentPath: docPath })

    // Cabeçalhos automáticos (só se o usuário não definiu).
    if (built.contentType && !hasHeader(headers, 'content-type')) headers.push(['Content-Type', built.contentType])
    for (const h of built.headers) if (!hasHeader(headers, h[0].toLowerCase())) headers.push(h)
    if (!hasHeader(headers, 'user-agent')) headers.push(['User-Agent', `MeuEditorDeArquivos/${app.getVersion()}`])
    if (!hasHeader(headers, 'accept')) headers.push(['Accept', ACCEPT[request.responseType] ?? '*/*'])
    if (!hasHeader(headers, 'accept-encoding')) headers.push(['Accept-Encoding', 'gzip, deflate, br'])

    // Cookies do ambiente.
    const jar = getJar(environment?.id)
    const userCookie = hasHeader(headers, 'cookie')
    const cookieFor = (u: URL): string | undefined => jar.header(u)
    if (s.sendCookies && !userCookie) {
      const cookie = cookieFor(url)
      if (cookie) headers.push(['Cookie', cookie])
    }

    const material = await loadTlsMaterial(
      {
        caPath: r.resolve(s.caPath),
        clientCert: s.clientCert
          ? { ...s.clientCert, certPath: r.resolve(s.clientCert.certPath), keyPath: r.resolve(s.clientCert.keyPath), pfxPath: r.resolve(s.clientCert.pfxPath) }
          : undefined
      },
      docPath,
      (name) => r.lookup(name)
    )
    const proxySettings = { proxy: s.proxy, proxyUrl: r.resolve(s.proxyUrl) }

    // Segredo só vai para um host que o usuário já confirmou para o escopo dele (um .apireq de terceiros
    // não pode mandar {{token}} para qualquer lugar). A confirmação vem com o reenvio (confirmSecretHost).
    if (r.secretScopes.size > 0) {
      const host = url.host.toLowerCase()
      if (!(await isHostTrusted(r.secretScopes, host))) {
        if (input.confirmSecretHost?.trim().toLowerCase() !== host) return fail('secretHostNotConfirmed', host)
        await trustHost(r.secretScopes, host)
      }
    }

    // Cabeçalhos que não acompanham um redirecionamento para outro host: os da autorização e qualquer
    // um que carregue um valor secreto.
    const stripOnRedirect = new Set<string>(['x-api-key', 'authorization', 'cookie', 'proxy-authorization'])
    for (const [k] of authHeaders) stripOnRedirect.add(k.toLowerCase())
    const secretValues = [...r.secrets].filter((v) => v.length > 0)
    for (const [k, v] of headers) if (secretValues.some((sv) => v.includes(sv))) stripOnRedirect.add(k.toLowerCase())

    // Antes de enviar: variáveis que não existem em nenhum escopo ficam registradas em missingVariables.
    const responseCookies: ApiCookie[] = []
    const result = await sendHttp({
      method: request.method,
      url,
      headers,
      body: built,
      settings: { timeoutMs: s.timeoutMs, followRedirects: s.followRedirects, maxRedirects: s.maxRedirects, verifyTls: s.verifyTls, minTlsVersion: s.minTlsVersion, http2: s.http2 },
      tls: material,
      proxy: (u) => chooseProxy(proxySettings, u),
      signal: options.signal,
      saveToPath: input.saveToFile ? options.saveToPath : undefined,
      stripOnRedirect: [...stripOnRedirect],
      cookieHeader: s.sendCookies && !userCookie ? cookieFor : undefined,
      onSetCookie: (u, list) => {
        // Sem "enviar cookies", os recebidos aparecem na resposta mas não ficam no pote.
        responseCookies.push(...(s.sendCookies ? jar : new CookieJar()).store(list, u))
      },
      limits: options.limits
    })

    const contentType = result.headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
    const text = isTextBody(result.body, contentType, request.responseType)
    const limit = options.limits?.displayBytes ?? API_LIMITS.displayBytes
    const shown = result.body.length > limit ? result.body.subarray(0, limit) : result.body
    const truncated = result.bodySize > shown.length

    // Testes e extrações (só as linhas ativas; os índices voltam para as posições originais).
    const activeTests = request.tests.map((t, i) => ({ t, i })).filter((x) => x.t.enabled)
    const activeExtract = request.extract.map((e, i) => ({ e, i })).filter((x) => x.e.enabled)
    let tests: AssertionResult[] = []
    let extracted: ExtractionResult[] = []
    if (activeTests.length > 0 || activeExtract.length > 0) {
      let evaluation
      try {
        evaluation = await evaluateResponse(
          activeTests.map((x) => x.t),
          activeExtract.map((x) => x.e),
          {
            status: result.status,
            timeMs: result.timings.total,
            sizeBytes: result.bodySize,
            headers: result.headers.map(([key, value]) => ({ key, value })),
            cookies: responseCookies.map((c) => ({ name: c.name, value: c.value })),
            body: text ? result.body.toString('utf8') : '',
            contentType
          }
        )
      } catch {
        evaluation = null
      }
      tests = activeTests.map((x, k) => {
        const t: AssertionResult = { ...(evaluation?.tests[k] ?? { passed: false, error: 'unknown' }), index: x.i }
        return t.actual !== undefined ? { ...t, actual: r.mask(t.actual) } : t
      })
      extracted = []
      for (const [k, x] of activeExtract.entries()) {
        const value = evaluation?.extracted[k]
        let ok = value !== undefined
        if (ok && x.e.secret) {
          // Segredo extraído vai direto para o cofre; o valor não volta ao Renderer.
          try {
            if (value!.length > API_LIMITS.secretChars) throw new Error('grande')
            await secretVault.set(r.scope, x.e.to, value!)
          } catch {
            ok = false
          }
        }
        extracted.push({ to: x.e.to, secret: x.e.secret, ok, ...(ok && !x.e.secret ? { value } : {}) })
      }
    }

    const response: ApiResponseResult = {
      ok: true,
      runId,
      status: result.status,
      statusText: result.statusText,
      httpVersion: result.httpVersion,
      headers: result.headers.map(([key, value]) => ({ key: r.mask(key), value: r.mask(value), enabled: true })),
      cookies: responseCookies,
      timings: result.timings,
      ...(result.tls ? { tls: result.tls } : {}),
      size: { headers: result.headersSize, body: result.bodySize, ...(result.compressedSize !== undefined ? { compressed: result.compressedSize } : {}) },
      body: { encoding: text ? 'utf8' : 'base64', text: text ? r.mask(encodeBody(shown, text, truncated)) : encodeBody(shown, text, truncated), contentType, truncated, ...(result.savedTo ? { savedTo: result.savedTo } : {}) },
      sentRequest: {
        method: request.method,
        url: r.mask(hideUrlPassword(url.href)),
        headers: headers.map(([key, value]) => ({ key, value: displayHeader(key, value, r), enabled: true }))
      },
      redirects: result.redirects.map((x) => ({ status: x.status, url: r.mask(hideUrlPassword(x.url)) })),
      tests,
      extracted,
      missingVariables: [...r.missing]
    }
    return response
  } catch (err) {
    if (options.signal.aborted && !(err instanceof ApiFail && err.code !== 'cancelled')) return fail('cancelled')
    return fail(toApiErrorCode(err))
  }
}
