// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo, useState } from 'react'
import { Pencil, TriangleAlert } from 'lucide-react'
import type { ApiCollection } from '@shared/api/schema'
import { API_LIMITS } from '@shared/api/limits'
import { applyEol } from '@shared/eol'
import { useT } from '@/i18n'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { parseCollection, serializeCollection } from './environment'
import { AuthEditor } from './RequestSections'
import { VariablesTable } from './VariablesTable'

/**
 * Configurações da coleção (collection.apicol) ou de uma pasta dela (folder.apicol): nome, descrição,
 * autorização herdada pelas requisições, variáveis (com segredos no cofre do computador) e sincronização
 * das respostas salvas pela nuvem.
 */
export function CollectionSettingsView({ doc }: { doc: EditorDocument }) {
  const t = useT()
  const updateContent = useDocuments((s) => s.updateContent)
  const setMode = useDocuments((s) => s.setMode)
  const col = useMemo(() => parseCollection(doc.content), [doc.content])
  const [name, setName] = useState(col?.name ?? '')
  const isFolder = doc.name.toLowerCase() === 'folder.apicol'

  useEffect(() => {
    if (col && col.name !== name.trim()) setName(col.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [col?.name])

  if (!col) {
    return (
      <div className="grid h-full place-items-center bg-surface p-6" data-testid="col-invalid">
        <div className="max-w-lg rounded-md border border-amber-300 bg-amber-50 p-4 text-zinc-800">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <TriangleAlert size={16} className="text-amber-600" /> {t('apiClient.col.invalid')}
          </p>
          <p className="mb-3">{t('apiClient.col.invalidHelp')}</p>
          <button type="button" onClick={() => setMode(doc.id, 'edit')} className="flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-1.5 hover:bg-zinc-100">
            <Pencil size={14} /> {t('toolbar.editText')}
          </button>
        </div>
      </div>
    )
  }

  const update = (patch: Partial<ApiCollection>): void => {
    const text = applyEol(serializeCollection({ ...col, ...patch }), doc.eol)
    if (text !== doc.content) updateContent(doc.id, text)
  }
  const field = 'w-full rounded border border-border bg-surface px-2 py-1 text-sm text-zinc-900 outline-none focus:border-accent'

  return (
    <div className="h-full overflow-auto bg-surface px-4 py-3" data-testid="api-collection-settings">
      <h2 className="mb-3 text-sm font-semibold">{t(isFolder ? 'apiClient.col.folderTitle' : 'apiClient.col.title')}</h2>
      <div className="mb-3 grid gap-3">
        <label className="flex flex-col gap-1 text-[12.5px] text-zinc-600">
          {t('apiClient.env.name')}
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (e.target.value.trim() !== '') update({ name: e.target.value.trim() })
            }}
            maxLength={API_LIMITS.nameChars}
            aria-invalid={name.trim() === ''}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-zinc-600">
          {t('apiClient.col.description')}
          <textarea
            value={col.description ?? ''}
            onChange={(e) => update({ description: e.target.value === '' ? undefined : e.target.value })}
            maxLength={API_LIMITS.requestDescriptionChars}
            rows={3}
            className={field}
          />
        </label>
      </div>

      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.tab.auth')}</h3>
      <p className="mb-2 text-[12px] text-zinc-500">{t('apiClient.col.authHelp')}</p>
      <div className="mb-4">
        <AuthEditor auth={col.auth} onChange={(auth) => update({ auth })} docId={doc.id} />
      </div>

      <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.col.variables')}</h3>
      <VariablesTable label={t('apiClient.col.variables')} scopeId={col.id} variables={col.variables} onChange={(variables) => update({ variables })} />

      {!isFolder && (
        <label className="mt-4 flex items-start gap-2 text-[12.5px]">
          <input type="checkbox" checked={col.syncResponses} onChange={(e) => update({ syncResponses: e.target.checked })} className="mt-0.5" />
          <span>
            {t('apiClient.col.syncResponses')}
            <span className="block text-[12px] text-zinc-500">{t('apiClient.col.syncResponsesHelp')}</span>
          </span>
        </label>
      )}
    </div>
  )
}
