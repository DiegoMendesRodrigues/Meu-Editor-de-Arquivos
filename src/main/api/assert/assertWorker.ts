// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Thread dos testes da resposta: regex e JSONPath sobre corpos grandes podem demorar,
 * então rodam aqui e o Main encerra a thread se passar do tempo limite.
 * Cada resultado é enviado assim que fica pronto, para o Main saber o que ficou pendente.
 */
import { parentPort } from 'node:worker_threads'
import { evaluateAssertion, evaluateExtraction, makeCtx } from './evaluate'
import type { WorkerIn, WorkerOut } from './runner'

parentPort?.on('message', (req: WorkerIn) => {
  const send = (msg: WorkerOut): void => parentPort?.postMessage(msg)
  const ctx = makeCtx(req.response)
  req.tests.forEach((t, index) => send({ kind: 'test', result: evaluateAssertion(index, t, ctx) }))
  req.extract.forEach((x, index) => send({ kind: 'extract', index, value: evaluateExtraction(x, ctx) }))
  send({ kind: 'done' })
})
