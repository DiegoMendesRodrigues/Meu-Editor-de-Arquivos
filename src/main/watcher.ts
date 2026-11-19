import { watch, type FSWatcher } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { WebContents } from 'electron'
import log from 'electron-log/main'
import { IpcChannels, type FileChange } from '@shared/ipc'

/**
 * Monitora os arquivos abertos e avisa o Renderer quando outro programa os altera.
 * As gravações feitas pelo próprio editor são reconhecidas pela data de modificação
 * e não geram aviso.
 */
interface Watched {
  watcher: FSWatcher | null
  mtimeMs: number
  timer: NodeJS.Timeout | null
}

const watched = new Map<string, Watched>()
let target: WebContents | null = null

export const setWatchTarget = (wc: WebContents | null): void => {
  target = wc
}

function notify(change: FileChange): void {
  if (target && !target.isDestroyed()) target.send(IpcChannels.fileChanged, change)
}

async function check(path: string): Promise<void> {
  const entry = watched.get(path)
  if (!entry) return
  try {
    const info = await stat(path)
    if (info.mtimeMs !== entry.mtimeMs) {
      entry.mtimeMs = info.mtimeMs
      notify({ path, kind: 'changed' })
    }
  } catch {
    notify({ path, kind: 'deleted' })
    stopWatching(path)
    return
  }
  // Muitos programas salvam por "renomear sobre o original", o que encerra o monitor; reinicia.
  if (entry.watcher === null) startWatcher(path, entry)
}

function startWatcher(path: string, entry: Watched): void {
  try {
    entry.watcher = watch(path, { persistent: false }, (event) => {
      if (event === 'rename') {
        entry.watcher?.close()
        entry.watcher = null
      }
      // Agrupa rajadas de eventos de uma mesma gravação.
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(() => void check(path), 200)
    })
    entry.watcher.on('error', () => {
      entry.watcher?.close()
      entry.watcher = null
    })
  } catch (err) {
    log.warn(`Não foi possível monitorar ${path}: ${String(err)}`)
  }
}

/** Começa (ou atualiza) o monitoramento com a data de modificação conhecida. */
export function watchFile(path: string, mtimeMs: number): void {
  const existing = watched.get(path)
  if (existing) {
    existing.mtimeMs = mtimeMs
    if (existing.watcher === null) startWatcher(path, existing)
    return
  }
  const entry: Watched = { watcher: null, mtimeMs, timer: null }
  watched.set(path, entry)
  startWatcher(path, entry)
}

export function stopWatching(path: string): void {
  const entry = watched.get(path)
  if (!entry) return
  entry.watcher?.close()
  if (entry.timer) clearTimeout(entry.timer)
  watched.delete(path)
}
