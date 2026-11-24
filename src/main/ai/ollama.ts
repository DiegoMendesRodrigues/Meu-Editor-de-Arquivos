// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { AI_LIMITS, type AiErrorCode, type AiMessage, type AiSettings, type AiStatus } from '@shared/ai'

/**
 * Cliente da API local do Ollama. Toda a rede da IA fica aqui no Main. Por padrão só aceita endereços de
 * loopback; um servidor em outro computador exige a opção explícita do usuário. Nunca devolve a mensagem
 * crua do servidor: só códigos conhecidos.
 */

export interface OllamaTimeouts {
  /** Tempo para o servidor começar a responder (cabeçalhos). */
  connectMs: number
  /** Tempo máximo sem receber nada durante o stream (o primeiro pedaço pode demorar: o modelo é carregado). */
  idleMs: number
}

export const DEFAULT_TIMEOUTS: OllamaTimeouts = { connectMs: 10_000, idleMs: 120_000 }

/** Linha NDJSON maior que isso indica um servidor estranho. */
const MAX_LINE_CHARS = 2 * 1024 * 1024
const MAX_MODELS = 500
/** Janela de contexto pedida ao modelo (o padrão do Ollama, 2048 a 4096 tokens, corta documentos médios). */
const NUM_CTX = 8192

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])

export type HostCheck = { ok: true; origin: string } | { ok: false; code: AiErrorCode }

/** Valida o endereço: só http/https, sem credenciais, e loopback a menos que o servidor remoto esteja liberado. */
export function checkHost(raw: string, allowRemote: boolean): HostCheck {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, code: 'invalidSettings' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, code: 'invalidSettings' }
  if (url.username !== '' || url.password !== '') return { ok: false, code: 'invalidSettings' }
  if (!allowRemote && !LOOPBACK.has(url.hostname.toLowerCase())) return { ok: false, code: 'hostNotAllowed' }
  return { ok: true, origin: url.origin }
}

class OllamaError extends Error {
  constructor(readonly code: AiErrorCode) {
    super(code)
  }
}

interface Ctl {
  controller: AbortController
  timedOut: () => boolean
  fireTimeout: () => void
  dispose: () => void
}

/** Liga o sinal do chamador a um controlador próprio e lembra se o aborto foi por tempo esgotado. */
function makeController(outer?: AbortSignal): Ctl {
  const controller = new AbortController()
  let timedOut = false
  const onAbort = (): void => controller.abort()
  if (outer) {
    if (outer.aborted) controller.abort()
    else outer.addEventListener('abort', onAbort, { once: true })
  }
  return {
    controller,
    timedOut: () => timedOut,
    fireTimeout: () => {
      timedOut = true
      controller.abort()
    },
    dispose: () => outer?.removeEventListener('abort', onAbort)
  }
}

async function open(
  origin: string,
  path: string,
  init: RequestInit,
  timeouts: OllamaTimeouts,
  outer: AbortSignal | undefined
): Promise<{ res: Response; ctl: Ctl }> {
  const ctl = makeController(outer)
  const timer = setTimeout(ctl.fireTimeout, timeouts.connectMs)
  try {
    // redirect: 'error' impede que um servidor mande o app para outro endereço (fora da checagem de loopback).
    const res = await fetch(origin + path, { ...init, signal: ctl.controller.signal, redirect: 'error' })
    return { res, ctl }
  } catch (err) {
    ctl.dispose()
    if (ctl.timedOut()) throw new OllamaError('timeout')
    if (outer?.aborted) throw err
    throw new OllamaError('ollamaNotRunning')
  } finally {
    clearTimeout(timer)
  }
}

async function getJson(origin: string, path: string, timeouts: OllamaTimeouts): Promise<unknown> {
  const { res, ctl } = await open(origin, path, { method: 'GET' }, timeouts, undefined)
  // O corpo de /api/version e /api/tags é pequeno; o mesmo tempo limita a leitura.
  const timer = setTimeout(ctl.fireTimeout, timeouts.connectMs)
  try {
    if (!res.ok) throw new OllamaError('unknown')
    return await res.json()
  } catch (err) {
    if (err instanceof OllamaError) throw err
    throw new OllamaError(ctl.timedOut() ? 'timeout' : 'unknown')
  } finally {
    clearTimeout(timer)
    ctl.dispose()
  }
}

const asRecord = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {})

/** O Ollama responde? Versão (GET /api/version) e modelos instalados (GET /api/tags). */
export async function getStatus(settings: AiSettings, timeouts: OllamaTimeouts = DEFAULT_TIMEOUTS): Promise<AiStatus> {
  const host = checkHost(settings.host, settings.allowRemote)
  if (!host.ok) return { ok: false, models: [], code: host.code }
  try {
    const version = asRecord(await getJson(host.origin, '/api/version', timeouts))['version']
    const tags = asRecord(await getJson(host.origin, '/api/tags', timeouts))['models']
    const models = (Array.isArray(tags) ? tags : [])
      .map((m) => asRecord(m)['name'])
      .filter((n): n is string => typeof n === 'string' && n !== '' && n.length <= AI_LIMITS.modelChars)
      .slice(0, MAX_MODELS)
    return { ok: true, version: typeof version === 'string' ? version.slice(0, 40) : undefined, models }
  } catch (err) {
    return { ok: false, models: [], code: err instanceof OllamaError ? err.code : 'unknown' }
  }
}

export type ChatOutcome = { ok: true } | { ok: false; code: AiErrorCode }

/**
 * Faz uma geração com streaming (POST /api/chat) e entrega cada pedaço de texto em `onText`.
 * Cancelar o `signal` encerra sem erro (o chamador sabe que cancelou).
 */
export async function streamChat(
  settings: AiSettings,
  messages: AiMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
  timeouts: OllamaTimeouts = DEFAULT_TIMEOUTS
): Promise<ChatOutcome> {
  const host = checkHost(settings.host, settings.allowRemote)
  if (!host.ok) return { ok: false, code: host.code }
  if (settings.model.trim() === '') return { ok: false, code: 'modelNotFound' }
  let opened: { res: Response; ctl: Ctl }
  try {
    opened = await open(
      host.origin,
      '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: settings.model, messages, stream: true, options: { temperature: settings.temperature, num_ctx: NUM_CTX } })
      },
      timeouts,
      signal
    )
  } catch (err) {
    if (signal.aborted) return { ok: true }
    return { ok: false, code: err instanceof OllamaError ? err.code : 'unknown' }
  }
  const { res, ctl } = opened
  let idle: ReturnType<typeof setTimeout> | undefined
  const armIdle = (): void => {
    clearTimeout(idle)
    idle = setTimeout(ctl.fireTimeout, timeouts.idleMs)
  }
  try {
    if (res.status === 404) return { ok: false, code: 'modelNotFound' }
    if (!res.ok || !res.body) return { ok: false, code: 'unknown' }
    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let total = 0
    let finished = false
    /** Processa uma linha NDJSON. Devolve um código se o servidor reportou erro. */
    const handleLine = (line: string): AiErrorCode | null => {
      if (line.trim() === '') return null
      let obj: Record<string, unknown>
      try {
        obj = asRecord(JSON.parse(line))
      } catch {
        return 'unknown'
      }
      if (typeof obj['error'] === 'string') return /not found/i.test(obj['error']) ? 'modelNotFound' : 'unknown'
      const content = asRecord(obj['message'])['content']
      if (typeof content === 'string' && content !== '') {
        total += content.length
        if (total > AI_LIMITS.responseChars) return 'tooLarge'
        onText(content)
      }
      if (obj['done'] === true) finished = true
      return null
    }
    armIdle()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      armIdle()
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const code = handleLine(buffer.slice(0, nl))
        buffer = buffer.slice(nl + 1)
        if (code) {
          await reader.cancel().catch(() => undefined)
          return { ok: false, code }
        }
      }
      if (buffer.length > MAX_LINE_CHARS) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, code: 'unknown' }
      }
    }
    buffer += decoder.decode()
    const last = handleLine(buffer)
    if (last) return { ok: false, code: last }
    // Fluxo encerrado sem "done": o servidor caiu no meio da resposta.
    return finished ? { ok: true } : { ok: false, code: 'unknown' }
  } catch {
    if (signal.aborted) return { ok: true }
    return { ok: false, code: ctl.timedOut() ? 'timeout' : 'unknown' }
  } finally {
    clearTimeout(idle)
    ctl.dispose()
  }
}
