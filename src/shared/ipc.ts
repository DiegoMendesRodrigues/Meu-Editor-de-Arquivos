/**
 * Contrato entre Main, Preload e Renderer.
 * Os nomes de canais e os tipos ficam aqui para que as três camadas
 * usem exatamente a mesma definição.
 */

export const IpcChannels = {
  openFiles: 'file:open',
  saveFile: 'file:save',
  saveFileAs: 'file:save-as',
  appInfo: 'app:info'
} as const

export type Eol = 'LF' | 'CRLF'
export type Encoding = 'UTF-8' | 'UTF-8 BOM'

export interface OpenedFile {
  path: string
  name: string
  content: string
  encoding: Encoding
  eol: Eol
  size: number
}

export interface SaveRequest {
  path: string
  content: string
  encoding: Encoding
}

export interface SaveAsRequest {
  suggestedName: string
  content: string
  encoding: Encoding
}

export interface SavedFile {
  path: string
  name: string
  size: number
}

export interface AppInfo {
  version: string
  platform: string
}

/** API exposta ao Renderer via contextBridge (window.api). */
export interface EditorApi {
  openFiles(): Promise<OpenedFile[]>
  saveFile(req: SaveRequest): Promise<SavedFile>
  saveFileAs(req: SaveAsRequest): Promise<SavedFile | null>
  getAppInfo(): Promise<AppInfo>
}
