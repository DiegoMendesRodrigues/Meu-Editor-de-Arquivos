import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type EditorApi } from '@shared/ipc'

/**
 * Única ponte entre o Renderer e o sistema operacional.
 * Apenas estas funções ficam disponíveis em window.api; o Renderer não acessa Node.js.
 */
const api: EditorApi = {
  openFiles: () => ipcRenderer.invoke(IpcChannels.openFiles),
  saveFile: (req) => ipcRenderer.invoke(IpcChannels.saveFile, req),
  saveFileAs: (req) => ipcRenderer.invoke(IpcChannels.saveFileAs, req),
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.appInfo)
}

contextBridge.exposeInMainWorld('api', api)
