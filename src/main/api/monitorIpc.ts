// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Canais dos monitores (fase 5): api:monitor-list, -save, -delete, -run-now e o evento api:monitor-event
 * (para todas as janelas). Os monitores habilitados voltam a rodar quando o app abre; só rodam com o app aberto.
 */
import { join } from 'node:path'
import { app, BrowserWindow, Notification } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels } from '@shared/ipc'
import type { ApiMonitorEvent, ApiMonitorSaveResult } from '@shared/api/protocol'
import { handle } from '../ipc/secure'
import { isAuthorized, isInside } from '../ipc/access'
import { tm } from '../i18n'
import { createFileStore, createMonitorService, type MonitorService } from './monitor'
import { executeMonitor } from './monitorRunner'

let service: MonitorService | null = null

function getService(): MonitorService {
  return (service ??= createMonitorService({
    store: createFileStore(join(app.getPath('userData'), 'api-monitors.json'), (m) => log.warn(m)),
    execute: executeMonitor,
    isAuthorized,
    isInsideDir: isInside,
    notify: (monitor, notice, run) => {
      if (!Notification.isSupported()) return
      const failed = notice === 'failed'
      new Notification({
        title: tm(failed ? 'apiClient.monitor.notify.failedTitle' : 'apiClient.monitor.notify.recoveredTitle'),
        body: tm(failed ? 'apiClient.monitor.notify.failedBody' : 'apiClient.monitor.notify.recoveredBody', {
          name: monitor.name,
          failed: run.failed,
          errors: run.errors
        })
      }).show()
    },
    emit: (state) => {
      const event: ApiMonitorEvent = { monitor: state }
      for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed() && !w.webContents.isDestroyed()) w.webContents.send(IpcChannels.apiMonitorEvent, event)
    },
    // Só o id e o resultado: nada de URL, nome ou conteúdo.
    log: (id, run) => log.info(`Monitor ${id}: ${run.ok ? 'ok' : 'falha'} (testes ${run.failed} falhos, erros de rede ${run.errors})`)
  }))
}

const idSchema = z.string().uuid()

export function registerMonitorHandlers(): void {
  const svc = getService()
  handle(IpcChannels.apiMonitorList, () => svc.list())
  handle(IpcChannels.apiMonitorSave, (_e, raw: unknown): Promise<ApiMonitorSaveResult> => svc.save(raw))
  handle(IpcChannels.apiMonitorDelete, (_e, raw: unknown) => svc.remove(idSchema.parse(raw)))
  handle(IpcChannels.apiMonitorRunNow, (_e, raw: unknown) => {
    // Roda já, em segundo plano: o Renderer acompanha pelo evento.
    void svc.runNow(idSchema.parse(raw))
  })
  void svc.start()
  app.once('before-quit', () => svc.stop())
}
