// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { z } from 'zod'

/** Assistente de IA local (Ollama). Contrato entre Renderer e Main; a rede fica só no Main. */

export const AI_DEFAULT_HOST = 'http://127.0.0.1:11434'

export const AI_LIMITS = {
  /** Soma dos caracteres de todas as mensagens enviadas ao modelo. */
  contextChars: 200_000,
  /** Mensagens por geração. */
  messages: 100,
  /** Gerações simultâneas por janela. */
  generations: 2,
  /** Resposta máxima aceita por geração (caracteres). */
  responseChars: 400_000,
  hostChars: 300,
  modelChars: 200
} as const

export const AI_ERROR_CODES = [
  'ollamaNotRunning',
  'modelNotFound',
  'hostNotAllowed',
  'timeout',
  'tooLarge',
  'tooManyGenerations',
  'invalidSettings',
  'downloadFailed',
  'signatureInvalid',
  'installerFailed',
  'notInstalled',
  'startFailed',
  'pullFailed',
  'modelNameInvalid',
  'unsupportedPlatform',
  'diskFull',
  'busy',
  'cancelled',
  'unknown'
] as const
export type AiErrorCode = (typeof AI_ERROR_CODES)[number]

export const aiSettingsSchema = z.object({
  host: z.string().trim().min(1).max(AI_LIMITS.hostChars).default(AI_DEFAULT_HOST),
  /** Modelo escolhido; vazio = ainda não escolhido. */
  model: z.string().max(AI_LIMITS.modelChars).default(''),
  temperature: z.number().min(0).max(2).default(0.7),
  /** Permite um servidor Ollama que não esteja neste computador. */
  allowRemote: z.boolean().default(false)
})
export type AiSettings = z.infer<typeof aiSettingsSchema>

export const DEFAULT_AI_SETTINGS: AiSettings = { host: AI_DEFAULT_HOST, model: '', temperature: 0.7, allowRemote: false }

export type AiSetSettingsResult = { ok: true; settings: AiSettings } | { ok: false; code: AiErrorCode }

export interface AiStatus {
  /** O Ollama respondeu. */
  ok: boolean
  version?: string
  /** Nomes dos modelos instalados. */
  models: string[]
  code?: AiErrorCode
}

export const aiMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string()
})
export type AiMessage = z.infer<typeof aiMessageSchema>

export const aiChatInputSchema = z.object({
  /** Id da geração, escolhido pelo Renderer. */
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  messages: z.array(aiMessageSchema).min(1).max(AI_LIMITS.messages)
})
export type AiChatInput = z.infer<typeof aiChatInputSchema>

export type AiChatResult = { ok: true } | { ok: false; code: AiErrorCode }

/** Pedaço da resposta (evento aiChunk). `done` encerra a geração; `code` indica que ela falhou. */
export interface AiChunk {
  id: string
  text: string
  done: boolean
  code?: AiErrorCode
}

/** Instalação do Ollama e download de modelos. As URLs e os caminhos de executáveis ficam fixos no Main. */

/** Comando oficial para Linux: precisa de sudo, por isso o app só o digita no terminal (sem Enter). */
export const AI_LINUX_INSTALL_COMMAND = 'curl -fsSL https://ollama.com/install.sh | sh'
export const AI_OLLAMA_SITE = 'https://ollama.com/download'

/** Modelos sugeridos, com o tamanho aproximado do download (MB). A lista fica só aqui. */
export const AI_RECOMMENDED_MODELS: readonly { name: string; sizeMb: number }[] = [
  { name: 'llama3.2:3b', sizeMb: 2000 },
  { name: 'qwen2.5-coder:7b', sizeMb: 4700 },
  { name: 'gemma3:4b', sizeMb: 3300 },
  { name: 'phi4-mini', sizeMb: 2500 }
]

export const AI_MODEL_NAME_MAX = 100
/** Nome livre de modelo: só [a-z0-9._:/-], começando por letra ou número. */
export const aiModelNameSchema = z
  .string()
  .max(AI_MODEL_NAME_MAX)
  .regex(/^[a-z0-9][a-z0-9._:/-]*$/)
export const isValidModelName = (name: string): boolean => aiModelNameSchema.safeParse(name).success

export interface AiInstallInfo {
  platform: 'win32' | 'linux' | 'other'
  /** O executável do Ollama foi encontrado (o caminho nunca sai do Main). */
  installed: boolean
  /** O servidor responde. */
  running: boolean
}

export type AiOpResult = { ok: true } | { ok: false; code: AiErrorCode }

/** Andamento da instalação ou do download de modelo (evento aiInstallProgress). `done` encerra a operação. */
export interface AiInstallProgress {
  op: 'install' | 'pull'
  stage: 'download' | 'verify' | 'installer' | 'waiting' | 'pull'
  completed: number
  total: number
  /** Pull: texto de status do Ollama (ex.: "pulling manifest"). */
  status?: string
  model?: string
  done: boolean
  code?: AiErrorCode
}
