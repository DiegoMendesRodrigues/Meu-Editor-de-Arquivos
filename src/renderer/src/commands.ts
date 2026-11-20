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
import { pushToCloud } from '@/cloud'
import { useDialogs } from '@/store/dialogs'
import { useLibrary } from '@/store/library'
import { playMacro, startRecording, stopRecording } from '@/editor/macros'
import { flushSession, hasUnsavedText, unsavedFitsInSession } from '@/session'

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

export async function openFile(): Promise<void> {
  try {
    docs().addOpenedFiles(await window.api.openFiles())
    refreshRecent()
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
  try {
    const content = doc.content
    const saved = await window.api.saveFileAs({ suggestedName: doc.path ?? doc.name, content, encoding: doc.encoding })
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
    const saved = await window.api.saveFile({ path: doc.path, content, encoding: doc.encoding })
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

export function convertEol(eol: 'LF' | 'CRLF'): void {
  const doc = active()
  if (doc) docs().setEol(doc.id, eol)
}

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
  if (active()) useDialogs.getState().show('cloudSave')
}

export const openManual = (): void => void window.api.openManual().catch((err) => reportError('err.openManual', err))
export const openShortcuts = (): void => useDialogs.getState().show('shortcuts')
export const openAbout = (): void => useDialogs.getState().show('about')
