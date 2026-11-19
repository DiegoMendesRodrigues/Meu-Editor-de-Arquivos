// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useMemo } from 'react'
import { languageLabel } from '@/editor/languages'
import { useT } from '@/i18n'
import { useActiveDocument, useDocuments } from '@/store/documents'
import { useLibrary } from '@/store/library'

const formatSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const encoder = new TextEncoder()

export function StatusBar() {
  const t = useT()
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
          {t('status.recording')}
        </span>
      )}
      {doc ? (
        <>
          <span>
            {t('status.lineCol', { line: cursor.line, col: cursor.column })}
          </span>
          {cursor.selectedChars > 0 && <span>{t('status.selected', { n: cursor.selectedChars })}</span>}
          <span className="ml-auto">{formatSize(size)}</span>
          <span>{doc.encoding}</span>
          <span>{doc.eol}</span>
          <span>{languageLabel(doc.language)}</span>
        </>
      ) : (
        <span>{t('status.ready')}</span>
      )}
    </footer>
  )
}
