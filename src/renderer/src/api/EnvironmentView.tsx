// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo, useState } from 'react'
import { Check, Pencil, ShieldAlert, TriangleAlert } from 'lucide-react'
import type { ApiEnvironment } from '@shared/api/schema'
import { API_LIMITS } from '@shared/api/limits'
import { applyEol } from '@shared/eol'
import { useT } from '@/i18n'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { environmentKeyOf, useApiStore } from '@/store/api'
import { parseEnvironment, serializeEnvironment } from './environment'
import { VariablesTable } from './VariablesTable'

/**
 * Construtor do ambiente (.apienv): nome, produção e variáveis. Cada alteração regrava o JSON do
 * documento. Os valores das variáveis secretas nunca entram no arquivo: ficam no cofre do computador.
 */
export function EnvironmentView({ doc }: { doc: EditorDocument }) {
  const t = useT()
  const updateContent = useDocuments((s) => s.updateContent)
  const setMode = useDocuments((s) => s.setMode)
  const activeKey = useApiStore((s) => s.activeEnvironment)
  const setActive = useApiStore((s) => s.setActiveEnvironment)
  const env = useMemo(() => parseEnvironment(doc.content), [doc.content])
  const [persistent, setPersistent] = useState(true)
  const [name, setName] = useState(env?.name ?? '')

  useEffect(() => {
    void window.api.apiSecretsInfo().then((info) => setPersistent(info.persistent), () => undefined)
  }, [])
  // Nome alterado por fora (texto, recarregamento): o campo acompanha.
  useEffect(() => {
    if (env && env.name !== '' && env.name !== name.trim()) setName(env.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env?.name])

  if (!env) {
    return (
      <div className="grid h-full place-items-center bg-surface p-6" data-testid="env-invalid">
        <div className="max-w-lg rounded-md border border-amber-300 bg-amber-50 p-4 text-zinc-800">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <TriangleAlert size={16} className="text-amber-600" /> {t('apiClient.env.invalid')}
          </p>
          <p className="mb-3">{t('apiClient.env.invalidHelp')}</p>
          <button type="button" onClick={() => setMode(doc.id, 'edit')} className="flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-1.5 hover:bg-zinc-100">
            <Pencil size={14} /> {t('toolbar.editText')}
          </button>
        </div>
      </div>
    )
  }

  const update = (patch: Partial<ApiEnvironment>): void => {
    const text = applyEol(serializeEnvironment({ ...env, ...patch }), doc.eol)
    if (text !== doc.content) updateContent(doc.id, text)
  }
  const key = environmentKeyOf(doc)
  const isActive = activeKey === key

  return (
    <div className="flex h-full flex-col bg-surface" data-testid="api-environment">
      {env.production && (
        <div role="status" className="flex shrink-0 items-center gap-2 bg-red-600 px-3 py-1.5 text-[12.5px] font-semibold text-white" data-testid="env-production-band">
          <ShieldAlert size={15} /> {t('apiClient.env.productionBand')}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div className="mb-3 flex flex-wrap items-end gap-4">
          <label className="flex min-w-60 flex-1 flex-col gap-1 text-[12.5px] text-zinc-600">
            {t('apiClient.env.name')}
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (e.target.value.trim() !== '') update({ name: e.target.value.trim() })
              }}
              maxLength={API_LIMITS.nameChars}
              aria-invalid={name.trim() === ''}
              className="rounded border border-border bg-surface px-2 py-1 text-sm text-zinc-900 outline-none focus:border-accent"
            />
          </label>
          <label className="flex items-center gap-2 pb-1.5 text-[12.5px]">
            <input type="checkbox" checked={env.production} onChange={(e) => update({ production: e.target.checked })} />
            {t('apiClient.env.production')}
          </label>
          <button
            type="button"
            onClick={() => setActive(isActive ? null : key)}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 rounded border px-3 py-1 text-[12.5px] ${isActive ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-border hover:bg-zinc-100'}`}
          >
            {isActive && <Check size={13} />}
            {t(isActive ? 'apiClient.env.active' : 'apiClient.env.use')}
          </button>
        </div>
        {env.production && <p className="mb-3 text-[12px] text-red-700">{t('apiClient.env.productionHelp')}</p>}
        {!persistent && (
          <p role="alert" className="mb-3 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-zinc-800" data-testid="env-vault-warning">
            <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-600" /> {t('apiClient.env.vaultMemory')}
          </p>
        )}
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.env.variables')}</h3>
        <VariablesTable label={t('apiClient.env.variables')} scopeId={env.id} variables={env.variables} onChange={(variables) => update({ variables })} />
        <p className="mt-3 text-[12px] text-zinc-500">{t('apiClient.env.secretsHelp')}</p>
      </div>
    </div>
  )
}
