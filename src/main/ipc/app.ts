import { app, BrowserWindow } from 'electron'
import { IpcChannels, type AppInfo } from '@shared/ipc'
import { handle } from './secure'

/** Janelas cujo fechamento já foi confirmado pelo Renderer. */
const closeConfirmed = new WeakSet<BrowserWindow>()

/**
 * Ao fechar a janela, o Main pergunta ao Renderer antes, para que ele
 * verifique documentos não salvos. O Renderer responde com closeWindow().
 */
export function guardWindowClose(win: BrowserWindow): void {
  win.on('close', (event) => {
    if (closeConfirmed.has(win) || win.webContents.isCrashed()) return
    event.preventDefault()
    win.webContents.send(IpcChannels.beforeClose)
  })
}

export function registerAppHandlers(): void {
  handle(IpcChannels.appInfo, (): AppInfo => ({
    version: app.getVersion(),
    platform: process.platform
  }))

  handle(IpcChannels.closeWindow, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    closeConfirmed.add(win)
    win.close()
  })
}
