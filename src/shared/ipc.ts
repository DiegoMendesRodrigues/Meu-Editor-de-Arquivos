// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { Locale } from './i18n'
import type { SearchMatch, SearchOptions } from './search'
export type { SearchMatch, SearchOptions } from './search'

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
  searchFolder: 'search:folder',
  replaceInFiles: 'search:replace',
  recentList: 'recent:list',
  recentClear: 'recent:clear',
  confirmUnsaved: 'dialog:confirm-unsaved',
  confirmReload: 'dialog:confirm-reload',
  sessionLoad: 'session:load',
  sessionSave: 'session:save',
  accountStatus: 'account:status',
  accountSetServer: 'account:set-server',
  accountRegister: 'account:register',
  accountLogin: 'account:login',
  accountLogout: 'account:logout',
  accountUpdateProfile: 'account:update-profile',
  accountChangePassword: 'account:change-password',
  accountRequestReset: 'account:request-reset',
  accountConfirmReset: 'account:confirm-reset',
  cloudList: 'cloud:list',
  cloudRead: 'cloud:read',
  cloudSave: 'cloud:save',
  cloudDelete: 'cloud:delete',
  libraryLoad: 'library:load',
  librarySave: 'library:save',
  appInfo: 'app:info',
  beforeClose: 'app:before-close',
  closeWindow: 'app:close-window',
  setLocale: 'app:set-locale',
  openManual: 'app:open-manual'
} as const

/** Limite de texto não salvo guardado na sessão (acima disso o app volta a perguntar ao fechar). */
export const SESSION_MAX_UNSAVED_CHARS = 100 * 1024 * 1024

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

export interface SearchRequest extends SearchOptions {
  folder: string
  /** Padrões separados por vírgula (ex.: "*.ts, docs/**"). Vazio = todos os arquivos de texto. */
  include: string
}

export interface SearchFileResult {
  path: string
  /** Caminho relativo à pasta, com "/". */
  relPath: string
  matches: SearchMatch[]
}

export interface SearchResponse {
  files: SearchFileResult[]
  totalMatches: number
  filesScanned: number
  /** Arquivos ignorados por serem binários ou grandes demais. */
  filesSkipped: number
  /** Verdadeiro se a busca parou num limite (de ocorrências ou de arquivos). */
  truncated: boolean
}

export interface ReplaceRequest extends SearchRequest {
  replacement: string
  /** Arquivos (caminhos absolutos dentro da pasta) em que a substituição será aplicada. */
  paths: string[]
}

export interface ReplaceResponse {
  filesChanged: number
  replacements: number
  errors: string[]
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
  /** Linguagem escolhida manualmente; ausente = deduzida pelo nome. */
  language?: string
  /** Vínculo com um arquivo da nuvem, se houver. */
  cloud?: { id: string; path: string; version: number }
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
    wordWrap: boolean
    showInvisibles: boolean
    insertSpaces?: boolean
    fontSize?: number
    tabSize?: number
    /** Idioma escolhido pelo usuário; ausente = idioma do sistema. */
    locale?: Locale
  }
  /** Corretor ortográfico: ligado, idioma (ausente = o da interface) e dicionário do usuário. */
  spelling?: {
    enabled: boolean
    locale?: Locale
    words: string[]
  }
}

/** Trecho de texto reutilizável, na sintaxe de snippets do Monaco ($1, ${2:padrão}, $0). */
export interface Snippet {
  id: string
  name: string
  /** Texto que, digitado, sugere o snippet no autocompletar. */
  prefix: string
  body: string
}

/** Passo de uma macro: texto digitado ou comando do editor (cursorLeft, deleteLeft, ...). */
export type MacroStep = { type: 'text'; text: string } | { type: 'command'; id: string }

export interface Macro {
  id: string
  name: string
  steps: MacroStep[]
}

export type LibraryKind = 'snippets' | 'macros'

export interface AccountUser {
  id: string
  email: string
  name: string
}

export interface AccountStatus {
  /** Endereço da API configurado (null = ainda não configurado). */
  serverUrl: string | null
  user: AccountUser | null
  /** Falso quando o sistema não tem cofre de credenciais: a sessão não é lembrada entre execuções. */
  rememberSession: boolean
}

export interface CloudFileMeta {
  id: string
  path: string
  version: number
  size: number
  updatedAt: string
}

export interface CloudFileContent extends CloudFileMeta {
  content: string
  encoding: Encoding
  eol: Eol
}

export interface CloudSaveRequest {
  path: string
  content: string
  encoding: Encoding
  /** Versão que o computador tinha; null = arquivo novo na nuvem. */
  baseVersion: number | null
  force: boolean
}

export type CloudSaveResult = { ok: true; file: CloudFileMeta } | { ok: false; conflict: true; current: CloudFileMeta }

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
  searchFolder(req: SearchRequest): Promise<SearchResponse>
  replaceInFiles(req: ReplaceRequest): Promise<ReplaceResponse>

  getRecentFiles(): Promise<string[]>
  clearRecentFiles(): Promise<void>

  /** Diálogo nativo para documentos com alterações não salvas. */
  confirmUnsaved(names: string[]): Promise<UnsavedChoice>
  /** Diálogo nativo quando um arquivo com alterações foi modificado por outro programa. */
  confirmReload(name: string): Promise<boolean>

  /** Sessão anterior (abas, pasta, preferências e textos não salvos), ou null. */
  loadSession(): Promise<SessionData | null>
  saveSession(data: SessionData): Promise<void>

  /** Snippets e macros do usuário (guardados na pasta de dados do app). */
  loadSnippets(): Promise<Snippet[]>
  saveSnippets(items: Snippet[]): Promise<void>
  loadMacros(): Promise<Macro[]>
  saveMacros(items: Macro[]): Promise<void>

  /** Conta de usuário e sincronização (a sessão fica no Main; o Renderer nunca vê o token). */
  accountStatus(): Promise<AccountStatus>
  accountSetServer(url: string): Promise<AccountStatus>
  accountRegister(email: string, name: string, password: string): Promise<AccountStatus>
  accountLogin(email: string, password: string): Promise<AccountStatus>
  accountLogout(): Promise<AccountStatus>
  accountUpdateProfile(name: string): Promise<AccountStatus>
  accountChangePassword(currentPassword: string, newPassword: string): Promise<void>
  accountRequestReset(email: string): Promise<void>
  accountConfirmReset(token: string, newPassword: string): Promise<void>
  cloudList(): Promise<CloudFileMeta[]>
  cloudRead(id: string): Promise<CloudFileContent>
  cloudSave(req: CloudSaveRequest): Promise<CloudSaveResult>
  cloudDelete(id: string): Promise<void>

  /** Avisa o processo principal do idioma da interface (diálogos nativos e mensagens de erro). */
  setLocale(locale: Locale): Promise<void>
  /** Abre o manual do usuário, no idioma atual, numa janela própria. */
  openManual(): Promise<void>

  getAppInfo(): Promise<AppInfo>
  /** O Main avisa que o usuário quer fechar a janela; o Renderer decide e chama closeWindow(). */
  onBeforeClose(listener: () => void): () => void
  closeWindow(): Promise<void>
}
