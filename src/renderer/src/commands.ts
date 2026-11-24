// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Comandos da aplicação. Menus, toolbar e atalhos chamam estas funções,
 * para que cada ação tenha uma única implementação.
 */
import { getActiveWysiwyg } from '@/markdown/wysiwygRef'
import type { MessageKey } from '@shared/i18n'
import { t } from '@/i18n'
import { useDocuments, isDirty, canPreview, type EditorDocument } from '@/store/documents'
import { useWorkspace } from '@/store/workspace'
import { getActiveEditor, revealInDocument, runEditorAction } from '@/editor/editorRef'
import { useSearch } from '@/store/search'
import { useView } from '@/store/view'
import { pushToCloud, requestCloudSave } from '@/cloud'
import { storageMode } from '@/store/cloud'
import { useDialogs } from '@/store/dialogs'
import { useLibrary } from '@/store/library'
import { playMacro, startRecording, stopRecording } from '@/editor/macros'
import { flushWorkspace } from '@/workspaceSync'
import { flushSession, hasUnsavedText, unsavedFitsInSession } from '@/session'
import { toStoredText } from '@shared/eol'
import type { Eol, HashAlgorithm } from '@shared/ipc'
import { useNotice } from '@/store/notice'
import { selectedText } from '@/textCommands'
import { createTerminal } from '@/terminal/terminalBus'
import { useApiStore } from '@/store/api'
import { useAi } from '@/ai/store'
export { autoFormat, collapseSpaces, convertCase, trimSpaces, urlEncodeDecode } from '@/textCommands'

const docs = () => useDocuments.getState()
const active = (): EditorDocument | undefined => {
  const s = docs()
  return s.documents.find((d) => d.id === s.activeId)
}

function reportError(titleKey: MessageKey, err: unknown): void {
  const message = err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)
  window.alert(t(titleKey) + '\n\n' + message)
}

const refreshRecent = (): void => void useWorkspace.getState().refreshRecent()

export function newFile(extension?: string): void {
  docs().newDocument(extension)
}

/** Ferramentas → Cliente de API (Ctrl+Shift+A): uma nova requisição, aberta no construtor. */
export function openApiClient(): void {
  useApiStore.getState().setSidebarOn(true)
  docs().newDocument('apireq')
}

/** Ferramentas → Assistente de IA (Ctrl+Shift+I): abre ou fecha o painel à direita. */
export function toggleAssistant(): void {
  useAi.getState().toggle()
}

/** Ferramentas → Ambientes: um ambiente novo, aberto no construtor. */
export function newEnvironmentDocument(): void {
  useApiStore.getState().setSidebarOn(true)
  docs().newDocument('apienv')
}

/** Ferramentas → WebSocket: uma nova conexão, aberta no construtor. */
export function newWebSocketDocument(): void {
  useApiStore.getState().setSidebarOn(true)
  docs().newDocument('apiws')
}

/** Ferramentas → gRPC: uma nova chamada, aberta no construtor. */
export function newGrpcDocument(): void {
  useApiStore.getState().setSidebarOn(true)
  docs().newDocument('apigrpc')
}

/** Ferramentas → Importar…: curl, Postman, OpenAPI, Insomnia, HAR e .http. */
export function openApiImport(): void {
  useApiStore.getState().setSidebarOn(true)
  useApiStore.getState().openDialog({ kind: 'import' })
}

/** Ferramentas → Servidor mock: sem coleção de origem (escolhe um arquivo OpenAPI). */
export function openApiMock(): void {
  useApiStore.getState().openDialog({ kind: 'mock' })
}

/** Ferramentas → Monitores de API: lista os monitores e cria novos (a pasta é escolhida no formulário). */
export function openApiMonitor(): void {
  useApiStore.getState().openDialog({ kind: 'monitor' })
}

/** Ferramentas → Cookies: os cookies guardados pelo Cliente de API. */
export function openApiCookies(): void {
  useApiStore.getState().openDialog({ kind: 'cookies' })
}

/** Ferramentas → Histórico: mostra as seções de API (com o histórico) na barra lateral. */
export function showApiHistory(): void {
  useApiStore.getState().setSidebarOn(true)
  if (!useView.getState().sidebarVisible) useView.getState().toggle('sidebarVisible')
}

export async function openFile(): Promise<void> {
  // Com a conta conectada (e a nuvem escolhida no rodapé), abrir usa a nuvem.
  if (storageMode() === 'cloud') return useDialogs.getState().show('cloudOpen')
  try {
    docs().addOpenedFiles(await window.api.openFiles())
    refreshRecent()
  } catch (err) {
    reportError('err.openFile', err)
  }
}

/** Abre os arquivos arrastados do explorador do sistema para a janela. */
export async function openDroppedFiles(files: File[]): Promise<void> {
  if (files.length === 0) return
  try {
    const { opened, failed } = await window.api.openDroppedFiles(files)
    docs().addOpenedFiles(opened)
    if (opened.length > 0) refreshRecent()
    if (failed.length > 0) window.alert(t('err.openFile') + '\n\n' + failed.join('\n'))
  } catch (err) {
    reportError('err.openFile', err)
  }
}

/** Abre um arquivo pelo caminho (explorador ou recentes); se já estiver aberto, só ativa a aba. */
export async function openPath(path: string): Promise<void> {
  const existing = docs().documents.find((d) => d.path === path)
  if (existing) return docs().setActive(existing.id)
  try {
    docs().addOpenedFiles([await window.api.readFile(path)])
    refreshRecent()
  } catch (err) {
    reportError('err.openFile', err)
  }
}

export async function openFolder(): Promise<void> {
  try {
    const folder = await window.api.openFolder()
    if (folder) useWorkspace.getState().setFolder(folder)
  } catch (err) {
    reportError('err.openFolder', err)
  }
}

export const closeFolder = (): void => useWorkspace.getState().setFolder(null)

export async function saveAs(doc = active()): Promise<boolean> {
  if (!doc) return false
  if (storageMode() === 'cloud') return requestCloudSave(doc)
  try {
    const content = doc.content
    const saved = await window.api.saveFileAs({ suggestedName: doc.path ?? doc.name, content: toStoredText(content, doc.eol), encoding: doc.encoding })
    if (!saved) return false
    if (doc.path && doc.path !== saved.path) void window.api.unwatchFile(doc.path)
    docs().markSaved(doc.id, saved, content)
    refreshRecent()
    return true
  } catch (err) {
    reportError('err.saveFile', err)
    return false
  }
}

export async function save(doc = active()): Promise<boolean> {
  if (!doc) return false
  // Documento aberto da nuvem (sem arquivo no disco): Ctrl+S grava de volta na nuvem.
  if (!doc.path && doc.cloud) return pushToCloud(doc, doc.cloud.path)
  if (!doc.path) return saveAs(doc)
  try {
    const content = doc.content
    const saved = await window.api.saveFile({ path: doc.path, content: toStoredText(content, doc.eol), encoding: doc.encoding })
    docs().markSaved(doc.id, saved, content)
    return true
  } catch (err) {
    reportError('err.saveFile', err)
    return false
  }
}

export async function saveAll(): Promise<boolean> {
  for (const doc of docs().documents.filter(isDirty)) {
    if (!(await save(doc))) return false
  }
  return true
}

/**
 * Pergunta o que fazer com os documentos não salvos (Salvar / Não salvar / Cancelar).
 * Devolve true quando é seguro prosseguir com o fechamento.
 */
async function resolveUnsaved(targets: EditorDocument[]): Promise<boolean> {
  const dirty = targets.filter(isDirty)
  if (dirty.length === 0) return true
  const choice = await window.api.confirmUnsaved(dirty.map((d) => d.name))
  if (choice === 'cancel') return false
  if (choice === 'discard') return true
  for (const doc of dirty) {
    docs().setActive(doc.id)
    if (!(await save(doc))) return false
  }
  return true
}

function discard(doc: EditorDocument): void {
  if (doc.path) void window.api.unwatchFile(doc.path)
  docs().closeDocument(doc.id)
}

export async function closeFile(id = docs().activeId): Promise<void> {
  const doc = docs().documents.find((d) => d.id === id)
  if (!doc) return
  if (!(await resolveUnsaved([doc]))) return
  // Relê o documento: ele pode ter sido salvo com outro caminho.
  const current = docs().documents.find((d) => d.id === doc.id)
  if (current) discard(current)
}

export async function closeAll(): Promise<void> {
  const all = docs().documents
  if (!(await resolveUnsaved(all))) return
  docs().documents.forEach(discard)
}

/** Chamado quando o usuário fecha a janela (botão X, Alt+F4 ou menu Sair). */
/**
 * Fecha o app sem perguntar: os documentos, inclusive o texto não salvo, ficam guardados na
 * sessão e voltam na próxima abertura. Só se isso não for possível (texto grande demais ou
 * falha ao gravar) é que o app pergunta o que fazer com os não salvos.
 */
export async function requestQuit(): Promise<void> {
  await flushWorkspace()
  if (!hasUnsavedText() || unsavedFitsInSession()) {
    if (await flushSession(true)) return window.api.closeWindow()
  }
  if (!(await resolveUnsaved(docs().documents))) return
  await flushSession(false)
  await window.api.closeWindow()
}

// Na visualização editável do Markdown, desfazer e refazer valem para o editor formatado.
export const undo = (): void => void (getActiveWysiwyg()?.chain().focus().undo().run() ?? runEditorAction('undo'))
export const redo = (): void => void (getActiveWysiwyg()?.chain().focus().redo().run() ?? runEditorAction('redo'))
export const find = (): void => runEditorAction('actions.find')
export const replace = (): void => runEditorAction('editor.action.startFindReplaceAction')
export const goToLine = (): void => runEditorAction('editor.action.gotoLine')
export const selectAll = (): void => runEditorAction('editor.action.selectAll')
export const commandPalette = (): void => runEditorAction('editor.action.quickCommand')
export const sortLinesAsc = (): void => runEditorAction('editor.action.sortLinesAscending')
export const sortLinesDesc = (): void => runEditorAction('editor.action.sortLinesDescending')
export const removeDuplicateLines = (): void => runEditorAction('editor.action.removeDuplicateLines')
export const trimWhitespace = (): void => runEditorAction('editor.action.trimTrailingWhitespace')
export const toggleColumnSelection = (): void => runEditorAction('editor.action.toggleColumnSelection')
export const foldAll = (): void => runEditorAction('editor.foldAll')
export const unfoldAll = (): void => runEditorAction('editor.unfoldAll')

/** Alterna o documento ativo entre a visualização (Markdown formatado ou JSON em árvore) e o texto. */
export function togglePreview(): void {
  const doc = active()
  if (!doc || !canPreview(doc)) return
  docs().setMode(doc.id, doc.mode === 'preview' ? 'edit' : 'preview')
}

/** Formata (indenta) o documento inteiro com o formatador da linguagem, quando houver. */
export const formatDocument = (): void => runEditorAction('editor.action.formatDocument')

/** Abre o painel de busca em arquivos; usa o texto selecionado no editor como consulta. */
export function openSearch(): void {
  const ed = getActiveEditor()
  const sel = ed?.getModel() && ed.getSelection() && !ed.getSelection()!.isEmpty() ? ed.getModel()!.getValueInRange(ed.getSelection()!) : ''
  if (sel && !sel.includes('\n') && sel.length <= 200) useSearch.getState().setField('query', sel)
  if (!useView.getState().bottomPanelVisible) useView.getState().toggle('bottomPanelVisible')
  useSearch.getState().focusQuery()
}

/** Abre o arquivo de um resultado de busca e seleciona a ocorrência. */
export async function openMatch(path: string, line: number, column: number, length: number): Promise<void> {
  await openPath(path)
  const doc = docs().documents.find((d) => d.path === path)
  if (!doc) return
  if (doc.mode === 'preview') docs().setMode(doc.id, 'edit')
  revealInDocument(doc.id, line, column, length)
}

export function setLanguage(language: string): void {
  const doc = active()
  if (doc) docs().setLanguage(doc.id, language)
}

export function convertEncoding(encoding: 'UTF-8' | 'UTF-8 BOM'): void {
  const doc = active()
  if (doc) docs().setEncoding(doc.id, encoding)
}

/** Converte as quebras de linha do documento ativo: Windows (CRLF), Unix (LF) ou Mac (CR). */
export function convertEol(eol: Eol): void {
  const doc = active()
  if (doc) docs().setEol(doc.id, eol)
}

/** Entra ou sai da tela inteira: a janela ocupa a tela e só o documento fica visível. */
export function toggleFullScreen(): void {
  const on = !useView.getState().fullScreen
  useView.getState().setFullScreen(on)
  void window.api.setFullScreen(on)
}

export const openHash = (algorithm: HashAlgorithm): void => useDialogs.getState().showHash(algorithm)

/** Gera o hash do texto selecionado no documento e o deixa na área de transferência. */
export async function hashSelection(algorithm: HashAlgorithm): Promise<void> {
  const text = selectedText()
  if (!text) return window.alert(t('hash.noSelection', { algorithm }))
  try {
    await window.api.copyText(await window.api.hashText(algorithm, text))
    useNotice.getState().show(t('hash.copied', { algorithm }))
  } catch (err) {
    reportError('err.hash', err)
  }
}

export { toggleTheme } from '@/theme'

/** Abre um terminal novo (o shell do usuário, na pasta pessoal) no painel abaixo do documento. */
export const openTerminal = (): void => void createTerminal().catch((err) => reportError('err.terminal', err))

export const zoomIn = (): void => useView.getState().zoomFont(1)
export const zoomOut = (): void => useView.getState().zoomFont(-1)
export const zoomReset = (): void => useView.getState().resetFont()

export const openSnippets = (): void => useDialogs.getState().show('snippets')
export const openMacros = (): void => useDialogs.getState().show('macros')

/** Inicia ou encerra a gravação de macro. */
export function toggleMacroRecording(): void {
  if (useLibrary.getState().recording) stopRecording()
  else startRecording()
}

/** Executa de novo a última gravação. */
export function playLastMacro(): void {
  const { steps, recording } = useLibrary.getState()
  if (!recording && steps.length > 0) playMacro({ id: 'last', name: '', steps })
}

export const openAccount = (): void => useDialogs.getState().show('account')
export const openCloudFiles = (): void => useDialogs.getState().show('cloudOpen')
export const saveToCloudDialog = (): void => {
  const doc = active()
  if (doc) void requestCloudSave(doc)
}

export const openSupport = (): void => void window.api.openSupport().catch((err) => reportError('err.openSupport', err))
export const openManual = (): void => void window.api.openManual().catch((err) => reportError('err.openManual', err))
export const openShortcuts = (): void => useDialogs.getState().show('shortcuts')
export const openAbout = (): void => useDialogs.getState().show('about')
export const checkUpdate = (): void => useDialogs.getState().show('update')
