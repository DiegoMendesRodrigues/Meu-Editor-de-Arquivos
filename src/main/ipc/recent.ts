// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels } from '@shared/ipc'
import { authorizeFile, isInside } from './access'
import { handle } from './secure'

/** Arquivos recentes, guardados em JSON na pasta de dados do usuário. */
const MAX_RECENT = 15
let recent: string[] = []

const storePath = (): string => join(app.getPath('userData'), 'recent-files.json')

export async function loadRecent(): Promise<void> {
  try {
    recent = z.array(z.string()).parse(JSON.parse(await readFile(storePath(), 'utf8'))).slice(0, MAX_RECENT)
  } catch {
    recent = []
  }
  // Estes arquivos já foram escolhidos pelo usuário antes; podem ser reabertos.
  recent.forEach(authorizeFile)
}

async function persist(): Promise<void> {
  try {
    await writeFile(storePath(), JSON.stringify(recent, null, 2), 'utf8')
  } catch (err) {
    log.warn(`Não foi possível gravar os arquivos recentes: ${String(err)}`)
  }
}

const same = (a: string, b: string): boolean =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b

export function addRecent(path: string): void {
  recent = [path, ...recent.filter((p) => !same(p, path))].slice(0, MAX_RECENT)
  void persist()
}

/** Depois de renomear um arquivo ou pasta: os recentes que estavam ali passam para o novo caminho. */
export function renameRecent(oldPath: string, newPath: string): void {
  let changed = false
  recent = recent.map((p) => {
    if (!isInside(oldPath, p)) return p
    changed = true
    const next = newPath + p.slice(oldPath.length)
    authorizeFile(next)
    return next
  })
  if (changed) void persist()
}

export function registerRecentHandlers(): void {
  handle(IpcChannels.recentList, () => recent)
  handle(IpcChannels.recentClear, async () => {
    recent = []
    await persist()
  })
}
