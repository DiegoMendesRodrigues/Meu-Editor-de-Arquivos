// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdtempSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'

const h = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({ app: { getPath: () => h.dir } }))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))
vi.mock('./vault', () => ({
  secretVault: { get: async (scope: string, name: string) => (scope === 'env1' && name === 'token' ? 's3cr3t-valor' : undefined), names: async () => [] }
}))

import { API_LIMITS } from '@shared/api/limits'
import { MASK, type ApiWsEvent } from '@shared/api/protocol'
import { closeOwned, closeWs, connectWs, sendWs } from './ws'

/** WebContents de mentira: recebe os eventos e avisa quando é destruído. */
class FakeOwner extends EventEmitter {
  events: ApiWsEvent[] = []
  destroyed = false
  send(_channel: string, event: ApiWsEvent): void {
    this.events.push(event)
  }
  isDestroyed(): boolean {
    return this.destroyed
  }
}
const asOwner = (o: FakeOwner) => o as unknown as Electron.WebContents

let server: WebSocketServer
const owners: FakeOwner[] = []
const newOwner = (): FakeOwner => {
  const o = new FakeOwner()
  owners.push(o)
  return o
}
const wait = async (cond: () => boolean, ms = 3000): Promise<void> => {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error('tempo esgotado')
    await new Promise((r) => setTimeout(r, 10))
  }
}
const url = (): string => `ws://127.0.0.1:${(server.address() as AddressInfo).port}`

beforeAll(async () => {
  h.dir = mkdtempSync(join(tmpdir(), 'apiws-'))
  server = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  server.on('connection', (sock) => {
    sock.on('message', (data, isBinary) => sock.send(data, { binary: isBinary }))
  })
  await new Promise((r) => server.once('listening', r))
  return () => server.close()
})

afterEach(() => {
  for (const o of owners.splice(0)) closeOwned(asOwner(o))
})

describe('WebSocket no Main', () => {
  it('conecta, envia texto e recebe o eco', async () => {
    const o = newOwner()
    const id = randomUUID()
    const r = await connectWs(asOwner(o), { connId: id, url: url() })
    expect(r.ok).toBe(true)
    await sendWs(asOwner(o), id, { data: 'olá' })
    await wait(() => o.events.some((e) => e.direction === 'in'))
    expect(o.events.find((e) => e.direction === 'out')?.data).toBe('olá')
    expect(o.events.find((e) => e.direction === 'in')?.data).toBe('olá')
    expect(o.events.find((e) => e.type === 'open')).toBeTruthy()
  })

  it('envia e recebe binário em base64', async () => {
    const o = newOwner()
    const id = randomUUID()
    await connectWs(asOwner(o), { connId: id, url: url() })
    const b64 = Buffer.from([1, 2, 3, 250]).toString('base64')
    await sendWs(asOwner(o), id, { data: b64, binary: true })
    await wait(() => o.events.some((e) => e.direction === 'in'))
    const inEvent = o.events.find((e) => e.direction === 'in')!
    expect(inEvent.binary).toBe(true)
    expect(inEvent.data).toBe(b64)
    expect(inEvent.size).toBe(4)
  })

  it('trunca a mensagem exibida mas informa o tamanho real', async () => {
    const o = newOwner()
    const id = randomUUID()
    await connectWs(asOwner(o), { connId: id, url: url() })
    const big = 'x'.repeat(API_LIMITS.wsMessageBytes + 100)
    await sendWs(asOwner(o), id, { data: big })
    await wait(() => o.events.some((e) => e.direction === 'in'))
    const inEvent = o.events.find((e) => e.direction === 'in')!
    expect(inEvent.truncated).toBe(true)
    expect(inEvent.data?.length).toBe(API_LIMITS.wsMessageBytes)
    expect(inEvent.size).toBe(big.length)
  })

  it('limita as conexões por janela', async () => {
    const o = newOwner()
    for (let i = 0; i < API_LIMITS.wsConnections; i++) expect((await connectWs(asOwner(o), { connId: randomUUID(), url: url() })).ok).toBe(true)
    const extra = await connectWs(asOwner(o), { connId: randomUUID(), url: url() })
    expect(extra).toEqual({ ok: false, code: 'tooManyConnections' })
    // Outra janela tem cota própria.
    expect((await connectWs(asOwner(newOwner()), { connId: randomUUID(), url: url() })).ok).toBe(true)
  })

  it('fecha as conexões quando a janela é destruída', async () => {
    const o = newOwner()
    const id = randomUUID()
    await connectWs(asOwner(o), { connId: id, url: url() })
    const serverSide = [...server.clients]
    o.destroyed = true
    o.emit('destroyed')
    await wait(() => serverSide.every((c) => c.readyState === c.CLOSED))
    // Depois de destruída, a conexão não aceita mais envio.
    await sendWs(asOwner(o), id, { data: 'x' })
    expect(o.events.filter((e) => e.direction === 'out')).toHaveLength(0)
  })

  it('só o dono envia e fecha', async () => {
    const o = newOwner()
    const intruder = newOwner()
    const id = randomUUID()
    await connectWs(asOwner(o), { connId: id, url: url() })
    await sendWs(asOwner(intruder), id, { data: 'x' })
    closeWs(asOwner(intruder), id)
    await new Promise((r) => setTimeout(r, 100))
    expect(o.events.some((e) => e.type === 'close')).toBe(false)
    expect(intruder.events).toHaveLength(0)
    closeWs(asOwner(o), id)
    await wait(() => o.events.some((e) => e.type === 'close'))
  })

  it('recusa esquemas que não sejam ws, wss, http ou https (estes viram ws/wss)', async () => {
    const o = newOwner()
    for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'ftp://127.0.0.1/']) {
      expect(await connectWs(asOwner(o), { connId: randomUUID(), url: bad })).toEqual({ ok: false, code: 'schemeNotAllowed' })
    }
    expect(await connectWs(asOwner(o), { connId: randomUUID(), url: 'não é url' })).toEqual({ ok: false, code: 'badUrl' })
  })

  it('devolve wsHandshake com o status quando o handshake é recusado', async () => {
    const http = new WebSocketServer({ port: 0, host: '127.0.0.1', verifyClient: (_i, cb) => cb(false, 403, 'no') })
    await new Promise((r) => http.once('listening', r))
    const r = await connectWs(asOwner(newOwner()), { connId: randomUUID(), url: `ws://127.0.0.1:${(http.address() as AddressInfo).port}` })
    http.close()
    expect(r).toEqual({ ok: false, code: 'wsHandshake', status: 403 })
  })

  it('pede confirmação do host para segredos e mascara a mensagem enviada', async () => {
    const o = newOwner()
    const id = randomUUID()
    const env = { id: 'env1', name: 'Teste', variables: [{ key: 'token', secret: true }] }
    const first = await connectWs(asOwner(o), { connId: id, url: url(), environment: env, headers: [{ key: 'X-T', value: '{{token}}' }] })
    const host = new URL(url()).host
    expect(first).toEqual({ ok: false, code: 'secretHostNotConfirmed', host })
    const wrong = await connectWs(asOwner(o), { connId: id, url: url(), environment: env, headers: [{ key: 'X-T', value: '{{token}}' }], confirmSecretHost: 'outro:1' })
    expect(wrong.ok).toBe(false)
    const ok = await connectWs(asOwner(o), { connId: id, url: `${url()}/?t={{token}}`, environment: env, confirmSecretHost: host })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.url).not.toContain('s3cr3t')
    await sendWs(asOwner(o), id, { data: '{"auth":"{{token}}"}' })
    await wait(() => o.events.some((e) => e.direction === 'in'))
    const out = o.events.find((e) => e.direction === 'out')!
    expect(out.data).toBe(`{"auth":"${MASK}"}`)
    expect(JSON.stringify(o.events.filter((e) => e.direction === 'out'))).not.toContain('s3cr3t')
  })
})
