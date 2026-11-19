import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, ipcMain, type IpcMainInvokeEvent } from 'electron'
import log from 'electron-log/main'

/**
 * Só aceita chamadas IPC vindas da página do próprio aplicativo (quadro principal).
 * Em produção é o index.html empacotado; em desenvolvimento, o servidor do Vite.
 */
function trustedPage(): { origin?: string; file?: string } {
  const dev = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && dev) return { origin: new URL(dev).origin }
  return { file: pathToFileURL(join(__dirname, '../renderer/index.html')).href }
}

export function isTrustedSender(e: IpcMainInvokeEvent): boolean {
  const frame = e.senderFrame
  if (!frame || frame !== e.sender.mainFrame) return false
  try {
    const url = new URL(frame.url)
    const trusted = trustedPage()
    if (trusted.origin) return url.origin === trusted.origin
    return url.href.split(/[?#]/)[0] === trusted.file
  } catch {
    return false
  }
}

type Listener = (e: IpcMainInvokeEvent, ...args: any[]) => unknown // eslint-disable-line @typescript-eslint/no-explicit-any

/** ipcMain.handle com verificação de origem do remetente. */
export function handle(channel: string, listener: Listener): void {
  ipcMain.handle(channel, (e, ...args) => {
    if (!isTrustedSender(e)) {
      log.warn(`IPC recusado em "${channel}": remetente não confiável (${e.senderFrame?.url ?? 'desconhecido'})`)
      throw new Error('Origem não autorizada.')
    }
    return listener(e, ...args)
  })
}
