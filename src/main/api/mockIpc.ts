// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Canais do servidor mock (fase 4): api:mock-start, api:mock-stop e o evento api:mock-log.
 * O registro das chamadas vai só para o webContents dono; só o dono para. Os servidores terminam
 * quando a janela fecha ou recarrega.
 */
import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels } from '@shared/ipc'
import { API_LIMITS } from '@shared/api/limits'
import { mockStartInputSchema, type ApiMockStartResult } from '@shared/api/protocol'
import { handle } from '../ipc/secure'
import { startMockServer } from './mock'

interface ActiveMock {
  owner: WebContents
  stop: () => void
}

const mocks = new Map<string, ActiveMock>()
const watched = new WeakSet<WebContents>()

/** A janela fechou ou recarregou: os servidores dela param. */
function watchOwner(owner: WebContents): void {
  if (watched.has(owner)) return
  watched.add(owner)
  const stopOwned = (): void => {
    for (const [id, m] of mocks) {
      if (m.owner !== owner) continue
      m.stop()
      mocks.delete(id)
    }
  }
  owner.once('destroyed', stopOwned)
  owner.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) stopOwned()
  })
}

export function registerMockHandlers(): void {
  handle(IpcChannels.apiMockStart, async (e, raw: unknown): Promise<ApiMockStartResult> => {
    const parsed = mockStartInputSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'invalid' }
    const input = parsed.data
    const owner = e.sender
    let active = 0
    for (const m of mocks.values()) if (m.owner === owner) active++
    if (active >= API_LIMITS.mocks) return { ok: false, code: 'tooManyMocks' }

    const mockId = randomUUID()
    const started = await startMockServer({
      routes: input.routes,
      port: input.port,
      lan: input.lan,
      maxBodyBytes: API_LIMITS.mockBodyBytes,
      maxConnections: API_LIMITS.mockConnections,
      idleMs: API_LIMITS.mockIdleMs,
      onLog: (entry) => {
        if (!owner.isDestroyed()) owner.send(IpcChannels.apiMockLog, { mockId, ...entry })
      },
      onIdle: () => {
        mocks.delete(mockId)
        log.info('Servidor mock parou por inatividade')
        if (!owner.isDestroyed()) {
          owner.send(IpcChannels.apiMockLog, { mockId, at: new Date().toISOString(), method: '', path: '', status: 0, timeMs: 0, stopped: true })
        }
      }
    })
    if (!started.ok) return { ok: false, code: started.code }
    // A janela fechou durante a subida: não deixa o servidor órfão.
    if (owner.isDestroyed()) {
      started.stop()
      return { ok: false, code: 'unknown' }
    }

    watchOwner(owner)
    mocks.set(mockId, { owner, stop: started.stop })
    // Só porta e quantidade de rotas: nada de caminhos, cabeçalhos ou corpos.
    log.info(`Servidor mock iniciado na porta ${started.port} com ${input.routes.length} rotas`)
    return { ok: true, mockId, port: started.port, url: started.url }
  })

  handle(IpcChannels.apiMockStop, (e, raw: unknown): void => {
    const id = z.string().uuid().parse(raw)
    const m = mocks.get(id)
    if (!m || m.owner !== e.sender) return
    m.stop()
    mocks.delete(id)
  })
}
