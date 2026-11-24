// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IpcChannels, type EditorApi, type FileChange } from '@shared/ipc'

/**
 * Única ponte entre o Renderer e o sistema operacional.
 * Apenas estas funções ficam disponíveis em window.api; o Renderer não acessa Node.js.
 */
const api: EditorApi = {
  openFiles: () => ipcRenderer.invoke(IpcChannels.openFiles),
  // Só arquivos reais do disco têm caminho (um File criado pela página devolve ''), então a página
  // não consegue pedir um caminho qualquer por aqui.
  openDroppedFiles: (files) =>
    ipcRenderer.invoke(
      IpcChannels.openDropped,
      Array.from(files)
        .map((f) => webUtils.getPathForFile(f))
        .filter(Boolean)
    ),
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
  renameEntry: (path, newName) => ipcRenderer.invoke(IpcChannels.renameEntry, path, newName),
  deleteEmptyFolder: (path) => ipcRenderer.invoke(IpcChannels.deleteEmptyFolder, path),
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
  cloudReadIfExists: (id) => ipcRenderer.invoke(IpcChannels.cloudReadIfExists, id),
  cloudSave: (req) => ipcRenderer.invoke(IpcChannels.cloudSave, req),
  cloudDelete: (id) => ipcRenderer.invoke(IpcChannels.cloudDelete, id),
  cloudMove: (id, path) => ipcRenderer.invoke(IpcChannels.cloudMove, id, path),
  workspaceGet: () => ipcRenderer.invoke(IpcChannels.workspaceGet),
  workspacePut: (data, baseVersion) => ipcRenderer.invoke(IpcChannels.workspacePut, data, baseVersion),
  cloudFolders: () => ipcRenderer.invoke(IpcChannels.cloudFolders),
  cloudCreateFolder: (path) => ipcRenderer.invoke(IpcChannels.cloudCreateFolder, path),
  cloudDeleteFolder: (path) => ipcRenderer.invoke(IpcChannels.cloudDeleteFolder, path),
  cloudRenameFolder: (from, to) => ipcRenderer.invoke(IpcChannels.cloudRenameFolder, from, to),
  cloudStorage: () => ipcRenderer.invoke(IpcChannels.cloudStorage),
  onCloudStorageChanged: (listener) => {
    const handler = (_e: unknown, bytes: number) => listener(bytes)
    ipcRenderer.on(IpcChannels.cloudStorageChanged, handler)
    return () => void ipcRenderer.off(IpcChannels.cloudStorageChanged, handler)
  },

  openManual: () => ipcRenderer.invoke(IpcChannels.openManual),
  openSupport: () => ipcRenderer.invoke(IpcChannels.openSupport),
  checkUpdate: () => ipcRenderer.invoke(IpcChannels.checkUpdate),
  setLocale: (locale) => ipcRenderer.invoke(IpcChannels.setLocale, locale),
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.appInfo),
  terminalCreate: (size) => ipcRenderer.invoke(IpcChannels.terminalCreate, size),
  terminalWrite: (id, data) => ipcRenderer.invoke(IpcChannels.terminalWrite, id, data),
  terminalResize: (id, size) => ipcRenderer.invoke(IpcChannels.terminalResize, id, size),
  terminalKill: (id) => ipcRenderer.invoke(IpcChannels.terminalKill, id),
  onTerminalData: (listener) => {
    const handler = (_e: unknown, id: number, data: string) => listener(id, data)
    ipcRenderer.on(IpcChannels.terminalData, handler)
    return () => void ipcRenderer.off(IpcChannels.terminalData, handler)
  },
  onTerminalExit: (listener) => {
    const handler = (_e: unknown, id: number, exitCode: number) => listener(id, exitCode)
    ipcRenderer.on(IpcChannels.terminalExit, handler)
    return () => void ipcRenderer.off(IpcChannels.terminalExit, handler)
  },
  setTheme: (theme) => ipcRenderer.invoke(IpcChannels.setTheme, theme),
  setFullScreen: (on) => ipcRenderer.invoke(IpcChannels.setFullScreen, on),
  onFullScreenChanged: (listener) => {
    const handler = (_e: unknown, on: boolean) => listener(on)
    ipcRenderer.on(IpcChannels.fullScreenChanged, handler)
    return () => void ipcRenderer.off(IpcChannels.fullScreenChanged, handler)
  },
  hashText: (algorithm, text) => ipcRenderer.invoke(IpcChannels.hashText, algorithm, text),
  formatCode: (language, extension, text) => ipcRenderer.invoke(IpcChannels.formatCode, language, extension, text),
  copyText: (text) => ipcRenderer.invoke(IpcChannels.copyText, text),
  apiSecretsInfo: () => ipcRenderer.invoke(IpcChannels.apiSecretsInfo),
  apiSecretSet: (scope, name, value) => ipcRenderer.invoke(IpcChannels.apiSecretSet, scope, name, value),
  apiSecretHas: (scope, name) => ipcRenderer.invoke(IpcChannels.apiSecretHas, scope, name),
  apiSecretNames: (scope) => ipcRenderer.invoke(IpcChannels.apiSecretNames, scope),
  apiSecretDelete: (scope, name) => ipcRenderer.invoke(IpcChannels.apiSecretDelete, scope, name),
  onBeforeClose: (listener) => {
    const handler = () => listener()
    ipcRenderer.on(IpcChannels.beforeClose, handler)
    return () => void ipcRenderer.off(IpcChannels.beforeClose, handler)
  },
  closeWindow: () => ipcRenderer.invoke(IpcChannels.closeWindow)
}

contextBridge.exposeInMainWorld('api', api)
