import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels, type OpenedFile, type SavedFile, type UnsavedChoice } from '@shared/ipc'
import { decodeText, encodeText } from './textCodec'
import { assertAuthorized, authorizeFile } from './access'
import { addRecent } from './recent'
import { stopWatching, watchFile } from '../watcher'

/** Acima deste tamanho o arquivo não é aberto (o suporte a arquivos grandes vem depois). */
const MAX_OPEN_BYTES = 50 * 1024 * 1024

const encodingSchema = z.enum(['UTF-8', 'UTF-8 BOM'])
const pathSchema = z.string().min(1)
const saveSchema = z.object({ path: pathSchema, content: z.string(), encoding: encodingSchema })
const saveAsSchema = z.object({ suggestedName: z.string().max(1024), content: z.string(), encoding: encodingSchema })

const FILTERS: Electron.FileFilter[] = [
  { name: 'Todos os arquivos', extensions: ['*'] },
  { name: 'Markdown', extensions: ['md', 'markdown'] },
  { name: 'Texto', extensions: ['txt', 'log'] },
  { name: 'Dados', extensions: ['json', 'csv', 'yaml', 'yml', 'toml', 'ini', 'xml', 'sql'] }
]

const ownerWindow = (e: IpcMainInvokeEvent): BrowserWindow | undefined =>
  BrowserWindow.fromWebContents(e.sender) ?? undefined

async function readOne(path: string): Promise<OpenedFile> {
  const info = await stat(path)
  if (info.isDirectory()) throw new Error(`${basename(path)} é uma pasta.`)
  if (info.size > MAX_OPEN_BYTES) {
    throw new Error(`O arquivo ${basename(path)} tem mais de 50 MB e ainda não pode ser aberto.`)
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
  ipcMain.handle(IpcChannels.openFiles, async (e): Promise<OpenedFile[]> => {
    const win = ownerWindow(e)
    const options: Electron.OpenDialogOptions = {
      title: 'Abrir arquivos',
      properties: ['openFile', 'multiSelections'],
      filters: FILTERS
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled) return []
    return Promise.all(result.filePaths.map(readOne))
  })

  ipcMain.handle(IpcChannels.readFile, async (_e, raw: unknown): Promise<OpenedFile> => {
    return readOne(await assertAuthorized(pathSchema.parse(raw)))
  })

  ipcMain.handle(IpcChannels.saveFile, async (_e, raw: unknown): Promise<SavedFile> => {
    const req = saveSchema.parse(raw)
    const target = await assertAuthorized(req.path).catch(() => {
      log.warn(`Gravação recusada em caminho não autorizado: ${resolve(req.path)}`)
      throw new Error('Caminho não autorizado. Use "Salvar como".')
    })
    return writeOne(target, req.content, req.encoding)
  })

  ipcMain.handle(IpcChannels.saveFileAs, async (e, raw: unknown): Promise<SavedFile | null> => {
    const req = saveAsSchema.parse(raw)
    const win = ownerWindow(e)
    const options: Electron.SaveDialogOptions = {
      title: 'Salvar como',
      defaultPath: req.suggestedName || 'Sem título.md',
      filters: FILTERS
    }
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    authorizeFile(result.filePath)
    return writeOne(resolve(result.filePath), req.content, req.encoding)
  })

  ipcMain.handle(IpcChannels.unwatchFile, (_e, raw: unknown) => stopWatching(resolve(pathSchema.parse(raw))))

  ipcMain.handle(IpcChannels.confirmUnsaved, async (e, raw: unknown): Promise<UnsavedChoice> => {
    const names = z.array(z.string()).parse(raw)
    const single = names.length === 1
    const response = await messageBox(e, {
      type: 'warning',
      title: 'Alterações não salvas',
      message: single
        ? `Deseja salvar as alterações em "${names[0]}"?`
        : `Deseja salvar as alterações em ${names.length} documentos?`,
      detail: (single ? '' : names.map((n) => `• ${n}`).join('\n') + '\n\n') + 'As alterações serão perdidas se você não salvar.',
      buttons: [single ? 'Salvar' : 'Salvar todos', 'Não salvar', 'Cancelar'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    return (['save', 'discard', 'cancel'] as const)[response] ?? 'cancel'
  })

  ipcMain.handle(IpcChannels.confirmReload, async (e, raw: unknown): Promise<boolean> => {
    const name = z.string().parse(raw)
    const response = await messageBox(e, {
      type: 'question',
      title: 'Arquivo alterado',
      message: `"${name}" foi alterado por outro programa.`,
      detail: 'Você tem alterações não salvas neste documento. Deseja recarregar o arquivo do disco e descartar suas alterações?',
      buttons: ['Manter minhas alterações', 'Recarregar do disco'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    return response === 1
  })
}
