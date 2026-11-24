// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Controle da thread do script (separado do index.ts para ser testável sem o `?nodeWorker`). */
import { API_LIMITS } from '@shared/api/limits'
import type { ScriptErrorCode, ScriptInput, ScriptNetRequest, ScriptOutput, ScriptSendFn, ScriptWorkerLike } from './types'

const failed = (error: ScriptErrorCode): ScriptOutput => ({
  ok: false,
  error,
  logs: [{ level: 'error', text: error === 'scriptTimeout' ? 'script: execution time limit exceeded' : error === 'scriptMemory' ? 'script: memory limit exceeded' : 'script: internal error' }],
  tests: [],
  envSets: [],
  varSets: [],
  secretsRead: []
})

const sendFailed = JSON.stringify({ ok: false, code: 'unknown' })

/**
 * Roda o script na thread; passou do tempo de parede, a thread é encerrada e o resultado é scriptTimeout.
 * Com `net`, a thread pode pedir pm.sendRequest: cada pedido amplia o prazo de parede pelo tempo limite
 * da chamada (a rede não conta como CPU), até um teto de `scriptSendRequests` chamadas.
 */
export function runInWorker(createWorker: () => ScriptWorkerLike, input: ScriptInput, wallMs: number, net?: ScriptSendFn, sendWallMs: number = API_LIMITS.scriptSendTimeoutMs): Promise<ScriptOutput> {
  return new Promise((resolve) => {
    let settled = false
    let worker: ScriptWorkerLike | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let deadline = Date.now() + wallMs
    const ceiling = deadline + API_LIMITS.scriptSendRequests * sendWallMs
    const finish = (out: ScriptOutput): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        void worker?.terminate()
      } catch {
        /* a thread já terminou */
      }
      resolve(out)
    }
    const arm = (): void => {
      clearTimeout(timer)
      timer = setTimeout(() => finish(failed('scriptTimeout')), Math.max(0, deadline - Date.now()))
    }
    arm()
    try {
      worker = createWorker()
    } catch {
      return finish(failed('scriptError'))
    }
    const onNet = (msg: ScriptNetRequest): void => {
      deadline = Math.min(deadline + sendWallMs, ceiling)
      arm()
      void (net ? net(msg.json) : Promise.resolve(sendFailed))
        .catch(() => sendFailed)
        .then((json) => {
          if (!settled) worker?.postMessage({ netReply: msg.netRequest, json })
        })
    }
    worker.on('message', (msg) => ('netRequest' in msg ? onNet(msg) : finish(msg)))
    worker.on('error', (err) => finish(failed(/ERR_WORKER_OUT_OF_MEMORY|out of memory/i.test(`${(err as NodeJS.ErrnoException).code ?? ''} ${err.message}`) ? 'scriptMemory' : 'scriptError')))
    worker.on('exit', () => finish(failed('scriptError')))
    worker.postMessage(input)
  })
}
