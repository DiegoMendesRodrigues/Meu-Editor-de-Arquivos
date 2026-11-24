// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Controle da thread dos testes (separado do index.ts para ser testável sem o `?nodeWorker`). */
import type { Assertion, Extraction } from '@shared/api/schema'
import type { AssertionResult } from '@shared/api/protocol'
import type { ResponseForAssertions } from './evaluate'

export interface WorkerIn {
  tests: Assertion[]
  extract: Extraction[]
  response: ResponseForAssertions
}
export type WorkerOut = { kind: 'test'; result: AssertionResult } | { kind: 'extract'; index: number; value: string | undefined } | { kind: 'done' }

/** O mínimo que o runner usa de um worker_thread. */
export interface WorkerLike {
  postMessage(msg: WorkerIn): void
  terminate(): Promise<number> | void
  on(event: 'message', fn: (msg: WorkerOut) => void): unknown
  on(event: 'error', fn: (err: Error) => void): unknown
}

export interface EvaluationResult {
  tests: AssertionResult[]
  extracted: (string | undefined)[]
}

/** Roda a avaliação na thread; no tempo limite, as asserções pendentes viram erro 'timeout'. */
export function runInWorker(createWorker: () => WorkerLike, input: WorkerIn, timeoutMs: number): Promise<EvaluationResult> {
  return new Promise((resolve) => {
    const tests = new Map<number, AssertionResult>()
    const extracted = new Map<number, string | undefined>()
    const worker = createWorker()
    let settled = false
    const finish = (failCode?: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      resolve({
        tests: input.tests.map((_t, index) => tests.get(index) ?? { index, passed: false, error: failCode ?? 'timeout' }),
        extracted: input.extract.map((_x, index) => extracted.get(index))
      })
    }
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    worker.on('message', (msg) => {
      if (msg.kind === 'test') tests.set(msg.result.index, msg.result)
      else if (msg.kind === 'extract') extracted.set(msg.index, msg.value)
      else finish()
    })
    worker.on('error', () => finish('evalFailed'))
    worker.postMessage(input)
  })
}
