// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useMemo } from 'react'
import { TriangleAlert } from 'lucide-react'
import { savedResponseSchema } from '@shared/api/schema'
import { useT } from '@/i18n'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { fromSaved } from './response/model'
import { ResponseView } from './response/ResponseView'

/** Resposta salva (.apiresp), só para leitura, com o mesmo painel da resposta ao vivo. */
export function SavedResponseView({ doc }: { doc: EditorDocument }) {
  const t = useT()
  const setMode = useDocuments((s) => s.setMode)
  const parsed = useMemo(() => {
    try {
      const r = savedResponseSchema.safeParse(JSON.parse(doc.content))
      return r.success ? fromSaved(r.data) : null
    } catch {
      return null
    }
  }, [doc.content])

  if (!parsed) {
    return (
      <div className="grid h-full place-items-center bg-surface p-6">
        <div className="max-w-lg rounded-md border border-amber-300 bg-amber-50 p-4 text-zinc-800">
          <p className="mb-2 flex items-center gap-2 font-semibold">
            <TriangleAlert size={16} className="text-amber-600" /> {t('apiClient.saved.invalid')}
          </p>
          <button type="button" onClick={() => setMode(doc.id, 'edit')} className="rounded border border-border bg-surface px-3 py-1.5 hover:bg-zinc-100">
            {t('toolbar.editText')}
          </button>
        </div>
      </div>
    )
  }
  const req = parsed.sentRequest
  return (
    <div className="flex h-full flex-col bg-surface" data-testid="api-saved-response">
      <p className="shrink-0 select-text break-all border-b border-border px-3 py-1.5 font-mono text-[12.5px]">
        <span className="font-bold">{req.method}</span> {req.url}
        {parsed.environment ? <span className="ml-3 font-sans text-zinc-500">{parsed.environment}</span> : null}
      </p>
      <div className="min-h-0 flex-1">
        <ResponseView res={parsed} requestId="" saved />
      </div>
    </div>
  )
}
