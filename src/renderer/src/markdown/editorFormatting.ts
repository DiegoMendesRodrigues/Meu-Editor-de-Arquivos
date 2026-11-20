// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Formatação de Markdown pela barra de ferramentas: no modo de edição de texto, aplica as
 * transformações de format.ts à seleção do Monaco; na visualização editável, usa os comandos do
 * editor formatado (o resultado é o mesmo Markdown).
 */
import { t } from '@/i18n'
import type { editor } from 'monaco-editor'
import { monaco } from '@/editor/monacoSetup'
import { getActiveEditor } from '@/editor/editorRef'
import * as fmt from './format'
import { getActiveWysiwyg } from './wysiwygRef'
import type { Editor as Wysiwyg } from '@tiptap/react'

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

/** Na visualização editável, executa a ação no editor formatado; senão, a versão do Monaco. */
const either =
  (rich: (ed: Wysiwyg) => void, plain: () => void) =>
  (): void => {
    const ed = getActiveWysiwyg()
    if (ed) rich(ed)
    else plain()
  }

type Level = 1 | 2 | 3 | 4 | 5 | 6
export const heading = (level: number): void =>
  either(
    (ed) => (level <= 0 ? ed.chain().focus().setParagraph().run() : ed.chain().focus().setHeading({ level: Math.min(level, 6) as Level }).run()),
    () => transformLines((lines) => lines.map((l) => fmt.setHeading(l, level)))
  )()
export const bulletList = either((ed) => ed.chain().focus().toggleBulletList().run(), () => transformLines(fmt.toggleBulletList))
export const numberedList = either((ed) => ed.chain().focus().toggleOrderedList().run(), () => transformLines(fmt.toggleNumberedList))

const wrap = (marker: string) => () => transformSelections((t) => fmt.toggleWrap(t, marker), marker.length)
export const bold = either((ed) => ed.chain().focus().toggleBold().run(), wrap('**'))
export const italic = either((ed) => ed.chain().focus().toggleItalic().run(), wrap('*'))
export const strikethrough = either((ed) => ed.chain().focus().toggleStrike().run(), wrap('~~'))

/** Link: com texto selecionado, vira link (o endereço é o próprio texto, se for um); sem seleção, insere um link de exemplo. */
export const link = either(
  (ed) => {
    const { from, to, empty } = ed.state.selection
    if (ed.isActive('link')) return void ed.chain().focus().extendMarkRange('link').unsetLink().run()
    if (empty) {
      const text = t('md.linkText')
      return void ed.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href: 'https://' } }] }).run()
    }
    const selected = ed.state.doc.textBetween(from, to).trim()
    ed.chain().focus().setLink({ href: /^(https?:\/\/|mailto:)/i.test(selected) ? selected : 'https://' }).run()
  },
  () => transformSelections((text) => fmt.makeLink(text, t('md.linkText')))
)
export const removeFormatting = either((ed) => ed.chain().focus().unsetAllMarks().clearNodes().run(), () => transformSelections(fmt.stripFormatting))

/** Recuo: em listas, aprofunda o item; no Monaco, indenta as linhas. */
export const indent = either(
  (ed) => void (ed.chain().focus().sinkListItem('listItem').run() || ed.chain().focus().sinkListItem('taskItem').run()),
  () => {
    getActiveEditor()?.focus()
    getActiveEditor()?.trigger('markdown-format', 'editor.action.indentLines', null)
  }
)

export const outdent = either(
  (ed) => void (ed.chain().focus().liftListItem('listItem').run() || ed.chain().focus().liftListItem('taskItem').run()),
  () => {
    getActiveEditor()?.focus()
    getActiveEditor()?.trigger('markdown-format', 'editor.action.outdentLines', null)
  }
)

/** Insere uma tabela 3x2 em uma linha própria, abaixo do cursor. */
export function table(): void {
  const rich = getActiveWysiwyg()
  if (rich) {
    rich.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    return
  }
  withEditor((ed, model) => {
    const pos = ed.getPosition()!
    const eol = model.getEOL()
    const lineIsEmpty = model.getLineContent(pos.lineNumber).trim() === ''
    const col = lineIsEmpty ? 1 : model.getLineMaxColumn(pos.lineNumber)
    const prefix = lineIsEmpty ? '' : eol + eol
    const text = prefix + fmt.tableTemplate(3, 2, t('md.column')).split('\n').join(eol) + eol
    ed.pushUndoStop()
    ed.executeEdits('markdown-format', [{ range: new monaco.Range(pos.lineNumber, col, pos.lineNumber, col), text }])
    ed.pushUndoStop()
  })
}

/** Atalhos de formatação dentro do editor, ativos só em documentos Markdown. */
export function registerMarkdownKeybindings(ed: Editor): void {
  const { KeyMod, KeyCode } = monaco
  const when = "editorLangId == 'markdown'"
  ed.addAction({ id: 'md.bold', label: `Markdown: ${t('toolbar.bold')}`, precondition: when, keybindings: [KeyMod.CtrlCmd | KeyCode.KeyB], run: bold })
  ed.addAction({ id: 'md.italic', label: `Markdown: ${t('toolbar.italic')}`, precondition: when, keybindings: [KeyMod.CtrlCmd | KeyCode.KeyI], run: italic })
  // Ctrl+K fica livre: no Monaco ele inicia combinações como Ctrl+K Ctrl+C.
  ed.addAction({ id: 'md.strike', label: `Markdown: ${t('toolbar.strike')}`, precondition: when, keybindings: [KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyX], run: strikethrough })
}
