// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { API_ERROR_CODES, type ApiErrorCode } from '@shared/api/protocol'

/** Falha do Cliente de API com um código conhecido (traduzido na interface, nunca a mensagem crua). */
export class ApiFail extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(code)
    this.name = 'ApiFail'
  }
}

const KNOWN = new Set<string>(API_ERROR_CODES)

/** Códigos do Node (e do OpenSSL) que viram outro código da lista. */
const ALIASES: Record<string, ApiErrorCode> = {
  EAI_AGAIN: 'ENOTFOUND',
  EAI_NODATA: 'ENOTFOUND',
  EAI_NONAME: 'ENOTFOUND',
  ENETUNREACH: 'EHOSTUNREACH',
  EHOSTDOWN: 'EHOSTUNREACH',
  ECONNABORTED: 'ECONNRESET',
  EPIPE: 'ECONNRESET',
  UND_ERR_SOCKET: 'ECONNRESET',
  UND_ERR_CONNECT_TIMEOUT: 'ETIMEDOUT',
  ERR_INVALID_URL: 'badUrl',
  ERR_INVALID_HTTP_TOKEN: 'invalidRequest',
  ERR_INVALID_CHAR: 'invalidRequest',
  ERR_HTTP_INVALID_HEADER_VALUE: 'invalidRequest',
  ENOENT: 'fileNotFound',
  ABORT_ERR: 'cancelled',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  UNABLE_TO_GET_ISSUER_CERT: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  CERT_UNTRUSTED: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
}

const TLS_VERSION_RE = /PROTOCOL_VERSION|UNSUPPORTED_PROTOCOL|WRONG_VERSION|VERSION_TOO|NO_PROTOCOLS_AVAILABLE/

/** Converte um erro do Node em código da lista; o que não se reconhece vira "unknown". */
export function toApiErrorCode(err: unknown): ApiErrorCode {
  if (err instanceof ApiFail) return err.code
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
  if (typeof code === 'string') {
    if (/ALERT_CERTIFICATE_REQUIRED|ALERT_BAD_CERTIFICATE|ALERT_UNKNOWN_CA/.test(code)) return 'clientCert'
    if (KNOWN.has(code)) return code as ApiErrorCode
    if (ALIASES[code]) return ALIASES[code]
    if (TLS_VERSION_RE.test(code)) return 'tlsVersion'
  }
  if (err instanceof Error && err.name === 'AbortError') return 'cancelled'
  return 'unknown'
}
