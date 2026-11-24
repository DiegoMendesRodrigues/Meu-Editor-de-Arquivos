// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHmac, randomBytes, sign } from 'node:crypto'

/** Parâmetros resolvidos (sem {{variáveis}}) para assinar uma requisição OAuth 1.0a (RFC 5849). */
export interface OAuth1SignInput {
  method: string
  /** URL completa, com a query. */
  url: string
  /** Campos form-urlencoded do corpo (entram na assinatura). */
  bodyParams: [string, string][]
  consumerKey: string
  consumerSecret: string
  token?: string
  tokenSecret?: string
  signature: 'HMAC-SHA1' | 'HMAC-SHA256' | 'RSA-SHA1' | 'PLAINTEXT'
  /** Chave privada PEM (RSA-SHA1). */
  privateKey?: string
  realm?: string
  placement: 'header' | 'query' | 'body'
  /** Para testes com vetores conhecidos. */
  nonce?: string
  timestamp?: string
}

/** Resultado: cabeçalho Authorization, ou parâmetros a acrescentar na query ou no corpo. */
export interface OAuth1SignResult {
  header?: string
  queryParams?: [string, string][]
  bodyParams?: [string, string][]
}

/** Codificação percent da RFC 3986 (seção 3.6 da RFC 5849): só A-Z a-z 0-9 - . _ ~ ficam sem codificar. */
export const percentEncode = (s: string): string =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/** Decodifica um pedaço de query (+ vira espaço); sequência inválida fica como está. */
function decodeQueryPart(s: string): string {
  const plus = s.replace(/\+/g, ' ')
  try {
    return decodeURIComponent(plus)
  } catch {
    return plus
  }
}

/** URI base da assinatura (3.4.1.2): esquema e host em minúsculas, porta padrão omitida, sem query nem fragmento. */
export function baseStringUri(url: string): string {
  const u = new URL(url)
  const scheme = u.protocol.toLowerCase()
  const defaultPort = scheme === 'http:' ? '80' : scheme === 'https:' ? '443' : ''
  const port = u.port && u.port !== defaultPort ? `:${u.port}` : ''
  // URL já normaliza o host para minúsculas; o caminho vazio vira "/".
  return `${scheme}//${u.hostname}${port}${u.pathname || '/'}`
}

/** Normaliza os parâmetros (3.4.1.3.2): codifica, ordena por nome e depois por valor, junta com "&". */
export function normalizeParams(params: [string, string][]): string {
  return params
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}

/** Base string da assinatura: MÉTODO&URI&parâmetros, cada parte codificada. */
export function signatureBaseString(method: string, url: string, params: [string, string][]): string {
  return [method.toUpperCase(), percentEncode(baseStringUri(url)), percentEncode(normalizeParams(params))].join('&')
}

/** Parâmetros da query da URL, decodificados. */
function queryParamsOf(url: string): [string, string][] {
  const q = new URL(url).search.slice(1)
  if (!q) return []
  return q.split('&').filter(Boolean).map((pair) => {
    const i = pair.indexOf('=')
    return i < 0 ? ([decodeQueryPart(pair), ''] as [string, string]) : ([decodeQueryPart(pair.slice(0, i)), decodeQueryPart(pair.slice(i + 1))] as [string, string])
  })
}

export function signOAuth1(input: OAuth1SignInput): OAuth1SignResult {
  const oauth: [string, string][] = [
    ['oauth_consumer_key', input.consumerKey],
    ['oauth_nonce', input.nonce ?? randomBytes(16).toString('hex')],
    ['oauth_signature_method', input.signature],
    ['oauth_timestamp', input.timestamp ?? String(Math.floor(Date.now() / 1000))],
    ['oauth_version', '1.0']
  ]
  if (input.token) oauth.push(['oauth_token', input.token])

  const key = `${percentEncode(input.consumerSecret)}&${percentEncode(input.tokenSecret ?? '')}`
  let signature: string
  if (input.signature === 'PLAINTEXT') {
    signature = key
  } else {
    // O realm não entra na assinatura; os parâmetros oauth_* sim (a própria oauth_signature não).
    const base = signatureBaseString(input.method, input.url, [...queryParamsOf(input.url), ...input.bodyParams, ...oauth])
    if (input.signature === 'RSA-SHA1') {
      if (!input.privateKey) throw new Error('RSA-SHA1 exige a chave privada')
      signature = sign('RSA-SHA1', Buffer.from(base, 'utf8'), input.privateKey).toString('base64')
    } else {
      signature = createHmac(input.signature === 'HMAC-SHA256' ? 'sha256' : 'sha1', key).update(base, 'utf8').digest('base64')
    }
  }
  const all: [string, string][] = [...oauth, ['oauth_signature', signature]]

  if (input.placement === 'query') return { queryParams: all }
  if (input.placement === 'body') return { bodyParams: all }
  const parts = all.map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
  // Em aspas, o realm só precisa escapar " e \ (3.5.1 usa a sintaxe de quoted-string).
  if (input.realm) parts.unshift(`realm="${input.realm.replace(/[\\"]/g, '\$&')}"`)
  return { header: `OAuth ${parts.join(', ')}` }
}
