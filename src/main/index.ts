import { join } from 'node:path'
import { app, BrowserWindow, Menu, session, shell } from 'electron'
import log from 'electron-log/main'
import { registerFileHandlers } from './ipc/files'
import { guardWindowClose, registerAppHandlers } from './ipc/app'
import { registerFolderHandlers } from './ipc/folders'
import { registerSearchHandlers } from './ipc/search'
import { loadRecent, registerRecentHandlers } from './ipc/recent'
import { setWatchTarget } from './watcher'
import { loadAccount, registerAccountHandlers } from './ipc/account'
import { registerLibraryHandlers } from './ipc/library'
import { registerSessionHandlers } from './ipc/session'

log.initialize()

// Uma única instância: duas janelas gravariam a mesma sessão e os mesmos arquivos de dados.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

// Endurecimento de qualquer conteúdo web: sem <webview>, sem navegação para fora, sem permissões de dispositivo.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.on('will-redirect', (event) => event.preventDefault())
})
log.info(`Iniciando Meu Editor de Arquivos ${app.getVersion()} em ${process.platform}`)

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    show: false,
    title: 'Meu Editor de Arquivos',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  win.once('ready-to-show', () => win.show())
  guardWindowClose(win)
  setWatchTarget(win.webContents)
  win.on('closed', () => setWatchTarget(null))

  // Links externos abrem no navegador do sistema; nenhuma janela nova no app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // Impede que o conteúdo navegue a janela para outro endereço.
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault()
  })

  // F12 abre as ferramentas de desenvolvimento apenas fora do pacote final.
  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools()
    })
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// O menu principal é desenhado pelo Renderer (React), então o menu nativo é removido.
Menu.setApplicationMenu(null)

app.whenReady().then(async () => {
  // Editor de texto: nenhuma permissão (câmera, microfone, notificações, localização...) é concedida.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  session.defaultSession.setPermissionCheckHandler(() => false)
  await loadRecent()
  await loadAccount()
  registerFileHandlers()
  registerFolderHandlers()
  registerSearchHandlers()
  registerRecentHandlers()
  registerSessionHandlers()
  registerLibraryHandlers()
  registerAccountHandlers()
  registerAppHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
