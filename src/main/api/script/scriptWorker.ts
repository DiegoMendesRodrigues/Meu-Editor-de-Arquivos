// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Thread de um script (uma por execução): recebe a entrada, roda no sandbox QuickJS e devolve o resultado.
 * O Main encerra a thread se o tempo de parede passar (CPU + folga), mesmo que o QuickJS não responda.
 * pm.sendRequest passa pelo Main: a thread pede por mensagem e espera a resposta (a rede fica fora daqui).
 */
import { parentPort } from 'node:worker_threads'
import { runScriptCore } from './core'
import type { ScriptInput, ScriptNetReply, ScriptOutput } from './types'

const waiting = new Map<number, (json: string) => void>()
let nextId = 0

const send = (json: string): Promise<string> =>
  new Promise((resolve) => {
    const id = ++nextId
    waiting.set(id, resolve)
    parentPort?.postMessage({ netRequest: id, json })
  })

parentPort?.on('message', (msg: ScriptInput | ScriptNetReply) => {
  if ('netReply' in msg) {
    const done = waiting.get(msg.netReply)
    waiting.delete(msg.netReply)
    done?.(msg.json)
    return
  }
  void runScriptCore(msg, { send })
    .catch((): ScriptOutput => ({ ok: false, error: 'scriptError', logs: [], tests: [], envSets: [], varSets: [], secretsRead: [] }))
    .then((out) => parentPort?.postMessage(out))
})
