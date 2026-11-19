import type { editor } from 'monaco-editor'
import { recordCommand } from './macros'

/**
 * Referência à instância ativa do Monaco, usada pelos menus e pela toolbar
 * para disparar ações do editor (desfazer, localizar, ir para linha etc.).
 */
let current: editor.IStandaloneCodeEditor | null = null

export const setActiveEditor = (ed: editor.IStandaloneCodeEditor | null): void => {
  current = ed
}

export const getActiveEditor = (): editor.IStandaloneCodeEditor | null => current

/** Posição (e trecho opcional) a revelar quando o editor for montado ou trocar de documento. */
let pendingReveal: { line: number; column: number; length: number } | null = null

export function requestReveal(line: number, column: number, length = 0): void {
  pendingReveal = { line, column, length }
}

export function consumeReveal(ed: editor.IStandaloneCodeEditor): void {
  if (!pendingReveal) return
  const { line, column, length } = pendingReveal
  pendingReveal = null
  const model = ed.getModel()
  const start = { lineNumber: line, column }
  if (model && length > 0) {
    const end = model.getPositionAt(model.getOffsetAt(start) + length)
    ed.setSelection({ startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column })
  } else {
    ed.setPosition(start)
  }
  ed.revealLineInCenter(line)
  ed.focus()
}

/**
 * Revela a posição no documento `docId`. Se o editor já estiver montado, espera o modelo
 * do documento ser exibido; se não, o consumeReveal da montagem cuida disso.
 */
export function revealInDocument(docId: string, line: number, column: number, length: number): void {
  requestReveal(line, column, length)
  let tries = 0
  const tick = (): void => {
    const ed = current
    if (!pendingReveal) return
    if (ed && ed.getModel()?.uri.path.startsWith(`/${docId}/`)) return consumeReveal(ed)
    if (++tries < 20) setTimeout(tick, 25)
  }
  tick()
}

/** Executa uma ação do Monaco pelo id, devolvendo o foco ao editor. */
export function runEditorAction(actionId: string): void {
  const ed = current
  if (!ed) return
  ed.focus()
  recordCommand(actionId)
  const action = ed.getAction(actionId)
  if (action) void action.run()
  else ed.trigger('menu', actionId, null)
}
