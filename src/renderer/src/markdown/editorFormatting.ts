/**
 * Aplica as transformações de format.ts à seleção atual do Monaco.
 */
import type { editor } from 'monaco-editor'
import { monaco } from '@/editor/monacoSetup'
import { getActiveEditor } from '@/editor/editorRef'
import * as fmt from './format'

type Editor = editor.IStandaloneCodeEditor

function withEditor(fn: (ed: Editor, model: editor.ITextModel) => void): void {
  const ed = getActiveEditor()
  const model = ed?.getModel()
  if (!ed || !model) return
  fn(ed, model)
  ed.focus()
}

/** Transforma as linhas completas cobertas pela seleção principal. */
function transformLines(transform: (lines: string[]) => string[]): void {
  withEditor((ed, model) => {
    const sel = ed.getSelection()!
    // Uma seleção que termina na coluna 1 não inclui aquela linha.
    const endLine = sel.endLineNumber > sel.startLineNumber && sel.endColumn === 1 ? sel.endLineNumber - 1 : sel.endLineNumber
    const range = new monaco.Range(sel.startLineNumber, 1, endLine, model.getLineMaxColumn(endLine))
    const lines = Array.from({ length: endLine - sel.startLineNumber + 1 }, (_, i) => model.getLineContent(sel.startLineNumber + i))
    const text = transform(lines).join(model.getEOL())
    ed.pushUndoStop()
    ed.executeEdits('markdown-format', [{ range, text }])
    ed.pushUndoStop()
    const last = sel.startLineNumber + lines.length - 1
    ed.setSelection(new monaco.Range(sel.startLineNumber, 1, last, model.getLineMaxColumn(last)))
  })
}

/** Transforma o texto de cada seleção (suporta múltiplos cursores). */
function transformSelections(transform: (text: string) => string, emptyCaretOffset?: number): void {
  withEditor((ed, model) => {
    const selections = ed.getSelections() ?? []
    ed.pushUndoStop()
    ed.executeEdits(
      'markdown-format',
      selections.map((sel) => ({ range: sel, text: transform(model.getValueInRange(sel)) })),
      (inverse) =>
        inverse.map((edit, i) => {
          const r = edit.range
          // Sem seleção, posiciona o cursor entre os marcadores inseridos.
          if (selections[i].isEmpty() && emptyCaretOffset !== undefined) {
            const pos = model.getPositionAt(model.getOffsetAt(r.getStartPosition()) + emptyCaretOffset)
            return new monaco.Selection(pos.lineNumber, pos.column, pos.lineNumber, pos.column)
          }
          return new monaco.Selection(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn)
        })
    )
    ed.pushUndoStop()
  })
}

export const heading = (level: number): void => transformLines((lines) => lines.map((l) => fmt.setHeading(l, level)))
export const bulletList = (): void => transformLines(fmt.toggleBulletList)
export const numberedList = (): void => transformLines(fmt.toggleNumberedList)

const wrap = (marker: string) => () => transformSelections((t) => fmt.toggleWrap(t, marker), marker.length)
export const bold = wrap('**')
export const italic = wrap('*')
export const strikethrough = wrap('~~')

export const link = (): void => transformSelections(fmt.makeLink)
export const removeFormatting = (): void => transformSelections(fmt.stripFormatting)

export function indent(): void {
  getActiveEditor()?.focus()
  getActiveEditor()?.trigger('markdown-format', 'editor.action.indentLines', null)
}

export function outdent(): void {
  getActiveEditor()?.focus()
  getActiveEditor()?.trigger('markdown-format', 'editor.action.outdentLines', null)
}

/** Insere uma tabela 3x2 em uma linha própria, abaixo do cursor. */
export function table(): void {
  withEditor((ed, model) => {
    const pos = ed.getPosition()!
    const eol = model.getEOL()
    const lineIsEmpty = model.getLineContent(pos.lineNumber).trim() === ''
    const col = lineIsEmpty ? 1 : model.getLineMaxColumn(pos.lineNumber)
    const prefix = lineIsEmpty ? '' : eol + eol
    const text = prefix + fmt.tableTemplate().split('\n').join(eol) + eol
    ed.pushUndoStop()
    ed.executeEdits('markdown-format', [{ range: new monaco.Range(pos.lineNumber, col, pos.lineNumber, col), text }])
    ed.pushUndoStop()
  })
}

/** Atalhos de formatação dentro do editor, ativos só em documentos Markdown. */
export function registerMarkdownKeybindings(ed: Editor): void {
  const { KeyMod, KeyCode } = monaco
  const when = "editorLangId == 'markdown'"
  ed.addAction({ id: 'md.bold', label: 'Markdown: Negrito', precondition: when, keybindings: [KeyMod.CtrlCmd | KeyCode.KeyB], run: bold })
  ed.addAction({ id: 'md.italic', label: 'Markdown: Itálico', precondition: when, keybindings: [KeyMod.CtrlCmd | KeyCode.KeyI], run: italic })
  // Ctrl+K fica livre: no Monaco ele inicia combinações como Ctrl+K Ctrl+C.
  ed.addAction({ id: 'md.strike', label: 'Markdown: Tachado', precondition: when, keybindings: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyX], run: strikethrough })
}
