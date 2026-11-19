/**
 * Contrato entre Main, Preload e Renderer.
 * Os nomes de canais e os tipos ficam aqui para que as três camadas
 * usem exatamente a mesma definição.
 */

export const IpcChannels = {
  openFiles: 'file:open',
  readFile: 'file:read',
  saveFile: 'file:save',
  saveFileAs: 'file:save-as',
  unwatchFile: 'file:unwatch',
  fileChanged: 'file:changed',
  openFolder: 'folder:open',
  listFolder: 'folder:list',
  recentList: 'recent:list',
  recentClear: 'recent:clear',
  confirmUnsaved: 'dialog:confirm-unsaved',
  confirmReload: 'dialog:confirm-reload',
  sessionLoad: 'session:load',
  sessionSave: 'session:save',
  appInfo: 'app:info',
  beforeClose: 'app:before-close',
  closeWindow: 'app:close-window'
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

export interface FolderInfo {
  path: string
  name: string
}

export interface FolderEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface FileChange {
  path: string
  kind: 'changed' | 'deleted'
}

export type UnsavedChoice = 'save' | 'discard' | 'cancel'

/** Documento guardado na sessão. unsavedContent só existe quando havia alterações não salvas. */
export interface SessionDocument {
  path: string | null
  name: string
  mode: 'preview' | 'edit'
  encoding: Encoding
  eol: Eol
  unsavedContent?: string
}

export interface SessionData {
  version: 1
  folder: string | null
  activeIndex: number
  documents: SessionDocument[]
  view: {
    sidebarVisible: boolean
    bottomPanelVisible: boolean
    minimap: boolean
    wordWrap: boolean
    showInvisibles: boolean
  }
}

export interface AppInfo {
  version: string
  platform: string
}

/** API exposta ao Renderer via contextBridge (window.api). */
export interface EditorApi {
  openFiles(): Promise<OpenedFile[]>
  /** Lê um arquivo já autorizado (dentro de uma pasta aberta ou da lista de recentes). */
  readFile(path: string): Promise<OpenedFile>
  saveFile(req: SaveRequest): Promise<SavedFile>
  saveFileAs(req: SaveAsRequest): Promise<SavedFile | null>
  unwatchFile(path: string): Promise<void>
  onFileChanged(listener: (change: FileChange) => void): () => void

  openFolder(): Promise<FolderInfo | null>
  listFolder(path: string): Promise<FolderEntry[]>

  getRecentFiles(): Promise<string[]>
  clearRecentFiles(): Promise<void>

  /** Diálogo nativo para documentos com alterações não salvas. */
  confirmUnsaved(names: string[]): Promise<UnsavedChoice>
  /** Diálogo nativo quando um arquivo com alterações foi modificado por outro programa. */
  confirmReload(name: string): Promise<boolean>

  /** Sessão anterior (abas, pasta, preferências e textos não salvos), ou null. */
  loadSession(): Promise<SessionData | null>
  saveSession(data: SessionData): Promise<void>

  getAppInfo(): Promise<AppInfo>
  /** O Main avisa que o usuário quer fechar a janela; o Renderer decide e chama closeWindow(). */
  onBeforeClose(listener: () => void): () => void
  closeWindow(): Promise<void>
}
