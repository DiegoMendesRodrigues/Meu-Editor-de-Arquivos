import { useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { monaco } from '@/editor/monacoSetup'
import { consumeReveal, requestReveal, setActiveEditor } from '@/editor/editorRef'
import { JsonViewer } from '@/json/JsonViewer'
import { attachRecorder } from '@/editor/macros'
import { registerMarkdownKeybindings } from '@/markdown/editorFormatting'
import { MarkdownPreview } from '@/markdown/MarkdownPreview'
import { canPreview, modelPath, useActiveDocument, useDocuments, type EditorDocument } from '@/store/documents'
import { useView } from '@/store/view'
import { newFile, openFile } from '@/commands'

function CodeEditor({ doc }: { doc: EditorDocument }) {
  const updateContent = useDocuments((s) => s.updateContent)
  const setCursor = useDocuments((s) => s.setCursor)
  const view = useView()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleMount: OnMount = (ed) => {
    editorRef.current = ed
    setActiveEditor(ed)
    registerMarkdownKeybindings(ed)
    attachRecorder(ed)

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

  // Ao sair do modo de edição, os comandos de editor deixam de ter alvo.
  useEffect(() => () => setActiveEditor(null), [])

  // Aplica a quebra de linha do documento ao modelo do Monaco.
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
      theme="vs"
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
        unicodeHighlight: { ambiguousCharacters: false }
      }}
    />
  )
}

export function EditorPane() {
  const doc = useActiveDocument()
  const documents = useDocuments((s) => s.documents)
  const setMode = useDocuments((s) => s.setMode)

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
          <p className="mb-3 text-base">Nenhum documento aberto</p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={newFile} className="rounded border border-border px-3 py-1.5 hover:bg-zinc-100">
              Novo documento
            </button>
            <button type="button" onClick={() => void openFile()} className="rounded border border-border px-3 py-1.5 hover:bg-zinc-100">
              Abrir arquivo
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
    return <MarkdownPreview content={doc.content} onEdit={() => setMode(doc.id, 'edit')} />
  }
  return <CodeEditor doc={doc} />
}
