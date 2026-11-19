import { LANGUAGE_LABELS } from '@/editor/languages'
import { useActiveDocument, useDocuments } from '@/store/documents'

const formatSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const encoder = new TextEncoder()

export function StatusBar() {
  const doc = useActiveDocument()
  const cursor = useDocuments((s) => s.cursor)

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-chrome px-3 text-xs text-zinc-600">
      {doc ? (
        <>
          <span>
            Ln {cursor.line}, Col {cursor.column}
          </span>
          {cursor.selectedChars > 0 && <span>({cursor.selectedChars} selecionados)</span>}
          <span className="ml-auto">{formatSize(encoder.encode(doc.content).length)}</span>
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
