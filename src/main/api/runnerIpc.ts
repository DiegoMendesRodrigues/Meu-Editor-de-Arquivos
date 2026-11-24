// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Canais do Cliente de API: executor de coleção (api:run-start, api:run-cancel, evento api:run-progress).
 * O andamento vai só para o webContents que iniciou; só ele cancela. As execuções terminam quando a
 * janela fecha ou recarrega.
 */
import type { WebContents } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels } from '@shared/ipc'
import { runInputSchema } from '@shared/api/protocol'
import { handle } from '../ipc/secure'
import { expectedExecutions, runCollection } from './runner'

/** No máximo estas execuções ao mesmo tempo por janela. */
const MAX_RUNS_PER_WINDOW = 3

interface ActiveRun {
  owner: WebContents
  controller: AbortController
}

const runs = new Map<string, ActiveRun>()
const watched = new WeakSet<WebContents>()

/** A janela fechou ou recarregou: as execuções dela são encerradas. */
function watchOwner(owner: WebContents): void {
  if (watched.has(owner)) return
  watched.add(owner)
  const abortOwned = (): void => {
    for (const run of runs.values()) if (run.owner === owner) run.controller.abort()
  }
  owner.once('destroyed', abortOwned)
  owner.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) abortOwned()
  })
}

export function registerRunnerHandlers(): void {
  handle(IpcChannels.apiRunStart, (e, raw: unknown): void => {
    const input = runInputSchema.parse(raw)
    // Produção exige a confirmação do usuário (feita na janela do executor).
    if (input.environment?.production && !input.productionConfirmed) throw new Error('productionNotConfirmed')
    if (runs.has(input.runId)) throw new Error('invalidRequest')
    const owner = e.sender
    let active = 0
    for (const r of runs.values()) if (r.owner === owner) active++
    if (active >= MAX_RUNS_PER_WINDOW) throw new Error('tooManyRequests')
    if (expectedExecutions(input) > 1_000_000) throw new Error('invalidRequest')

    watchOwner(owner)
    const controller = new AbortController()
    runs.set(input.runId, { owner, controller })
    // Roda em segundo plano: o Renderer acompanha pelo evento de andamento.
    void runCollection(input, {
      signal: controller.signal,
      onProgress: (progress) => {
        if (!owner.isDestroyed()) owner.send(IpcChannels.apiRunProgress, progress)
      }
    })
      .catch((err: unknown) => {
        log.warn('Executor de coleção falhou:', err instanceof Error ? err.name : 'erro')
        if (!owner.isDestroyed()) {
          owner.send(IpcChannels.apiRunProgress, { runId: input.runId, done: 0, total: 0, finished: true, cancelled: true })
        }
      })
      .finally(() => runs.delete(input.runId))
  })

  handle(IpcChannels.apiRunCancel, (e, raw: unknown): void => {
    const run = runs.get(z.string().uuid().parse(raw))
    if (run && run.owner === e.sender) run.controller.abort()
  })
}
