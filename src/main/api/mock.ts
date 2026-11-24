// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Servidor mock (fase 4): node:http local que responde pelas rotas dadas. Sem Electron aqui, para testar
 * com chamadas reais. Só o Main sobe o servidor; o Renderer recebe o registro das chamadas.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { networkInterfaces } from 'node:os'
import type { ApiMockLogEntry, ApiMockRoute } from '@shared/api/protocol'

export interface MockOptions {
  routes: ApiMockRoute[]
  port: number
  lan: boolean
  maxBodyBytes: number
  maxConnections: number
  idleMs: number
  onLog: (entry: Omit<ApiMockLogEntry, 'mockId'>) => void
  /** Chamado quando o servidor para sozinho por inatividade. */
  onIdle?: () => void
}

export type MockStarted = { ok: true; port: number; url: string; stop: () => void } | { ok: false; code: 'portInUse' | 'unknown' }

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
  'Access-Control-Max-Age': '86400'
}

const segments = (path: string): string[] => path.split('/').filter((s) => s !== '')

/** Casamento exato por segmento; ":x" aceita qualquer segmento; "*" no fim aceita o resto (inclusive nada). */
export function matchPath(pattern: string, actual: string): { params: number; wildcard: boolean } | null {
  const p = segments(pattern)
  const a = segments(actual)
  let params = 0
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!
    if (seg === '*' && i === p.length - 1) return { params, wildcard: true }
    if (i >= a.length) return null
    if (seg.startsWith(':') && seg.length > 1) params++
    else if (seg !== a[i]) return null
  }
  return p.length === a.length ? { params, wildcard: false } : null
}

/** Rota que atende a chamada; havendo vários exemplos, escolhe pelo nome pedido, senão o primeiro. */
export function pickRoute(routes: ApiMockRoute[], method: string, path: string, wanted: string): number {
  const found: { index: number; params: number; wildcard: boolean }[] = []
  routes.forEach((r, index) => {
    const m = r.method.toUpperCase()
    if (m !== '*' && m !== method) return
    const hit = matchPath(r.path, path)
    if (hit) found.push({ index, ...hit })
  })
  if (found.length === 0) return -1
  // Mais específica primeiro (sem curinga, menos :params); empates mantêm a ordem das rotas.
  found.sort((x, y) => Number(x.wildcard) - Number(y.wildcard) || x.params - y.params || x.index - y.index)
  const best = found[0]!
  const same = found.filter((f) => f.wildcard === best.wildcard && f.params === best.params)
  if (wanted) {
    const byName = same.find((f) => routes[f.index]!.example === wanted)
    if (byName) return byName.index
  }
  return best.index
}

function lanAddress(): string {
  for (const list of Object.values(networkInterfaces())) {
    for (const nic of list ?? []) if (nic.family === 'IPv4' && !nic.internal) return nic.address
  }
  return '127.0.0.1'
}

export function startMockServer(opts: MockOptions): Promise<MockStarted> {
  const timers = new Set<NodeJS.Timeout>()
  let idleTimer: NodeJS.Timeout | undefined
  let stopped = false
  let server: Server

  const stop = (): void => {
    if (stopped) return
    stopped = true
    if (idleTimer) clearTimeout(idleTimer)
    for (const t of timers) clearTimeout(t)
    timers.clear()
    server.close()
    server.closeAllConnections()
  }
  const armIdle = (): void => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      stop()
      opts.onIdle?.()
    }, opts.idleMs)
    idleTimer.unref()
  }

  const finish = (res: ServerResponse, status: number, headers: Record<string, string>, body: string | Buffer, method: string): void => {
    if (res.destroyed) return
    for (const [k, v] of Object.entries(headers)) {
      try {
        res.setHeader(k, v)
      } catch {
        // cabeçalho inválido (caractere de controle): ignora só ele
      }
    }
    res.statusCode = status
    res.end(method === 'HEAD' ? undefined : body)
  }

  const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
    armIdle()
    const started = Date.now()
    const method = (req.method ?? 'GET').toUpperCase()
    const url = new URL(req.url ?? '/', 'http://mock.local')
    let path = url.pathname
    try {
      path = decodeURI(path)
    } catch {
      // mantém o caminho cru
    }
    const wanted = (req.headers['x-mock-example'] as string | undefined) ?? url.searchParams.get('__example') ?? ''
    const logged = path + url.search

    // Só neste computador: recusa nomes de host diferentes de localhost/127.0.0.1 (contra DNS rebinding a partir de sites abertos no navegador).
    if (!opts.lan) {
      const host = (req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase()
      if (host !== '127.0.0.1' && host !== 'localhost' && host !== '[::1]') {
        opts.onLog({ at: new Date().toISOString(), method, path: logged, status: 421, timeMs: Date.now() - started })
        finish(res, 421, { 'Content-Type': 'application/json', Connection: 'close' }, JSON.stringify({ error: 'host not allowed' }), method)
        req.resume()
        return
      }
    }

    let size = 0
    let tooBig = false
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > opts.maxBodyBytes && !tooBig) {
        tooBig = true
        opts.onLog({ at: new Date().toISOString(), method, path: logged, status: 413, timeMs: Date.now() - started })
        finish(res, 413, { ...CORS, 'Content-Type': 'application/json', Connection: 'close' }, JSON.stringify({ error: 'body too large' }), method)
        req.destroy()
      }
    })
    req.on('error', () => undefined)
    req.on('end', () => {
      if (tooBig) return
      const index = pickRoute(opts.routes, method, path, wanted)
      const respond = (status: number, headers: Record<string, string>, body: string, route?: number): void => {
        finish(res, status, headers, body, method)
        opts.onLog({ at: new Date().toISOString(), method, path: logged, status, ...(route !== undefined ? { route } : {}), timeMs: Date.now() - started })
      }
      if (index < 0) {
        // Pré-voo CORS sem rota própria: libera.
        if (method === 'OPTIONS') return respond(204, { ...CORS }, '')
        return respond(404, { ...CORS, 'Content-Type': 'application/json' }, JSON.stringify({ error: 'no mock route', method, path }))
      }
      const route = opts.routes[index]!
      const headers: Record<string, string> = { ...CORS }
      for (const h of route.headers) {
        if (h.key.toLowerCase() === 'content-length' || h.key.toLowerCase() === 'transfer-encoding') continue
        const existing = Object.keys(headers).find((k) => k.toLowerCase() === h.key.toLowerCase())
        if (existing) delete headers[existing]
        headers[h.key] = h.value
      }
      const send = (): void => respond(route.status, headers, route.body, index)
      if (route.delayMs > 0) {
        const t = setTimeout(() => {
          timers.delete(t)
          send()
        }, route.delayMs)
        timers.add(t)
      } else send()
    })
  }

  server = createServer(onRequest)
  server.maxConnections = opts.maxConnections
  server.requestTimeout = 30_000

  return new Promise((resolve) => {
    server.once('error', (err: NodeJS.ErrnoException) => {
      resolve({ ok: false, code: err.code === 'EADDRINUSE' || err.code === 'EACCES' ? 'portInUse' : 'unknown' })
    })
    server.listen(opts.port, opts.lan ? '0.0.0.0' : '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port
      armIdle()
      resolve({ ok: true, port, url: `http://${opts.lan ? lanAddress() : '127.0.0.1'}:${port}`, stop })
    })
  })
}
