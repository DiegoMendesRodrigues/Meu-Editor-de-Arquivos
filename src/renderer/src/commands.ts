/**
 * Comandos da aplicação. Menus, toolbar e atalhos chamam estas funções,
 * para que cada ação tenha uma única implementação.
 */
import { useDocuments, isDirty, canPreview, type EditorDocument } from '@/store/documents'
import { runEditorAction } from '@/editor/editorRef'

const docs = () => useDocuments.getState()
const active = (): EditorDocument | undefined => {
  const s = docs()
  return s.documents.find((d) => d.id === s.activeId)
}

function reportError(action: string, err: unknown): void {
  const message = err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)
  window.alert(`Não foi possível ${action}.\n\n${message}`)
}

export function newFile(): void {
  docs().newDocument()
}

export async function openFile(): Promise<void> {
  try {
    docs().addOpenedFiles(await window.api.openFiles())
  } catch (err) {
    reportError('abrir o arquivo', err)
  }
}

export async function saveAs(doc = active()): Promise<boolean> {
  if (!doc) return false
  try {
    const content = doc.content
    const saved = await window.api.saveFileAs({ suggestedName: doc.path ?? doc.name, content, encoding: doc.encoding })
    if (!saved) return false
    docs().markSaved(doc.id, saved, content)
    return true
  } catch (err) {
    reportError('salvar o arquivo', err)
    return false
  }
}

export async function save(doc = active()): Promise<boolean> {
  if (!doc) return false
  if (!doc.path) return saveAs(doc)
  try {
    const content = doc.content
    const saved = await window.api.saveFile({ path: doc.path, content, encoding: doc.encoding })
    docs().markSaved(doc.id, saved, content)
    return true
  } catch (err) {
    reportError('salvar o arquivo', err)
    return false
  }
}

export async function closeFile(id = docs().activeId): Promise<void> {
  const doc = docs().documents.find((d) => d.id === id)
  if (!doc) return
  if (isDirty(doc)) {
    const shouldSave = window.confirm(`"${doc.name}" tem alterações não salvas.\n\nOK salva antes de fechar; Cancelar descarta as alterações.`)
    if (shouldSave && !(await save(doc))) return
  }
  docs().closeDocument(doc.id)
}

export const undo = (): void => runEditorAction('undo')
export const redo = (): void => runEditorAction('redo')
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
