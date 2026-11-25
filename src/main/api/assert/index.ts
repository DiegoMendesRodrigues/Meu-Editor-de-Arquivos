// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { Assertion, Extraction } from '@shared/api/schema'
import { API_LIMITS } from '@shared/api/limits'
import createAssertWorker from './assertWorker?nodeWorker'
import { runInWorker, type EvaluationResult, type WorkerLike } from './runner'
import type { ResponseForAssertions } from './evaluate'

export type { ResponseForAssertions } from './evaluate'
export type { EvaluationResult } from './runner'

/**
 * Avalia testes e extrações numa thread com tempo limite (API_LIMITS.assertTimeoutMs).
 * No tempo limite, as asserções pendentes voltam com error 'timeout'.
 */
export async function evaluateResponse(tests: Assertion[], extract: Extraction[], response: ResponseForAssertions): Promise<EvaluationResult> {
  if (tests.length === 0 && extract.length === 0) return { tests: [], extracted: [] }
  return runInWorker(() => createAssertWorker({ resourceLimits: { maxOldGenerationSizeMb: 256 } }) as unknown as WorkerLike, { tests, extract, response }, API_LIMITS.assertTimeoutMs)
}
