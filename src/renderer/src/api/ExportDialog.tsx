// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useState } from 'react'
import { EXPORT_FORMATS, type ExportInput } from '@shared/api/export'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from '@/components/Modal'
import { useT } from '@/i18n'
import { readCollection, type CollectionTree } from './collections'

/** Exportar a coleção em Postman 2.1, OpenAPI 3.1, HAR, .http ou curl. Valores de segredos nunca entram. */

const baseName = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? 'colecao'

/** Entrada dos exportadores: só variáveis comuns (as secretas não têm valor no arquivo). */
export function toExportInput(tree: CollectionTree): ExportInput {
  return {
    name: tree.collection?.name ?? baseName(tree.dir),
    description: tree.collection?.description,
    variables: (tree.collection?.variables ?? []).filter((v) => !v.secret && v.value !== undefined).map((v) => ({ key: v.key, value: v.value ?? '' })),
    items: tree.requests.map((r) => ({ folder: r.folder, request: r.request }))
  }
}

export function ExportDialog({ open, onClose, dir }: { open: boolean; onClose: () => void; dir?: string }) {
  const t = useT()
  const [tree, setTree] = useState<CollectionTree | null>(null)
  const [formatId, setFormatId] = useState<string>(EXPORT_FORMATS[0]!.id)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!open || !dir) return
    let alive = true
    setTree(null)
    setMessage(null)
    readCollection(dir).then(
      (res) => alive && setTree(res),
      () => alive && setMessage({ error: true, text: t('apiClient.export.error') })
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dir])

  if (!open) return null

  const format = EXPORT_FORMATS.find((f) => f.id === formatId) ?? EXPORT_FORMATS[0]!

  const save = async (): Promise<void> => {
    if (!tree) return
    try {
      const input = toExportInput(tree)
      const saved = await window.api.saveFileAs({ suggestedName: `${input.name}.${format.extension}`, content: format.run(input), encoding: 'UTF-8' })
      if (saved) setMessage({ error: false, text: t('apiClient.export.saved', { name: saved.name }) })
    } catch {
      setMessage({ error: true, text: t('apiClient.export.error') })
    }
  }

  return (
    <Modal title={t('apiClient.export.title')} size="sm" onClose={onClose}>
      <div className="flex flex-col gap-3">
        {!dir ? (
          <p className="text-sm">{t('apiClient.export.noCollection')}</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs">
              {t('apiClient.export.format')}
              <select aria-label={t('apiClient.export.format')} value={formatId} onChange={(e) => setFormatId(e.target.value)} className={fieldClass}>
                {EXPORT_FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t(f.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            {tree && <p className="text-xs text-zinc-500">{tree.requests.length === 0 ? t('apiClient.export.empty') : t('apiClient.import.count', { n: tree.requests.length })}</p>}
            <p className="text-xs text-zinc-500">{t('apiClient.export.note')}</p>
          </>
        )}
        {message && (
          <p role={message.error ? 'alert' : 'status'} className={`text-sm ${message.error ? 'text-red-600' : 'text-emerald-600'}`}>
            {message.text}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={buttonClass} onClick={onClose}>
            {t('common.close')}
          </button>
          <button type="button" className={primaryButtonClass} disabled={!tree || tree.requests.length === 0} onClick={() => void save()}>
            {t('apiClient.export.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
