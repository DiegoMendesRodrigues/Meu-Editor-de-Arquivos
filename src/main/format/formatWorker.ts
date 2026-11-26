// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Auto formatação numa thread separada (worker_threads): um arquivo grande ou um formatador lento
 * não trava o processo principal, que encerra a thread se passar do tempo limite.
 */
import { parentPort } from 'node:worker_threads'
import { formatSource } from './formatters'

parentPort?.on('message', (req: { language: string; extension: string; text: string }) => {
  formatSource(req.language, req.extension, req.text).then(
    (result) => parentPort!.postMessage({ ok: true, result }),
    (err: unknown) => parentPort!.postMessage({ ok: false, message: (err as Error).message })
  )
})
