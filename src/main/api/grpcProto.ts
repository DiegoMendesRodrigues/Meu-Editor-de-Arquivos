// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { existsSync } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { Enum, Namespace, Root, Service, Type, parse, type Field } from 'protobufjs'
import * as descriptorNs from 'protobufjs/ext/descriptor'
import { API_LIMITS } from '@shared/api/limits'
import type { ApiGrpcMethod, ApiGrpcService, ApiGrpcSource } from '@shared/api/protocol'
import { assertAuthorized, isAuthorized, isInside } from '../ipc/access'
import { ApiFail } from './errors'

/**
 * Definições gRPC: lê .proto (só arquivos autorizados) ou pergunta ao servidor pela reflexão, e devolve o
 * Root do protobufjs (tipos e serviços) com a definição do proto-loader para chamar os métodos.
 */

/** Opções iguais às do contrato: nomes dos campos como no .proto, int64 e enums como texto, bytes em base64. */
export const LOADER_OPTIONS: protoLoader.Options = { keepCase: true, longs: String, enums: String, bytes: String, defaults: true, oneofs: true }

export interface GrpcDefinition {
  root: Root
  def: protoLoader.PackageDefinition
}

export class ProtoInvalid extends Error {}
/** O arquivo não está autorizado neste computador (outro computador, pasta não aberta): o usuário escolhe de novo. */
export class ProtoNotAuthorized extends Error {}

/**
 * Caminho absoluto de um item de files/importPaths. Relativos valem contra a pasta do .apigrpc (`baseDir`) e
 * não podem sair dela com "..". Absolutos continuam como estão (documento ainda não salvo ou arquivo fora da pasta).
 */
export function resolveProtoPath(baseDir: string | undefined, path: string): string {
  if (isAbsolute(path)) return resolve(path)
  if (!baseDir || !isAbsolute(baseDir)) throw new ProtoInvalid()
  const abs = resolve(baseDir, path)
  if (!isInside(baseDir, abs)) throw new ProtoInvalid()
  return abs
}

async function authorizedProtoPath(baseDir: string | undefined, path: string): Promise<string> {
  const abs = resolveProtoPath(baseDir, path)
  try {
    return await assertAuthorized(abs)
  } catch {
    throw new ProtoNotAuthorized()
  }
}

function fromRoot(root: Root): GrpcDefinition {
  try {
    root.resolveAll()
    const def = protoLoader.fromJSON(root.toJSON(), LOADER_OPTIONS)
    return { root, def }
  } catch {
    throw new ProtoInvalid()
  }
}

/* ------------------------------------------------------------------ arquivos .proto */

export async function loadProtoFiles(source: Extract<ApiGrpcSource, { type: 'proto' }>): Promise<GrpcDefinition> {
  const files: string[] = []
  for (const f of source.files) files.push(await authorizedProtoPath(source.baseDir, f))
  const dirs: string[] = []
  for (const p of source.importPaths) dirs.push(await authorizedProtoPath(source.baseDir, p))
  // As pastas dos arquivos escolhidos também valem para procurar imports.
  for (const f of files) if (!dirs.includes(dirname(f))) dirs.push(dirname(f))
  const realDirs: string[] = []
  for (const d of dirs) realDirs.push(await realpath(d).catch(() => d))

  const root = new Root()
  root.resolvePath = (origin, target) => {
    if (origin === '') return resolve(target)
    const candidates = [resolve(dirname(origin), target), ...dirs.map((d) => resolve(d, target))]
    return candidates.find((c) => existsSync(c)) ?? candidates[0]
  }
  // Todo arquivo lido passa por aqui: autorizado, ou dentro de uma pasta de imports (links resolvidos), e com limite de tamanho.
  root.fetch = ((path: string, cb: (err: Error | null, content?: string) => void) => {
    void (async () => {
      const real = await realpath(path)
      const allowed = (await isAuthorized(path)) || realDirs.some((d) => isInside(d, real))
      if (!allowed) throw new ProtoNotAuthorized()
      if ((await stat(real)).size > API_LIMITS.protoFileBytes) throw new ApiFail('tooLarge')
      return readFile(real, 'utf8')
    })().then(
      (text) => cb(null, text),
      (err: unknown) => cb(err instanceof Error ? err : new Error('proto'))
    )
  }) as typeof root.fetch
  try {
    await root.load(files, { keepCase: true })
  } catch (err) {
    if (err instanceof ApiFail || err instanceof ProtoNotAuthorized) throw err
    throw new ProtoInvalid()
  }
  return fromRoot(root)
}

/* ------------------------------------------------------------------ reflexão */

const REFLECTION_PROTO = (version: string): string => `
syntax = "proto3";
package grpc.reflection.${version};
service ServerReflection {
  rpc ServerReflectionInfo(stream ServerReflectionRequest) returns (stream ServerReflectionResponse);
}
message ServerReflectionRequest {
  string host = 1;
  oneof message_request {
    string file_by_filename = 3;
    string file_containing_symbol = 4;
    ExtensionRequest file_containing_extension = 5;
    string all_extension_numbers_of_type = 6;
    string list_services = 7;
  }
}
message ExtensionRequest { string containing_type = 1; int32 extension_number = 2; }
message ServerReflectionResponse {
  string valid_host = 1;
  ServerReflectionRequest original_request = 2;
  oneof message_response {
    FileDescriptorResponse file_descriptor_response = 4;
    ExtensionNumberResponse all_extension_numbers_response = 5;
    ListServiceResponse list_services_response = 6;
    ErrorResponse error_response = 7;
  }
}
message FileDescriptorResponse { repeated bytes file_descriptor_proto = 1; }
message ExtensionNumberResponse { string base_type_name = 1; repeated int32 extension_number = 2; }
message ListServiceResponse { repeated ServiceResponse service = 1; }
message ServiceResponse { string name = 1; }
message ErrorResponse { int32 error_code = 1; string error_message = 2; }
`

export const REFLECTION_VERSIONS = ['v1alpha', 'v1'] as const
export type ReflectionVersion = (typeof REFLECTION_VERSIONS)[number]

const reflectionDefs = new Map<string, protoLoader.PackageDefinition>()
/** Definição do serviço de reflexão (também usada pelo servidor dos testes). */
export function reflectionDefinition(version: ReflectionVersion): protoLoader.PackageDefinition {
  let def = reflectionDefs.get(version)
  if (!def) {
    const root = new Root()
    parse(REFLECTION_PROTO(version), root, { keepCase: true })
    def = protoLoader.fromJSON(root.toJSON(), { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true })
    reflectionDefs.set(version, def)
  }
  return def
}

interface ReflectionResponse {
  message_response?: string
  list_services_response?: { service: { name: string }[] }
  file_descriptor_response?: { file_descriptor_proto: Uint8Array[] }
  error_response?: { error_code: number; error_message: string }
}

export class ReflectionFail extends Error {
  constructor(
    readonly kind: 'unimplemented' | 'network' | 'other',
    readonly details = ''
  ) {
    super(kind)
  }
}

interface DescriptorMessage {
  name: string
  dependency?: string[]
}
interface DescriptorType {
  decode(buf: Uint8Array): DescriptorMessage
  toObject(m: DescriptorMessage, o?: object): object
}
interface DescriptorExt {
  FileDescriptorProto: DescriptorType
}
// Módulo CJS: dependendo de quem importa, as exportações vêm em `default` ou direto no namespace.
const ext = ((descriptorNs as unknown as { default?: DescriptorExt }).default ?? descriptorNs) as unknown as DescriptorExt
const RootWithDescriptor = Root as unknown as { fromDescriptor(set: unknown): Root }

const REFLECTION_MAX_SERVICES = 200
const REFLECTION_MAX_FILES = 500
const REFLECTION_MAX_BYTES = 16 * 1024 * 1024

/** Pergunta o catálogo de serviços por uma versão da reflexão. */
async function reflectOnce(client: grpc.Client, version: ReflectionVersion, metadata: grpc.Metadata, deadline: number): Promise<Root> {
  const svcDef = reflectionDefinition(version)[`grpc.reflection.${version}.ServerReflection`] as protoLoader.ServiceDefinition
  const method = svcDef.ServerReflectionInfo
  const call = client.makeBidiStreamRequest(method.path, method.requestSerialize, method.responseDeserialize, metadata, { deadline })
  let pending: { resolve: (r: ReflectionResponse) => void; reject: (e: ReflectionFail) => void } | null = null
  let failure: ReflectionFail | null = null
  const fail = (err: { code?: number; details?: string; message?: string }): void => {
    const kind = err.code === grpc.status.UNIMPLEMENTED ? 'unimplemented' : err.code === grpc.status.UNAVAILABLE || err.code === grpc.status.DEADLINE_EXCEEDED ? 'network' : 'other'
    failure = new ReflectionFail(kind, err.details ?? err.message ?? '')
    pending?.reject(failure)
    pending = null
  }
  call.on('error', fail)
  call.on('data', (r: ReflectionResponse) => {
    pending?.resolve(r)
    pending = null
  })
  call.on('end', () => fail({ code: grpc.status.UNIMPLEMENTED }))
  const ask = (req: object): Promise<ReflectionResponse> =>
    new Promise((res, rej) => {
      if (failure) return rej(failure)
      pending = { resolve: res, reject: rej }
      call.write({ host: '', ...req })
    })

  try {
    const list = await ask({ list_services: '*' })
    if (list.message_response !== 'list_services_response') throw new ReflectionFail('other')
    // Servidor não confiável: limites de serviços, arquivos e bytes de descritores.
    const names = (list.list_services_response?.service ?? []).map((s) => s.name).filter((n) => !n.startsWith('grpc.reflection.')).slice(0, REFLECTION_MAX_SERVICES)
    const files = new Map<string, { buf: Uint8Array; deps: string[] }>()
    let totalBytes = 0
    const absorb = (r: ReflectionResponse): void => {
      if (r.message_response !== 'file_descriptor_response') return
      for (const buf of r.file_descriptor_response?.file_descriptor_proto ?? []) {
        totalBytes += buf.length
        if (files.size >= REFLECTION_MAX_FILES || totalBytes > REFLECTION_MAX_BYTES) throw new ReflectionFail('other')
        const fd = ext.FileDescriptorProto.decode(buf)
        if (!files.has(fd.name)) files.set(fd.name, { buf, deps: fd.dependency ?? [] })
      }
    }
    for (const name of names) absorb(await ask({ file_containing_symbol: name }))
    // Dependências que o servidor não mandou junto: pede pelo nome (limite para não girar sem fim).
    for (let round = 0; round < 200; round++) {
      const missing = [...files.values()].flatMap((f) => f.deps).find((d) => !files.has(d))
      if (!missing) break
      const before = files.size
      absorb(await ask({ file_by_filename: missing }))
      if (files.size === before) break
    }
    const set = { file: [...files.values()].map((f) => ext.FileDescriptorProto.decode(f.buf)) }
    return RootWithDescriptor.fromDescriptor(set)
  } finally {
    call.cancel()
  }
}

/** Serviços do servidor pela reflexão (v1alpha e depois v1). Sem reflexão: ReflectionFail('unimplemented'). */
export async function loadReflection(client: grpc.Client, metadata: grpc.Metadata): Promise<GrpcDefinition> {
  const deadline = Date.now() + 15_000
  let last: ReflectionFail = new ReflectionFail('unimplemented')
  for (const version of REFLECTION_VERSIONS) {
    try {
      return fromRoot(await reflectOnce(client, version, metadata.clone(), deadline))
    } catch (err) {
      if (err instanceof ProtoInvalid) throw err
      last = err instanceof ReflectionFail ? err : new ReflectionFail('other')
      if (last.kind !== 'unimplemented') throw last
    }
  }
  throw last
}

/* ------------------------------------------------------------------ catálogo e mensagem modelo */

const MAX_TEMPLATE_DEPTH = 4
/** Teto de campos expandidos por mensagem modelo: tipos autorreferentes com muitos campos explodiriam (n^4). */
const MAX_TEMPLATE_NODES = 2000

let templateBudget = MAX_TEMPLATE_NODES

function defaultOf(field: Field, depth: number): unknown {
  if (field.map) return {}
  if (field.repeated) return []
  const t = field.resolvedType
  if (t instanceof Enum) return Object.keys(t.values)[0] ?? 0
  if (t instanceof Type) return depth >= MAX_TEMPLATE_DEPTH || templateBudget <= 0 ? {} : templateOf(t, depth + 1)
  switch (field.type) {
    case 'string':
    case 'bytes':
      return ''
    case 'bool':
      return false
    case 'int64':
    case 'uint64':
    case 'sint64':
    case 'fixed64':
    case 'sfixed64':
      return '0'
    default:
      return 0
  }
}

/** Objeto com todos os campos nos valores padrão; de cada oneof entra só o primeiro membro. */
function templateOf(type: Type, depth = 0): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const seen = new Set<string>()
  for (const f of type.fieldsArray) {
    if (f.partOf) {
      if (seen.has(f.partOf.name)) continue
      seen.add(f.partOf.name)
    }
    if (templateBudget-- <= 0) break
    out[f.name] = defaultOf(f.resolve(), depth)
  }
  return out
}

export const messageTemplate = (type: Type): string => {
  templateBudget = MAX_TEMPLATE_NODES
  return JSON.stringify(templateOf(type), null, 2)
}

function walk(ns: Namespace, visit: (s: Service) => void): void {
  for (const n of ns.nestedArray) {
    if (n instanceof Service) visit(n)
    else if (n instanceof Namespace) walk(n, visit)
  }
}

/** Serviços e métodos do Root, com tipo da chamada e mensagem modelo. */
export function describeServices(root: Root): ApiGrpcService[] {
  const out: ApiGrpcService[] = []
  walk(root, (svc) => {
    svc.resolveAll()
    const methods: ApiGrpcMethod[] = svc.methodsArray.map((m) => ({
      name: m.name,
      kind: m.requestStream ? (m.responseStream ? 'bidi' : 'client') : m.responseStream ? 'server' : 'unary',
      requestType: m.resolvedRequestType?.fullName.replace(/^\./, '') ?? m.requestType,
      responseType: m.resolvedResponseType?.fullName.replace(/^\./, '') ?? m.responseType,
      template: m.resolvedRequestType ? messageTemplate(m.resolvedRequestType) : '{}'
    }))
    out.push({ name: svc.fullName.replace(/^\./, ''), methods })
  })
  return out.sort((a, b) => a.name.localeCompare(b.name))
}
