// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { WebContents } from 'electron'
import log from 'electron-log/main'
import { AI_LIMITS, aiChatInputSchema, type AiChatResult, type AiChunk, type AiErrorCode, type AiSettings } from '@shared/ai'
import { IpcChannels } from '@shared/ipc'
import { DEFAULT_TIMEOUTS, streamChat, type OllamaTimeouts } from './ollama'

/**
 * Gerações em andamento. Cada uma pertence a uma janela (o `owner`), que recebe os pedaços por aiChunk.
 * No máximo AI_LIMITS.generations por janela; tudo é cancelado quando a janela fecha ou recarrega.
 */

interface Generation {
  owner: WebContents
  controller: AbortController
}

const running = new Map<string, Generation>()
const watched = new WeakSet<WebContents>()

const countOf = (owner: WebContents): number => [...running.values()].filter((g) => g.owner === owner).length

function emit(owner: WebContents, chunk: AiChunk): void {
  if (!owner.isDestroyed()) owner.send(IpcChannels.aiChunk, chunk)
}

/** Cancela todas as gerações da janela (ao fechar ou recarregar). */
export function cancelOwned(owner: WebContents): void {
  for (const [id, g] of running) {
    if (g.owner !== owner) continue
    running.delete(id)
    g.controller.abort()
  }
}

function watchOwner(owner: WebContents): void {
  if (watched.has(owner)) return
  watched.add(owner)
  owner.once('destroyed', () => cancelOwned(owner))
  owner.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) cancelOwned(owner)
  })
}

/** Só quem iniciou a geração cancela. */
export function cancelChat(owner: WebContents, id: unknown): void {
  if (typeof id !== 'string') return
  const g = running.get(id)
  if (g && g.owner === owner) {
    running.delete(id)
    g.controller.abort()
    emit(owner, { id, text: '', done: true })
  }
}

/**
 * Valida e inicia uma geração. Devolve na hora se o pedido foi aceito; o texto chega depois por aiChunk
 * (com `code` se falhar no meio). O conteúdo das mensagens nunca vai para o log.
 */
export function startChat(owner: WebContents, raw: unknown, settings: AiSettings, timeouts: OllamaTimeouts = DEFAULT_TIMEOUTS): AiChatResult {
  const parsed = aiChatInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, code: 'unknown' }
  const { id, messages } = parsed.data
  const chars = messages.reduce((n, m) => n + m.content.length, 0)
  if (chars > AI_LIMITS.contextChars) return { ok: false, code: 'tooLarge' }
  if (running.has(id) || countOf(owner) >= AI_LIMITS.generations) return { ok: false, code: 'tooManyGenerations' }
  watchOwner(owner)

  const controller = new AbortController()
  running.set(id, { owner, controller })
  log.info(`IA: geração iniciada (modelo ${settings.model.slice(0, 80)}, ${chars} caracteres)`)
  void streamChat(settings, messages, (text) => emit(owner, { id, text, done: false }), controller.signal, timeouts).then((outcome) => {
    // Se já foi removida, foi cancelada (cancelChat ou cancelOwned) e o evento final já saiu.
    if (running.get(id)?.controller !== controller) return
    running.delete(id)
    const code: AiErrorCode | undefined = outcome.ok ? undefined : outcome.code
    if (code) log.warn(`IA: geração falhou (${code})`)
    emit(owner, { id, text: '', done: true, ...(code ? { code } : {}) })
  })
  return { ok: true }
}
