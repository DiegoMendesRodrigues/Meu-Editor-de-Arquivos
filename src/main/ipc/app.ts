// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { BrowserWindow, shell } from 'electron'
import { IpcChannels, type AppInfo, type UpdateInfo } from '@shared/ipc'
import { z } from 'zod'
import { LOCALES, type Locale } from '@shared/i18n'
import { currentLocale, setMainLocale } from '../i18n'
import { SITE_URL, siteUrl, supportUrl, versionUrl } from '@shared/support'
import { openManual, refreshManual } from '../manual'
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

/** Só os campos usados; o link só é aceito se for do próprio site. */
const versionSchema = z.object({
  version: z.string().regex(/^\d+(\.\d+){1,3}$/),
  websiteLink: z.string().optional()
})

async function checkUpdate(): Promise<UpdateInfo> {
  const locale = currentLocale()
  const response = await fetch(versionUrl(locale), { signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = versionSchema.parse(await response.json())
  const link = data.websiteLink && data.websiteLink.startsWith(SITE_URL) ? data.websiteLink : siteUrl(locale)
  return { version: data.version, websiteLink: link }
}

export function registerAppHandlers(): void {
  handle(IpcChannels.checkUpdate, () => checkUpdate())
  handle(IpcChannels.openManual, () => openManual())
  // O endereço é montado aqui (o Renderer não escolhe a URL aberta no navegador).
  handle(IpcChannels.openSupport, () => shell.openExternal(supportUrl(currentLocale())))
  handle(IpcChannels.setLocale, (_e, raw: unknown) => {
    setMainLocale(localeSchema.parse(raw))
    refreshManual()
  })

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
