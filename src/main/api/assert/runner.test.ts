// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { Worker } from 'node:worker_threads'
import { describe, expect, it } from 'vitest'
import { assertionSchema, extractionSchema } from '@shared/api/schema'
import { runInWorker, type WorkerLike } from './runner'
import type { ResponseForAssertions } from './evaluate'

const response: ResponseForAssertions = {
  status: 200,
  timeMs: 1,
  sizeBytes: 1,
  headers: [],
  cookies: [],
  body: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!',
  contentType: 'text/plain'
}
const tests = [
  assertionSchema.parse({ target: 'status', op: 'eq', expected: 200 }),
  assertionSchema.parse({ target: 'body', op: 'matches', expected: '^(a+)+$' }),
  assertionSchema.parse({ target: 'status', op: 'exists' })
]
const extract = [extractionSchema.parse({ from: 'regex', path: 'a', to: 'v' })]

// Thread de verdade que responde ao primeiro teste e depois trava numa regex catastrófica,
// como o assertWorker faria. O TS do worker não carrega no Vitest por causa do ?nodeWorker.
const code = `
const { parentPort } = require('node:worker_threads')
parentPort.on('message', (req) => {
  parentPort.postMessage({ kind: 'test', result: { index: 0, passed: true, actual: '200' } })
  new RegExp('^(a+)+$').test(req.response.body)
  parentPort.postMessage({ kind: 'done' })
})`

describe('runInWorker', () => {
  it('no tempo limite encerra a thread e marca as pendentes como timeout', async () => {
    const t0 = Date.now()
    const res = await runInWorker(() => new Worker(code, { eval: true }) as unknown as WorkerLike, { tests, extract, response }, 400)
    expect(Date.now() - t0).toBeLessThan(5000)
    expect(res.tests[0]).toEqual({ index: 0, passed: true, actual: '200' })
    expect(res.tests[1]).toEqual({ index: 1, passed: false, error: 'timeout' })
    expect(res.tests[2].error).toBe('timeout')
    expect(res.extracted).toEqual([undefined])
  })

  it('devolve os resultados quando a thread termina a tempo (worker simulado)', async () => {
    const fake: WorkerLike = {
      postMessage: () => undefined,
      terminate: () => undefined,
      on(event, fn) {
        if (event === 'message') {
          const f = fn as (m: unknown) => void
          setTimeout(() => {
            tests.forEach((_t, index) => f({ kind: 'test', result: { index, passed: true } }))
            f({ kind: 'extract', index: 0, value: 'a' })
            f({ kind: 'done' })
          }, 5)
        }
      }
    }
    const res = await runInWorker(() => fake, { tests, extract, response }, 1000)
    expect(res.tests.every((t) => t.passed)).toBe(true)
    expect(res.extracted).toEqual(['a'])
  })
})
