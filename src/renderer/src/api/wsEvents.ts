// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { ApiWsEvent } from '@shared/api/protocol'

/**
 * Um único ouvinte de api:ws-event para a janela; cada conexão registra o seu pelo connId. Usado pelo painel
 * WebSocket e pelas subscriptions GraphQL (que também abrem WebSockets pelos canais apiWs*).
 */
const listeners = new Map<string, (event: ApiWsEvent) => void>()
let off: (() => void) | null = null

export function listenWs(connId: string, listener: (event: ApiWsEvent) => void): () => void {
  off ??= window.api.onApiWsEvent((e) => listeners.get(e.connId)?.(e))
  listeners.set(connId, listener)
  return () => {
    listeners.delete(connId)
    if (listeners.size === 0 && off) {
      off()
      off = null
    }
  }
}

/** Texto base64 válido (com ou sem quebras de linha). */
export function base64Valid(text: string): boolean {
  const clean = text.replace(/\s+/g, '')
  return /^[A-Za-z0-9+/]*={0,2}$/.test(clean) && clean.length % 4 === 0
}

/** Texto formatado se for JSON; senão null. */
export function prettyJson(text: string): string | null {
  const s = text.trim()
  if (!(s.startsWith('{') || s.startsWith('['))) return null
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return null
  }
}

/** Chave i18n do erro de uma conexão; `code` vem do Main (ApiErrorCode, wsHandshake ou tooManyConnections). */
export function wsErrorKey(code: string): string {
  if (code === 'wsHandshake') return 'apiClient.ws.error.handshake'
  if (code === 'tooManyConnections') return 'apiClient.ws.error.tooManyConnections'
  return `apiClient.error.${code}`
}
