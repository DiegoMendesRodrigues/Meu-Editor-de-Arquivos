// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { FolderColor } from './folderColors'
import type { Locale } from './i18n'
import type { SearchMatch, SearchOptions } from './search'
import type { AiChatInput, AiChatResult, AiChunk, AiInstallInfo, AiInstallProgress, AiOpResult, AiSetSettingsResult, AiSettings, AiStatus } from './ai'
import type {
  ApiCookieJarEntry,
  ApiHistoryEntry,
  ApiImportFormat,
  ApiImportResponse,
  ApiOAuthInput,
  ApiOAuthProgress,
  ApiOAuthResult,
  ApiOAuthTokenInfo,
  ApiPickPurpose,
  ApiRunInput,
  ApiRunProgress,
  ApiSendInput,
  ApiSendResult,
  ApiWriteFilesInput,
  ApiWsConnectInput,
  ApiWsConnectResult,
  ApiWsEvent,
  ApiMockStartInput,
  ApiMockStartResult,
  ApiMockLogEntry,
  ApiGrpcLoadInput,
  ApiGrpcLoadResult,
  ApiGrpcStartInput,
  ApiGrpcStartResult,
  ApiGrpcEvent,
  ApiMonitorInput,
  ApiMonitorState,
  ApiMonitorSaveResult,
  ApiMonitorEvent,
  ApiScriptTrustInput
} from './api/protocol'
export type { SearchMatch, SearchOptions } from './search'

/**
 * Contrato entre Main, Preload e Renderer.
 * Os nomes de canais e os tipos ficam aqui para que as três camadas
 * usem exatamente a mesma definição.
 */

export const IpcChannels = {
  openFiles: 'file:open',
  openDropped: 'file:open-dropped',
  readFile: 'file:read',
  saveFile: 'file:save',
  saveFileAs: 'file:save-as',
  unwatchFile: 'file:unwatch',
  fileChanged: 'file:changed',
  openFolder: 'folder:open',
  listFolder: 'folder:list',
  renameEntry: 'folder:rename-entry',
  deleteEmptyFolder: 'folder:delete-empty',
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
  cloudReadIfExists: 'cloud:read-if-exists',
  cloudSave: 'cloud:save',
  cloudDelete: 'cloud:delete',
  cloudMove: 'cloud:move',
  workspaceGet: 'workspace:get',
  workspacePut: 'workspace:put',
  cloudFolders: 'cloud:folders',
  cloudCreateFolder: 'cloud:create-folder',
  cloudDeleteFolder: 'cloud:delete-folder',
  cloudRenameFolder: 'cloud:rename-folder',
  cloudStorage: 'cloud:storage',
  cloudStorageChanged: 'cloud:storage-changed',
  libraryLoad: 'library:load',
  librarySave: 'library:save',
  appInfo: 'app:info',
  beforeClose: 'app:before-close',
  closeWindow: 'app:close-window',
  setLocale: 'app:set-locale',
  openManual: 'app:open-manual',
  openSupport: 'app:open-support',
  checkUpdate: 'app:check-update',
  setFullScreen: 'app:set-full-screen',
  fullScreenChanged: 'app:full-screen-changed',
  hashText: 'tools:hash-text',
  copyText: 'tools:copy-text',
  formatCode: 'tools:format-code',
  setTheme: 'app:set-theme',
  terminalCreate: 'terminal:create',
  terminalWrite: 'terminal:write',
  terminalResize: 'terminal:resize',
  terminalKill: 'terminal:kill',
  terminalData: 'terminal:data',
  terminalExit: 'terminal:exit',
  apiSecretsInfo: 'api:secrets-info',
  apiSecretSet: 'api:secret-set',
  apiSecretHas: 'api:secret-has',
  apiSecretNames: 'api:secret-names',
  apiSecretDelete: 'api:secret-delete',
  apiSend: 'api:send',
  apiCancel: 'api:cancel',
  apiHistoryList: 'api:history-list',
  apiHistoryClear: 'api:history-clear',
  apiCookiesList: 'api:cookies-list',
  apiCookiesClear: 'api:cookies-clear',
  apiPickFiles: 'api:pick-files',
  apiImportParse: 'api:import-parse',
  apiWriteFiles: 'api:write-files',
  apiRunStart: 'api:run-start',
  apiRunCancel: 'api:run-cancel',
  apiRunProgress: 'api:run-progress',
  apiOAuthAuthorize: 'api:oauth-authorize',
  apiOAuthCancel: 'api:oauth-cancel',
  apiOAuthProgress: 'api:oauth-progress',
  apiOAuthTokenInfo: 'api:oauth-token-info',
  apiOAuthClear: 'api:oauth-clear',
  apiWsConnect: 'api:ws-connect',
  apiWsSend: 'api:ws-send',
  apiWsClose: 'api:ws-close',
  apiWsEvent: 'api:ws-event',
  apiMockStart: 'api:mock-start',
  apiMockStop: 'api:mock-stop',
  apiMockLog: 'api:mock-log',
  apiGrpcLoad: 'api:grpc-load',
  apiGrpcStart: 'api:grpc-start',
  apiGrpcSend: 'api:grpc-send',
  apiGrpcEnd: 'api:grpc-end',
  apiGrpcCancel: 'api:grpc-cancel',
  apiGrpcEvent: 'api:grpc-event',
  apiMonitorList: 'api:monitor-list',
  apiMonitorSave: 'api:monitor-save',
  apiMonitorDelete: 'api:monitor-delete',
  apiMonitorRunNow: 'api:monitor-run-now',
  apiMonitorEvent: 'api:monitor-event',
  apiScriptTrust: 'api:script-trust',
  apiScriptIsTrusted: 'api:script-is-trusted',
  aiStatus: 'ai:status',
  aiGetSettings: 'ai:get-settings',
  aiSetSettings: 'ai:set-settings',
  aiChat: 'ai:chat',
  aiCancel: 'ai:cancel',
  aiChunk: 'ai:chunk',
  aiInstallInfo: 'ai:install-info',
  aiInstallStart: 'ai:install-start',
  aiInstallCancel: 'ai:install-cancel',
  aiStartServer: 'ai:start-server',
  aiPull: 'ai:pull',
  aiPullCancel: 'ai:pull-cancel',
  aiDeleteModel: 'ai:delete-model',
  aiInstallProgress: 'ai:install-progress'
} as const

/** Cofre de segredos do Cliente de API: persistent = false quando o sistema não oferece cifra (só memória). */
export interface ApiSecretsInfo {
  persistent: boolean
}

/** Algoritmos de resumo (hash) do menu Ferramentas. */
export const HASH_ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512'] as const
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number]

/**
 * Resultado da auto formatação: texto formatado (guessedIndent: a indentação do Python faltava e foi
 * deduzida), linguagem sem formatador ou código que o formatador não entendeu (com a linha, se souber).
 */
export type FormatResult =
  | { status: 'ok'; text: string; guessedIndent?: boolean }
  | { status: 'unsupported' }
  | { status: 'invalid'; line?: number }

/** Limite de texto aceito pela auto formatação. */
export const FORMAT_MAX_CHARS = 5 * 1024 * 1024

/** Tema da interface. */
export type Theme = 'light' | 'dark'

/** Limite de texto não salvo guardado na sessão (acima disso o app volta a perguntar ao fechar). */
export const SESSION_MAX_UNSAVED_CHARS = 100 * 1024 * 1024

/** Windows (CRLF), Unix (LF) ou Mac clássico (CR). */
export type Eol = 'LF' | 'CRLF' | 'CR'
export type Encoding = 'UTF-8' | 'UTF-8 BOM'

export interface OpenedFile {
  path: string
  name: string
  content: string
  encoding: Encoding
  eol: Eol
  size: number
}

interface SaveRequest {
  path: string
  content: string
  encoding: Encoding
}

interface SaveAsRequest {
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

interface SearchRequest extends SearchOptions {
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

interface ReplaceRequest extends SearchRequest {
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
  /** Identificador do documento na área de trabalho sincronizada pela nuvem. */
  syncId?: string
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
    /** Tema escolhido pelo usuário; ausente = o do sistema operacional. */
    theme?: Theme
  }
  /** Corretor ortográfico: ligado, idioma (ausente = o da interface) e dicionário do usuário. */
  spelling?: {
    enabled: boolean
    locale?: Locale
    words: string[]
  }
  /** Cores escolhidas para as pastas da barra lateral ("local:<caminho>" ou "cloud:<caminho>"). */
  folderColors?: Record<string, FolderColor>
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

type LibraryKind = 'snippets' | 'macros'

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

interface CloudSaveRequest {
  path: string
  content: string
  encoding: Encoding
  /** Versão que o computador tinha; null = arquivo novo na nuvem. */
  baseVersion: number | null
  force: boolean
}

export type CloudSaveResult = { ok: true; file: CloudFileMeta } | { ok: false; conflict: true; current: CloudFileMeta }

/** Resposta do site (version.php), já validada. */
export interface UpdateInfo {
  version: string
  websiteLink: string
}

export interface AppInfo {
  version: string
  platform: string
}

/** API exposta ao Renderer via contextBridge (window.api). */
export interface EditorApi {
  openFiles(): Promise<OpenedFile[]>
  /**
   * Abre arquivos arrastados do explorador do sistema para a janela. Recebe os File do evento de soltar;
   * o caminho é obtido no preload (o Renderer não o vê). Pastas e arquivos ilegíveis vêm em failed.
   */
  openDroppedFiles(files: File[]): Promise<{ opened: OpenedFile[]; failed: string[] }>
  /** Lê um arquivo já autorizado (dentro de uma pasta aberta ou da lista de recentes). */
  readFile(path: string): Promise<OpenedFile>
  saveFile(req: SaveRequest): Promise<SavedFile>
  saveFileAs(req: SaveAsRequest): Promise<SavedFile | null>
  unwatchFile(path: string): Promise<void>
  onFileChanged(listener: (change: FileChange) => void): () => void

  openFolder(): Promise<FolderInfo | null>
  listFolder(path: string): Promise<FolderEntry[]>
  /** Renomeia um arquivo ou pasta da pasta aberta; devolve o novo caminho. */
  renameEntry(path: string, newName: string): Promise<string>
  /** Exclui uma pasta vazia da pasta aberta. */
  deleteEmptyFolder(path: string): Promise<void>
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
  /** Como cloudRead, mas devolve null se o arquivo não existe mais na nuvem (outros erros continuam sendo erros). */
  cloudReadIfExists(id: string): Promise<CloudFileContent | null>
  cloudSave(req: CloudSaveRequest): Promise<CloudSaveResult>
  cloudDelete(id: string): Promise<void>
  /** Muda o caminho do arquivo na nuvem (mover para outra pasta ou renomear). */
  cloudMove(id: string, path: string): Promise<CloudFileMeta>
  /** Pastas criadas na nuvem (as dos caminhos dos arquivos existem implicitamente). */
  cloudFolders(): Promise<string[]>
  /** Área de trabalho sincronizada entre computadores (JSON) e sua versão (0 = não existe). */
  workspaceGet(): Promise<{ data: string | null; version: number }>
  /** Grava a área de trabalho; ok: false quando outro computador gravou antes (versão diferente). */
  workspacePut(data: string, baseVersion: number): Promise<{ ok: true; version: number } | { ok: false }>
  cloudCreateFolder(path: string): Promise<void>
  /** Exclui a pasta da nuvem; só funciona com a pasta vazia. */
  cloudDeleteFolder(path: string): Promise<void>
  /** Renomeia uma pasta da nuvem (e tudo o que há dentro dela). */
  cloudRenameFolder(from: string, to: string): Promise<void>
  /** Espaço usado na nuvem, em bytes (arquivos + textos não salvos da área de trabalho). */
  cloudStorage(): Promise<number>
  /** O Main avisa quando o servidor informa um novo espaço usado (depois de salvar, excluir ou sincronizar). */
  onCloudStorageChanged(listener: (bytes: number) => void): () => void

  /** Avisa o processo principal do idioma da interface (diálogos nativos e mensagens de erro). */
  setLocale(locale: Locale): Promise<void>
  /** Abre o manual do usuário, no idioma atual, numa janela própria. */
  openManual(): Promise<void>
  /** Abre a página de suporte técnico do site no navegador, no idioma da interface. */
  openSupport(): Promise<void>
  /** Consulta no site a versão mais recente publicada. */
  checkUpdate(): Promise<UpdateInfo>

  getAppInfo(): Promise<AppInfo>
  /**
   * Tema da janela e dos diálogos nativos: 'system' segue o sistema operacional. Com um tema
   * fixo, o prefers-color-scheme do Renderer também passa a ser esse.
   */
  setTheme(theme: Theme | 'system'): Promise<void>
  /** Abre um terminal (o shell do usuário, na pasta pessoal) e devolve o seu número. */
  terminalCreate(size: { cols: number; rows: number }): Promise<number>
  /** Envia ao terminal o que foi digitado (ou colado). */
  terminalWrite(id: number, data: string): Promise<void>
  terminalResize(id: number, size: { cols: number; rows: number }): Promise<void>
  /** Encerra o shell do terminal. */
  terminalKill(id: number): Promise<void>
  /** Saída dos terminais (todos chegam pelo mesmo canal, com o número). */
  onTerminalData(listener: (id: number, data: string) => void): () => void
  /** O shell terminou (comando exit, por exemplo). */
  onTerminalExit(listener: (id: number, exitCode: number) => void): () => void
  /** Coloca a janela em tela inteira (ou a tira). */
  setFullScreen(on: boolean): Promise<void>
  /** O Main avisa quando a janela entra ou sai da tela inteira. */
  onFullScreenChanged(listener: (on: boolean) => void): () => void
  /** Resumo do texto (UTF-8) em hexadecimal minúsculo. */
  hashText(algorithm: HashAlgorithm, text: string): Promise<string>
  /** Copia o texto para a área de transferência do sistema. */
  copyText(text: string): Promise<void>
  /** Formata o código no padrão da linguagem (id do Monaco); a extensão distingue casos como .tsx. */
  formatCode(language: string, extension: string, text: string): Promise<FormatResult>
  /**
   * Cofre de segredos do Cliente de API, por escopo (id do ambiente, da coleção ou "globals").
   * Não há como ler o valor de volta: só o Main usa os segredos, ao enviar as requisições.
   */
  apiSecretsInfo(): Promise<ApiSecretsInfo>
  apiSecretSet(scope: string, name: string, value: string): Promise<void>
  apiSecretHas(scope: string, name: string): Promise<boolean>
  apiSecretNames(scope: string): Promise<string[]>
  apiSecretDelete(scope: string, name: string): Promise<void>
  /** Envia uma requisição (a rede fica no Main; variáveis e segredos são resolvidos lá). */
  apiSend(input: ApiSendInput): Promise<ApiSendResult>
  /** Cancela um envio (ou uma execução do executor) aberto por esta janela. */
  apiCancel(runId: string): Promise<void>
  apiHistoryList(): Promise<ApiHistoryEntry[]>
  apiHistoryClear(): Promise<void>
  /** Cookies guardados para o ambiente (id) ou "default". */
  apiCookiesList(jar: string): Promise<ApiCookieJarEntry[]>
  /** Apaga os cookies do ambiente; com domain, só os desse domínio; com name, só esse cookie. */
  apiCookiesClear(jar: string, domain?: string, name?: string): Promise<void>
  /** Diálogo nativo para escolher arquivos (corpo, certificados, dados, importar); o Main autoriza os escolhidos. */
  apiPickFiles(purpose: ApiPickPurpose, multiple?: boolean): Promise<string[]>
  /** Lê um arquivo para importar (Postman, OpenAPI, HAR, curl...), numa thread com tempo limite. */
  apiImportParse(input: { text?: string; path?: string; format: ApiImportFormat }): Promise<ApiImportResponse>
  /** Grava arquivos de coleção dentro de uma pasta autorizada (não sobrescreve: acrescenta " (2)"). Devolve os caminhos. */
  apiWriteFiles(input: ApiWriteFilesInput): Promise<string[]>
  /** Executa uma coleção; o andamento chega por onApiRunProgress. */
  apiRunStart(input: ApiRunInput): Promise<void>
  apiRunCancel(runId: string): Promise<void>
  onApiRunProgress(listener: (progress: ApiRunProgress) => void): () => void
  /** Obtém um token OAuth 2.0 (navegador do sistema, loopback, Device Code...) e guarda no cofre. */
  apiOAuthAuthorize(input: ApiOAuthInput): Promise<ApiOAuthResult>
  apiOAuthCancel(runId: string): Promise<void>
  onApiOAuthProgress(listener: (progress: ApiOAuthProgress) => void): () => void
  apiOAuthTokenInfo(scope: string, tokenVar: string): Promise<ApiOAuthTokenInfo>
  apiOAuthClear(scope: string, tokenVar: string): Promise<void>
  /** Abre uma conexão WebSocket no Main (ws/wss); os eventos chegam por onApiWsEvent. */
  apiWsConnect(input: ApiWsConnectInput): Promise<ApiWsConnectResult>
  /** Envia uma mensagem (texto, ou binário em base64) por uma conexão aberta por esta janela. */
  apiWsSend(connId: string, message: { data: string; binary?: boolean }): Promise<void>
  apiWsClose(connId: string, code?: number): Promise<void>
  onApiWsEvent(listener: (event: ApiWsEvent) => void): () => void
  /** Sobe um servidor mock (127.0.0.1 por padrão) com as rotas dadas. */
  apiMockStart(input: ApiMockStartInput): Promise<ApiMockStartResult>
  apiMockStop(mockId: string): Promise<void>
  onApiMockLog(listener: (entry: ApiMockLogEntry) => void): () => void
  /** gRPC: lê os serviços do .proto ou da reflexão do servidor. */
  apiGrpcLoad(input: ApiGrpcLoadInput): Promise<ApiGrpcLoadResult>
  /** Abre uma chamada gRPC; mensagens, metadados e status chegam por onApiGrpcEvent. */
  apiGrpcStart(input: ApiGrpcStartInput): Promise<ApiGrpcStartResult>
  /** Envia mais uma mensagem (JSON) nas chamadas com streaming do cliente. */
  apiGrpcSend(callId: string, message: string): Promise<void>
  /** Fecha o envio (half-close) do streaming do cliente. */
  apiGrpcEnd(callId: string): Promise<void>
  apiGrpcCancel(callId: string): Promise<void>
  onApiGrpcEvent(listener: (event: ApiGrpcEvent) => void): () => void
  /** Monitores (rodam só com o app aberto). */
  apiMonitorList(): Promise<ApiMonitorState[]>
  apiMonitorSave(input: ApiMonitorInput): Promise<ApiMonitorSaveResult>
  apiMonitorDelete(id: string): Promise<void>
  apiMonitorRunNow(id: string): Promise<void>
  onApiMonitorEvent(listener: (event: ApiMonitorEvent) => void): () => void
  /** Registra a confiança nos scripts (da requisição ou da coleção inteira). */
  apiScriptTrust(input: ApiScriptTrustInput): Promise<void>
  apiScriptIsTrusted(input: ApiScriptTrustInput): Promise<boolean>
  /** Assistente de IA local (Ollama): estado, configuração e conversa com streaming (eventos em onAiChunk). */
  aiStatus(): Promise<AiStatus>
  aiGetSettings(): Promise<AiSettings>
  aiSetSettings(settings: AiSettings): Promise<AiSetSettingsResult>
  aiChat(input: AiChatInput): Promise<AiChatResult>
  aiCancel(id: string): Promise<void>
  onAiChunk(listener: (chunk: AiChunk) => void): () => void
  /** Instalar o Ollama e baixar modelos sem sair do app. URLs e executáveis são fixos no Main. */
  aiInstallInfo(): Promise<AiInstallInfo>
  aiInstallStart(): Promise<AiOpResult>
  aiInstallCancel(): Promise<void>
  aiStartServer(): Promise<AiOpResult>
  aiPull(model: string): Promise<AiOpResult>
  aiPullCancel(): Promise<void>
  aiDeleteModel(model: string): Promise<AiOpResult>
  onAiInstallProgress(listener: (progress: AiInstallProgress) => void): () => void
  /** O Main avisa que o usuário quer fechar a janela; o Renderer decide e chama closeWindow(). */
  onBeforeClose(listener: () => void): () => void
  closeWindow(): Promise<void>
}
