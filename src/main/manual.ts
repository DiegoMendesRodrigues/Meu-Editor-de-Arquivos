// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, shell } from 'electron'
import { currentLocale, tm } from './i18n'
import { windowIcon } from './icon'

/**
 * Pasta dos manuais: dentro do pacote (resources/manual) ou, em desenvolvimento, docs/manual do projeto
 * (o app pode ser iniciado pela raiz do projeto ou direto por out/main/index.js).
 */
function manualRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'manual')
  const appPath = app.getAppPath()
  const found = [appPath, resolve(appPath, '..', '..')].map((dir) => join(dir, 'docs', 'manual')).find((dir) => existsSync(dir))
  return found ?? join(appPath, 'docs', 'manual')
}

let manualWindow: BrowserWindow | null = null

/**
 * Abre o manual do usuário, no idioma atual do aplicativo, numa janela própria (sem acesso a Node.js nem à API do app).
 * O manual não tem troca de idioma: ele sempre acompanha o idioma do aplicativo (se o usuário trocar
 * o idioma com o manual aberto, a janela recarrega no novo idioma). Links externos abrem no navegador do sistema.
 */
export function openManual(): void {
  const root = manualRoot()
  const file = join(root, currentLocale(), 'index.html')
  if (!existsSync(file)) throw new Error(tm('err.manualMissing'))

  if (manualWindow && !manualWindow.isDestroyed()) {
    void manualWindow.loadFile(file)
    if (manualWindow.isMinimized()) manualWindow.restore()
    manualWindow.focus()
    return
  }

  const rootUrl = pathToFileURL(root).href
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 640,
    minHeight: 480,
    title: tm('menu.help.manual'),
    icon: windowIcon(),
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true }
  })
  win.removeMenu()
  manualWindow = win
  win.on('closed', () => {
    manualWindow = null
  })

  const external = (url: string): void => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    external(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    // Só páginas dentro da pasta do manual (a barra final evita pastas vizinhas como manual-x).
    if (!url.startsWith(rootUrl.endsWith('/') ? rootUrl : `${rootUrl}/`)) {
      event.preventDefault()
      external(url)
    }
  })

  void win.loadFile(file)
}

/** Se o manual estiver aberto, passa para o idioma atual do aplicativo (chamado quando o usuário troca o idioma). */
export function refreshManual(): void {
  if (!manualWindow || manualWindow.isDestroyed()) return
  const file = join(manualRoot(), currentLocale(), 'index.html')
  if (!existsSync(file)) return
  void manualWindow.loadFile(file)
  manualWindow.setTitle(tm('menu.help.manual'))
}
