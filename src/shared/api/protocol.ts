// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Contrato entre o Renderer e o Main do Cliente de API (canais api:*).
 *
 * Regras que todos os canais seguem:
 * - A rede fica só no Main. O Renderer manda a requisição como está no documento (com {{variáveis}}) e o
 *   Main valida com Zod, resolve as variáveis, injeta os segredos do cofre e envia.
 * - Nenhum tipo daqui leva o valor de um segredo do Main para o Renderer. Valores secretos voltam
 *   mascarados (MASK) na requisição enviada, e extrações marcadas como segredo vão direto para o cofre.
 * - Erros chegam como códigos conhecidos (ApiErrorCode), traduzidos em apiClient.error.<código>; a
 *   mensagem crua do sistema ou do servidor nunca aparece na interface.
 */
import { z } from 'zod'
import { API_LIMITS as L } from './limits'
import {
  apiRequestSchema,
  authSchema,
  environmentVariableSchema,
  keyValueSchema,
  type ApiEnvironment,
  type ApiRequest,
  type KeyValue
} from './schema'
import { VARIABLE_NAME_RE } from './variables'

/** Como um valor secreto aparece em qualquer coisa que volte ao Renderer. */
export const MASK = '••••••'

/* ------------------------------------------------------------------ envio */

/** Ambiente ativo, como está no documento .apienv (segredos sem valor; o Main busca no cofre pelo id). */
export const environmentPayloadSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(L.nameChars),
  production: z.boolean().default(false),
  variables: z.array(environmentVariableSchema).max(L.variables).default([])
})
export type ApiEnvironmentPayload = z.infer<typeof environmentPayloadSchema>

/** Coleção da requisição (pasta com collection.apicol): variáveis e autorização herdada. */
export const collectionPayloadSchema = z.object({
  id: z.string().min(1).max(64),
  variables: z.array(environmentVariableSchema).max(L.variables).default([]),
  auth: authSchema.default({ type: 'none' })
})
export type ApiCollectionPayload = z.infer<typeof collectionPayloadSchema>

export const sendInputSchema = z.object({
  /** Id criado pelo Renderer (UUID) para acompanhar e cancelar o envio. */
  runId: z.string().uuid(),
  request: apiRequestSchema,
  environment: environmentPayloadSchema.nullable().default(null),
  collection: collectionPayloadSchema.nullable().default(null),
  /** Variáveis temporárias (extraídas antes, no executor), as mais fortes. Nunca segredos. */
  temporary: z.record(z.string().regex(VARIABLE_NAME_RE), z.string().max(L.valueChars)).default({}),
  /** Caminho do .apireq, quando salvo (para arquivos anexados com caminho relativo). */
  documentPath: z.string().max(4096).nullable().default(null),
  /** Gravar o corpo da resposta num arquivo (o Main abre o diálogo e grava em streaming). */
  saveToFile: z.boolean().default(false),
  /** O usuário confirmou o envio num ambiente de produção (POST, PUT, PATCH e DELETE). */
  productionConfirmed: z.boolean().default(false),
  /** O usuário confirmou enviar segredos para este host (igual ao host de destino). */
  confirmSecretHost: z.string().max(255).optional(),
  /** Chave da confiança em scripts quando o documento ainda não tem caminho (id do documento). */
  scriptKey: z.string().max(4096).optional()
})
export type ApiSendInput = z.input<typeof sendInputSchema>

export interface ApiTimings {
  dns: number
  tcp: number
  tls: number
  firstByte: number
  download: number
  total: number
}

export interface ApiTlsInfo {
  protocol: string
  cipher?: string
  issuer: string
  subject: string
  validFrom: string
  validTo: string
  authorized: boolean
  /** Código do problema do certificado, quando não autorizado (ex.: DEPTH_ZERO_SELF_SIGNED_CERT). */
  authorizationError?: string
}

export interface ApiCookie {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface AssertionResult {
  /** Posição da asserção em request.tests. */
  index: number
  passed: boolean
  /** Valor recebido, resumido (até 200 caracteres), para mostrar ao lado do esperado. */
  actual?: string
  /** Código do problema ao avaliar (ex.: badJsonPath, badRegex, timeout, notJson, badSchema). */
  error?: string
}

export interface ExtractionResult {
  to: string
  secret: boolean
  ok: boolean
  /** Só nas extrações que não são segredo; as secretas vão direto para o cofre (escopo do ambiente). */
  value?: string
}

/** Linha do console de um script (já sem segredos). */
export interface ScriptLogLine {
  level: 'log' | 'info' | 'warn' | 'error'
  text: string
  phase?: 'pre' | 'post'
}

/** Resultado de um test(nome, fn) de script. `error` é só a mensagem da falha (sem segredos). */
export interface ScriptTestResult {
  name: string
  passed: boolean
  error?: string
  /** Código do problema do próprio script (scriptTimeout, scriptMemory, scriptError), quando o script não terminou. */
  code?: 'scriptTimeout' | 'scriptMemory' | 'scriptError'
}

export interface ApiResponseResult {
  ok: true
  runId: string
  status: number
  statusText: string
  httpVersion: string
  headers: KeyValue[]
  cookies: ApiCookie[]
  timings: ApiTimings
  tls?: ApiTlsInfo
  size: { headers: number; body: number; compressed?: number }
  body: {
    encoding: 'utf8' | 'base64'
    text: string
    contentType: string
    /** O Renderer recebe no máximo API_LIMITS.displayBytes; o resto fica de fora. */
    truncated: boolean
    /** Corpo gravado em arquivo (saveToFile). */
    savedTo?: string
  }
  /** Requisição enviada, com as variáveis resolvidas e os segredos mascarados. */
  sentRequest: { method: string; url: string; headers: KeyValue[] }
  redirects: { status: number; url: string }[]
  tests: AssertionResult[]
  /** Testes feitos pelo script "depois" (fase 5). */
  scriptTests?: ScriptTestResult[]
  /** Console dos scripts "antes" e "depois" (fase 5). */
  scriptLogs?: ScriptLogLine[]
  extracted: ExtractionResult[]
  /** Variáveis usadas na requisição que não existem em nenhum escopo. */
  missingVariables: string[]
}

export const API_ERROR_CODES = [
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'tlsVersion',
  'timeout',
  'connectTimeout',
  'cancelled',
  'tooLarge',
  'tooManyRedirects',
  'badUrl',
  'schemeNotAllowed',
  'fileNotAuthorized',
  'fileNotFound',
  'tooManyRequests',
  'invalidRequest',
  'productionNotConfirmed',
  'secretHostNotConfirmed',
  'proxy',
  'clientCert',
  'saveCancelled',
  'scriptsNotTrusted',
  'scriptTimeout',
  'scriptMemory',
  'scriptError',
  'unknown'
] as const
export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export interface ApiSendError {
  ok: false
  runId: string
  code: ApiErrorCode
  missingVariables?: string[]
  /** Com secretHostNotConfirmed: o host que precisa de confirmação. */
  host?: string
  /** Console do script "antes" quando ele falhou (fase 5). */
  scriptLogs?: ScriptLogLine[]
}

export type ApiSendResult = ApiResponseResult | ApiSendError

/* ------------------------------------------------------------------ histórico e cookies */

export interface ApiHistoryEntry {
  id: string
  /** ISO 8601. */
  at: string
  method: string
  /** URL modelo, com {{variáveis}} (nunca os valores resolvidos). */
  url: string
  status?: number
  timeMs?: number
  errorCode?: ApiErrorCode
  environment?: string
  /** A requisição como estava (cabeçalhos sensíveis mascarados), para reabrir como nova. */
  request: ApiRequest
}

/** Cookies de um ambiente (ou "default" sem ambiente), por domínio. */
export interface ApiCookieJarEntry extends ApiCookie {
  domain: string
}

/* ------------------------------------------------------------------ arquivos anexados */

/** Para que o arquivo será usado: define o filtro do diálogo nativo. O Main autoriza os escolhidos. */
export const PICK_PURPOSES = ['body', 'certificate', 'privateKey', 'ca', 'pfx', 'data', 'import', 'proto'] as const
export type ApiPickPurpose = (typeof PICK_PURPOSES)[number]

/* ------------------------------------------------------------------ importar */

export const IMPORT_FORMATS = ['auto', 'curl', 'postman', 'openapi', 'insomnia', 'har', 'http', 'wsdl'] as const
export type ApiImportFormat = (typeof IMPORT_FORMATS)[number]

export interface ApiImportItem {
  /** Pasta dentro da coleção ("" = raiz), com "/" como separador. */
  folder: string
  request: ApiRequest
}

export interface ApiImportResult {
  ok: true
  format: Exclude<ApiImportFormat, 'auto'>
  name: string
  items: ApiImportItem[]
  environments: ApiEnvironment[]
  /** Variáveis da coleção (Postman, OpenAPI servers). */
  variables: { key: string; value: string }[]
  /** Avisos por código (ex.: scriptsIgnored, unsupportedAuth, unsupportedBody, truncated). */
  warnings: string[]
}
export type ApiImportResponse = ApiImportResult | { ok: false; code: 'unknownFormat' | 'invalid' | 'tooLarge' | 'timeout' }

/** Grava os arquivos de uma coleção importada ou criada (só dentro de uma pasta autorizada). */
export interface ApiWriteFilesInput {
  dir: string
  files: { relativePath: string; content: string }[]
}

/* ------------------------------------------------------------------ executor */

export const runInputSchema = z.object({
  runId: z.string().uuid(),
  name: z.string().max(L.nameChars),
  /** Requisições na ordem de execução, já com a autorização da coleção resolvida pelo Renderer. */
  items: z
    .array(z.object({ path: z.string().max(4096), folder: z.string().max(4096).default(''), request: apiRequestSchema }))
    .min(1)
    .max(1000),
  environment: environmentPayloadSchema.nullable().default(null),
  collection: collectionPayloadSchema.nullable().default(null),
  iterations: z.number().int().min(1).max(1000).default(1),
  delayMs: z.number().int().min(0).max(60_000).default(0),
  stopOnFailure: z.boolean().default(false),
  /** Linhas do arquivo de dados (CSV ou JSON) já lidas: cada linha vira variáveis de uma iteração. */
  data: z.array(z.record(z.string(), z.string().max(L.valueChars))).max(10_000).default([]),
  productionConfirmed: z.boolean().default(false)
})
export type ApiRunInput = z.input<typeof runInputSchema>

export interface ApiRunItemResult {
  iteration: number
  path: string
  folder: string
  name: string
  method: string
  /** URL resolvida com os segredos mascarados. */
  url: string
  status?: number
  timeMs?: number
  errorCode?: ApiErrorCode
  tests: { name: string; passed: boolean; actual?: string; error?: string }[]
}

export interface ApiRunProgress {
  runId: string
  done: number
  total: number
  item?: ApiRunItemResult
  finished?: boolean
  cancelled?: boolean
}

/* ------------------------------------------------------------------ OAuth */

export const oauthInputSchema = z.object({
  runId: z.string().uuid(),
  auth: authSchema,
  environment: environmentPayloadSchema.nullable().default(null),
  collection: collectionPayloadSchema.nullable().default(null),
  verifyTls: z.boolean().default(true)
})
export type ApiOAuthInput = z.input<typeof oauthInputSchema>

/** Andamento do OAuth 2.0 (Device Code: código para o usuário digitar). */
export interface ApiOAuthProgress {
  runId: string
  verificationUri?: string
  userCode?: string
  expiresIn?: number
}

export type ApiOAuthResult =
  | { ok: true; tokenVar: string; expiresAt?: string; hasRefreshToken: boolean }
  | { ok: false; code: 'cancelled' | 'timeout' | 'denied' | 'stateMismatch' | 'invalidResponse' | 'network' | 'invalidConfig' | 'noVault' | 'unknown' }

/** Estado do token guardado no cofre (sem o valor). */
export interface ApiOAuthTokenInfo {
  exists: boolean
  expiresAt?: string
  hasRefreshToken: boolean
}

/* ------------------------------------------------------------------ WebSocket (fase 4) */

export const wsConnectInputSchema = z.object({
  /** Id criado pelo Renderer (UUID) para enviar, fechar e receber os eventos da conexão. */
  connId: z.string().uuid(),
  /** ws:// ou wss://, com {{variáveis}} resolvidas no Main. */
  url: z.string().max(L.urlChars),
  headers: z.array(z.object({ key: z.string().max(L.keyChars), value: z.string().max(L.valueChars), enabled: z.boolean().default(true) })).max(L.keyValueRows).default([]),
  protocols: z.array(z.string().max(100)).max(20).default([]),
  environment: environmentPayloadSchema.nullable().default(null),
  collection: collectionPayloadSchema.nullable().default(null),
  verifyTls: z.boolean().default(true),
  /** Confirmação de envio de segredos para o host (como em api:send). */
  confirmSecretHost: z.string().max(255).optional()
})
export type ApiWsConnectInput = z.input<typeof wsConnectInputSchema>

export type ApiWsConnectResult =
  | { ok: true; protocol: string; url: string }
  | { ok: false; code: ApiErrorCode | 'wsHandshake' | 'tooManyConnections'; status?: number; host?: string }

/** Evento de uma conexão (mensagens com no máximo API_LIMITS.wsMessageBytes para exibir). */
export interface ApiWsEvent {
  connId: string
  type: 'open' | 'message' | 'close' | 'error'
  direction?: 'in' | 'out'
  /** Texto, ou base64 quando binary. Segredos resolvidos aparecem mascarados nas mensagens enviadas. */
  data?: string
  binary?: boolean
  size?: number
  at: string
  code?: number | string
  truncated?: boolean
}

/* ------------------------------------------------------------------ servidor mock (fase 4) */

export const mockRouteSchema = z.object({
  method: z.string().max(20),
  /** Caminho com :params (ex.: /produtos/:id). */
  path: z.string().max(L.urlChars),
  status: z.number().int().min(100).max(599).default(200),
  headers: z.array(z.object({ key: z.string().max(L.keyChars), value: z.string().max(L.valueChars) })).max(L.keyValueRows).default([]),
  body: z.string().max(L.bodyChars).default(''),
  /** Nome do exemplo (escolhido pelo cabeçalho x-mock-example ou pela query ?__example=). */
  example: z.string().max(L.nameChars).default(''),
  delayMs: z.number().int().min(0).max(60_000).default(0)
})
export type ApiMockRoute = z.infer<typeof mockRouteSchema>

export const mockStartInputSchema = z.object({
  name: z.string().max(L.nameChars).default(''),
  port: z.number().int().min(0).max(65535).default(4010),
  /** Ouvir na rede local (0.0.0.0) exige marcar a opção com aviso; o padrão é só 127.0.0.1. */
  lan: z.boolean().default(false),
  routes: z.array(mockRouteSchema).max(2000)
})
export type ApiMockStartInput = z.input<typeof mockStartInputSchema>

export type ApiMockStartResult = { ok: true; mockId: string; port: number; url: string } | { ok: false; code: 'portInUse' | 'tooManyMocks' | 'invalid' | 'unknown' }

export interface ApiMockLogEntry {
  mockId: string
  at: string
  method: string
  path: string
  status: number
  /** Rota encontrada (índice) ou ausente (404). */
  route?: number
  timeMs: number
  /** O servidor parou sozinho (inatividade): o Renderer tira o mock da lista de ativos. */
  stopped?: true
}

/* ------------------------------------------------------------------ gRPC (fase 5) */

/** De onde vêm os serviços: arquivos .proto (escolhidos em diálogo) ou a reflexão do servidor. */
export const grpcSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('proto'), files: z.array(z.string().max(4096)).min(1).max(50), importPaths: z.array(z.string().max(4096)).max(20).default([]) }),
  z.object({ type: z.literal('reflection') })
])
export type ApiGrpcSource = z.infer<typeof grpcSourceSchema>

const grpcTargetFields = {
  /** host:porta, sem esquema (pode ter {{variáveis}}). */
  address: z.string().min(1).max(L.urlChars),
  tls: z.boolean().default(false),
  verifyTls: z.boolean().default(true),
  metadata: z.array(keyValueSchema).max(L.keyValueRows).default([]),
  environment: environmentPayloadSchema.nullable().default(null),
  collection: collectionPayloadSchema.nullable().default(null),
  /** Confirmação de envio de segredos para o host (como em api:send). */
  confirmSecretHost: z.string().max(255).optional()
}

export const grpcLoadInputSchema = z.object({ source: grpcSourceSchema, ...grpcTargetFields })
export type ApiGrpcLoadInput = z.input<typeof grpcLoadInputSchema>

export type ApiGrpcMethodKind = 'unary' | 'server' | 'client' | 'bidi'
export interface ApiGrpcMethod {
  name: string
  kind: ApiGrpcMethodKind
  requestType: string
  responseType: string
  /** Mensagem de exemplo em JSON gerada a partir do proto. */
  template: string
}
export interface ApiGrpcService {
  /** Nome completo (pacote.Servico). */
  name: string
  methods: ApiGrpcMethod[]
}
export type ApiGrpcLoadResult =
  | { ok: true; services: ApiGrpcService[] }
  | { ok: false; code: ApiErrorCode | 'protoInvalid' | 'reflectionUnavailable'; host?: string }

export const grpcStartInputSchema = z.object({
  callId: z.string().uuid(),
  source: grpcSourceSchema,
  ...grpcTargetFields,
  service: z.string().min(1).max(500),
  method: z.string().min(1).max(200),
  /** Primeira mensagem em JSON (unário e streaming do servidor; nas outras pode ficar vazia). */
  message: z.string().max(L.bodyChars).default(''),
  deadlineMs: z.number().int().min(0).max(3_600_000).default(0)
})
export type ApiGrpcStartInput = z.input<typeof grpcStartInputSchema>
export type ApiGrpcStartResult =
  | { ok: true }
  | { ok: false; code: ApiErrorCode | 'protoInvalid' | 'reflectionUnavailable' | 'methodNotFound' | 'messageInvalid' | 'tooManyCalls'; host?: string }

export interface ApiGrpcEvent {
  callId: string
  type: 'message' | 'metadata' | 'status' | 'error'
  direction: 'in' | 'out'
  /** JSON da mensagem, ou metadados como JSON. */
  data: string
  at: string
  /** Status gRPC (0 = OK) e o nome dele (OK, NOT_FOUND...) no evento status. */
  code?: number
  codeName?: string
  /** Detalhe do status vindo do servidor: o Renderer mostra só como texto, nunca como HTML. */
  details?: string
  truncated?: boolean
}

/* ------------------------------------------------------------------ monitoramento (fase 5) */

export const monitorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(L.nameChars),
  /** Pasta da coleção (precisa estar autorizada quando o monitor é criado). */
  collectionDir: z.string().min(1).max(4096),
  /** Caminhos relativos das requisições; vazio = todas. */
  requests: z.array(z.string().max(4096)).max(500).default([]),
  environment: z.string().max(4096).optional(),
  intervalMin: z.number().int().min(1).max(1440),
  enabled: z.boolean().default(true),
  notifyOnFailure: z.boolean().default(true)
})
export type ApiMonitor = z.infer<typeof monitorSchema>
export type ApiMonitorInput = z.input<typeof monitorSchema>

export interface ApiMonitorRun {
  at: string
  ok: boolean
  passed: number
  failed: number
  /** Requisições com erro de rede. */
  errors: number
  totalMs: number
  avgMs: number
}
export interface ApiMonitorState extends ApiMonitor {
  /** Últimas execuções, da mais antiga para a mais nova (no máximo API_LIMITS.monitorRuns). */
  runs: ApiMonitorRun[]
  running: boolean
  nextAt?: string
}
export type ApiMonitorSaveResult = { ok: true; monitor: ApiMonitorState } | { ok: false; code: 'notAuthorized' | 'tooManyMonitors' | 'invalid' }
export interface ApiMonitorEvent {
  monitor: ApiMonitorState
}

/* ------------------------------------------------------------------ scripts (fase 5) */

/** Confiar nos scripts: da requisição atual (editados pelo usuário) ou de toda a coleção. */
export const scriptTrustInputSchema = z.object({
  /** Arquivo .apireq (ou id do documento ainda não salvo). */
  requestKey: z.string().min(1).max(4096),
  collectionDir: z.string().max(4096).optional(),
  pre: z.string().max(L.bodyChars).default(''),
  post: z.string().max(L.bodyChars).default(''),
  /** true = confia em todos os scripts atuais da coleção (botão "Confiar nesta coleção"). */
  wholeCollection: z.boolean().default(false)
})
export type ApiScriptTrustInput = z.input<typeof scriptTrustInputSchema>
