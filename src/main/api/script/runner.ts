// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Controle da thread do script (separado do index.ts para ser testável sem o `?nodeWorker`). */
import type { ScriptErrorCode, ScriptInput, ScriptOutput, ScriptWorkerLike } from './types'

const failed = (error: ScriptErrorCode): ScriptOutput => ({
  ok: false,
  error,
  logs: [{ level: 'error', text: error === 'scriptTimeout' ? 'script: execution time limit exceeded' : error === 'scriptMemory' ? 'script: memory limit exceeded' : 'script: internal error' }],
  tests: [],
  envSets: [],
  varSets: [],
  secretsRead: []
})

/** Roda o script na thread; passou do tempo de parede, a thread é encerrada e o resultado é scriptTimeout. */
export function runInWorker(createWorker: () => ScriptWorkerLike, input: ScriptInput, wallMs: number): Promise<ScriptOutput> {
  return new Promise((resolve) => {
    let settled = false
    let worker: ScriptWorkerLike | undefined
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
    const timer = setTimeout(() => finish(failed('scriptTimeout')), wallMs)
    try {
      worker = createWorker()
    } catch {
      return finish(failed('scriptError'))
    }
    worker.on('message', (msg) => finish(msg))
    worker.on('error', (err) => finish(failed(/ERR_WORKER_OUT_OF_MEMORY|out of memory/i.test(`${(err as NodeJS.ErrnoException).code ?? ''} ${err.message}`) ? 'scriptMemory' : 'scriptError')))
    worker.on('exit', () => finish(failed('scriptError')))
    worker.postMessage(input)
  })
}
