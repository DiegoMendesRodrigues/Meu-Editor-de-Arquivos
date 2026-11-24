// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Thread de um script (uma por execução): recebe a entrada, roda no sandbox QuickJS e devolve o resultado.
 * O Main encerra a thread se o tempo de parede passar (CPU + folga), mesmo que o QuickJS não responda.
 */
import { parentPort } from 'node:worker_threads'
import { runScriptCore } from './core'
import type { ScriptInput, ScriptOutput } from './types'

parentPort?.on('message', (input: ScriptInput) => {
  void runScriptCore(input)
    .catch((): ScriptOutput => ({ ok: false, error: 'scriptError', logs: [], tests: [], envSets: [], varSets: [], secretsRead: [] }))
    .then((out) => parentPort?.postMessage(out))
})
