// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { getActiveEditor } from '@/editor/editorRef'
import { getActiveWysiwyg } from '@/markdown/wysiwygRef'
import { useDocuments } from '@/store/documents'
import { selectedText } from '@/textCommands'
import { limitText, QUICK_CONTEXT_CHARS, type DocContext } from './prompts'

/** Liga o assistente ao documento ativo: lê a seleção (ou o documento) e escreve no cursor. */

const activeDoc = () => {
  const s = useDocuments.getState()
  return s.documents.find((d) => d.id === s.activeId)
}

/** O Monaco que está mostrando o documento ativo (e não o de outra aba ou de um painel). */
function activeMonaco() {
  const doc = activeDoc()
  const ed = getActiveEditor()
  if (!doc || !ed) return null
  const model = ed.getModel()
  return model && model.uri.path.startsWith(`/${doc.id}/`) ? ed : null
}

/** Contexto para as ações rápidas: a seleção, se houver, senão o documento (limitado). Null sem documento. */
export function getDocContext(): DocContext | null {
  const doc = activeDoc()
  if (!doc) return null
  const selection = selectedText()
  const scope = selection.trim() !== '' ? 'selection' : 'document'
  const { text, truncated } = limitText(scope === 'selection' ? selection : doc.content, QUICK_CONTEXT_CHARS)
  if (text.trim() === '') return null
  return { name: doc.name, language: doc.language, scope, text, truncated }
}

/** Há onde escrever: um editor de texto ou o editor formatado do documento ativo, e ele não é só leitura. */
export function canWriteToDocument(): boolean {
  const ed = activeMonaco()
  if (ed) return !ed.getRawOptions().readOnly
  return getActiveWysiwyg() !== null
}

/** Escreve no documento ativo: `insert` no cursor (sem apagar a seleção), `replace` no lugar da seleção. */
export function writeToDocument(text: string, mode: 'insert' | 'replace'): boolean {
  const ed = activeMonaco()
  if (ed) {
    const sel = ed.getSelection()
    if (!sel || ed.getRawOptions().readOnly) return false
    const range = mode === 'replace' ? sel : { startLineNumber: sel.endLineNumber, startColumn: sel.endColumn, endLineNumber: sel.endLineNumber, endColumn: sel.endColumn }
    ed.pushUndoStop()
    ed.executeEdits('ai-assistant', [{ range, text, forceMoveMarkers: true }])
    ed.pushUndoStop()
    ed.focus()
    return true
  }
  const wys = getActiveWysiwyg()
  if (wys) {
    // Texto puro (nunca HTML); no editor formatado a seleção, se houver, é substituída.
    if (mode === 'insert') wys.commands.setTextSelection(wys.state.selection.to)
    return wys.chain().focus().insertContent({ type: 'text', text }).run()
  }
  return false
}
