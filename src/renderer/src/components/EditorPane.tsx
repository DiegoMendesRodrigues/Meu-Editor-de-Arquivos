// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor, IDisposable } from 'monaco-editor'
import { monaco } from '@/editor/monacoSetup'
import { consumeReveal, requestReveal, setActiveEditor } from '@/editor/editorRef'
import { JsonViewer } from '@/json/JsonViewer'
import { attachRecorder } from '@/editor/macros'
import { registerMarkdownKeybindings } from '@/markdown/editorFormatting'
import { MarkdownWysiwyg } from '@/markdown/MarkdownWysiwyg'
import { canPreview, modelPath, useActiveDocument, useDocuments, type EditorDocument } from '@/store/documents'
import { useView } from '@/store/view'
import { useShallow } from 'zustand/react/shallow'
import { newFile, openFile } from '@/commands'
import { useLocale, useT } from '@/i18n'
import { monacoSpeaks } from '@/editor/monacoNls'
import { attachSpellcheck, registerSpellcheck } from '@/spell/spellcheck'

registerSpellcheck()

function CodeEditor({ doc }: { doc: EditorDocument }) {
  const updateContent = useDocuments((s) => s.updateContent)
  const setCursor = useDocuments((s) => s.setCursor)
  // Só os campos usados aqui: o editor não é redesenhado quando outras preferências mudam.
  const view = useView(
    useShallow((s) => ({ fontSize: s.fontSize, wordWrap: s.wordWrap, showInvisibles: s.showInvisibles, tabSize: s.tabSize, insertSpaces: s.insertSpaces }))
  )
  const locale = useLocale((s) => s.locale)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const spellRef = useRef<IDisposable | null>(null)

  const handleMount: OnMount = (ed) => {
    editorRef.current = ed
    // O modelo é mantido entre as trocas de modo; se o texto mudou na visualização editável,
    // traz a mudança para cá (como uma edição: Ctrl+Z volta ao texto anterior).
    const model = ed.getModel()
    if (model && model.getValue() !== doc.content) {
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: doc.content }], () => null)
    }
    setActiveEditor(ed)
    registerMarkdownKeybindings(ed)
    attachRecorder(ed)
    spellRef.current = attachSpellcheck(ed)

    const reportCursor = () => {
      const pos = ed.getPosition()
      const model = ed.getModel()
      const selectedChars = (ed.getSelections() ?? []).reduce(
        (sum, sel) => sum + (model ? model.getValueLengthInRange(sel) : 0),
        0
      )
      setCursor({ line: pos?.lineNumber ?? 1, column: pos?.column ?? 1, selectedChars })
    }
    ed.onDidChangeCursorSelection(reportCursor)
    ed.onDidChangeModel(reportCursor)
    consumeReveal(ed)
    reportCursor()
    ed.focus()
  }

  // Ao sair do modo de edição, os comandos de editor deixam de ter alvo (e o corretor se desliga).
  useEffect(
    () => () => {
      spellRef.current?.dispose()
      setActiveEditor(null)
    },
    []
  )

  // Marca o fim de cada linha com ¶ quando os caracteres invisíveis estão ligados
  // (o Monaco só desenha espaços e tabulações). Em arquivos enormes, fica de fora.
  useEffect(() => {
    const ed = editorRef.current
    if (!ed || !view.showInvisibles) return
    const collection = ed.createDecorationsCollection()
    const MAX_LINES = 50000
    const apply = (): void => {
      const model = ed.getModel()
      if (!model || model.getLineCount() > MAX_LINES) return collection.clear()
      collection.set(
        Array.from({ length: model.getLineCount() }, (_, i) => {
          const line = i + 1
          const col = model.getLineMaxColumn(line)
          return { range: { startLineNumber: line, startColumn: col, endLineNumber: line, endColumn: col }, options: { afterContentClassName: 'eol-mark' } }
        })
      )
    }
    apply()
    // Ao digitar, refaz as marcas só depois de uma pausa curta (evita recriar milhares de marcas a cada tecla).
    let timer: ReturnType<typeof setTimeout> | undefined
    const sub = ed.onDidChangeModelContent(() => {
      clearTimeout(timer)
      timer = setTimeout(apply, 120)
    })
    const modelSub = ed.onDidChangeModel(apply)
    return () => {
      clearTimeout(timer)
      sub.dispose()
      modelSub.dispose()
      collection.clear()
    }
  }, [view.showInvisibles, doc.id])

  // Aplica a quebra de linha do documento ao modelo do Monaco (que não tem CR: documentos CR usam LF).
  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (model) {
      model.setEOL(doc.eol === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF)
    }
  }, [doc.id, doc.eol])

  return (
    <Editor
      path={modelPath(doc)}
      defaultValue={doc.content}
      language={doc.language}
      theme="meu-claro"
      // Mantém o modelo (e o histórico de desfazer) ao alternar para a visualização.
      keepCurrentModel
      onMount={handleMount}
      onChange={(value) => updateContent(doc.id, value ?? '')}
      options={{
        automaticLayout: true,
        fontSize: view.fontSize,
        fontFamily: "'Cascadia Code', 'Consolas', 'DejaVu Sans Mono', 'Ubuntu Mono', monospace",
        minimap: { enabled: false },
        wordWrap: view.wordWrap ? 'on' : 'off',
        renderWhitespace: view.showInvisibles ? 'all' : 'selection',
        renderControlCharacters: view.showInvisibles,
        folding: true,
        showFoldingControls: 'always',
        multiCursorModifier: 'alt',
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        tabSize: view.tabSize,
        insertSpaces: view.insertSpaces,
        detectIndentation: false,
        unicodeHighlight: { ambiguousCharacters: false },
        // Títulos da janela de correções ("Correção Rápida"): só quando já estão no idioma do app.
        ...({ 'codeActionWidget.showHeaders': monacoSpeaks(locale) } as object)
      }}
    />
  )
}

export function EditorPane() {
  const t = useT()
  const doc = useActiveDocument()
  const documents = useDocuments((s) => s.documents)
  const setMode = useDocuments((s) => s.setMode)
  const updateContent = useDocuments((s) => s.updateContent)

  // Descarta os modelos dos documentos fechados para liberar memória.
  useEffect(() => {
    const open = new Set(documents.map((d) => modelPath(d)))
    for (const model of monaco.editor.getModels()) {
      if (model.uri.scheme === 'inmemory' && model.uri.authority === 'doc' && !open.has(model.uri.toString(true))) {
        model.dispose()
      }
    }
  }, [documents])

  if (!doc) {
    return (
      <div className="grid h-full place-items-center bg-white text-zinc-500">
        <div className="text-center">
          <p className="mb-3 text-base">{t('editor.noDocument')}</p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={() => newFile()} className="rounded border border-border px-3 py-1.5 hover:bg-zinc-100">
              {t('editor.newDocument')}
            </button>
            <button type="button" onClick={() => void openFile()} className="rounded border border-border px-3 py-1.5 hover:bg-zinc-100">
              {t('editor.openFile')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (canPreview(doc) && doc.mode === 'preview') {
    if (doc.language === 'json') {
      const edit = (line?: number, column?: number) => {
        if (line !== undefined) requestReveal(line, column ?? 1)
        setMode(doc.id, 'edit')
      }
      // key: cada documento tem seu próprio estado de nós abertos/fechados.
      return <JsonViewer key={doc.id} content={doc.content} onEdit={edit} />
    }
    // key: cada documento tem o seu editor formatado (e o seu histórico de desfazer).
    return <MarkdownWysiwyg key={doc.id} content={doc.content} onChange={(markdown) => updateContent(doc.id, markdown)} />
  }
  return <CodeEditor doc={doc} />
}
