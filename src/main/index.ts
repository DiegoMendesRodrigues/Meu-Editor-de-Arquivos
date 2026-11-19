import { join } from 'node:path'
import { app, BrowserWindow, Menu, shell } from 'electron'
import log from 'electron-log/main'
import { registerFileHandlers } from './ipc/files'
import { guardWindowClose, registerAppHandlers } from './ipc/app'
import { registerFolderHandlers } from './ipc/folders'
import { loadRecent, registerRecentHandlers } from './ipc/recent'
import { setWatchTarget } from './watcher'
import { registerSessionHandlers } from './ipc/session'

log.initialize()
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
  await loadRecent()
  registerFileHandlers()
  registerFolderHandlers()
  registerRecentHandlers()
  registerSessionHandlers()
  registerAppHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
