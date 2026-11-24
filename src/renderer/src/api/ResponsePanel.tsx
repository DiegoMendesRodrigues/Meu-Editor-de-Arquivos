// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useMemo } from 'react'
import { Loader2, Send, TriangleAlert } from 'lucide-react'
import type { Assertion } from '@shared/api/schema'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'
import { useDocResponse } from './responses'
import { fromResult, type ViewResponse } from './response/model'
import { ResponseView } from './response/ResponseView'

/** Painel da resposta da requisição: vazio, enviando (com Cancelar), erro por código ou a resposta. */
export function ResponsePanel({
  docId,
  requestId,
  assertions,
  forcedType,
  onCancel,
  onSaveExample
}: {
  docId: string
  requestId: string
  assertions: Assertion[]
  forcedType: string
  onCancel: () => void
  onSaveExample?: (res: ViewResponse) => void
}) {
  const t = useT()
  const { runId, result, sentAt, environment } = useDocResponse(docId)
  const view = useMemo(() => (result?.ok ? fromResult(result, sentAt, environment) : null), [result, sentAt, environment])

  let content: React.ReactNode
  if (runId) {
    content = (
      <div className="grid h-full place-items-center p-6 text-center text-zinc-500" data-testid="api-sending">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={26} className="animate-spin text-zinc-400" />
          <p>{t('apiClient.response.sending')}</p>
          <button type="button" onClick={onCancel} className="rounded border border-border px-3 py-1 text-zinc-700 hover:bg-zinc-100">
            {t('apiClient.cancel')}
          </button>
        </div>
      </div>
    )
  } else if (result && !result.ok) {
    content = (
      <div className="p-4" data-testid="api-error">
        <p className="flex items-center gap-2 font-semibold text-red-600">
          <TriangleAlert size={16} /> {t(`apiClient.error.${result.code}` as MessageKey)}
        </p>
        {result.missingVariables && result.missingVariables.length > 0 && (
          <p className="mt-2 select-text text-amber-700">{t('apiClient.response.missingVars', { names: result.missingVariables.map((n) => `{{${n}}}`).join(', ') })}</p>
        )}
      </div>
    )
  } else if (view) {
    content = <ResponseView res={view} requestId={requestId} assertions={assertions} forcedType={forcedType} onSaveExample={onSaveExample} />
  } else {
    content = (
      <div className="grid h-full place-items-center p-6 text-center text-zinc-500">
        <div className="max-w-sm">
          <Send size={28} strokeWidth={1.5} className="mx-auto mb-2 text-zinc-400" />
          <p>{t('apiClient.response.empty')}</p>
        </div>
      </div>
    )
  }

  return (
    <section aria-label={t('apiClient.response')} className="flex h-full flex-col bg-surface" data-testid="api-response">
      {content}
    </section>
  )
}
