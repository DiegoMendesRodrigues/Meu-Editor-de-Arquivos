import { useMemo } from 'react'
import { LANGUAGE_LABELS } from '@/editor/languages'
import { useActiveDocument, useDocuments } from '@/store/documents'
import { useLibrary } from '@/store/library'

const formatSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const encoder = new TextEncoder()

export function StatusBar() {
  const doc = useActiveDocument()
  const cursor = useDocuments((s) => s.cursor)
  const recording = useLibrary((s) => s.recording)
  // O tamanho só é recalculado quando o texto muda (não a cada movimento do cursor), importante em arquivos grandes.
  const content = doc?.content
  const size = useMemo(() => (content === undefined ? 0 : encoder.encode(content).length), [content])

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-chrome px-3 text-xs text-zinc-600">
      {recording && (
        <span role="status" className="font-medium text-red-700">
          ● Gravando macro (Ctrl+Shift+R para parar)
        </span>
      )}
      {doc ? (
        <>
          <span>
            Ln {cursor.line}, Col {cursor.column}
          </span>
          {cursor.selectedChars > 0 && <span>({cursor.selectedChars} selecionados)</span>}
          <span className="ml-auto">{formatSize(size)}</span>
          <span>{doc.encoding}</span>
          <span>{doc.eol}</span>
          <span>{LANGUAGE_LABELS[doc.language] ?? doc.language}</span>
        </>
      ) : (
        <span>Pronto</span>
      )}
    </footer>
  )
}
