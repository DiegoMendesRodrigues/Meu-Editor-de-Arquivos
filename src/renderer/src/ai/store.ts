// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import { AI_LIMITS, DEFAULT_AI_SETTINGS, type AiChunk, type AiErrorCode, type AiMessage, type AiSettings, type AiStatus } from '@shared/ai'
import { useLocale } from '@/i18n'
import { systemPrompt } from './prompts'

/**
 * Estado do assistente de IA. A conversa fica só na memória: não vai para o disco, a sessão nem a nuvem,
 * e some quando o app fecha. A rede é toda no Main; aqui só há o que a tela mostra.
 */

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  /** O que vai ao modelo. */
  content: string
  /** O que o usuário vê no lugar de `content` (ações rápidas mandam o documento junto). */
  display?: string
  /** Resposta: id da geração que a produz (os pedaços chegam por esse id). */
  generation?: string
  streaming?: boolean
  error?: AiErrorCode
}

export type Connection = { state: 'unknown' } | { state: 'checking' } | { state: 'ok'; version?: string; models: string[] } | { state: 'down'; code: AiErrorCode }

interface AiState {
  open: boolean
  settings: AiSettings
  settingsLoaded: boolean
  connection: Connection
  messages: ChatMessage[]
  /** Id da geração em andamento (uma por vez na tela). */
  generationId: string | null
  show(): void
  hide(): void
  toggle(): void
  refresh(): Promise<void>
  /** Grava a configuração; devolve o código do erro (endereço inválido ou não permitido) ou null. */
  saveSettings(next: AiSettings): Promise<AiErrorCode | null>
  chooseModel(model: string): Promise<void>
  /** Envia uma pergunta; `display` é o texto mostrado no lugar do conteúdo completo. */
  send(content: string, display?: string): Promise<void>
  /** Abre o painel e envia (usado pelo Cliente de API e pelas ações rápidas). */
  ask(content: string, display?: string): Promise<void>
  stop(): void
  newChat(): void
  handleChunk(chunk: AiChunk): void
}

let counter = 0
const nextId = (prefix: string): string => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`

/** Mensagens enviadas ao modelo: o prompt de sistema e o histórico, sem as mais antigas se passar do limite. */
export function buildConversation(history: ChatMessage[], system: string): AiMessage[] {
  const usable = history.filter((m) => !m.error && m.content !== '').map((m): AiMessage => ({ role: m.role, content: m.content }))
  let total = system.length + usable.reduce((n, m) => n + m.content.length, 0)
  while (usable.length > 1 && (total > AI_LIMITS.contextChars || usable.length >= AI_LIMITS.messages)) {
    total -= usable.shift()!.content.length
  }
  return [{ role: 'system', content: system }, ...usable]
}

export const useAi = create<AiState>((set, get) => ({
  open: false,
  settings: { ...DEFAULT_AI_SETTINGS },
  settingsLoaded: false,
  connection: { state: 'unknown' },
  messages: [],
  generationId: null,

  show: () => {
    set({ open: true })
    void get().refresh()
  },
  hide: () => set({ open: false }),
  toggle: () => (get().open ? get().hide() : get().show()),

  refresh: async () => {
    set({ connection: { state: 'checking' } })
    try {
      const settings = await window.api.aiGetSettings()
      set({ settings, settingsLoaded: true })
      const status: AiStatus = await window.api.aiStatus()
      if (!status.ok) return set({ connection: { state: 'down', code: status.code ?? 'unknown' } })
      set({ connection: { state: 'ok', version: status.version, models: status.models } })
      // Modelo ainda não escolhido (ou removido): usa o primeiro instalado.
      if (status.models.length > 0 && !status.models.includes(settings.model)) await get().chooseModel(status.models[0]!)
    } catch {
      set({ connection: { state: 'down', code: 'unknown' } })
    }
  },

  saveSettings: async (next) => {
    try {
      const result = await window.api.aiSetSettings(next)
      if (!result.ok) return result.code
      set({ settings: result.settings })
      // A verificação do novo endereço pode demorar (tempo limite); não segura o aviso de "salvo".
      void get().refresh()
      return null
    } catch {
      return 'unknown'
    }
  },

  chooseModel: async (model) => {
    const next = { ...get().settings, model }
    set({ settings: next })
    try {
      const result = await window.api.aiSetSettings(next)
      if (result.ok) set({ settings: result.settings })
    } catch {
      /* a escolha vale para esta sessão; o Main só usa o que está gravado, então o próximo envio avisa */
    }
  },

  send: async (content, display) => {
    const state = get()
    if (state.generationId || content.trim() === '') return
    const user: ChatMessage = { id: nextId('u'), role: 'user', content, display }
    const generationId = nextId('g')
    const reply: ChatMessage = { id: nextId('a'), role: 'assistant', content: '', streaming: true, generation: generationId }
    const history = [...state.messages, user]
    set({ messages: [...history, reply], generationId })
    const locale = useLocale.getState().locale
    let code: AiErrorCode | null = null
    try {
      const result = await window.api.aiChat({ id: generationId, messages: buildConversation(history, systemPrompt(locale)) })
      if (!result.ok) code = result.code
    } catch {
      code = 'unknown'
    }
    if (code) {
      set((s) => ({
        generationId: s.generationId === generationId ? null : s.generationId,
        messages: s.messages.map((m) => (m.id === reply.id ? { ...m, streaming: false, error: code! } : m))
      }))
    }
  },

  ask: async (content, display) => {
    set({ open: true })
    // Conexão ainda não verificada: confere antes (escolhe o modelo, se faltar).
    if (get().connection.state === 'unknown' || !get().settingsLoaded) await get().refresh()
    await get().send(content, display)
  },

  stop: () => {
    const id = get().generationId
    if (id) void window.api.aiCancel(id).catch(() => undefined)
  },

  newChat: () => {
    get().stop()
    set({ messages: [], generationId: null })
  },

  handleChunk: (chunk) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.generation === chunk.id ? { ...m, content: m.content + chunk.text, streaming: !chunk.done, ...(chunk.code ? { error: chunk.code } : {}) } : m
      ),
      generationId: chunk.done && s.generationId === chunk.id ? null : s.generationId
    }))
  }
}))

/** Liga os pedaços vindos do Main ao estado. Chamado uma vez, na abertura do app. */
export function startAiBridge(): () => void {
  return window.api.onAiChunk((chunk) => useAi.getState().handleChunk(chunk))
}
