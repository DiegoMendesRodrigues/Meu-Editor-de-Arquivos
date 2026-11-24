// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { isValidModelName, type AiErrorCode, type AiSettings } from '@shared/ai'
import { asRecord, checkHost, DEFAULT_TIMEOUTS, OllamaError, open, type OllamaTimeouts } from './ollama'

/**
 * Baixar e excluir modelos pela API local do Ollama (mesma regra de host do assistente: loopback, ou o
 * remoto permitido nas configurações). Nunca devolve a mensagem crua do servidor.
 */

/** Um modelo grande pode ficar parado entre camadas; o tempo ocioso é maior que o do chat. */
export const PULL_TIMEOUTS: OllamaTimeouts = { connectMs: 10_000, idleMs: 300_000 }
const MAX_LINE_CHARS = 1024 * 1024

export interface PullProgress {
  status: string
  completed: number
  total: number
}

export type PullOutcome = { ok: true } | { ok: false; code: AiErrorCode }

const notFound = (text: string): boolean => /not found|does not exist|file does not exist/i.test(text)

/** POST /api/pull com stream: true. Cancelar o `signal` encerra com 'cancelled'. */
export async function pullModel(
  settings: AiSettings,
  name: string,
  onProgress: (p: PullProgress) => void,
  signal: AbortSignal,
  timeouts: OllamaTimeouts = PULL_TIMEOUTS
): Promise<PullOutcome> {
  if (!isValidModelName(name)) return { ok: false, code: 'modelNameInvalid' }
  const host = checkHost(settings.host, settings.allowRemote)
  if (!host.ok) return { ok: false, code: host.code }
  let opened: Awaited<ReturnType<typeof open>>
  try {
    opened = await open(host.origin, '/api/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: name, stream: true }) }, timeouts, signal)
  } catch (err) {
    if (signal.aborted) return { ok: false, code: 'cancelled' }
    return { ok: false, code: err instanceof OllamaError ? err.code : 'pullFailed' }
  }
  const { res, ctl } = opened
  let idle: ReturnType<typeof setTimeout> | undefined
  const armIdle = (): void => {
    clearTimeout(idle)
    idle = setTimeout(ctl.fireTimeout, timeouts.idleMs)
  }
  try {
    if (res.status === 404) return { ok: false, code: 'modelNotFound' }
    if (!res.ok || !res.body) return { ok: false, code: 'pullFailed' }
    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let success = false
    const handleLine = (line: string): AiErrorCode | null => {
      if (line.trim() === '') return null
      let obj: Record<string, unknown>
      try {
        obj = asRecord(JSON.parse(line))
      } catch {
        return 'pullFailed'
      }
      if (typeof obj['error'] === 'string') return notFound(obj['error']) ? 'modelNotFound' : 'pullFailed'
      const status = typeof obj['status'] === 'string' ? obj['status'].slice(0, 120) : ''
      const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
      if (status === 'success') success = true
      onProgress({ status, completed: num(obj['completed']), total: num(obj['total']) })
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
        return { ok: false, code: 'pullFailed' }
      }
    }
    buffer += decoder.decode()
    const last = handleLine(buffer)
    if (last) return { ok: false, code: last }
    return success ? { ok: true } : { ok: false, code: 'pullFailed' }
  } catch {
    if (signal.aborted) return { ok: false, code: 'cancelled' }
    return { ok: false, code: ctl.timedOut() ? 'timeout' : 'pullFailed' }
  } finally {
    clearTimeout(idle)
    ctl.dispose()
  }
}

/** DELETE /api/delete. O nome vem da lista de modelos instalados, então só se limita o tamanho. */
export async function deleteModel(settings: AiSettings, name: string, timeouts: OllamaTimeouts = DEFAULT_TIMEOUTS): Promise<PullOutcome> {
  if (name.trim() === '' || name.length > 200) return { ok: false, code: 'modelNameInvalid' }
  const host = checkHost(settings.host, settings.allowRemote)
  if (!host.ok) return { ok: false, code: host.code }
  try {
    const { res, ctl } = await open(host.origin, '/api/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: name }) }, timeouts, undefined)
    ctl.dispose()
    await res.body?.cancel().catch(() => undefined)
    if (res.status === 404) return { ok: false, code: 'modelNotFound' }
    return res.ok ? { ok: true } : { ok: false, code: 'unknown' }
  } catch (err) {
    return { ok: false, code: err instanceof OllamaError ? err.code : 'unknown' }
  }
}
