// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { WebContents } from 'electron'
import log from 'electron-log/main'
import * as grpc from '@grpc/grpc-js'
import type { Type } from 'protobufjs'
import { z } from 'zod'
import { API_LIMITS } from '@shared/api/limits'
import {
  grpcLoadInputSchema,
  grpcStartInputSchema,
  type ApiErrorCode,
  type ApiGrpcEvent,
  type ApiGrpcLoadResult,
  type ApiGrpcMethodKind,
  type ApiGrpcSource,
  type ApiGrpcStartResult
} from '@shared/api/protocol'
import { IpcChannels } from '@shared/ipc'
import { ApiFail, toApiErrorCode } from './errors'
import { describeServices, loadProtoFiles, loadReflection, ProtoInvalid, ReflectionFail, type GrpcDefinition } from './grpcProto'
import { buildResolver, type Resolver } from './resolve'
import { isHostTrusted, trustHost } from './trust'

/**
 * Chamadas gRPC do Cliente de API (fase 5). Toda a rede fica aqui no Main. Só o dono (a janela que abriu a
 * chamada) envia, finaliza ou cancela; tudo é cancelado quando ela fecha ou recarrega. Segredos resolvidos
 * nunca voltam ao Renderer: metadados e mensagens enviadas aparecem mascarados.
 */

interface Call {
  owner: WebContents
  kind: ApiGrpcMethodKind
  stream: grpc.ClientWritableStream<unknown> | grpc.ClientDuplexStream<unknown, unknown> | null
  cancel: () => void
  client: grpc.Client
  resolver: Resolver
  host: string
  requestType: Type
  done: boolean
}

const calls = new Map<string, Call>()
const watched = new WeakSet<WebContents>()

const countOf = (owner: WebContents): number => [...calls.values()].filter((c) => c.owner === owner).length

function emit(owner: WebContents, event: Omit<ApiGrpcEvent, 'at'>): void {
  if (owner.isDestroyed()) return
  owner.send(IpcChannels.apiGrpcEvent, { ...event, at: new Date().toISOString() } satisfies ApiGrpcEvent)
}

function release(id: string): void {
  const c = calls.get(id)
  if (!c) return
  calls.delete(id)
  c.done = true
  try {
    c.client.close()
  } catch {
    /* já fechado */
  }
}

/** Cancela todas as chamadas da janela (ao fechar ou recarregar). */
export function closeOwned(owner: WebContents): void {
  for (const [id, c] of calls) {
    if (c.owner !== owner) continue
    try {
      c.cancel()
    } catch {
      /* já terminou */
    }
    release(id)
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

/** Texto para exibir, cortado em grpcMessageBytes. */
function clip(text: string): { data: string; truncated?: true } {
  if (Buffer.byteLength(text) <= API_LIMITS.grpcMessageBytes) return { data: text }
  return { data: Buffer.from(text).subarray(0, API_LIMITS.grpcMessageBytes).toString('utf8'), truncated: true }
}

const pretty = (text: string): string => {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

/** Código da lista de erros a partir do texto que o grpc-js põe nos detalhes de UNAVAILABLE. */
export function networkCodeOf(details: string): ApiErrorCode {
  const net = /\b(ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN)\b/.exec(details)
  if (net) return toApiErrorCode({ code: net[1] })
  if (/self[- ]signed certificate in certificate chain/i.test(details)) return 'SELF_SIGNED_CERT_IN_CHAIN'
  if (/self[- ]signed/i.test(details)) return 'DEPTH_ZERO_SELF_SIGNED_CERT'
  if (/certificate has expired/i.test(details)) return 'CERT_HAS_EXPIRED'
  if (/unable to verify|unable to get (local )?issuer/i.test(details)) return 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
  if (/does not match certificate|altnames|Hostname\/IP/i.test(details)) return 'ERR_TLS_CERT_ALTNAME_INVALID'
  if (/protocol version|wrong version number/i.test(details)) return 'tlsVersion'
  return 'unknown'
}

/* ------------------------------------------------------------------ alvo, credenciais e metadados */

interface Target {
  resolver: Resolver
  address: string
  host: string
  client: grpc.Client
  metadata: grpc.Metadata
}

type Common = z.infer<typeof grpcLoadInputSchema>

const ADDRESS_RE = /^(\[[0-9a-f:.]+\]|[a-z0-9._-]+)(:\d{1,5})?$/i

function credentials(tls: boolean, verify: boolean): grpc.ChannelCredentials {
  if (!tls) return grpc.credentials.createInsecure()
  if (verify) return grpc.credentials.createSsl()
  return grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: false, checkServerIdentity: () => undefined })
}

function buildMetadata(input: Common, resolver: Resolver): grpc.Metadata {
  const md = new grpc.Metadata()
  for (const h of input.metadata) {
    if (!h.enabled) continue
    const key = resolver.resolve(h.key).trim().toLowerCase()
    if (key === '') continue
    const value = resolver.resolve(h.value)
    // Chaves terminadas em -bin levam bytes: o valor vem em base64.
    md.add(key, key.endsWith('-bin') ? Buffer.from(value, 'base64') : value)
  }
  return md
}

/** Resolve variáveis, confere o host dos segredos e abre o canal. Devolve o código do problema, se houver. */
async function openTarget(input: Common): Promise<{ ok: true; target: Target } | { ok: false; code: ApiErrorCode; host?: string }> {
  const resolver = await buildResolver({ environment: input.environment, collection: input.collection, temporary: {} })
  const address = resolver.resolve(input.address).trim()
  if (!ADDRESS_RE.test(address)) return { ok: false, code: 'badUrl' }
  let metadata: grpc.Metadata
  try {
    metadata = buildMetadata(input, resolver)
  } catch {
    return { ok: false, code: 'invalidRequest' }
  }
  const host = address.toLowerCase()
  if (resolver.secretScopes.size > 0 && !(await isHostTrusted(resolver.secretScopes, host))) {
    if (input.confirmSecretHost?.trim().toLowerCase() !== host) return { ok: false, code: 'secretHostNotConfirmed', host }
    await trustHost(resolver.secretScopes, host)
  }
  const client = new grpc.Client(address, credentials(input.tls, input.verifyTls), {
    'grpc.max_receive_message_length': API_LIMITS.grpcMessageBytes,
    'grpc.max_send_message_length': API_LIMITS.grpcMessageBytes
  })
  return { ok: true, target: { resolver, address, host, client, metadata } }
}

async function loadDefinition(source: ApiGrpcSource, target: Target | null): Promise<GrpcDefinition> {
  if (source.type === 'proto') return loadProtoFiles(source)
  if (!target) throw new ReflectionFail('other')
  return loadReflection(target.client, target.metadata)
}

type LoadFailure = { ok: false; code: ApiErrorCode | 'protoInvalid' | 'reflectionUnavailable'; host?: string }

function failureOf(err: unknown): LoadFailure {
  if (err instanceof ProtoInvalid) return { ok: false, code: 'protoInvalid' }
  if (err instanceof ApiFail) return { ok: false, code: err.code }
  if (err instanceof ReflectionFail) {
    if (err.kind === 'unimplemented') return { ok: false, code: 'reflectionUnavailable' }
    if (err.kind === 'network') return { ok: false, code: err.details.includes('Deadline') ? 'timeout' : networkCodeOf(err.details) }
  }
  return { ok: false, code: toApiErrorCode(err) }
}

/* ------------------------------------------------------------------ carregar serviços */

export async function loadGrpc(owner: WebContents, raw: unknown): Promise<ApiGrpcLoadResult> {
  const parsed = grpcLoadInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, code: 'invalidRequest' }
  const input = parsed.data
  watchOwner(owner)
  let target: Target | null = null
  try {
    if (input.source.type === 'reflection') {
      const opened = await openTarget(input)
      if (!opened.ok) return opened
      target = opened.target
      log.info(`gRPC ${target.host} reflexão`)
    }
    const { root } = await loadDefinition(input.source, target)
    return { ok: true, services: describeServices(root) }
  } catch (err) {
    const failure = failureOf(err)
    log.info(`gRPC ${target?.host ?? 'proto'} carga falhou ${failure.code}`)
    return failure
  } finally {
    target?.client.close()
  }
}

/* ------------------------------------------------------------------ chamadas */

/** Texto da mensagem para objeto: variáveis resolvidas, JSON de objeto e aceito pelo tipo do proto. */
function toMessage(resolver: Resolver, type: Type, text: string): { obj: object; shown: string } | null {
  const resolved = resolver.resolve(text.trim() === '' ? '{}' : text)
  try {
    const obj: unknown = JSON.parse(resolved)
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null
    type.fromObject(obj as Record<string, unknown>)
    return { obj, shown: pretty(resolver.mask(resolved)) }
  } catch {
    return null
  }
}

const metadataJson = (md: grpc.Metadata, resolver: Resolver): string => {
  const out: Record<string, string | string[]> = {}
  for (const [k, values] of Object.entries(md.getMap())) out[k] = typeof values === 'string' ? values : values.toString('base64')
  // getMap só guarda o último valor de cada chave; repetidas vêm de get().
  for (const k of Object.keys(out)) {
    const all = md.get(k)
    if (all.length > 1) out[k] = all.map((v) => (typeof v === 'string' ? v : v.toString('base64')))
  }
  return resolver.mask(JSON.stringify(out, null, 2))
}

export async function startGrpc(owner: WebContents, raw: unknown): Promise<ApiGrpcStartResult> {
  const parsed = grpcStartInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, code: 'invalidRequest' }
  const input = parsed.data
  if (calls.has(input.callId)) return { ok: false, code: 'invalidRequest' }
  if (countOf(owner) >= API_LIMITS.grpcCalls) return { ok: false, code: 'tooManyCalls' }
  watchOwner(owner)

  const opened = await openTarget(input)
  if (!opened.ok) return opened
  const { target } = opened
  let registered = false
  try {
    const { root, def } = await loadDefinition(input.source, input.source.type === 'reflection' ? target : null)
    const service = root.lookupService(input.service.replace(/^\./, ''))
    const entry = (def[input.service.replace(/^\./, '')] ?? {}) as Record<string, grpc.MethodDefinition<unknown, unknown>>
    const methodProto = service.methods[input.method]
    const method = Object.values(entry).find((m) => m.originalName === input.method) ?? entry[input.method]
    if (!methodProto || !method) return { ok: false, code: 'methodNotFound' }
    const requestType = methodProto.resolvedRequestType as Type
    const kind: ApiGrpcMethodKind = methodProto.requestStream ? (methodProto.responseStream ? 'bidi' : 'client') : methodProto.responseStream ? 'server' : 'unary'

    const { resolver, host } = target
    const first = kind === 'unary' || kind === 'server' || input.message.trim() !== '' ? toMessage(resolver, requestType, input.message) : null
    if ((kind === 'unary' || kind === 'server' || input.message.trim() !== '') && !first) return { ok: false, code: 'messageInvalid' }
    // A mensagem pode ter trazido segredo novo: o host precisa estar confirmado também.
    if (resolver.secretScopes.size > 0 && !(await isHostTrusted(resolver.secretScopes, host))) {
      if (input.confirmSecretHost?.trim().toLowerCase() !== host) return { ok: false, code: 'secretHostNotConfirmed', host }
      await trustHost(resolver.secretScopes, host)
    }
    // Rechecagem: outra chamada pode ter ocupado o id ou a cota durante os awaits.
    if (calls.has(input.callId) || countOf(owner) >= API_LIMITS.grpcCalls) return { ok: false, code: 'tooManyCalls' }
    if (owner.isDestroyed()) return { ok: false, code: 'unknown' }

    const options: grpc.CallOptions = input.deadlineMs > 0 ? { deadline: Date.now() + input.deadlineMs } : {}
    const callId = input.callId
    const call: Call = { owner, kind, stream: null, cancel: () => undefined, client: target.client, resolver, host, requestType, done: false }
    calls.set(callId, call)
    registered = true

    const status = (code: number, details: string): void => {
      if (call.done) return
      emit(owner, { callId, type: 'status', direction: 'in', data: '', code, codeName: grpc.status[code] ?? 'UNKNOWN', details: resolver.mask(details) })
      log.info(`gRPC ${host} ${input.service}/${input.method} status ${code}`)
      release(callId)
    }
    const incoming = (value: unknown): void => {
      const text = pretty(resolver.mask(JSON.stringify(value)))
      emit(owner, { callId, type: 'message', direction: 'in', ...clip(text) })
    }
    const outgoing = (shown: string): void => emit(owner, { callId, type: 'message', direction: 'out', ...clip(shown) })
    const onMetadata = (md: grpc.Metadata): void => emit(owner, { callId, type: 'metadata', direction: 'in', data: metadataJson(md, resolver) })
    const onFinalStatus = (st: grpc.StatusObject): void => {
      if (st.metadata && Object.keys(st.metadata.getMap()).length > 0) emit(owner, { callId, type: 'metadata', direction: 'in', data: metadataJson(st.metadata, resolver), details: 'trailers' })
      status(st.code, st.details)
    }
    const callback = (err: grpc.ServiceError | null, value?: unknown): void => {
      if (err) return status(err.code, err.details ?? '')
      incoming(value)
      status(grpc.status.OK, '')
    }
    log.info(`gRPC ${host} ${input.service}/${input.method} iniciado`)

    const ser = method.requestSerialize
    const de = method.responseDeserialize
    if (kind === 'unary') {
      const c = target.client.makeUnaryRequest(method.path, ser, de, first!.obj, target.metadata, options, callback)
      c.on('metadata', onMetadata)
      call.cancel = () => c.cancel()
      outgoing(first!.shown)
    } else if (kind === 'server') {
      const c = target.client.makeServerStreamRequest(method.path, ser, de, first!.obj, target.metadata, options)
      c.on('metadata', onMetadata)
      c.on('data', incoming)
      c.on('error', () => undefined) // o status chega em 'status'
      c.on('status', onFinalStatus)
      call.cancel = () => c.cancel()
      outgoing(first!.shown)
    } else if (kind === 'client') {
      const c = target.client.makeClientStreamRequest(method.path, ser, de, target.metadata, options, callback)
      c.on('metadata', onMetadata)
      call.stream = c
      call.cancel = () => c.cancel()
      if (first) {
        c.write(first.obj)
        outgoing(first.shown)
      }
    } else {
      const c = target.client.makeBidiStreamRequest(method.path, ser, de, target.metadata, options)
      c.on('metadata', onMetadata)
      c.on('data', incoming)
      c.on('error', () => undefined)
      c.on('status', onFinalStatus)
      call.stream = c
      call.cancel = () => c.cancel()
      if (first) {
        c.write(first.obj)
        outgoing(first.shown)
      }
    }
    return { ok: true }
  } catch (err) {
    if (err instanceof ProtoInvalid || err instanceof ApiFail || err instanceof ReflectionFail) return failureOf(err)
    // lookupService lança quando o serviço não existe.
    if (err instanceof Error && /no such (service|type)/i.test(err.message)) return { ok: false, code: 'methodNotFound' }
    return failureOf(err)
  } finally {
    // Só mantém o canal aberto quando a chamada foi registrada (ela o fecha ao terminar).
    if (!registered) target.client.close()
  }
}

const idSchema = z.string().uuid()
const messageSchema = z.string().max(API_LIMITS.bodyChars)

function ownedCall(owner: WebContents, rawId: unknown): { id: string; call: Call } | null {
  const id = idSchema.parse(rawId)
  const call = calls.get(id)
  // Só o dono mexe na chamada.
  return call && call.owner === owner && !call.done ? { id, call } : null
}

export async function sendGrpc(owner: WebContents, rawId: unknown, rawMessage: unknown): Promise<void> {
  const text = messageSchema.parse(rawMessage)
  const found = ownedCall(owner, rawId)
  if (!found) return
  const { id, call } = found
  if (!call.stream) return emit(owner, { callId: id, type: 'error', direction: 'out', data: 'invalidRequest' })
  const before = call.resolver.secretScopes.size
  const msg = toMessage(call.resolver, call.requestType, text)
  if (!msg) return emit(owner, { callId: id, type: 'error', direction: 'out', data: 'messageInvalid' })
  // Segredo novo na mensagem precisa de host confirmado também.
  if (call.resolver.secretScopes.size > before && !(await isHostTrusted(call.resolver.secretScopes, call.host))) {
    return emit(owner, { callId: id, type: 'error', direction: 'out', data: 'secretHostNotConfirmed' })
  }
  if (call.done) return
  call.stream.write(msg.obj, (err?: Error | null) => {
    if (err) emit(owner, { callId: id, type: 'error', direction: 'out', data: toApiErrorCode(err) })
  })
  emit(owner, { callId: id, type: 'message', direction: 'out', ...clip(msg.shown) })
}

export function endGrpc(owner: WebContents, rawId: unknown): void {
  const found = ownedCall(owner, rawId)
  if (found?.call.stream) found.call.stream.end()
}

export function cancelGrpc(owner: WebContents, rawId: unknown): void {
  const found = ownedCall(owner, rawId)
  found?.call.cancel()
}
