import { readFile, stat, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels, type OpenedFile, type SavedFile } from '@shared/ipc'
import { decodeText, encodeText } from './textCodec'

/**
 * Caminhos que o usuário escolheu explicitamente por um diálogo nativo.
 * O Renderer só consegue gravar em arquivos desta lista: um conteúdo malicioso
 * no Renderer não pode escrever em um caminho arbitrário do disco.
 */
const authorizedPaths = new Set<string>()
const authorize = (p: string): void => void authorizedPaths.add(resolve(p))

/** Acima deste tamanho o arquivo não é aberto (o suporte a arquivos grandes vem depois). */
const MAX_OPEN_BYTES = 50 * 1024 * 1024

const encodingSchema = z.enum(['UTF-8', 'UTF-8 BOM'])
const saveSchema = z.object({ path: z.string().min(1), content: z.string(), encoding: encodingSchema })
const saveAsSchema = z.object({
  suggestedName: z.string().max(255),
  content: z.string(),
  encoding: encodingSchema
})

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
  if (info.size > MAX_OPEN_BYTES) {
    throw new Error(`O arquivo ${basename(path)} tem mais de 50 MB e ainda não pode ser aberto.`)
  }
  const decoded = decodeText(await readFile(path))
  authorize(path)
  return { path, name: basename(path), size: info.size, ...decoded }
}

async function writeOne(path: string, content: string, encoding: 'UTF-8' | 'UTF-8 BOM'): Promise<SavedFile> {
  const data = encodeText(content, encoding)
  await writeFile(path, data)
  log.info(`Arquivo salvo: ${path}`)
  return { path, name: basename(path), size: data.length }
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

  ipcMain.handle(IpcChannels.saveFile, async (_e, raw: unknown): Promise<SavedFile> => {
    const req = saveSchema.parse(raw)
    const target = resolve(req.path)
    if (!authorizedPaths.has(target)) {
      log.warn(`Gravação recusada em caminho não autorizado: ${target}`)
      throw new Error('Caminho não autorizado. Use "Salvar como".')
    }
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
    authorize(result.filePath)
    return writeOne(resolve(result.filePath), req.content, req.encoding)
  })
}
