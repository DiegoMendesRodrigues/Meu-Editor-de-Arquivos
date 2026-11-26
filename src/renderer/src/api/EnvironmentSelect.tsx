// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/i18n'
import { useActiveDocument, useDocuments, type EditorDocument } from '@/store/documents'
import { useCloud } from '@/store/cloud'
import { environmentKeyOf, useApiStore } from '@/store/api'
import { findCollection, listCollectionEnvironments } from './collections'
import { parseEnvironment } from './environment'

interface Option {
  key: string
  label: string
}

const stem = (path: string): string => (path.split(/[\\/]/).pop() ?? path).replace(/\.apienv$/i, '')

/**
 * Seletor do ambiente ativo (barra da requisição): os .apienv abertos em abas, os da pasta ambientes/ da
 * coleção do documento e "Sem ambiente". A escolha vale para todas as requisições e fica guardada.
 */
export function EnvironmentSelect({ doc }: { doc?: EditorDocument }) {
  const t = useT()
  const activeDoc = useActiveDocument()
  const current = doc ?? activeDoc
  const documents = useDocuments((s) => s.documents)
  const cloudFiles = useCloud((s) => s.files)
  const activeKey = useApiStore((s) => s.activeEnvironment)
  const info = useApiStore((s) => s.envInfo)
  const setActive = useApiStore((s) => s.setActiveEnvironment)
  const tick = useApiStore((s) => s.collectionsTick)
  const [fromCollection, setFromCollection] = useState<string[]>([])

  const path = current?.path ?? null
  const cloudPath = current?.cloud?.path
  const loadCollectionEnvs = (): void => {
    if (!current) return
    void findCollection({ path, cloud: cloudPath ? { path: cloudPath } : undefined })
      .then((found) => (found ? listCollectionEnvironments(found.dir) : []))
      .then(setFromCollection, () => setFromCollection([]))
  }
  useEffect(loadCollectionEnvs, [path, cloudPath, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = useMemo<Option[]>(
    () =>
      documents
        .filter((d) => d.language === 'apienv')
        .map((d) => ({ key: environmentKeyOf(d), label: parseEnvironment(d.content)?.name ?? d.name })),
    [documents]
  )
  const collection = useMemo<Option[]>(() => {
    const openKeys = new Set(open.map((o) => o.key))
    const out: Option[] = []
    for (const p of fromCollection) {
      // Na nuvem a chave é o id do arquivo; no disco, o próprio caminho.
      const cloudFile = cloudFiles.find((f) => f.path === p)
      const key = /^([A-Za-z]:[\\/]|[\\/])/.test(p) ? p : cloudFile ? `cloud:${cloudFile.id}` : null
      if (key && !openKeys.has(key)) out.push({ key, label: stem(p) })
    }
    return out
  }, [fromCollection, open, cloudFiles])

  const known = [...open, ...collection].some((o) => o.key === activeKey)
  const production = !!info?.production && info.key === activeKey

  return (
    <select
      value={activeKey ?? ''}
      onChange={(e) => setActive(e.target.value === '' ? null : e.target.value)}
      onFocus={loadCollectionEnvs}
      aria-label={t('apiClient.env.select')}
      title={production ? t('apiClient.env.productionBand') : t('apiClient.env.select')}
      data-testid="api-env-select"
      className={`max-w-44 rounded border bg-surface px-1.5 py-1 text-[12.5px] outline-none focus:border-accent ${production ? 'border-red-500 font-semibold text-red-700' : 'border-border'}`}
    >
      <option value="">{t('apiClient.env.none')}</option>
      {activeKey && !known && <option value={activeKey}>{info?.key === activeKey ? info.name : stem(activeKey)}</option>}
      {open.length > 0 && (
        <optgroup label={t('apiClient.env.openGroup')}>
          {open.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
      {collection.length > 0 && (
        <optgroup label={t('apiClient.env.collectionGroup')}>
          {collection.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  )
}
