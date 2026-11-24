// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { request } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import type { ApiMockRoute } from '@shared/api/protocol'
import { matchPath, pickRoute, startMockServer } from './mock'

const route = (p: Partial<ApiMockRoute>): ApiMockRoute => ({ method: 'GET', path: '/', status: 200, headers: [], body: '', example: '', delayMs: 0, ...p })

const stops: (() => void)[] = []
afterEach(() => {
  while (stops.length) stops.pop()!()
})

async function boot(routes: ApiMockRoute[], extra: { maxBodyBytes?: number; idleMs?: number; onIdle?: () => void } = {}) {
  const logs: { method: string; path: string; status: number; route?: number }[] = []
  const s = await startMockServer({ routes, port: 0, lan: false, maxBodyBytes: extra.maxBodyBytes ?? 1024, maxConnections: 50, idleMs: extra.idleMs ?? 60_000, onLog: (e) => logs.push(e), ...(extra.onIdle ? { onIdle: extra.onIdle } : {}) })
  if (!s.ok) throw new Error('falhou')
  stops.push(s.stop)
  return { ...s, logs }
}

const call = (port: number, method: string, path: string, opts: { headers?: Record<string, string>; body?: string } = {}) =>
  new Promise<{ status: number; headers: Record<string, string | string[] | undefined>; text: string }>((ok, fail) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers: opts.headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => ok({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', fail)
    req.end(opts.body)
  })

describe('casamento de rotas', () => {
  it('casa :params e curinga por segmento', () => {
    expect(matchPath('/produtos/:id', '/produtos/7')).toEqual({ params: 1, wildcard: false })
    expect(matchPath('/produtos/:id', '/produtos')).toBeNull()
    expect(matchPath('/a/b', '/a/b/c')).toBeNull()
    expect(matchPath('/arquivos/*', '/arquivos/x/y/z')?.wildcard).toBe(true)
    expect(matchPath('/arquivos/*', '/arquivos')?.wildcard).toBe(true)
  })

  it('prefere a rota mais específica e escolhe o exemplo pelo nome', () => {
    const routes = [route({ path: '/p/:id', example: 'a' }), route({ path: '/p/novo', example: 'b' }), route({ path: '/p/novo', example: 'c' })]
    expect(pickRoute(routes, 'GET', '/p/novo', '')).toBe(1)
    expect(pickRoute(routes, 'GET', '/p/novo', 'c')).toBe(2)
    expect(pickRoute(routes, 'GET', '/p/9', 'zzz')).toBe(0)
    expect(pickRoute(routes, 'POST', '/p/9', '')).toBe(-1)
  })
})

describe('servidor mock', () => {
  it('responde status, cabeçalhos, corpo e CORS, e registra a chamada', async () => {
    const m = await boot([route({ path: '/produtos/:id', status: 201, headers: [{ key: 'X-Teste', value: 'sim' }], body: '{"ok":true}' })])
    const r = await call(m.port, 'GET', '/produtos/5?q=1')
    expect(r.status).toBe(201)
    expect(r.text).toBe('{"ok":true}')
    expect(r.headers['x-teste']).toBe('sim')
    expect(r.headers['access-control-allow-origin']).toBe('*')
    expect(m.logs).toEqual([expect.objectContaining({ method: 'GET', path: '/produtos/5?q=1', status: 201, route: 0 })])
  })

  it('recusa outro nome de host sem a opção de rede local (DNS rebinding)', async () => {
    const m = await boot([route({ path: '/x', body: 'ok' })])
    const r = await call(m.port, 'GET', '/x', { headers: { host: 'site-malicioso.exemplo.com.br' } })
    expect(r.status).toBe(421)
    expect((await call(m.port, 'GET', '/x', { headers: { host: `localhost:${m.port}` } })).text).toBe('ok')
  })

  it('escolhe o exemplo pelo cabeçalho e pela query', async () => {
    const m = await boot([route({ path: '/x', body: 'um', example: 'um' }), route({ path: '/x', body: 'dois', example: 'dois' })])
    expect((await call(m.port, 'GET', '/x')).text).toBe('um')
    expect((await call(m.port, 'GET', '/x', { headers: { 'x-mock-example': 'dois' } })).text).toBe('dois')
    expect((await call(m.port, 'GET', '/x?__example=dois')).text).toBe('dois')
  })

  it('devolve 404 em JSON sem rota e 204 no OPTIONS', async () => {
    const m = await boot([route({ path: '/x' })])
    const miss = await call(m.port, 'GET', '/nada')
    expect(miss.status).toBe(404)
    expect(JSON.parse(miss.text).error).toBe('no mock route')
    const opt = await call(m.port, 'OPTIONS', '/qualquer')
    expect(opt.status).toBe(204)
    expect(opt.headers['access-control-allow-methods']).toContain('POST')
  })

  it('aplica o atraso da rota', async () => {
    const m = await boot([route({ path: '/lento', delayMs: 150 })])
    const t0 = Date.now()
    await call(m.port, 'GET', '/lento')
    expect(Date.now() - t0).toBeGreaterThanOrEqual(140)
  })

  it('recusa corpo acima do limite com 413', async () => {
    const m = await boot([route({ method: 'POST', path: '/x' })], { maxBodyBytes: 100 })
    const r = await call(m.port, 'POST', '/x', { body: 'a'.repeat(5000) }).catch(() => ({ status: 413 }))
    expect(r.status).toBe(413)
  })

  it('avisa portInUse quando a porta está ocupada', async () => {
    const a = await boot([])
    const b = await startMockServer({ routes: [], port: a.port, lan: false, maxBodyBytes: 1, maxConnections: 1, idleMs: 1000, onLog: () => undefined })
    expect(b).toEqual({ ok: false, code: 'portInUse' })
  })

  it('para sozinho depois do tempo sem chamadas', async () => {
    let idle = false
    const m = await boot([route({})], { idleMs: 80, onIdle: () => (idle = true) })
    await new Promise((r) => setTimeout(r, 250))
    expect(idle).toBe(true)
    await expect(call(m.port, 'GET', '/')).rejects.toThrow()
  })
})
