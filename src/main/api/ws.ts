// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { WebContents } from 'electron'
import log from 'electron-log/main'
import WebSocket from 'ws'
import { z } from 'zod'
import { API_LIMITS } from '@shared/api/limits'
import { wsConnectInputSchema, type ApiWsConnectResult, type ApiWsEvent } from '@shared/api/protocol'
import { IpcChannels } from '@shared/ipc'
import { toApiErrorCode } from './errors'
import { buildResolver, type Resolver } from './resolve'
import { isHostTrusted, trustHost } from './trust'

/**
 * Conexões WebSocket do Cliente de API (fase 4). Toda a rede fica aqui no Main; o Renderer só abre, envia,
 * fecha e recebe eventos. Só o dono (a janela que abriu) envia ou fecha, e tudo é encerrado quando ela
 * fecha ou recarrega. Segredos resolvidos nunca voltam ao Renderer: mensagens enviadas aparecem mascaradas.
 */

/** Tamanho máximo de uma mensagem recebida; acima disso o ws fecha a conexão (1009). */
export const WS_MAX_PAYLOAD = 16 * 1024 * 1024
export const WS_HANDSHAKE_TIMEOUT_MS = 20_000

interface Conn {
  owner: WebContents
  ws: WebSocket
  resolver: Resolver
  host: string
}

const conns = new Map<string, Conn>()
const watched = new WeakSet<WebContents>()

const countOf = (owner: WebContents): number => [...conns.values()].filter((c) => c.owner === owner).length

function emit(owner: WebContents, event: Omit<ApiWsEvent, 'at'>): void {
  if (owner.isDestroyed()) return
  owner.send(IpcChannels.apiWsEvent, { ...event, at: new Date().toISOString() } satisfies ApiWsEvent)
}

/** Fecha todas as conexões da janela (ao fechar ou recarregar). */
export function closeOwned(owner: WebContents): void {
  for (const [id, c] of conns) {
    if (c.owner !== owner) continue
    conns.delete(id)
    try {
      c.ws.terminate()
    } catch {
      /* já fechada */
    }
  }
}

function watchOwner(owner: WebContents): void {
  if (watched.has(owner)) return
  watched.add(owner)
  owner.once('destroyed', () => closeOwned(owner))
  owner.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) closeOwned(owner)
  })
}

/** Texto (ou base64) para exibir, cortado em wsMessageBytes. */
function toDisplay(buf: Buffer, binary: boolean): { data: string; truncated: boolean } {
  const truncated = buf.length > API_LIMITS.wsMessageBytes
  const part = truncated ? buf.subarray(0, API_LIMITS.wsMessageBytes) : buf
  return { data: binary ? part.toString('base64') : part.toString('utf8'), truncated }
}

const toBuffer = (raw: WebSocket.RawData): Buffer =>
  Buffer.isBuffer(raw) ? raw : Array.isArray(raw) ? Buffer.concat(raw) : Buffer.from(raw)

export async function connectWs(owner: WebContents, raw: unknown): Promise<ApiWsConnectResult> {
  const parsed = wsConnectInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, code: 'invalidRequest' }
  const input = parsed.data
  if (conns.has(input.connId)) return { ok: false, code: 'invalidRequest' }
  if (countOf(owner) >= API_LIMITS.wsConnections) return { ok: false, code: 'tooManyConnections' }
  watchOwner(owner)

  const resolver = await buildResolver({ environment: input.environment, collection: input.collection, temporary: {} })
  let url: URL
  try {
    url = new URL(resolver.resolve(input.url).trim())
  } catch {
    return { ok: false, code: 'badUrl' }
  }
  // A URL pode vir de uma requisição HTTP (subscriptions GraphQL com {{baseUrl}}): http vira ws e https, wss.
  if (url.protocol === 'http:') url.protocol = 'ws:'
  else if (url.protocol === 'https:') url.protocol = 'wss:'
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return { ok: false, code: 'schemeNotAllowed' }

  const headers: Record<string, string> = {}
  for (const h of input.headers) {
    if (!h.enabled) continue
    const key = resolver.resolve(h.key).trim()
    if (key !== '') headers[key] = resolver.resolve(h.value)
  }
  const protocols = input.protocols.map((p) => resolver.resolve(p).trim()).filter((p) => p !== '')

  // Segredo só vai para um host já confirmado pelo usuário (como em api:send).
  const host = url.host.toLowerCase()
  if (resolver.secretScopes.size > 0 && !(await isHostTrusted(resolver.secretScopes, host))) {
    if (input.confirmSecretHost?.trim().toLowerCase() !== host) return { ok: false, code: 'secretHostNotConfirmed', host }
    await trustHost(resolver.secretScopes, host)
  }
  // Rechecagem: outra chamada pode ter ocupado o id ou a cota durante os awaits.
  if (conns.has(input.connId) || countOf(owner) >= API_LIMITS.wsConnections) return { ok: false, code: 'tooManyConnections' }

  let ws: WebSocket
  try {
    ws = new WebSocket(url, protocols, {
      headers,
      rejectUnauthorized: input.verifyTls,
      handshakeTimeout: WS_HANDSHAKE_TIMEOUT_MS,
      maxPayload: WS_MAX_PAYLOAD,
      followRedirects: false
    })
  } catch {
    return { ok: false, code: 'badUrl' }
  }
  const conn: Conn = { owner, ws, resolver, host }
  if (owner.isDestroyed()) {
    ws.terminate()
    return { ok: false, code: 'unknown' }
  }
  conns.set(input.connId, conn)

  return new Promise<ApiWsConnectResult>((resolve) => {
    let opened = false
    const drop = (): void => {
      if (conns.get(input.connId) === conn) conns.delete(input.connId)
    }
    ws.on('unexpected-response', (_req, res) => {
      res.resume()
      drop()
      log.info(`WebSocket ${host} recusado ${res.statusCode ?? 0}`)
      resolve({ ok: false, code: 'wsHandshake', status: res.statusCode ?? 0 })
      ws.terminate()
    })
    ws.on('open', () => {
      opened = true
      log.info(`WebSocket ${host} aberto`)
      resolve({ ok: true, protocol: ws.protocol, url: resolver.mask(url.href) })
      emit(owner, { connId: input.connId, type: 'open' })
    })
    ws.on('message', (data, isBinary) => {
      const buf = toBuffer(data)
      const d = toDisplay(buf, isBinary)
      emit(owner, { connId: input.connId, type: 'message', direction: 'in', data: d.data, binary: isBinary, size: buf.length, truncated: d.truncated || undefined })
    })
    ws.on('error', (err) => {
      const code = toApiErrorCode(err)
      if (!opened) {
        drop()
        log.info(`WebSocket ${host} falhou ${code}`)
        resolve({ ok: false, code })
      } else {
        emit(owner, { connId: input.connId, type: 'error', code })
      }
    })
    ws.on('close', (code) => {
      drop()
      if (opened) {
        log.info(`WebSocket ${host} fechado ${code}`)
        emit(owner, { connId: input.connId, type: 'close', code })
      }
    })
  })
}

const sendMessageSchema = z.object({ data: z.string().max(API_LIMITS.bodyChars), binary: z.boolean().optional() })

export async function sendWs(owner: WebContents, rawId: unknown, rawMessage: unknown): Promise<void> {
  const connId = z.string().uuid().parse(rawId)
  const message = sendMessageSchema.parse(rawMessage)
  const c = conns.get(connId)
  // Só o dono envia.
  if (!c || c.owner !== owner) return
  const binary = message.binary === true
  let payload: string | Buffer
  let shown: string
  if (binary) {
    if (!/^[A-Za-z0-9+/=\s]*$/.test(message.data)) return emit(owner, { connId, type: 'error', code: 'invalidRequest' })
    payload = Buffer.from(message.data, 'base64')
    shown = payload.toString('base64')
  } else {
    const before = c.resolver.secretScopes.size
    payload = c.resolver.resolve(message.data)
    // Segredo novo na mensagem precisa de host confirmado também.
    if (c.resolver.secretScopes.size > before && !(await isHostTrusted(c.resolver.secretScopes, c.host))) {
      return emit(owner, { connId, type: 'error', code: 'secretHostNotConfirmed' })
    }
    shown = c.resolver.mask(payload)
  }
  const size = typeof payload === 'string' ? Buffer.byteLength(payload) : payload.length
  const d = toDisplay(Buffer.from(shown, binary ? 'base64' : 'utf8'), binary)
  c.ws.send(payload, { binary }, (err) => {
    if (err) emit(owner, { connId, type: 'error', code: toApiErrorCode(err) })
    else emit(owner, { connId, type: 'message', direction: 'out', data: d.data, binary, size, truncated: d.truncated || undefined })
  })
}

export function closeWs(owner: WebContents, rawId: unknown, rawCode?: unknown): void {
  const connId = z.string().uuid().parse(rawId)
  const code = z.number().int().optional().parse(rawCode)
  const c = conns.get(connId)
  if (!c || c.owner !== owner) return
  // Só 1000 e 3000-4999 são códigos que a aplicação pode enviar.
  const valid = code !== undefined && (code === 1000 || (code >= 3000 && code <= 4999)) ? code : 1000
  try {
    c.ws.close(valid)
  } catch {
    c.ws.terminate()
  }
  // Se o servidor não responder ao fechamento, derruba em 3 s.
  setTimeout(() => c.ws.terminate(), 3000).unref()
}
