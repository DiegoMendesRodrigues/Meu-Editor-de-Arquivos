// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { BrowserWindow } from 'electron'
import { IpcChannels, type AppInfo } from '@shared/ipc'
import { z } from 'zod'
import { LOCALES, type Locale } from '@shared/i18n'
import { setMainLocale } from '../i18n'
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

const localeSchema = z.enum(LOCALES.map((l) => l.code) as [Locale, ...Locale[]])

export function registerAppHandlers(): void {
  handle(IpcChannels.setLocale, (_e, raw: unknown) => setMainLocale(localeSchema.parse(raw)))

  handle(IpcChannels.appInfo, (): AppInfo => ({
    version: __APP_VERSION__,
    platform: process.platform
  }))

  handle(IpcChannels.closeWindow, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    closeConfirmed.add(win)
    win.close()
  })
}
