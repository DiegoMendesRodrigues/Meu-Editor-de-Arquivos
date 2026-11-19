import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import { z } from 'zod'
import { IpcChannels, type FolderEntry, type FolderInfo } from '@shared/ipc'
import { assertAuthorized, authorizeRoot } from './access'
import { handle } from './secure'

/** Limite de itens listados por pasta, para não travar a interface em diretórios enormes. */
const MAX_ENTRIES = 5000

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

export function registerFolderHandlers(): void {
  handle(IpcChannels.openFolder, async (e): Promise<FolderInfo | null> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = { title: 'Abrir pasta', properties: ['openDirectory'] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    authorizeRoot(path)
    return { path, name: basename(path) || path }
  })

  handle(IpcChannels.listFolder, async (_e, raw: unknown): Promise<FolderEntry[]> => {
    const dir = await assertAuthorized(z.string().min(1).parse(raw))
    const dirents = (await readdir(dir, { withFileTypes: true })).slice(0, MAX_ENTRIES)
    const entries = await Promise.all(
      dirents.map(async (d): Promise<FolderEntry | null> => {
        const path = join(dir, d.name)
        let isDirectory = d.isDirectory()
        if (d.isSymbolicLink()) {
          try {
            isDirectory = (await stat(path)).isDirectory()
          } catch {
            return null // link quebrado
          }
        }
        return { name: d.name, path, isDirectory }
      })
    )
    return entries
      .filter((x): x is FolderEntry => x !== null)
      .sort((a, b) => (a.isDirectory === b.isDirectory ? collator.compare(a.name, b.name) : a.isDirectory ? -1 : 1))
  })
}
