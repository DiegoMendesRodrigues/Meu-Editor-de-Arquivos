// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { BrowserWindow, dialog, type IpcMainInvokeEvent } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels, type OpenedFile, type SavedFile, type UnsavedChoice } from '@shared/ipc'
import { decodeText, encodeText } from './textCodec'
import { assertAuthorized, authorizeFile } from './access'
import { addRecent } from './recent'
import { stopWatching, watchFile } from '../watcher'
import { tm } from '../i18n'
import { handle } from './secure'

/** Acima deste tamanho o arquivo não é aberto (o suporte a arquivos grandes vem depois). */
const MAX_OPEN_BYTES = 50 * 1024 * 1024

const encodingSchema = z.enum(['UTF-8', 'UTF-8 BOM'])
const pathSchema = z.string().min(1)
const saveSchema = z.object({ path: pathSchema, content: z.string(), encoding: encodingSchema })
const saveAsSchema = z.object({ suggestedName: z.string().max(1024), content: z.string(), encoding: encodingSchema })

const filters = (): Electron.FileFilter[] => [
  { name: tm('dlg.filter.all'), extensions: ['*'] },
  { name: 'Markdown', extensions: ['md', 'markdown'] },
  { name: tm('lang.plaintext'), extensions: ['txt', 'log'] },
  { name: tm('dlg.filter.data'), extensions: ['json', 'csv', 'yaml', 'yml', 'toml', 'ini', 'xml', 'sql'] }
]

const ownerWindow = (e: IpcMainInvokeEvent): BrowserWindow | undefined =>
  BrowserWindow.fromWebContents(e.sender) ?? undefined

async function readOne(path: string): Promise<OpenedFile> {
  const info = await stat(path)
  if (info.isDirectory()) throw new Error(tm('err.isFolder', { name: basename(path) }))
  if (info.size > MAX_OPEN_BYTES) {
    throw new Error(tm('err.tooBig', { name: basename(path) }))
  }
  const decoded = decodeText(await readFile(path))
  authorizeFile(path)
  addRecent(path)
  watchFile(path, info.mtimeMs)
  return { path, name: basename(path), size: info.size, ...decoded }
}

async function writeOne(path: string, content: string, encoding: 'UTF-8' | 'UTF-8 BOM'): Promise<SavedFile> {
  const data = encodeText(content, encoding)
  await writeFile(path, data)
  // Registra a nova data de modificação para não confundir a própria gravação com uma alteração externa.
  watchFile(path, (await stat(path)).mtimeMs)
  addRecent(path)
  log.info(`Arquivo salvo: ${path}`)
  return { path, name: basename(path), size: data.length }
}

async function messageBox(e: IpcMainInvokeEvent, options: Electron.MessageBoxOptions): Promise<number> {
  const win = ownerWindow(e)
  const result = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
  return result.response
}

export function registerFileHandlers(): void {
  handle(IpcChannels.openFiles, async (e): Promise<OpenedFile[]> => {
    const win = ownerWindow(e)
    const options: Electron.OpenDialogOptions = {
      title: tm('dlg.openFiles'),
      properties: ['openFile', 'multiSelections'],
      filters: filters()
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled) return []
    return Promise.all(result.filePaths.map(readOne))
  })

  // Arquivos soltos na janela: o usuário escolheu cada um ao arrastar (como no diálogo de abrir).
  handle(IpcChannels.openDropped, async (_e, raw: unknown) => {
    const paths = z.array(pathSchema.max(4096)).max(100).parse(raw)
    const opened: OpenedFile[] = []
    const failed: string[] = []
    for (const p of paths) {
      try {
        opened.push(await readOne(resolve(p)))
      } catch (err) {
        log.warn(`Arquivo solto não aberto: ${resolve(p)}: ${String(err)}`)
        failed.push(basename(p))
      }
    }
    return { opened, failed }
  })

  handle(IpcChannels.readFile, async (_e, raw: unknown): Promise<OpenedFile> => {
    return readOne(await assertAuthorized(pathSchema.parse(raw)))
  })

  handle(IpcChannels.saveFile, async (_e, raw: unknown): Promise<SavedFile> => {
    const req = saveSchema.parse(raw)
    const target = await assertAuthorized(req.path).catch(() => {
      log.warn(`Gravação recusada em caminho não autorizado: ${resolve(req.path)}`)
      throw new Error(tm('err.saveNotAuthorized'))
    })
    return writeOne(target, req.content, req.encoding)
  })

  handle(IpcChannels.saveFileAs, async (e, raw: unknown): Promise<SavedFile | null> => {
    const req = saveAsSchema.parse(raw)
    const win = ownerWindow(e)
    const options: Electron.SaveDialogOptions = {
      title: tm('dlg.saveAs'),
      defaultPath: req.suggestedName || 'untitled.md',
      filters: filters()
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    authorizeFile(result.filePath)
    return writeOne(resolve(result.filePath), req.content, req.encoding)
  })

  handle(IpcChannels.unwatchFile, (_e, raw: unknown) => stopWatching(resolve(pathSchema.parse(raw))))

  handle(IpcChannels.confirmUnsaved, async (e, raw: unknown): Promise<UnsavedChoice> => {
    const names = z.array(z.string()).parse(raw)
    const single = names.length === 1
    const response = await messageBox(e, {
      type: 'warning',
      title: tm('dlg.unsaved.title'),
      message: single ? tm('dlg.unsaved.single', { name: names[0] }) : tm('dlg.unsaved.many', { n: names.length }),
      detail: (single ? '' : names.map((n) => `• ${n}`).join('\n') + '\n\n') + tm('dlg.unsaved.detail'),
      buttons: [single ? tm('common.save') : tm('menu.file.saveAll'), tm('dlg.unsaved.discard'), tm('common.cancel')],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    return (['save', 'discard', 'cancel'] as const)[response] ?? 'cancel'
  })

  handle(IpcChannels.confirmReload, async (e, raw: unknown): Promise<boolean> => {
    const name = z.string().parse(raw)
    const response = await messageBox(e, {
      type: 'question',
      title: tm('dlg.reload.title'),
      message: tm('dlg.reload.message', { name }),
      detail: tm('dlg.reload.detail'),
      buttons: [tm('dlg.reload.keep'), tm('dlg.reload.reload')],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    return response === 1
  })
}
