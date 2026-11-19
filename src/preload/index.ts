// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels, type EditorApi, type FileChange } from '@shared/ipc'

/**
 * Única ponte entre o Renderer e o sistema operacional.
 * Apenas estas funções ficam disponíveis em window.api; o Renderer não acessa Node.js.
 */
const api: EditorApi = {
  openFiles: () => ipcRenderer.invoke(IpcChannels.openFiles),
  readFile: (path) => ipcRenderer.invoke(IpcChannels.readFile, path),
  saveFile: (req) => ipcRenderer.invoke(IpcChannels.saveFile, req),
  saveFileAs: (req) => ipcRenderer.invoke(IpcChannels.saveFileAs, req),
  unwatchFile: (path) => ipcRenderer.invoke(IpcChannels.unwatchFile, path),
  onFileChanged: (listener) => {
    // O evento do Electron não é repassado ao Renderer, só os dados.
    const handler = (_e: IpcRendererEvent, change: FileChange) => listener(change)
    ipcRenderer.on(IpcChannels.fileChanged, handler)
    return () => void ipcRenderer.off(IpcChannels.fileChanged, handler)
  },

  openFolder: () => ipcRenderer.invoke(IpcChannels.openFolder),
  listFolder: (path) => ipcRenderer.invoke(IpcChannels.listFolder, path),
  searchFolder: (req) => ipcRenderer.invoke(IpcChannels.searchFolder, req),
  replaceInFiles: (req) => ipcRenderer.invoke(IpcChannels.replaceInFiles, req),

  getRecentFiles: () => ipcRenderer.invoke(IpcChannels.recentList),
  clearRecentFiles: () => ipcRenderer.invoke(IpcChannels.recentClear),

  confirmUnsaved: (names) => ipcRenderer.invoke(IpcChannels.confirmUnsaved, names),
  confirmReload: (name) => ipcRenderer.invoke(IpcChannels.confirmReload, name),

  loadSession: () => ipcRenderer.invoke(IpcChannels.sessionLoad),
  saveSession: (data) => ipcRenderer.invoke(IpcChannels.sessionSave, data),

  loadSnippets: () => ipcRenderer.invoke(IpcChannels.libraryLoad, 'snippets'),
  saveSnippets: (items) => ipcRenderer.invoke(IpcChannels.librarySave, 'snippets', items),
  loadMacros: () => ipcRenderer.invoke(IpcChannels.libraryLoad, 'macros'),
  saveMacros: (items) => ipcRenderer.invoke(IpcChannels.librarySave, 'macros', items),

  accountStatus: () => ipcRenderer.invoke(IpcChannels.accountStatus),
  accountSetServer: (url) => ipcRenderer.invoke(IpcChannels.accountSetServer, url),
  accountRegister: (email, name, password) => ipcRenderer.invoke(IpcChannels.accountRegister, email, name, password),
  accountLogin: (email, password) => ipcRenderer.invoke(IpcChannels.accountLogin, email, password),
  accountLogout: () => ipcRenderer.invoke(IpcChannels.accountLogout),
  accountUpdateProfile: (name) => ipcRenderer.invoke(IpcChannels.accountUpdateProfile, name),
  accountChangePassword: (current, next) => ipcRenderer.invoke(IpcChannels.accountChangePassword, current, next),
  accountRequestReset: (email) => ipcRenderer.invoke(IpcChannels.accountRequestReset, email),
  accountConfirmReset: (token, next) => ipcRenderer.invoke(IpcChannels.accountConfirmReset, token, next),
  cloudList: () => ipcRenderer.invoke(IpcChannels.cloudList),
  cloudRead: (id) => ipcRenderer.invoke(IpcChannels.cloudRead, id),
  cloudSave: (req) => ipcRenderer.invoke(IpcChannels.cloudSave, req),
  cloudDelete: (id) => ipcRenderer.invoke(IpcChannels.cloudDelete, id),

  setLocale: (locale) => ipcRenderer.invoke(IpcChannels.setLocale, locale),
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.appInfo),
  onBeforeClose: (listener) => {
    const handler = () => listener()
    ipcRenderer.on(IpcChannels.beforeClose, handler)
    return () => void ipcRenderer.off(IpcChannels.beforeClose, handler)
  },
  closeWindow: () => ipcRenderer.invoke(IpcChannels.closeWindow)
}

contextBridge.exposeInMainWorld('api', api)
