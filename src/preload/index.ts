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

  getRecentFiles: () => ipcRenderer.invoke(IpcChannels.recentList),
  clearRecentFiles: () => ipcRenderer.invoke(IpcChannels.recentClear),

  confirmUnsaved: (names) => ipcRenderer.invoke(IpcChannels.confirmUnsaved, names),
  confirmReload: (name) => ipcRenderer.invoke(IpcChannels.confirmReload, name),

  getAppInfo: () => ipcRenderer.invoke(IpcChannels.appInfo),
  onBeforeClose: (listener) => {
    const handler = () => listener()
    ipcRenderer.on(IpcChannels.beforeClose, handler)
    return () => void ipcRenderer.off(IpcChannels.beforeClose, handler)
  },
  closeWindow: () => ipcRenderer.invoke(IpcChannels.closeWindow)
}

contextBridge.exposeInMainWorld('api', api)
