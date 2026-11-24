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
