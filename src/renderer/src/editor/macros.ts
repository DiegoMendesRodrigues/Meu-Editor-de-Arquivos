// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Gravação e reprodução de macros.
 * Grava o que o usuário digita (onDidType) e as teclas de navegação/edição, mais os
 * comandos de menu executados pelo editor. A reprodução refaz os passos no editor ativo.
 */
import type { editor } from 'monaco-editor'
import type { Macro, MacroStep } from '@shared/ipc'
import { getActiveEditor } from './editorRef'
import { useLibrary } from '@/store/library'

type Mods = 'plain' | 'shift' | 'ctrl' | 'ctrlShift'

/** Tecla → comando do Monaco, por combinação de modificadores. */
const KEY_COMMANDS: Record<string, Partial<Record<Mods, string>>> = {
  ArrowLeft: { plain: 'cursorLeft', shift: 'cursorLeftSelect', ctrl: 'cursorWordLeft', ctrlShift: 'cursorWordLeftSelect' },
  ArrowRight: { plain: 'cursorRight', shift: 'cursorRightSelect', ctrl: 'cursorWordRight', ctrlShift: 'cursorWordRightSelect' },
  ArrowUp: { plain: 'cursorUp', shift: 'cursorUpSelect' },
  ArrowDown: { plain: 'cursorDown', shift: 'cursorDownSelect' },
  Home: { plain: 'cursorHome', shift: 'cursorHomeSelect' },
  End: { plain: 'cursorEnd', shift: 'cursorEndSelect' },
  Backspace: { plain: 'deleteLeft', ctrl: 'deleteWordLeft' },
  Delete: { plain: 'deleteRight', ctrl: 'deleteWordRight' },
  Tab: { plain: 'tab', shift: 'outdent' }
}

const modsOf = (e: KeyboardEvent): Mods | null => {
  if (e.altKey || e.metaKey) return null
  if (e.ctrlKey) return e.shiftKey ? 'ctrlShift' : 'ctrl'
  return e.shiftKey ? 'shift' : 'plain'
}

/** Junta textos digitados em sequência num único passo. */
function push(step: MacroStep): void {
  const { steps } = useLibrary.getState()
  const last = steps[steps.length - 1]
  const next = last?.type === 'text' && step.type === 'text' ? [...steps.slice(0, -1), { type: 'text' as const, text: last.text + step.text }] : [...steps, step]
  useLibrary.setState({ steps: next })
}

export const isRecording = (): boolean => useLibrary.getState().recording

export function startRecording(): void {
  useLibrary.setState({ recording: true, steps: [] })
  getActiveEditor()?.focus()
}

export function stopRecording(): void {
  useLibrary.setState({ recording: false })
}

/** Registra um comando executado por menu/atalho (só durante a gravação). */
export function recordCommand(id: string): void {
  if (isRecording()) push({ type: 'command', id })
}

/** Liga a captura ao editor; devolve a função que desliga. */
export function attachRecorder(ed: editor.IStandaloneCodeEditor): () => void {
  const keys = ed.onKeyDown((e) => {
    if (!isRecording()) return
    const ev = e.browserEvent
    // Texto digitado: tecla imprimível sem Ctrl/Meta (AltGr chega como Ctrl+Alt) e Enter.
    const altGr = ev.ctrlKey && ev.altKey
    if (ev.key.length === 1 && !ev.metaKey && (!ev.ctrlKey || altGr)) return push({ type: 'text', text: ev.key })
    if (ev.key === 'Enter' && !ev.ctrlKey && !ev.altKey && !ev.metaKey) return push({ type: 'text', text: String.fromCharCode(10) })
    const mods = modsOf(ev)
    const id = mods && KEY_COMMANDS[ev.key]?.[mods]
    if (id) push({ type: 'command', id })
  })
  // O texto colado é gravado como texto, para a macro não depender da área de transferência.
  const paste = ed.onDidPaste((e) => {
    const text = ed.getModel()?.getValueInRange(e.range)
    if (isRecording() && text) push({ type: 'text', text })
  })
  return () => {
    keys.dispose()
    paste.dispose()
  }
}

/** Reproduz os passos no editor ativo; devolve false se não houver editor. */
export function play(steps: MacroStep[], times = 1): boolean {
  const ed = getActiveEditor()
  if (!ed || steps.length === 0) return false
  ed.focus()
  for (let i = 0; i < times; i++) {
    ed.pushUndoStop()
    for (const step of steps) {
      if (step.type === 'text') ed.trigger('macro', 'type', { text: step.text })
      else if (ed.getAction(step.id)) void ed.getAction(step.id)!.run()
      else ed.trigger('macro', step.id, null)
    }
  }
  ed.pushUndoStop()
  return true
}

export const playMacro = (macro: Macro, times = 1): boolean => play(macro.steps, times)
