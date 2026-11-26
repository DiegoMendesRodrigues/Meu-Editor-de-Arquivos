// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import { AI_LIMITS, DEFAULT_AI_SETTINGS, type AiChunk, type AiErrorCode, type AiInstallInfo, type AiInstallProgress, type AiMessage, type AiOpResult, type AiSettings, type AiStatus } from '@shared/ai'
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

/** Operação longa em andamento (instalar o Ollama ou baixar um modelo). */
export type AiProgress = Pick<AiInstallProgress, 'op' | 'stage' | 'completed' | 'total' | 'status' | 'model'>

interface AiState {
  open: boolean
  /** Instalado/parado/plataforma; vem do Main (sem caminhos). */
  info: AiInstallInfo | null
  progress: AiProgress | null
  /** Erro da última operação de instalação, início ou download (código traduzido). */
  opError: AiErrorCode | null
  starting: boolean
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
  loadInfo(): Promise<void>
  installOllama(): Promise<void>
  cancelInstall(): void
  startOllama(): Promise<void>
  pullModel(name: string): Promise<void>
  cancelPull(): void
  deleteModel(name: string): Promise<void>
  handleProgress(p: AiInstallProgress): void
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
  info: null,
  progress: null,
  opError: null,
  starting: false,
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
      if (!status.ok) {
        set({ connection: { state: 'down', code: status.code ?? 'unknown' } })
        return get().loadInfo()
      }
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

  loadInfo: async () => {
    try {
      set({ info: await window.api.aiInstallInfo() })
    } catch {
      set({ info: null })
    }
  },

  installOllama: async () => {
    if (get().progress) return
    set({ progress: { op: 'install', stage: 'download', completed: 0, total: 0 }, opError: null })
    const result = await runOp(() => window.api.aiInstallStart())
    if (!result.ok) set({ progress: null, opError: result.code })
  },

  cancelInstall: () => void window.api.aiInstallCancel().catch(() => undefined),

  startOllama: async () => {
    if (get().starting) return
    set({ starting: true, opError: null })
    const result = await runOp(() => window.api.aiStartServer())
    set({ starting: false, ...(result.ok || result.code === 'cancelled' ? {} : { opError: result.code }) })
    if (result.ok) await get().refresh()
  },

  pullModel: async (name) => {
    if (get().progress) return
    set({ progress: { op: 'pull', stage: 'pull', completed: 0, total: 0, model: name, status: '' }, opError: null })
    const result = await runOp(() => window.api.aiPull(name))
    if (!result.ok) set({ progress: null, opError: result.code })
  },

  cancelPull: () => void window.api.aiPullCancel().catch(() => undefined),

  deleteModel: async (name) => {
    set({ opError: null })
    const result = await runOp(() => window.api.aiDeleteModel(name))
    if (!result.ok) set({ opError: result.code })
    else await get().refresh()
  },

  handleProgress: (p) => {
    if (!p.done) return set({ progress: { op: p.op, stage: p.stage, completed: p.completed, total: p.total, status: p.status, model: p.model } })
    set({ progress: null, opError: p.code && p.code !== 'cancelled' ? p.code : null })
    // Terminou (ou foi cancelada): relê o estado e, se baixou um modelo, seleciona-o.
    void get()
      .refresh()
      .then(() => {
        const c = get().connection
        if (p.op !== 'pull' || p.code || !p.model || c.state !== 'ok') return
        const installed = c.models.find((m) => m === p.model || m === `${p.model}:latest`)
        if (installed) return get().chooseModel(installed)
      })
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

/** Chamada ao Main que nunca lança: uma falha inesperada vira o código 'unknown'. */
async function runOp(call: () => Promise<AiOpResult>): Promise<AiOpResult> {
  try {
    return await call()
  } catch {
    return { ok: false, code: 'unknown' }
  }
}

/** Liga os pedaços e o andamento vindos do Main ao estado. Chamado uma vez, na abertura do app. */
export function startAiBridge(): () => void {
  const offChunk = window.api.onAiChunk((chunk) => useAi.getState().handleChunk(chunk))
  const offProgress = window.api.onAiInstallProgress((p) => useAi.getState().handleProgress(p))
  return () => {
    offChunk()
    offProgress()
  }
}
