import type { editor } from 'monaco-editor'

/**
 * Referência à instância ativa do Monaco, usada pelos menus e pela toolbar
 * para disparar ações do editor (desfazer, localizar, ir para linha etc.).
 */
let current: editor.IStandaloneCodeEditor | null = null

export const setActiveEditor = (ed: editor.IStandaloneCodeEditor | null): void => {
  current = ed
}

export const getActiveEditor = (): editor.IStandaloneCodeEditor | null => current

/** Posição a revelar quando o editor for montado (ex.: vindo do erro no JSON Viewer). */
let pendingReveal: { line: number; column: number } | null = null

export function requestReveal(line: number, column: number): void {
  pendingReveal = { line, column }
}

export function consumeReveal(ed: editor.IStandaloneCodeEditor): void {
  if (!pendingReveal) return
  const { line, column } = pendingReveal
  pendingReveal = null
  ed.setPosition({ lineNumber: line, column })
  ed.revealLineInCenter(line)
}

/** Executa uma ação do Monaco pelo id, devolvendo o foco ao editor. */
export function runEditorAction(actionId: string): void {
  const ed = current
  if (!ed) return
  ed.focus()
  const action = ed.getAction(actionId)
  if (action) void action.run()
  else ed.trigger('menu', actionId, null)
}
