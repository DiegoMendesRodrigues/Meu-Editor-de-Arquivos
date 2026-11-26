// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readdir, rename, rmdir, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { checkName } from '@shared/fileName'
import { IpcChannels, type FolderEntry, type FolderInfo } from '@shared/ipc'
import { assertAuthorized, authorizeRoot, isAuthorizedRoot, isInside } from './access'
import { renameRecent } from './recent'
import { releaseInside, watchFile } from '../watcher'
import { tm } from '../i18n'
import { handle } from './secure'

/** Limite de itens listados por pasta, para não travar a interface em diretórios enormes. */
const MAX_ENTRIES = 5000

const exists = (p: string): Promise<boolean> => stat(p).then(() => true, () => false)
const sameIgnoringCase = (a: string, b: string): boolean => process.platform === 'win32' && a.toLowerCase() === b.toLowerCase()

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

export function registerFolderHandlers(): void {
  handle(IpcChannels.openFolder, async (e): Promise<FolderInfo | null> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = { title: tm('dlg.openFolder'), properties: ['openDirectory'] }
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

  /**
   * Renomeia um arquivo ou pasta da pasta aberta (só o nome; continua no mesmo lugar).
   * A pasta aberta em si não é renomeada. Arquivos abertos continuam monitorados no novo caminho.
   */
  handle(IpcChannels.renameEntry, async (_e, rawPath: unknown, rawName: unknown): Promise<string> => {
    const path = await assertAuthorized(z.string().min(1).parse(rawPath))
    const name = z.string().max(1024).parse(rawName).trim()
    if (checkName(name)) throw new Error(tm('err.invalidName'))
    if (isAuthorizedRoot(path)) throw new Error(tm('err.renameRoot'))
    const target = join(dirname(path), name)
    if (target === path) return path
    await assertAuthorized(target)
    // No Windows, mudar só maiúsculas/minúsculas é o mesmo arquivo: pode.
    if (!sameIgnoringCase(path, target) && (await exists(target))) throw new Error(tm('err.nameInUse', { name }))
    const released = releaseInside(path, isInside)
    try {
      await rename(path, target)
    } catch (err) {
      released.forEach((w) => watchFile(w.path, w.mtimeMs))
      throw err
    }
    for (const w of released) {
      const next = target + w.path.slice(path.length)
      watchFile(next, await stat(next).then((i) => i.mtimeMs, () => w.mtimeMs))
    }
    renameRecent(path, target)
    log.info(`Renomeado: ${path} -> ${target}`)
    return target
  })

  /** Exclui uma pasta vazia da pasta aberta (a pasta aberta em si não). */
  handle(IpcChannels.deleteEmptyFolder, async (_e, raw: unknown): Promise<void> => {
    const path = await assertAuthorized(z.string().min(1).parse(raw))
    if (isAuthorizedRoot(path)) throw new Error(tm('err.renameRoot'))
    if (!(await stat(path)).isDirectory()) throw new Error(tm('err.notFolder'))
    try {
      await rmdir(path) // não recursivo: falha se houver algo dentro
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOTEMPTY' || code === 'EEXIST') throw new Error(tm('err.folderNotEmpty'))
      throw err
    }
    log.info(`Pasta excluída: ${path}`)
  })
}
