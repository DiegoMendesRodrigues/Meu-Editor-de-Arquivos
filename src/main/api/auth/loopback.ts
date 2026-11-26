// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

export type LoopbackOutcome =
  | { ok: true; code: string }
  | { ok: false; code: 'denied' | 'stateMismatch' | 'invalidResponse' | 'timeout' | 'cancelled' }

export interface Loopback {
  /** http://127.0.0.1:<porta>/callback (RFC 8252, 7.3). */
  redirectUri: string
  /** Nunca rejeita: resolve com o código ou com o motivo da falha. */
  result: Promise<LoopbackOutcome>
  close: () => void
}

export interface LoopbackOptions {
  state: string
  timeoutMs: number
  signal?: AbortSignal
  /** Páginas HTML mostradas ao usuário no navegador (já traduzidas pelo chamador). */
  pages: { success: string; failure: string }
}

const html = (res: ServerResponse, status: number, body: string): void => {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
    'x-content-type-options': 'nosniff',
    connection: 'close'
  })
  res.end(body)
}

/**
 * Servidor de redirecionamento do OAuth 2.0 para aplicativos nativos: só em 127.0.0.1, porta aleatória,
 * aceita uma única chamada em /callback, confere o state e se fecha (também no tempo limite e no cancelamento).
 */
export async function startLoopback(opts: LoopbackOptions): Promise<Loopback> {
  let settle!: (o: LoopbackOutcome) => void
  const result = new Promise<LoopbackOutcome>((resolve) => (settle = resolve))
  let finished = false
  let timer: NodeJS.Timeout | undefined

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Host diferente de 127.0.0.1:porta = tentativa de DNS rebinding; não consome a chamada única.
    const port = (server.address() as AddressInfo | null)?.port
    if (req.headers.host !== `127.0.0.1:${port}` || req.method !== 'GET') return html(res, 400, opts.pages.failure)
    let url: URL
    try {
      url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
    } catch {
      return html(res, 400, opts.pages.failure)
    }
    if (url.pathname !== '/callback') return html(res, 404, opts.pages.failure)
    if (finished) return html(res, 410, opts.pages.failure)
    finished = true

    const q = url.searchParams
    let outcome: LoopbackOutcome
    if (q.get('state') !== opts.state) outcome = { ok: false, code: 'stateMismatch' }
    else if (q.has('error')) outcome = { ok: false, code: 'denied' }
    else {
      const code = q.get('code')
      outcome = code && code.length <= 4096 ? { ok: true, code } : { ok: false, code: 'invalidResponse' }
    }
    html(res, outcome.ok ? 200 : 400, outcome.ok ? opts.pages.success : opts.pages.failure)
    // Fecha depois de a resposta sair, para o navegador receber a página.
    res.on('finish', () => close())
    settle(outcome)
  })

  const close = (): void => {
    finished = true
    if (timer) clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onAbort)
    server.close()
    server.closeIdleConnections()
    // Conexões ainda abertas (keep-alive do navegador) não podem segurar a porta.
    setTimeout(() => server.closeAllConnections(), 500).unref()
  }
  const onAbort = (): void => {
    settle({ ok: false, code: 'cancelled' })
    close()
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const port = (server.address() as AddressInfo).port

  if (opts.signal?.aborted) onAbort()
  else opts.signal?.addEventListener('abort', onAbort, { once: true })
  timer = setTimeout(() => {
    settle({ ok: false, code: 'timeout' })
    close()
  }, opts.timeoutMs)
  timer.unref()

  return { redirectUri: `http://127.0.0.1:${port}/callback`, result, close }
}
