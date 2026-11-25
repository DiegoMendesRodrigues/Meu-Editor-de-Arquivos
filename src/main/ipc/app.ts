// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHash } from 'node:crypto'
import { BrowserWindow, clipboard, nativeTheme, shell } from 'electron'
import { HASH_ALGORITHMS, IpcChannels, type AppInfo, type UpdateInfo } from '@shared/ipc'
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

/** Cor de fundo da janela (vista antes de a página desenhar), conforme o tema em uso. */
export const windowBackground = (): string => (nativeTheme.shouldUseDarkColors ? '#1e1e1e' : '#ffffff')

/** Avisa o Renderer quando a janela entra ou sai da tela inteira (F11, menu ou sistema). */
export function reportFullScreen(win: BrowserWindow): void {
  win.on('enter-full-screen', () => win.webContents.send(IpcChannels.fullScreenChanged, true))
  win.on('leave-full-screen', () => win.webContents.send(IpcChannels.fullScreenChanged, false))
}

/** Nomes do node:crypto para os algoritmos oferecidos. */
const NODE_HASH: Record<(typeof HASH_ALGORITHMS)[number], string> = { MD5: 'md5', 'SHA-1': 'sha1', 'SHA-256': 'sha256', 'SHA-512': 'sha512' }
const hashSchema = z.enum(HASH_ALGORITHMS)
/** Mesmo limite dos arquivos abertos (50 MB) com folga para UTF-16. */
const textSchema = z.string().max(64 * 1024 * 1024)

const localeSchema = z.enum(LOCALES.map((l) => l.code) as [Locale, ...Locale[]])

/** Só os campos usados; o link só é aceito se for do próprio site. */
const versionSchema = z.object({
  version: z.string().regex(/^\d+(\.\d+){1,3}$/),
  websiteLink: z.string().optional()
})

/** O link é https e tem exatamente a origem do site? (startsWith aceitaria "site.com.malicioso") */
function isSiteLink(raw: string | undefined): boolean {
  if (!raw) return false
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && u.origin === new URL(SITE_URL).origin && u.username === '' && u.password === ''
  } catch {
    return false
  }
}

async function checkUpdate(): Promise<UpdateInfo> {
  const locale = currentLocale()
  const response = await fetch(versionUrl(locale), { redirect: 'error', signal: AbortSignal.timeout(10_000), headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = versionSchema.parse(await response.json())
  const link = isSiteLink(data.websiteLink) ? data.websiteLink! : siteUrl(locale)
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

  // Tema: barra de título, diálogos nativos e o prefers-color-scheme da página acompanham.
  handle(IpcChannels.setTheme, (e, raw: unknown) => {
    nativeTheme.themeSource = z.enum(['light', 'dark', 'system']).parse(raw)
    BrowserWindow.fromWebContents(e.sender)?.setBackgroundColor(windowBackground())
  })

  handle(IpcChannels.setFullScreen, (e, raw: unknown) => {
    BrowserWindow.fromWebContents(e.sender)?.setFullScreen(z.boolean().parse(raw))
  })

  handle(IpcChannels.hashText, (_e, algorithm: unknown, text: unknown): string =>
    createHash(NODE_HASH[hashSchema.parse(algorithm)]).update(textSchema.parse(text), 'utf8').digest('hex')
  )

  handle(IpcChannels.copyText, (_e, text: unknown) => clipboard.writeText(textSchema.parse(text)))

  handle(IpcChannels.closeWindow, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    closeConfirmed.add(win)
    win.close()
  })
}
