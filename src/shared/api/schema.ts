// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Formatos de arquivo do Cliente de API (.apireq, .apienv, .apicol, .apiresp), validados com Zod.
 *
 * Os arquivos são JSON com o campo "$schema" (nome e versão do formato). As chaves saem sempre na ordem
 * dos schemas abaixo, para gerar diffs limpos no Git. Uma versão nova do formato precisa de uma
 * migração em MIGRATIONS e de um teste.
 */
import { z } from 'zod'
import { ALLOWED_URL_SCHEMES, API_LIMITS as L } from './limits'
import { VARIABLE_NAME_RE } from './variables'

/* ------------------------------------------------------------------ peças comuns */

const idSchema = z.string().min(1).max(64)
const variableName = z.string().regex(VARIABLE_NAME_RE)

export const keyValueSchema = z.object({
  key: z.string().max(L.keyChars),
  value: z.string().max(L.valueChars).default(''),
  description: z.string().max(L.descriptionChars).optional(),
  enabled: z.boolean().default(true)
})
export type KeyValue = z.infer<typeof keyValueSchema>

const keyValuesSchema = z.array(keyValueSchema).max(L.keyValueRows).default([])

/** Método HTTP: os do seletor ou um personalizado (letras, números, "_" e "-"), sempre em maiúsculas. */
export const methodSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/)
  .transform((m) => m.toUpperCase())

/* ------------------------------------------------------------------ autorização */

export const authSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('inherit') }),
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('apiKey'),
    key: z.string().max(L.keyChars).default(''),
    value: z.string().max(L.valueChars).default(''),
    in: z.enum(['header', 'query']).default('header')
  }),
  z.object({
    type: z.literal('basic'),
    username: z.string().max(L.valueChars).default(''),
    password: z.string().max(L.valueChars).default('')
  }),
  z.object({
    type: z.literal('bearer'),
    token: z.string().max(L.valueChars).default(''),
    prefix: z.string().max(50).default('Bearer')
  }),
  z.object({
    type: z.literal('oauth1'),
    consumerKey: z.string().max(L.valueChars).default(''),
    consumerSecret: z.string().max(L.valueChars).default(''),
    token: z.string().max(L.valueChars).optional(),
    tokenSecret: z.string().max(L.valueChars).optional(),
    signature: z.enum(['HMAC-SHA1', 'HMAC-SHA256', 'RSA-SHA1', 'PLAINTEXT']).default('HMAC-SHA1'),
    realm: z.string().max(L.valueChars).optional(),
    /** RSA-SHA1: caminho da chave privada PEM (escolhida em diálogo; o Main só lê arquivos autorizados). */
    privateKeyPath: z.string().max(4096).optional(),
    placement: z.enum(['header', 'query', 'body']).default('header')
  }),
  z.object({
    type: z.literal('oauth2'),
    flow: z.enum(['authorizationCode', 'clientCredentials', 'deviceCode', 'password']).default('authorizationCode'),
    authUrl: z.string().max(L.urlChars).optional(),
    tokenUrl: z.string().max(L.urlChars).default(''),
    clientId: z.string().max(L.valueChars).default(''),
    clientSecret: z.string().max(L.valueChars).optional(),
    scopes: z.array(z.string().max(L.keyChars)).max(100).default([]),
    pkce: z.boolean().default(true),
    audience: z.string().max(L.valueChars).optional(),
    /** Fluxo Password (legado). */
    username: z.string().max(L.valueChars).optional(),
    password: z.string().max(L.valueChars).optional(),
    tokenVar: variableName.default('token'),
    autoRefresh: z.boolean().default(true)
  })
])
export type Auth = z.infer<typeof authSchema>
/* ------------------------------------------------------------------ corpo */

export const RAW_BODY_LANGUAGES = ['json', 'xml', 'text', 'html'] as const

export const bodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('raw'),
    language: z.enum(RAW_BODY_LANGUAGES).default('json'),
    text: z.string().max(L.bodyChars).default('')
  }),
  z.object({ type: z.literal('urlencoded'), fields: keyValuesSchema }),
  z.object({
    type: z.literal('multipart'),
    parts: z
      .array(
        z.discriminatedUnion('kind', [
          z.object({ kind: z.literal('text'), key: z.string().max(L.keyChars), value: z.string().max(L.valueChars).default(''), enabled: z.boolean().default(true) }),
          // Caminho do arquivo neste computador; o Main só envia arquivos autorizados (access.ts).
          z.object({ kind: z.literal('file'), key: z.string().max(L.keyChars), path: z.string().max(4096), enabled: z.boolean().default(true) })
        ])
      )
      .max(L.keyValueRows)
      .default([])
  }),
  z.object({ type: z.literal('binary'), path: z.string().max(4096).default('') }),
  z.object({
    type: z.literal('graphql'),
    query: z.string().max(L.bodyChars).default(''),
    variables: z.string().max(L.bodyChars).default(''),
    operationName: z.string().max(L.keyChars).optional()
  }),
  z.object({
    type: z.literal('soap'),
    version: z.enum(['1.1', '1.2']).default('1.1'),
    action: z.string().max(L.valueChars).default(''),
    envelope: z.string().max(L.bodyChars).default('')
  })
])
export type Body = z.infer<typeof bodySchema>
/* ------------------------------------------------------------------ testes e extrações */

export const ASSERTION_TARGETS = ['status', 'time', 'size', 'header', 'cookie', 'body', 'jsonPath', 'xPath', 'jsonSchema'] as const
export const ASSERTION_OPS = [
  'eq', 'neq', 'contains', 'notContains', 'startsWith', 'matches',
  'gt', 'gte', 'lt', 'lte', 'exists', 'notExists', 'isType',
  'lengthEq', 'lengthGt', 'lengthLt', 'in', 'matchesSchema'
] as const

const expectedSchema = z.union([z.string().max(L.valueChars), z.number(), z.boolean(), z.null(), z.array(z.union([z.string().max(L.valueChars), z.number()])).max(100)])

export const assertionSchema = z.object({
  target: z.enum(ASSERTION_TARGETS),
  /** JSONPath, XPath ou caminho do schema, conforme o alvo. */
  path: z.string().max(L.valueChars).optional(),
  /** Nome do cabeçalho ou do cookie. */
  name: z.string().max(L.keyChars).optional(),
  op: z.enum(ASSERTION_OPS),
  expected: expectedSchema.optional(),
  enabled: z.boolean().default(true)
})
export type Assertion = z.infer<typeof assertionSchema>

export const extractionSchema = z.object({
  from: z.enum(['jsonPath', 'xPath', 'header', 'cookie', 'regex']),
  path: z.string().max(L.valueChars),
  to: variableName,
  secret: z.boolean().default(false),
  enabled: z.boolean().default(true)
})
export type Extraction = z.infer<typeof extractionSchema>

/* ------------------------------------------------------------------ requisição (.apireq) */

export const RESPONSE_TYPES = ['auto', 'json', 'xml', 'html', 'text', 'binary'] as const

export const requestSettingsSchema = z.object({
  timeoutMs: z.number().int().min(L.timeoutMinMs).max(L.timeoutMaxMs).default(L.timeoutDefaultMs),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().min(0).max(L.maxRedirects).default(L.defaultMaxRedirects),
  verifyTls: z.boolean().default(true),
  minTlsVersion: z.enum(['TLSv1.2', 'TLSv1.3']).default('TLSv1.2'),
  encodeUrl: z.boolean().default(true),
  sendCookies: z.boolean().default(true),
  /** Proxy: o do sistema, nenhum ou um endereço (http://host:porta, pode ter {{variáveis}}). */
  proxy: z.enum(['system', 'none', 'manual']).default('system'),
  proxyUrl: z.string().max(L.urlChars).default(''),
  /** HTTP/2 (só https, com ALPN); sem suporte no servidor, volta para HTTP/1.1. */
  http2: z.boolean().default(false),
  /** Certificado de cliente e CA própria: caminhos neste computador, autorizados pelo diálogo. */
  clientCert: z
    .object({
      certPath: z.string().max(4096).default(''),
      keyPath: z.string().max(4096).default(''),
      pfxPath: z.string().max(4096).default(''),
      /** Nome da variável secreta com a senha da chave ou do PFX. */
      passphraseVar: z.string().max(100).default('')
    })
    .optional(),
  caPath: z.string().max(4096).default('')
})
export type RequestSettings = z.infer<typeof requestSettingsSchema>

export const REQUEST_SCHEMA_ID = 'meu-editor/api-request'
export const REQUEST_SCHEMA_VERSION = 1

export const apiRequestSchema = z.object({
  $schema: z.literal(`${REQUEST_SCHEMA_ID}@${REQUEST_SCHEMA_VERSION}`),
  id: idSchema,
  name: z.string().max(L.nameChars).default(''),
  description: z.string().max(L.requestDescriptionChars).optional(),
  method: methodSchema.default('GET'),
  url: z.string().max(L.urlChars).default(''),
  params: keyValuesSchema,
  headers: keyValuesSchema,
  auth: authSchema.default({ type: 'inherit' }),
  body: bodySchema.default({ type: 'none' }),
  responseType: z.enum(RESPONSE_TYPES).default('auto'),
  tests: z.array(assertionSchema).max(L.assertions).default([]),
  extract: z.array(extractionSchema).max(L.assertions).default([]),
  settings: requestSettingsSchema.prefault({}),
  /** Respostas salvas como exemplo (caminhos relativos ao arquivo). */
  examples: z.array(z.string().max(4096)).max(50).default([]),
  /** Scripts em JavaScript para o sandbox QuickJS (fase 5). Ausente = sem scripts. */
  scripts: z.object({ pre: z.string().max(L.bodyChars).default(''), post: z.string().max(L.bodyChars).default('') }).optional()
})
export type ApiRequest = z.infer<typeof apiRequestSchema>

/* ------------------------------------------------------------------ ambiente (.apienv) e coleção (.apicol) */

export const environmentVariableSchema = z
  .object({
    key: variableName,
    /** Ausente nas variáveis secretas: o valor fica só no cofre do computador. */
    value: z.string().max(L.valueChars).optional(),
    secret: z.boolean().default(false),
    description: z.string().max(L.descriptionChars).optional()
  })
  .refine((v) => !(v.secret && v.value !== undefined), { message: 'secret variables must not have a value', path: ['value'] })
export type EnvironmentVariable = z.infer<typeof environmentVariableSchema>

const variablesSchema = z
  .array(environmentVariableSchema)
  .max(L.variables)
  .default([])
  .refine((vars) => new Set(vars.map((v) => v.key)).size === vars.length, { message: 'duplicate variable' })

export const apiEnvironmentSchema = z.object({
  $schema: z.literal('meu-editor/api-environment@1'),
  id: idSchema,
  name: z.string().min(1).max(L.nameChars),
  /** Ambiente de produção: pede confirmação antes de POST, PUT, PATCH e DELETE. */
  production: z.boolean().default(false),
  variables: variablesSchema
})
export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>

export const apiCollectionSchema = z.object({
  $schema: z.literal('meu-editor/api-collection@1'),
  id: idSchema,
  name: z.string().min(1).max(L.nameChars),
  description: z.string().max(L.requestDescriptionChars).optional(),
  auth: authSchema.default({ type: 'none' }),
  variables: variablesSchema,
  /** Ordem dos itens na barra lateral (nomes dos arquivos e subpastas). */
  order: z.array(z.string().max(255)).max(10_000).default([]),
  /** Sincronizar respostas salvas e relatórios pela nuvem (ocupa o espaço da conta). */
  syncResponses: z.boolean().default(false)
})
export type ApiCollection = z.infer<typeof apiCollectionSchema>

/* ------------------------------------------------------------------ resposta salva (.apiresp) */

const cookieSchema = z.object({
  name: z.string().max(L.keyChars),
  value: z.string().max(L.valueChars),
  domain: z.string().max(255).optional(),
  path: z.string().max(L.valueChars).optional(),
  expires: z.string().max(64).optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional()
})

const ms = z.number().min(0).max(24 * 3600_000)

export const savedResponseSchema = z.object({
  $schema: z.literal('meu-editor/api-response@1'),
  requestId: idSchema,
  sentAt: z.string().max(64),
  environment: z.string().max(L.nameChars).optional(),
  /** Requisição enviada, já com os segredos mascarados. */
  request: z.object({ method: methodSchema, url: z.string().max(L.urlChars), headers: z.array(keyValueSchema).max(L.keyValueRows) }),
  status: z.number().int().min(100).max(999),
  statusText: z.string().max(200),
  httpVersion: z.string().max(10),
  headers: z.array(keyValueSchema).max(500),
  cookies: z.array(cookieSchema).max(200).default([]),
  timings: z.object({ dns: ms, tcp: ms, tls: ms, firstByte: ms, download: ms, total: ms }),
  tls: z.object({ protocol: z.string().max(20), issuer: z.string().max(500), subject: z.string().max(500), validTo: z.string().max(64), authorized: z.boolean() }).optional(),
  size: z.object({ headers: z.number().int().min(0), body: z.number().int().min(0), compressed: z.number().int().min(0).optional() }),
  body: z.union([
    z.object({ encoding: z.enum(['utf8', 'base64']), text: z.string() }),
    /** Corpo grande ou binário gravado num arquivo ao lado (caminho relativo). */
    z.object({ file: z.string().max(4096) })
  ]),
  truncated: z.boolean().default(false)
})
export type SavedResponse = z.infer<typeof savedResponseSchema>

/* ------------------------------------------------------------------ conexão WebSocket (.apiws) */

export const wsMessageTemplateSchema = z.object({
  name: z.string().max(L.nameChars).default(''),
  kind: z.enum(['text', 'json', 'binary']).default('text'),
  /** Texto, JSON ou base64 (binary); pode ter {{variáveis}}. */
  data: z.string().max(L.bodyChars).default('')
})
export type WsMessageTemplate = z.infer<typeof wsMessageTemplateSchema>

export const apiWebSocketSchema = z.object({
  $schema: z.literal('meu-editor/api-ws@1'),
  id: idSchema,
  name: z.string().max(L.nameChars).default(''),
  url: z.string().max(L.urlChars).default(''),
  headers: keyValuesSchema,
  protocols: z.array(z.string().max(100)).max(20).default([]),
  settings: z.object({ verifyTls: z.boolean().default(true) }).prefault({}),
  /** Mensagens salvas para reenviar. */
  messages: z.array(wsMessageTemplateSchema).max(200).default([])
})
export type ApiWebSocket = z.infer<typeof apiWebSocketSchema>

export function newApiWebSocket(name = ''): ApiWebSocket {
  return apiWebSocketSchema.parse({ $schema: 'meu-editor/api-ws@1', id: globalThis.crypto.randomUUID(), name })
}

/* ------------------------------------------------------------------ chamada gRPC (.apigrpc) */

export const apiGrpcSchema = z.object({
  $schema: z.literal('meu-editor/api-grpc@1'),
  id: idSchema,
  name: z.string().max(L.nameChars).default(''),
  /** host:porta, sem esquema; pode ter {{variáveis}}. */
  address: z.string().max(L.urlChars).default(''),
  /** proto: caminhos dos arquivos .proto (relativos ao .apigrpc quando possível); reflection: pergunta ao servidor. */
  source: z
    .discriminatedUnion('type', [
      z.object({ type: z.literal('proto'), files: z.array(z.string().max(4096)).max(50).default([]), importPaths: z.array(z.string().max(4096)).max(20).default([]) }),
      z.object({ type: z.literal('reflection') })
    ])
    .default({ type: 'reflection' }),
  service: z.string().max(500).default(''),
  method: z.string().max(200).default(''),
  metadata: keyValuesSchema,
  /** Mensagem em JSON (pode ter {{variáveis}}). */
  message: z.string().max(L.bodyChars).default('{}'),
  settings: z
    .object({ tls: z.boolean().default(false), verifyTls: z.boolean().default(true), deadlineMs: z.number().int().min(0).max(3_600_000).default(0) })
    .prefault({}),
  /** Mensagens salvas para reenviar nos streams do cliente. */
  messages: z.array(z.object({ name: z.string().max(L.nameChars).default(''), data: z.string().max(L.bodyChars).default('') })).max(200).default([])
})
export type ApiGrpc = z.infer<typeof apiGrpcSchema>

export function newApiGrpc(name = ''): ApiGrpc {
  return apiGrpcSchema.parse({ $schema: 'meu-editor/api-grpc@1', id: globalThis.crypto.randomUUID(), name })
}

/* ------------------------------------------------------------------ leitura, migração e gravação */

export type RequestParseError =
  | { code: 'json'; detail: string }
  | { code: 'notRequest' }
  | { code: 'newerVersion'; version: number }
  | { code: 'invalid'; detail: string }
  | { code: 'tooLarge' }

export type RequestParseResult = { ok: true; request: ApiRequest } | { ok: false; error: RequestParseError }

type Migration = (data: Record<string, unknown>) => Record<string, unknown>
/** MIGRATIONS[n] converte a versão n na versão n + 1. Ainda não há versões anteriores à atual. */
const MIGRATIONS: Record<number, Migration> = {}

const schemaVersion = (value: unknown): number | null => {
  if (typeof value !== 'string') return null
  const m = /^meu-editor\/api-request@(\d{1,4})$/.exec(value)
  return m ? Number(m[1]) : null
}

/** Caminho do primeiro campo inválido (ex.: "settings.timeoutMs"); a mensagem do Zod não é exibida (fica em inglês). */
const issueDetail = (error: z.ZodError): string => {
  const issue = error.issues[0]
  if (!issue) return ''
  return issue.path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`)).join('').replace(/^\./, '')
}

/** Lê o texto de um .apireq. Texto vazio vira uma requisição nova (GET sem URL). */
export function parseApiRequest(text: string): RequestParseResult {
  if (text.length > L.requestFileChars) return { ok: false, error: { code: 'tooLarge' } }
  if (text.trim() === '') return { ok: true, request: newApiRequest() }
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (err) {
    return { ok: false, error: { code: 'json', detail: err instanceof Error ? err.message : String(err) } }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: { code: 'notRequest' } }
  let obj = data as Record<string, unknown>
  const version = schemaVersion(obj.$schema)
  if (version === null) return { ok: false, error: { code: 'notRequest' } }
  if (version > REQUEST_SCHEMA_VERSION) return { ok: false, error: { code: 'newerVersion', version } }
  for (let v = version; v < REQUEST_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v]
    if (!migrate) return { ok: false, error: { code: 'notRequest' } }
    obj = { ...migrate(obj), $schema: `${REQUEST_SCHEMA_ID}@${v + 1}` }
  }
  const parsed = apiRequestSchema.safeParse(obj)
  if (!parsed.success) return { ok: false, error: { code: 'invalid', detail: issueDetail(parsed.error) } }
  return { ok: true, request: parsed.data }
}

/** Texto do .apireq: JSON com 2 espaços, chaves na ordem do schema e quebra de linha no fim. */
export function serializeApiRequest(request: ApiRequest): string {
  return `${JSON.stringify(apiRequestSchema.parse(request), null, 2)}\n`
}

/** Requisição nova: GET, sem URL, autorização herdada da coleção. */
export function newApiRequest(name = ''): ApiRequest {
  return apiRequestSchema.parse({ $schema: `${REQUEST_SCHEMA_ID}@${REQUEST_SCHEMA_VERSION}`, id: globalThis.crypto.randomUUID(), name })
}

/** A URL (já com as variáveis resolvidas) usa um esquema permitido? */
export function isAllowedUrl(url: string): boolean {
  try {
    return (ALLOWED_URL_SCHEMES as readonly string[]).includes(new URL(url).protocol)
  } catch {
    return false
  }
}
