// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { Root } from 'protobufjs'
import * as descriptorNs from 'protobufjs/ext/descriptor'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({ app: { getPath: () => h.dir } }))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))
vi.mock('./vault', () => ({
  secretVault: { get: async (scope: string, name: string) => (scope === 'env1' && name === 'token' ? 's3cr3t-valor' : undefined), names: async () => [] }
}))

import { API_LIMITS } from '@shared/api/limits'
import { MASK, type ApiGrpcEvent, type ApiGrpcStartInput } from '@shared/api/protocol'
import { authorizeRoot } from '../ipc/access'
import { cancelGrpc, closeOwned, endGrpc, loadGrpc, networkCodeOf, sendGrpc, startGrpc } from './grpc'
import { reflectionDefinition, type ReflectionVersion } from './grpcProto'

const PROTO = `
syntax = "proto3";
package teste.exemplo;
enum Nivel { BAIXO = 0; ALTO = 1; }
message Pedido { string texto = 1; int64 numero = 2; Nivel nivel = 3; repeated string itens = 4; }
message Resposta { string texto = 1; int64 contagem = 2; Nivel nivel = 3; repeated string itens = 4; }
service Eco {
  rpc Unario(Pedido) returns (Resposta);
  rpc Servidor(Pedido) returns (stream Resposta);
  rpc Cliente(stream Pedido) returns (Resposta);
  rpc Bidi(stream Pedido) returns (stream Resposta);
  rpc Falha(Pedido) returns (Resposta);
  rpc Lento(Pedido) returns (Resposta);
  rpc Cabecalhos(Pedido) returns (Resposta);
}
`

class FakeOwner extends EventEmitter {
  events: ApiGrpcEvent[] = []
  destroyed = false
  send(_channel: string, event: ApiGrpcEvent): void {
    this.events.push(event)
  }
  isDestroyed(): boolean {
    return this.destroyed
  }
}
const asOwner = (o: FakeOwner) => o as unknown as Electron.WebContents
const wait = async (cond: () => boolean, ms = 4000): Promise<void> => {
  const end = Date.now() + ms
  while (!cond()) {
    if (Date.now() > end) throw new Error('tempo esgotado')
    await new Promise((r) => setTimeout(r, 10))
  }
}

let server: grpc.Server
let address = ''
let protoPath = ''
let noReflectionAddress = ''
let noReflectionServer: grpc.Server
let slowCancelled = false
let slowSeen = 0

const loaderOpts: protoLoader.Options = { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }

async function bind(srv: grpc.Server): Promise<string> {
  const port = await new Promise<number>((res, rej) => srv.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (e, p) => (e ? rej(e) : res(p))))
  return `127.0.0.1:${port}`
}

function addEco(srv: grpc.Server): void {
  const def = protoLoader.loadSync(protoPath, loaderOpts)
  const svc = def['teste.exemplo.Eco'] as grpc.ServiceDefinition
  srv.addService(svc, {
    Unario: (call: grpc.ServerUnaryCall<{ texto: string; numero: string }, unknown>, cb: grpc.sendUnaryData<unknown>) =>
      cb(null, { texto: `eco ${call.request.texto}`, contagem: call.request.numero, nivel: 'ALTO', itens: ['a'] }),
    Servidor: (call: grpc.ServerWritableStream<{ texto: string }, unknown>) => {
      for (let i = 1; i <= 3; i++) call.write({ texto: `${call.request.texto} ${i}`, contagem: String(i) })
      call.end()
    },
    Cliente: (call: grpc.ServerReadableStream<{ texto: string }, unknown>, cb: grpc.sendUnaryData<unknown>) => {
      const parts: string[] = []
      call.on('data', (m: { texto: string }) => parts.push(m.texto))
      call.on('end', () => cb(null, { texto: parts.join(','), contagem: String(parts.length) }))
    },
    Bidi: (call: grpc.ServerDuplexStream<{ texto: string }, unknown>) => {
      call.on('data', (m: { texto: string }) => call.write({ texto: `volta ${m.texto}` }))
      call.on('end', () => call.end())
    },
    Falha: (_call: unknown, cb: grpc.sendUnaryData<unknown>) => cb({ code: grpc.status.NOT_FOUND, details: 'não achei' }),
    Lento: (call: grpc.ServerUnaryCall<unknown, unknown>) => {
      slowSeen++
      call.on('cancelled', () => (slowCancelled = true))
    },
    Cabecalhos: (call: grpc.ServerUnaryCall<unknown, unknown>, cb: grpc.sendUnaryData<unknown>) => {
      const md = new grpc.Metadata()
      md.set('x-servidor', 'ola')
      call.sendMetadata(md)
      cb(null, { texto: String(call.metadata.get('x-token')[0] ?? '') })
    }
  })
}

/** Serviço de reflexão feito à mão, com os descritores do .proto de teste. */
function addReflection(srv: grpc.Server, version: ReflectionVersion): void {
  const root = new Root()
  root.loadSync(protoPath, { keepCase: true })
  const ext = ((descriptorNs as unknown as { default?: typeof descriptorNs }).default ?? descriptorNs) as typeof descriptorNs
  const set = (root as unknown as { toDescriptor(s: string): { file: object[] } }).toDescriptor('proto3')
  const bufs = set.file.map((f) => Buffer.from(ext.FileDescriptorProto.encode(ext.FileDescriptorProto.fromObject(f as Record<string, unknown>)).finish()))
  const svc = reflectionDefinition(version)[`grpc.reflection.${version}.ServerReflection`] as grpc.ServiceDefinition
  srv.addService(svc, {
    ServerReflectionInfo: (call: grpc.ServerDuplexStream<Record<string, string>, unknown>) => {
      call.on('data', (req: Record<string, string>) => {
        if (req.message_request === 'list_services') call.write({ original_request: req, list_services_response: { service: [{ name: 'teste.exemplo.Eco' }, { name: `grpc.reflection.${version}.ServerReflection` }] } })
        else if (req.message_request === 'file_containing_symbol' || req.message_request === 'file_by_filename')
          call.write({ original_request: req, file_descriptor_response: { file_descriptor_proto: bufs } })
        else call.write({ original_request: req, error_response: { error_code: 12, error_message: 'não suportado' } })
      })
      call.on('end', () => call.end())
    }
  })
}

beforeAll(async () => {
  h.dir = mkdtempSync(join(tmpdir(), 'apigrpc-'))
  mkdirSync(join(h.dir, 'protos'))
  protoPath = join(h.dir, 'protos', 'eco.proto')
  writeFileSync(protoPath, PROTO)
  authorizeRoot(h.dir)
  server = new grpc.Server()
  addEco(server)
  addReflection(server, 'v1alpha')
  address = await bind(server)
  noReflectionServer = new grpc.Server()
  addEco(noReflectionServer)
  noReflectionAddress = await bind(noReflectionServer)
})
afterAll(() => {
  server.forceShutdown()
  noReflectionServer.forceShutdown()
})

const protoSource = () => ({ type: 'proto' as const, files: [protoPath], importPaths: [] as string[] })

function start(owner: FakeOwner, over: Partial<ApiGrpcStartInput> & { method: string }): { callId: string; result: ReturnType<typeof startGrpc> } {
  const callId = randomUUID()
  const input: ApiGrpcStartInput = { callId, source: protoSource(), address, service: 'teste.exemplo.Eco', message: '{}', ...over }
  return { callId, result: startGrpc(asOwner(owner), input) }
}
const statusOf = (o: FakeOwner, id: string) => o.events.find((e) => e.callId === id && e.type === 'status')
const hasStatus = (o: FakeOwner, id: string) => () => !!statusOf(o, id)

describe('gRPC: carregar serviços', () => {
  it('lê o .proto e gera os tipos de chamada e a mensagem modelo', async () => {
    const r = await loadGrpc(asOwner(new FakeOwner()), { source: protoSource(), address })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.services.map((s) => s.name)).toEqual(['teste.exemplo.Eco'])
    const kinds = Object.fromEntries(r.services[0].methods.map((m) => [m.name, m.kind]))
    expect(kinds).toMatchObject({ Unario: 'unary', Servidor: 'server', Cliente: 'client', Bidi: 'bidi' })
    const unario = r.services[0].methods.find((m) => m.name === 'Unario')!
    expect(unario.requestType).toBe('teste.exemplo.Pedido')
    expect(JSON.parse(unario.template)).toEqual({ texto: '', numero: '0', nivel: 'BAIXO', itens: [] })
  })

  it('recusa .proto fora das pastas autorizadas e .proto inválido', async () => {
    const owner = new FakeOwner()
    const fora = join(mkdtempSync(join(tmpdir(), 'apigrpc-fora-')), 'x.proto')
    writeFileSync(fora, PROTO)
    const r1 = await loadGrpc(asOwner(owner), { source: { type: 'proto', files: [fora] }, address })
    expect(r1).toMatchObject({ ok: false })
    const ruim = join(h.dir, 'protos', 'ruim.proto')
    writeFileSync(ruim, 'syntax = "proto3"; message {')
    expect(await loadGrpc(asOwner(owner), { source: { type: 'proto', files: [ruim] }, address })).toEqual({ ok: false, code: 'protoInvalid' })
  })

  it('recusa .proto maior que o limite', async () => {
    const grande = join(h.dir, 'protos', 'grande.proto')
    writeFileSync(grande, `syntax = "proto3";\n// ${'x'.repeat(API_LIMITS.protoFileBytes)}\n`)
    expect(await loadGrpc(asOwner(new FakeOwner()), { source: { type: 'proto', files: [grande] }, address })).toEqual({ ok: false, code: 'tooLarge' })
  })

  it('resolve import pela pasta do arquivo, e recusa import fora das pastas', async () => {
    const dir = join(h.dir, 'imp')
    mkdirSync(dir)
    writeFileSync(join(dir, 'comum.proto'), 'syntax = "proto3"; package c; message Id { string v = 1; }')
    writeFileSync(join(dir, 'a.proto'), 'syntax = "proto3"; package a; import "comum.proto"; message M { c.Id id = 1; } service S { rpc F(M) returns (M); }')
    const r = await loadGrpc(asOwner(new FakeOwner()), { source: { type: 'proto', files: [join(dir, 'a.proto')] }, address })
    expect(r.ok && JSON.parse(r.services[0].methods[0].template)).toEqual({ id: { v: '' } })
    writeFileSync(join(dir, 'b.proto'), 'syntax = "proto3"; package b; import "../../../fora.proto"; message M {}')
    const r2 = await loadGrpc(asOwner(new FakeOwner()), { source: { type: 'proto', files: [join(dir, 'b.proto')] }, address })
    expect(r2.ok).toBe(false)
  })

  it('carrega os serviços pela reflexão', async () => {
    const r = await loadGrpc(asOwner(new FakeOwner()), { source: { type: 'reflection' }, address })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.services.map((s) => s.name)).toEqual(['teste.exemplo.Eco'])
    expect(r.services[0].methods.map((m) => m.name).sort()).toEqual(['Bidi', 'Cabecalhos', 'Cliente', 'Falha', 'Lento', 'Servidor', 'Unario'])
  })

  it('servidor sem reflexão devolve reflectionUnavailable', async () => {
    const r = await loadGrpc(asOwner(new FakeOwner()), { source: { type: 'reflection' }, address: noReflectionAddress })
    expect(r).toEqual({ ok: false, code: 'reflectionUnavailable' })
  })

  it('porta fechada vira ECONNREFUSED', async () => {
    const r = await loadGrpc(asOwner(new FakeOwner()), { source: { type: 'reflection' }, address: '127.0.0.1:1' })
    expect(r).toEqual({ ok: false, code: 'ECONNREFUSED' })
  })

  it('endereço inválido vira badUrl', async () => {
    expect(await loadGrpc(asOwner(new FakeOwner()), { source: { type: 'reflection' }, address: 'http://x/y' })).toEqual({ ok: false, code: 'badUrl' })
  })

  it('classifica os detalhes de erro de rede e de TLS', () => {
    expect(networkCodeOf('No connection established. Last error: connect ECONNREFUSED 127.0.0.1:1')).toBe('ECONNREFUSED')
    expect(networkCodeOf('self-signed certificate')).toBe('DEPTH_ZERO_SELF_SIGNED_CERT')
    expect(networkCodeOf('qualquer coisa')).toBe('unknown')
  })
})

describe('gRPC: chamadas', () => {
  it('unário: mensagem de saída, resposta e status OK', async () => {
    const o = new FakeOwner()
    const { callId, result } = start(o, { method: 'Unario', message: '{"texto":"oi","numero":"7"}' })
    expect(await result).toEqual({ ok: true })
    await wait(hasStatus(o, callId))
    const msgs = o.events.filter((e) => e.type === 'message')
    expect(msgs.map((m) => m.direction)).toEqual(['out', 'in'])
    expect(JSON.parse(msgs[1].data)).toEqual({ texto: 'eco oi', contagem: '7', nivel: 'ALTO', itens: ['a'] })
    expect(statusOf(o, callId)).toMatchObject({ code: 0, codeName: 'OK' })
  })

  it('streaming do servidor recebe várias mensagens e depois o status', async () => {
    const o = new FakeOwner()
    const { callId, result } = start(o, { method: 'Servidor', message: '{"texto":"n"}' })
    await result
    await wait(hasStatus(o, callId))
    const textos = o.events.filter((e) => e.type === 'message' && e.direction === 'in').map((e) => JSON.parse(e.data).texto)
    expect(textos).toEqual(['n 1', 'n 2', 'n 3'])
    expect(statusOf(o, callId)?.code).toBe(0)
  })

  it('streaming do cliente: envia, finaliza e recebe a resposta', async () => {
    const o = new FakeOwner()
    const { callId, result } = start(o, { method: 'Cliente', message: '' })
    expect(await result).toEqual({ ok: true })
    await sendGrpc(asOwner(o), callId, '{"texto":"a"}')
    await sendGrpc(asOwner(o), callId, '{"texto":"b"}')
    endGrpc(asOwner(o), callId)
    await wait(hasStatus(o, callId))
    const resp = o.events.find((e) => e.type === 'message' && e.direction === 'in')
    expect(JSON.parse(resp!.data)).toMatchObject({ texto: 'a,b', contagem: '2' })
  })

  it('bidirecional: mensagens vão e voltam até o fim do envio', async () => {
    const o = new FakeOwner()
    const { callId, result } = start(o, { method: 'Bidi', message: '{"texto":"1"}' })
    await result
    await sendGrpc(asOwner(o), callId, '{"texto":"2"}')
    await wait(() => o.events.filter((e) => e.type === 'message' && e.direction === 'in').length === 2)
    endGrpc(asOwner(o), callId)
    await wait(hasStatus(o, callId))
    expect(o.events.filter((e) => e.direction === 'in' && e.type === 'message').map((e) => JSON.parse(e.data).texto)).toEqual(['volta 1', 'volta 2'])
  })

  it('status de erro do servidor chega com código e detalhe', async () => {
    const o = new FakeOwner()
    const { callId, result } = start(o, { method: 'Falha' })
    await result
    await wait(hasStatus(o, callId))
    expect(statusOf(o, callId)).toMatchObject({ code: 5, codeName: 'NOT_FOUND', details: 'não achei' })
  })

  it('deadline vence e a chamada termina com DEADLINE_EXCEEDED', async () => {
    const o = new FakeOwner()
    const { callId, result } = start(o, { method: 'Lento', deadlineMs: 150 })
    await result
    await wait(hasStatus(o, callId))
    expect(statusOf(o, callId)).toMatchObject({ code: 4, codeName: 'DEADLINE_EXCEEDED' })
  })

  it('cancelar termina com CANCELLED e só o dono cancela', async () => {
    const o = new FakeOwner()
    const { callId, result } = start(o, { method: 'Lento' })
    await result
    cancelGrpc(asOwner(new FakeOwner()), callId)
    await new Promise((r) => setTimeout(r, 100))
    expect(statusOf(o, callId)).toBeUndefined()
    cancelGrpc(asOwner(o), callId)
    await wait(hasStatus(o, callId))
    expect(statusOf(o, callId)?.codeName).toBe('CANCELLED')
    await wait(() => slowCancelled)
  })

  it('metadados: envia com variável e segredo mascarado, e recebe os do servidor', async () => {
    const o = new FakeOwner()
    const env = { id: 'env1', name: 'dev', production: false, variables: [{ key: 'token', secret: true }] }
    const callId = randomUUID()
    const first = await startGrpc(asOwner(o), {
      callId,
      source: protoSource(),
      address,
      service: 'teste.exemplo.Eco',
      method: 'Cabecalhos',
      message: '{"texto":"{{token}}"}',
      metadata: [{ key: 'x-token', value: '{{token}}', enabled: true }],
      environment: env
    } as ApiGrpcStartInput)
    // Segredo só vai para um host confirmado.
    expect(first).toEqual({ ok: false, code: 'secretHostNotConfirmed', host: address.toLowerCase() })
    const second = await startGrpc(asOwner(o), {
      callId,
      source: protoSource(),
      address,
      service: 'teste.exemplo.Eco',
      method: 'Cabecalhos',
      message: '{"texto":"{{token}}"}',
      metadata: [{ key: 'x-token', value: '{{token}}', enabled: true }],
      environment: env,
      confirmSecretHost: address
    } as ApiGrpcStartInput)
    expect(second).toEqual({ ok: true })
    await wait(hasStatus(o, callId))
    const md = o.events.find((e) => e.type === 'metadata')
    expect(JSON.parse(md!.data)['x-servidor']).toBe('ola')
    const out = o.events.find((e) => e.type === 'message' && e.direction === 'out')!
    expect(out.data).toContain(MASK)
    expect(out.data).not.toContain('s3cr3t-valor')
    // O servidor recebeu o valor real e devolveu: a resposta mostra o segredo mascarado, nunca em claro.
    const inn = o.events.find((e) => e.type === 'message' && e.direction === 'in')!
    expect(JSON.parse(inn.data).texto).toBe(MASK)
    expect(JSON.stringify(o.events)).not.toContain('s3cr3t-valor')
  })

  it('método inexistente e mensagem inválida', async () => {
    const o = new FakeOwner()
    expect(await start(o, { method: 'Nada' }).result).toEqual({ ok: false, code: 'methodNotFound' })
    expect(await start(o, { service: 'x.Y', method: 'Unario' }).result).toEqual({ ok: false, code: 'methodNotFound' })
    expect(await start(o, { method: 'Unario', message: '{nao é json' }).result).toEqual({ ok: false, code: 'messageInvalid' })
    expect(await start(o, { method: 'Unario', message: '[1]' }).result).toEqual({ ok: false, code: 'messageInvalid' })
  })

  it('limita as chamadas abertas por janela', async () => {
    const o = new FakeOwner()
    const ids: string[] = []
    for (let i = 0; i < API_LIMITS.grpcCalls; i++) {
      const s = start(o, { method: 'Lento' })
      expect(await s.result).toEqual({ ok: true })
      ids.push(s.callId)
    }
    expect(await start(o, { method: 'Lento' }).result).toEqual({ ok: false, code: 'tooManyCalls' })
    closeOwned(asOwner(o))
    expect(await start(o, { method: 'Unario' }).result).toEqual({ ok: true })
  })

  it('fechar a janela cancela as chamadas abertas', async () => {
    const o = new FakeOwner()
    slowCancelled = false
    const seen = slowSeen
    const s = start(o, { method: 'Lento' })
    await s.result
    await wait(() => slowSeen > seen)
    o.destroyed = true
    o.emit('destroyed')
    closeOwned(asOwner(o))
    await wait(() => slowCancelled)
    // Depois de cancelada, a chamada não existe mais: enviar não faz nada.
    await sendGrpc(asOwner(o), s.callId, '{}')
  })

  it('usa a reflexão para chamar um método', async () => {
    const o = new FakeOwner()
    const { callId, result } = start(o, { method: 'Unario', source: { type: 'reflection' }, message: '{"texto":"r"}' })
    expect(await result).toEqual({ ok: true })
    await wait(hasStatus(o, callId))
    expect(JSON.parse(o.events.find((e) => e.type === 'message' && e.direction === 'in')!.data).texto).toBe('eco r')
  })
})
