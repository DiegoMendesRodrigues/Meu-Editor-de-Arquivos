// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createReadStream } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import http from 'node:http'
import http2, { type OutgoingHttpHeaders } from 'node:http2'
import https from 'node:https'
import net from 'node:net'
import { performance } from 'node:perf_hooks'
import { pipeline, Readable, Transform, Writable } from 'node:stream'
import { pipeline as pipelineAsync } from 'node:stream/promises'
import tls from 'node:tls'
import zlib from 'node:zlib'
import { API_LIMITS } from '@shared/api/limits'
import type { ApiTimings, ApiTlsInfo } from '@shared/api/protocol'
import type { BodyChunk } from './body'
import { ApiFail } from './errors'
import { proxyAuthHeader } from './proxy'
import { describeTls, type TlsMaterial } from './tls'

/**
 * Cliente HTTP do Cliente de API, sobre node:http, node:https e node:http2 (sem dependências), para medir
 * as etapas (DNS, TCP, TLS, primeiro byte, download), controlar o TLS e aplicar os limites.
 * A conexão é feita aqui (createConnection), o que permite proxy, túnel CONNECT e ALPN (HTTP/2).
 */

export interface HttpOptions {
  method: string
  url: URL
  /** Cabeçalhos do usuário e os automáticos, em ordem; Host e Content-Length são acrescentados aqui. */
  headers: [string, string][]
  body?: { chunks: BodyChunk[]; length: number }
  settings: { timeoutMs: number; followRedirects: boolean; maxRedirects: number; verifyTls: boolean; minTlsVersion: 'TLSv1.2' | 'TLSv1.3'; http2: boolean }
  connectTimeoutMs?: number
  tls?: TlsMaterial
  /** Proxy para a URL de destino (null = direto). */
  proxy?: (url: URL) => Promise<URL | null>
  signal?: AbortSignal
  /** Grava o corpo inteiro neste arquivo, em streaming (só os primeiros displayBytes ficam na memória). */
  saveToPath?: string
  /** Nomes (minúsculos) de cabeçalhos que não acompanham um redirecionamento para outro host. */
  stripOnRedirect?: string[]
  /** Requisição com segredo: um redirecionamento para outro host não é seguido (a resposta 3xx é devolvida como está). */
  noCrossHostRedirect?: boolean
  /** Cookies a enviar numa nova URL (redirecionamento). Sem a função, os cabeçalhos ficam como estão. */
  cookieHeader?: (url: URL) => string | undefined
  /** Recebe os Set-Cookie de cada resposta (inclusive as de redirecionamento). */
  onSetCookie?: (url: URL, setCookies: string[]) => void
  limits?: { memoryBytes: number; displayBytes: number; fileBytes?: number }
}

export interface HttpResult {
  status: number
  statusText: string
  httpVersion: string
  headers: [string, string][]
  /** Corpo (descomprimido) mantido na memória: inteiro, ou só o começo com saveToPath. */
  body: Buffer
  /** Tamanho total do corpo descomprimido. */
  bodySize: number
  compressedSize?: number
  headersSize: number
  timings: ApiTimings
  tls?: ApiTlsInfo
  redirects: { status: number; url: string }[]
  finalUrl: string
  savedTo?: string
}

interface Closable {
  destroy(): unknown
}

interface Ctx {
  signal: AbortSignal
  fail: (code: ApiFail['code']) => void
  open: Set<Closable>
}

const now = (): number => performance.now()
const round = (n: number): number => Math.round(Math.max(0, n) * 10) / 10

/** Espera a promessa, mas rejeita com o motivo do cancelamento ou do tempo limite se o envio for abortado antes. */
function raceAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const onAbort = (): void => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener('abort', onAbort)
        reject(e)
      }
    )
  })
}

const hostOf = (u: URL): string => u.hostname.replace(/^\[|\]$/g, '')

/** Túnel CONNECT para HTTPS através do proxy HTTP. */
async function openTunnel(socket: net.Socket, target: URL, proxy: URL, ctx: Ctx): Promise<void> {
  const authority = `${target.hostname}:${target.port || 443}`
  const auth = proxyAuthHeader(proxy)
  socket.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n${auth ? `Proxy-Authorization: ${auth}\r\n` : ''}\r\n`)
  await raceAbort(
    new Promise<void>((resolve, reject) => {
      let buf = Buffer.alloc(0)
      const cleanup = (): void => {
        socket.off('data', onData)
        socket.off('error', onError)
        socket.off('close', onClose)
      }
      const onError = (): void => {
        cleanup()
        reject(new ApiFail('proxy'))
      }
      const onClose = onError
      const onData = (d: Buffer): void => {
        buf = Buffer.concat([buf, d])
        const end = buf.indexOf('\r\n\r\n')
        if (end < 0) {
          if (buf.length > 16 * 1024) onError()
          return
        }
        cleanup()
        socket.pause()
        const status = /^HTTP\/\d(?:\.\d)? (\d{3})/.exec(buf.toString('latin1', 0, end))
        if (status?.[1] === '200') resolve()
        else reject(new ApiFail('proxy'))
      }
      socket.on('data', onData)
      socket.once('error', onError)
      socket.once('close', onClose)
    }),
    ctx.signal
  )
}

interface Conn {
  socket: net.Socket
  proxy: URL | null
  alpn: string | false | null
  dns: number
  tcp: number
  tls: number
  tlsInfo?: ApiTlsInfo
}

async function connect(url: URL, o: HttpOptions, ctx: Ctx): Promise<Conn> {
  const t0 = now()
  const timer = setTimeout(() => ctx.fail('connectTimeout'), o.connectTimeoutMs ?? API_LIMITS.connectTimeoutMs)
  try {
    const proxy = (await o.proxy?.(url)) ?? null
    const secure = url.protocol === 'https:'
    const host = hostOf(proxy ?? url)
    const port = Number((proxy ?? url).port) || (proxy ? 80 : secure ? 443 : 80)
    const socket = net.connect({ host, port })
    ctx.open.add(socket)
    let tLookup: number | undefined
    socket.once('lookup', () => (tLookup = now()))
    await raceAbort(
      new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve)
        socket.once('error', reject)
      }),
      ctx.signal
    )
    if (proxy && secure) await openTunnel(socket, url, proxy, ctx)
    const tTcp = now()
    const conn: Conn = { socket, proxy, alpn: null, dns: tLookup === undefined ? 0 : tLookup - t0, tcp: tTcp - (tLookup ?? t0), tls: 0 }
    if (!secure) return finishTimes(conn)

    const m = o.tls ?? {}
    let tlsSocket: tls.TLSSocket
    try {
      tlsSocket = tls.connect({
        socket,
        servername: net.isIP(hostOf(url)) ? undefined : hostOf(url),
        rejectUnauthorized: o.settings.verifyTls,
        minVersion: o.settings.minTlsVersion,
        ALPNProtocols: o.settings.http2 ? ['h2', 'http/1.1'] : ['http/1.1'],
        ca: m.ca,
        cert: m.cert,
        key: m.key,
        pfx: m.pfx,
        passphrase: m.passphrase
      })
    } catch (err) {
      // Certificado ou chave de cliente ilegível, ou senha errada.
      throw m.cert || m.pfx ? new ApiFail('clientCert') : err
    }
    ctx.open.add(tlsSocket)
    await raceAbort(
      new Promise<void>((resolve, reject) => {
        tlsSocket.once('secureConnect', resolve)
        tlsSocket.once('error', reject)
      }),
      ctx.signal
    )
    conn.socket = tlsSocket
    conn.tls = now() - tTcp
    conn.alpn = tlsSocket.alpnProtocol
    conn.tlsInfo = describeTls(tlsSocket)
    return finishTimes(conn)
  } finally {
    clearTimeout(timer)
  }
}

const finishTimes = (c: Conn): Conn => ({ ...c, dns: round(c.dns), tcp: round(c.tcp), tls: round(c.tls) })

interface RawResponse {
  status: number
  statusText: string
  httpVersion: string
  headers: [string, string][]
  stream: Readable
  /** Instante em que os cabeçalhos chegaram. */
  tHeaders: number
}

async function* chunkSource(chunks: BodyChunk[]): AsyncGenerator<Buffer> {
  for (const c of chunks) {
    if (Buffer.isBuffer(c)) yield c
    else for await (const b of createReadStream(c.path)) yield b as Buffer
  }
}

/** Envia o corpo e termina a requisição. Erros de gravação só valem enquanto não houver resposta. */
function sendBody(chunks: BodyChunk[], target: Writable, hasResponse: () => boolean, onError: (e: Error) => void): void {
  if (chunks.length === 0) {
    target.end()
    return
  }
  pipeline(Readable.from(chunkSource(chunks)), target, (err) => {
    if (err && !hasResponse()) onError(err)
  })
}

function requestH1(conn: Conn, url: URL, method: string, headers: [string, string][], body: HttpOptions['body'], ctx: Ctx): Promise<RawResponse> {
  const secure = url.protocol === 'https:'
  const absolute = conn.proxy !== null && !secure
  const bare = new URL(url.href)
  bare.hash = ''
  const flat = headers.flatMap(([k, v]) => [k, v])
  return new Promise<RawResponse>((resolve, reject) => {
    let responded = false
    const req = (secure ? https : http).request({
      method,
      path: absolute ? bare.href : `${url.pathname}${url.search}`,
      headers: flat,
      createConnection: () => conn.socket,
      setHost: false
    })
    ctx.open.add(req)
    req.once('error', reject)
    req.once('response', (res) => {
      responded = true
      const headers: [string, string][] = []
      for (let i = 0; i < res.rawHeaders.length; i += 2) headers.push([res.rawHeaders[i]!, res.rawHeaders[i + 1]!])
      resolve({ status: res.statusCode ?? 0, statusText: res.statusMessage ?? '', httpVersion: res.httpVersion, headers, stream: res, tHeaders: now() })
    })
    sendBody(body?.chunks ?? [], req, () => responded, reject)
  })
}

const H2_FORBIDDEN = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'host'])

function requestH2(conn: Conn, url: URL, method: string, headers: [string, string][], body: HttpOptions['body'], ctx: Ctx): Promise<RawResponse> {
  return new Promise<RawResponse>((resolve, reject) => {
    const session = http2.connect(`https://${url.host}`, { createConnection: () => conn.socket })
    ctx.open.add(session)
    session.once('error', reject)
    const h: OutgoingHttpHeaders = { ':method': method, ':path': `${url.pathname}${url.search}`, ':authority': url.host, ':scheme': 'https' }
    for (const [k, v] of headers) {
      const key = k.toLowerCase()
      if (H2_FORBIDDEN.has(key)) continue
      const prev = h[key]
      h[key] = prev === undefined ? v : [...(Array.isArray(prev) ? prev : [String(prev)]), v]
    }
    const stream = session.request(h, { endStream: !body || body.chunks.length === 0 })
    let responded = false
    stream.once('error', reject)
    stream.once('response', (rh) => {
      responded = true
      const out: [string, string][] = []
      for (const [k, v] of Object.entries(rh)) {
        if (k.startsWith(':') || v === undefined) continue
        for (const item of Array.isArray(v) ? v : [String(v)]) out.push([k, item])
      }
      const status = Number(rh[':status'])
      resolve({ status, statusText: http.STATUS_CODES[status] ?? '', httpVersion: '2', headers: out, stream, tHeaders: now() })
    })
    if (body && body.chunks.length > 0) sendBody(body.chunks, stream, () => responded, reject)
  })
}

const header = (list: [string, string][], name: string): string | undefined => list.find(([k]) => k.toLowerCase() === name)?.[1]
const without = (list: [string, string][], ...names: string[]): [string, string][] => list.filter(([k]) => !names.includes(k.toLowerCase()))

function decoders(encoding: string | undefined): Transform[] {
  const list = (encoding ?? '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'identity')
    .reverse()
  const out: Transform[] = []
  for (const e of list) {
    if (e === 'gzip' || e === 'x-gzip') out.push(zlib.createGunzip({ flush: zlib.constants.Z_SYNC_FLUSH, finishFlush: zlib.constants.Z_SYNC_FLUSH }))
    else if (e === 'deflate') out.push(zlib.createInflate({ flush: zlib.constants.Z_SYNC_FLUSH, finishFlush: zlib.constants.Z_SYNC_FLUSH }))
    else if (e === 'br') out.push(zlib.createBrotliDecompress())
  }
  return out
}

interface BodyRead {
  body: Buffer
  size: number
  compressed?: number
  savedTo?: string
}

/** Lê o corpo descomprimindo e contando: o limite vale para o tamanho depois de descomprimir (contra bombas). */
async function readBody(raw: RawResponse, o: HttpOptions, ctx: Ctx): Promise<BodyRead> {
  const limits = o.limits ?? { memoryBytes: API_LIMITS.responseMemoryBytes, displayBytes: API_LIMITS.displayBytes }
  const encoding = header(raw.headers, 'content-encoding')
  const steps = decoders(encoding)
  let compressed = 0
  const kept: Buffer[] = []
  let keptBytes = 0
  let size = 0
  const keepLimit = o.saveToPath ? limits.displayBytes : limits.memoryBytes
  const handle = o.saveToPath ? await open(o.saveToPath, 'w') : null
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      compressed += chunk.length
      cb(null, chunk)
    }
  })
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      size += chunk.length
      if (!handle && size > limits.memoryBytes) return cb(new ApiFail('tooLarge'))
      // Gravando em arquivo também há teto, para não encher o disco.
      if (handle && size > (o.limits?.fileBytes ?? API_LIMITS.responseFileBytes)) return cb(new ApiFail('tooLarge'))
      if (keptBytes < keepLimit) {
        const part = chunk.length > keepLimit - keptBytes ? chunk.subarray(0, keepLimit - keptBytes) : chunk
        kept.push(part)
        keptBytes += part.length
      }
      if (handle) handle.write(chunk).then(() => cb(), cb)
      else cb()
    }
  })
  try {
    await pipelineAsync([raw.stream, counter, ...steps, sink], { signal: ctx.signal })
  } catch (err) {
    await handle?.close().catch(() => undefined)
    if (o.saveToPath) await unlink(o.saveToPath).catch(() => undefined)
    throw err
  }
  await handle?.close()
  return { body: Buffer.concat(kept), size, compressed: steps.length > 0 ? compressed : undefined, savedTo: o.saveToPath }
}

const REDIRECTS = new Set([301, 302, 303, 307, 308])
const sensitive = ['authorization', 'cookie', 'proxy-authorization', 'x-api-key']

/** Envia a requisição (com redirecionamentos) e devolve a resposta. Falhas chegam como ApiFail ou erro do Node. */
export async function sendHttp(o: HttpOptions): Promise<HttpResult> {
  const ac = new AbortController()
  const fail = (code: ApiFail['code']): void => {
    if (!ac.signal.aborted) ac.abort(new ApiFail(code))
  }
  const ctx: Ctx = { signal: ac.signal, fail, open: new Set() }
  ac.signal.addEventListener('abort', () => {
    for (const c of ctx.open) c.destroy()
  })
  const onExternal = (): void => fail('cancelled')
  if (o.signal?.aborted) onExternal()
  else o.signal?.addEventListener('abort', onExternal, { once: true })
  const total = setTimeout(() => fail('timeout'), o.settings.timeoutMs)
  try {
    return await run(o, ctx)
  } catch (err) {
    throw ac.signal.aborted ? ac.signal.reason : err
  } finally {
    clearTimeout(total)
    o.signal?.removeEventListener('abort', onExternal)
    for (const c of ctx.open) c.destroy()
  }
}

async function run(o: HttpOptions, ctx: Ctx): Promise<HttpResult> {
  const t0 = now()
  let url = o.url
  let method = o.method
  let headers = [...o.headers]
  let body = o.body
  const redirects: { status: number; url: string }[] = []

  for (;;) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ApiFail('schemeNotAllowed')
    const conn = await connect(url, o, ctx)
    const wire = [...headers]
    if (!header(wire, 'host')) wire.unshift(['Host', url.host])
    if (conn.proxy && url.protocol === 'http:') {
      const auth = proxyAuthHeader(conn.proxy)
      if (auth && !header(wire, 'proxy-authorization')) wire.push(['Proxy-Authorization', auth])
    }
    const hasBody = (body?.length ?? 0) > 0
    if (!header(wire, 'content-length') && (hasBody || ['POST', 'PUT', 'PATCH'].includes(method))) wire.push(['Content-Length', String(body?.length ?? 0)])

    const tSent = now()
    const useH2 = o.settings.http2 && conn.alpn === 'h2'
    const raw = await (useH2 ? requestH2 : requestH1)(conn, url, method, wire, body, ctx)
    const setCookies = raw.headers.filter(([k]) => k.toLowerCase() === 'set-cookie').map(([, v]) => v)
    if (setCookies.length > 0) o.onSetCookie?.(url, setCookies)

    const location = header(raw.headers, 'location')
    let blockedCross = false
    if (o.noCrossHostRedirect && o.settings.followRedirects && REDIRECTS.has(raw.status) && location) {
      try {
        const n = new URL(location, url)
        blockedCross = n.host !== url.host || (url.protocol === 'https:' && n.protocol === 'http:')
      } catch {
        // Local inválido: segue o fluxo normal (badUrl).
      }
    }
    if (o.settings.followRedirects && REDIRECTS.has(raw.status) && location && !blockedCross) {
      raw.stream.resume()
      if (redirects.length >= o.settings.maxRedirects) throw new ApiFail('tooManyRedirects')
      let next: URL
      try {
        next = new URL(location, url)
      } catch {
        throw new ApiFail('badUrl')
      }
      if (next.protocol !== 'http:' && next.protocol !== 'https:') throw new ApiFail('schemeNotAllowed')
      redirects.push({ status: raw.status, url: next.href })
      const otherHost = next.host !== url.host || (url.protocol === 'https:' && next.protocol === 'http:')
      // Outro host: Authorization e Cookie não vão junto (não vazar credenciais para terceiros).
      if (otherHost) headers = without(headers, ...sensitive, ...(o.stripOnRedirect ?? []))
      if ((raw.status === 303 && method !== 'HEAD') || ((raw.status === 301 || raw.status === 302) && method === 'POST')) {
        method = 'GET'
        body = undefined
        headers = without(headers, 'content-type', 'content-length', 'content-encoding', 'content-language', 'transfer-encoding')
      }
      if (o.cookieHeader) {
        const cookie = o.cookieHeader(next)
        headers = without(headers, 'cookie')
        if (cookie) headers.push(['Cookie', cookie])
      }
      for (const c of ctx.open) c.destroy()
      ctx.open.clear()
      url = next
      continue
    }

    const noBody = method === 'HEAD' || raw.status === 204 || raw.status === 304 || raw.status < 200
    let read: BodyRead
    if (noBody) {
      raw.stream.resume()
      read = { body: Buffer.alloc(0), size: 0 }
      if (o.saveToPath) {
        const h = await open(o.saveToPath, 'w')
        await h.close()
        read.savedTo = o.saveToPath
      }
    } else read = await readBody(raw, o, ctx)
    const tEnd = now()
    const headersSize = raw.headers.reduce((n, [k, v]) => n + k.length + v.length + 4, 15)
    return {
      status: raw.status,
      statusText: raw.statusText,
      httpVersion: raw.httpVersion,
      headers: raw.headers,
      body: read.body,
      bodySize: read.size,
      compressedSize: read.compressed,
      headersSize,
      timings: {
        dns: conn.dns,
        tcp: conn.tcp,
        tls: conn.tls,
        firstByte: round(raw.tHeaders - tSent),
        download: round(tEnd - raw.tHeaders),
        total: round(tEnd - t0)
      },
      tls: conn.tlsInfo,
      redirects,
      finalUrl: url.href,
      savedTo: read.savedTo
    }
  }
}
