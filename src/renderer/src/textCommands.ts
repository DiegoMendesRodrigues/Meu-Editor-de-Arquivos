// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Comandos de texto dos menus Editar (letras e espaços) e Codificação (auto formatação e URL).
 * Funcionam no editor de texto (Monaco) e na visualização editável do Markdown (Tiptap),
 * conforme o que estiver aberto.
 */
import type { editor, Selection } from 'monaco-editor'
import type { Editor } from '@tiptap/react'
import { getActiveEditor } from '@/editor/editorRef'
import { getActiveWysiwyg } from '@/markdown/wysiwygRef'
import { collapseDoubleSpaces, convertCaseText, sentenceCaser, toggleUrlEncoding, trimLine, type CaseMode, type TrimMode } from '@/editor/textOps'
import { languageLabel } from '@/editor/languages'
import { t } from '@/i18n'
import { useDocuments } from '@/store/documents'
import { useNotice } from '@/store/notice'
import { applyEol } from '@shared/eol'
import { FORMAT_MAX_CHARS } from '@shared/ipc'

interface Edit {
  range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }
  text: string
}

/** Aplica as alterações no Monaco como um único passo de desfazer. */
function applyMonaco(ed: editor.IStandaloneCodeEditor, source: string, edits: Edit[], keepSelections?: Selection[]): void {
  if (edits.length === 0) return
  ed.pushUndoStop()
  ed.executeEdits(source, edits, keepSelections ? () => keepSelections : undefined)
  ed.pushUndoStop()
  ed.focus()
}

/** Faixas de texto (trechos de um mesmo nó) a trocar na visualização formatada; aplicadas do fim para o começo. */
function applyWysiwyg(ed: Editor, changes: { from: number; to: number; text: string }[]): void {
  if (changes.length === 0 || !ed.isEditable) return
  ed.chain()
    .focus()
    .command(({ tr }) => {
      for (const c of [...changes].sort((a, b) => b.from - a.from)) {
        if (c.text) tr.insertText(c.text, c.from, c.to)
        else tr.delete(c.from, c.to)
      }
      return true
    })
    .run()
}

// ---------------------------------------------------------------- Letras

export function convertCase(mode: CaseMode): void {
  const wys = getActiveWysiwyg()
  if (wys) return convertCaseWysiwyg(wys, mode)
  const ed = getActiveEditor()
  const model = ed?.getModel()
  if (!ed || !model) return
  const selections = (ed.getSelections() ?? []).filter((s) => !s.isEmpty())
  const edits = selections.map((range) => ({ range, text: convertCaseText(model.getValueInRange(range), mode) }))
  // Se o tamanho mudar (ß → SS), o Monaco ajusta a seleção; caso contrário, ela é mantida.
  const sameLength = edits.every((e) => e.text.length === model.getValueInRange(e.range).length)
  applyMonaco(ed, 'convertCase', edits, sameLength ? selections : undefined)
}

function convertCaseWysiwyg(ed: Editor, mode: CaseMode): void {
  const { from, to, empty } = ed.state.selection
  if (empty) return
  const caser = mode === 'sentence' ? sentenceCaser() : (text: string) => convertCaseText(text, mode)
  const changes: { from: number; to: number; text: string }[] = []
  let blocks = 0
  ed.state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock) {
      // Cada parágrafo, título ou item começa uma frase nova.
      if (blocks++ > 0) caser('\n')
      return true
    }
    if (!node.isText || !node.text) return true
    const start = Math.max(from, pos)
    const end = Math.min(to, pos + node.nodeSize)
    const text = node.text.slice(start - pos, end - pos)
    const converted = caser(text)
    if (converted !== text) changes.push({ from: start, to: end, text: converted })
    return false
  })
  applyWysiwyg(ed, changes)
}

// ---------------------------------------------------------------- Espaços

/** Limpa os espaços da linha atual (ou das linhas selecionadas). */
export function trimSpaces(mode: TrimMode): void {
  const wys = getActiveWysiwyg()
  if (wys) return trimSpacesWysiwyg(wys, mode)
  const ed = getActiveEditor()
  const model = ed?.getModel()
  if (!ed || !model) return
  const lines = new Set<number>()
  for (const s of ed.getSelections() ?? []) {
    // Uma seleção que termina no começo da linha seguinte não inclui essa linha.
    const last = s.endLineNumber > s.startLineNumber && s.endColumn === 1 ? s.endLineNumber - 1 : s.endLineNumber
    for (let line = s.startLineNumber; line <= last; line++) lines.add(line)
  }
  const edits: Edit[] = []
  for (const line of lines) {
    const text = model.getLineContent(line)
    const trimmed = trimLine(text, mode)
    if (trimmed !== text) {
      edits.push({ range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: text.length + 1 }, text: trimmed })
    }
  }
  applyMonaco(ed, 'trimSpaces', edits)
}

function trimSpacesWysiwyg(ed: Editor, mode: TrimMode): void {
  const { $from } = ed.state.selection
  const block = $from.parent
  if (!block.isTextblock || block.type.spec.code) return
  const start = $from.start()
  // Um caractere por posição: nós sem texto (imagens, quebras) contam como um caractere.
  const text = block.textBetween(0, block.content.size, undefined, '￼')
  const changes: { from: number; to: number; text: string }[] = []
  if (mode !== 'left') {
    const m = /[ \t]+$/.exec(text)
    if (m) changes.push({ from: start + m.index, to: start + text.length, text: '' })
  }
  if (mode !== 'right') {
    const m = /^[ \t]+/.exec(text)
    if (m && m[0].length < text.length) changes.push({ from: start, to: start + m[0].length, text: '' })
  }
  applyWysiwyg(ed, changes)
}

/** Troca espaços duplos por um espaço no documento inteiro (a indentação das linhas é mantida). */
export function collapseSpaces(): void {
  const wys = getActiveWysiwyg()
  if (wys) return collapseSpacesWysiwyg(wys)
  const ed = getActiveEditor()
  const model = ed?.getModel()
  if (!ed || !model) return
  const edits: Edit[] = []
  for (let line = 1; line <= model.getLineCount(); line++) {
    const text = model.getLineContent(line)
    const collapsed = collapseDoubleSpaces(text)
    if (collapsed !== text) {
      edits.push({ range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: text.length + 1 }, text: collapsed })
    }
  }
  applyMonaco(ed, 'collapseSpaces', edits)
}

function collapseSpacesWysiwyg(ed: Editor): void {
  const changes: { from: number; to: number; text: string }[] = []
  ed.state.doc.descendants((node, pos, parent) => {
    if (node.isTextblock && node.type.spec.code) return false // blocos de código ficam como estão
    if (!node.isText || !node.text || parent?.type.spec.code) return true
    for (const m of node.text.matchAll(/ {2,}/g)) {
      const at = pos + m.index! + 1
      changes.push({ from: at, to: at + m[0].length - 1, text: '' })
    }
    return false
  })
  applyWysiwyg(ed, changes)
}

// ---------------------------------------------------------------- Seleção

/** Texto selecionado no editor ativo (vários cursores: os trechos separados por quebra de linha). */
export function selectedText(): string {
  const wys = getActiveWysiwyg()
  if (wys) {
    const { from, to } = wys.state.selection
    return wys.state.doc.textBetween(from, to, '\n')
  }
  const ed = getActiveEditor()
  const model = ed?.getModel()
  if (!ed || !model) return ''
  return (ed.getSelections() ?? [])
    .filter((s) => !s.isEmpty())
    .map((s) => model.getValueInRange(s))
    .join('\n')
}

// ---------------------------------------------------------------- Auto formatação

/**
 * Remove os espaços duplos do documento inteiro (mantendo a indentação) e o formata no padrão da
 * linguagem (Python como Python, C como C…). Sem formatador para a linguagem, ou com erro de sintaxe,
 * só os espaços duplos são removidos. Tudo vira um único passo de desfazer no editor de texto.
 */
export async function autoFormat(): Promise<void> {
  const { documents, activeId, updateContent } = useDocuments.getState()
  const doc = documents.find((d) => d.id === activeId)
  if (!doc) return
  const ed = getActiveEditor()
  const model = ed?.getModel()
  const monaco = ed && model && model.uri.path.startsWith(`/${doc.id}/`) ? { ed, model } : null
  const original = monaco ? monaco.model.getValue() : doc.content
  // Linha a linha, para os espaços duplos sumirem sem mexer na quebra de linha (CRLF, LF).
  const collapsed = original.split(/(\r\n|\n|\r)/).map((part, i) => (i % 2 ? part : collapseDoubleSpaces(part))).join('')
  const language = languageLabel(doc.language)

  let formatted = collapsed
  let notice = t('format.done', { language })
  /** Problemas que o usuário precisa ver (erro de sintaxe, tempo esgotado) vão numa janela, não só na barra de status. */
  let problem: string | null = null
  if (collapsed.length > FORMAT_MAX_CHARS) {
    notice = t('format.tooLarge')
  } else {
    try {
      const extension = doc.name.includes('.') ? doc.name.split('.').pop()!.toLowerCase() : ''
      const result = await window.api.formatCode(doc.language, /^[a-z0-9]{0,10}$/.test(extension) ? extension : '', collapsed)
      if (result.status === 'ok') {
        formatted = result.text
        if (result.guessedIndent) notice = t('format.guessedIndent', { language })
      } else if (result.status === 'unsupported') {
        notice = t('format.unsupported', { language })
      } else {
        notice = problem = result.line ? t('format.invalidLine', { language, line: result.line }) : t('format.invalid', { language })
      }
    } catch (err) {
      notice = problem = err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)
    }
  }

  // O documento pode ter mudado (ou sido fechado) enquanto o formatador trabalhava.
  const current = useDocuments.getState().documents.find((d) => d.id === doc.id)
  const stillSame = monaco ? !monaco.model.isDisposed() && monaco.model.getValue() === original : current?.content === original
  if (!current || !stillSame) return
  if (formatted !== original) {
    if (monaco) {
      applyMonaco(monaco.ed, 'autoFormat', [{ range: monaco.model.getFullModelRange(), text: formatted }])
    } else {
      updateContent(doc.id, applyEol(formatted, doc.eol))
    }
  }
  useNotice.getState().show(notice)
  if (problem) window.alert(problem)
}

// ---------------------------------------------------------------- URL

/** Codifica (ou decodifica, se já estiver codificado) o texto selecionado no formato de URL. */
export function urlEncodeDecode(): void {
  const wys = getActiveWysiwyg()
  if (wys) return urlEncodeDecodeWysiwyg(wys)
  const ed = getActiveEditor()
  const model = ed?.getModel()
  if (!ed || !model) return
  const selections = (ed.getSelections() ?? []).filter((s) => !s.isEmpty())
  if (selections.length === 0) return window.alert(t('url.noSelection'))
  // A decisão (codificar ou decodificar) vale para todas as seleções, pela primeira.
  const mode = toggleUrlEncoding(model.getValueInRange(selections[0])).mode
  const edits = selections.map((range) => {
    const text = model.getValueInRange(range)
    const result = toggleUrlEncoding(text)
    return { range, text: result.mode === mode ? result.text : text }
  })
  applyMonaco(ed, 'urlEncodeDecode', edits)
  useNotice.getState().show(t(mode === 'encoded' ? 'url.encoded' : 'url.decoded'))
}

function urlEncodeDecodeWysiwyg(ed: Editor): void {
  const { from, to, empty } = ed.state.selection
  if (empty) return void window.alert(t('url.noSelection'))
  const mode = toggleUrlEncoding(ed.state.doc.textBetween(from, to, '\n')).mode
  // Trecho a trecho (como em convertCase), para manter as marcas (negrito, link…) e os parágrafos.
  const changes: { from: number; to: number; text: string }[] = []
  ed.state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText || !node.text) return true
    const start = Math.max(from, pos)
    const end = Math.min(to, pos + node.nodeSize)
    const text = node.text.slice(start - pos, end - pos)
    const result = toggleUrlEncoding(text)
    if (result.mode === mode && result.text !== text) changes.push({ from: start, to: end, text: result.text })
    return false
  })
  applyWysiwyg(ed, changes)
  useNotice.getState().show(t(mode === 'encoded' ? 'url.encoded' : 'url.decoded'))
}
