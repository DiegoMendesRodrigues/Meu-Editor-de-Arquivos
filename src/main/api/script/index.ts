// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { API_LIMITS } from '@shared/api/limits'
import createScriptWorker from './scriptWorker?nodeWorker'
import { maskOutput } from './mask'
import { runInWorker } from './runner'
import type { ScriptInput, ScriptOutput, ScriptWorkerLike } from './types'

export { maskOutput, maskText } from './mask'
export type { ScriptInput, ScriptOutput, ScriptPhase, ScriptErrorCode } from './types'

/** Folga do tempo de parede sobre o tempo de CPU: carregar o WebAssembly e coletar o resultado. */
const WALL_SLACK_MS = 4000

/**
 * Roda um script numa thread nova (sandbox QuickJS) com tempo limite. O tempo de CPU vem em
 * `input.cpuMs`; a thread é encerrada se passar disso mais uma folga.
 */
export function runScript(input: ScriptInput): Promise<ScriptOutput> {
  const cpuMs = Math.min(Math.max(input.cpuMs, 1), API_LIMITS.scriptCpuMaxMs)
  const secrets = input.secretNames.map((n) => input.values[n]).filter((v): v is string => typeof v === 'string')
  return runInWorker(
    () => createScriptWorker({ resourceLimits: { maxOldGenerationSizeMb: 192 } }) as unknown as ScriptWorkerLike,
    { ...input, cpuMs },
    cpuMs + WALL_SLACK_MS
  ).then((out) => maskOutput(out, [...secrets, ...out.envSets.filter((e) => e.secret).map((e) => e.value)]))
}
