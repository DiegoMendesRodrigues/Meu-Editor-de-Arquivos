// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useCallback, useEffect, useMemo, useState } from 'react'
import { serializeApiRequest } from '@shared/api/schema'
import type { ApiHistoryEntry } from '@shared/api/protocol'
import { t, useLocale, useT } from '@/i18n'
import { useDocuments } from '@/store/documents'
import { useApiStore } from '@/store/api'
import { METHOD_CLASS } from './ApiRequestView'

const dayKey = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const statusClass = (e: ApiHistoryEntry): string =>
  e.status === undefined ? 'text-red-600' : e.status < 300 ? 'text-emerald-700' : e.status < 400 ? 'text-sky-600' : e.status < 500 ? 'text-amber-700' : 'text-red-600'

/** Reabre a requisição do histórico como um documento novo (.apireq). */
export function openHistoryEntry(entry: ApiHistoryEntry): void {
  let text: string
  try {
    text = serializeApiRequest(entry.request)
  } catch {
    return
  }
  const name = `${entry.request.name || t('apiClient.col.newRequestName')}.apireq`
  useDocuments.getState().newDocumentWithContent(name, text)
}

/** Últimas execuções, agrupadas por dia. Clicar reabre a requisição; o botão da seção limpa a lista. */
export function HistoryList() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const tick = useApiStore((s) => s.historyTick)
  const [entries, setEntries] = useState<ApiHistoryEntry[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    window.api
      .apiHistoryList()
      .then((list) => {
        setEntries(list)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }, [])
  useEffect(load, [load, tick])
  // As execuções chegam de outras abas: relê de vez em quando enquanto a seção está na tela.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 5000)
    return () => clearInterval(id)
  }, [load])

  const groups = useMemo(() => {
    const map = new Map<string, ApiHistoryEntry[]>()
    for (const e of [...(entries ?? [])].sort((a, b) => b.at.localeCompare(a.at))) map.set(dayKey(e.at), [...(map.get(dayKey(e.at)) ?? []), e])
    return [...map.entries()]
  }, [entries])

  const label = (key: string, sample: string): string => {
    const today = dayKey(new Date().toISOString())
    const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString())
    if (key === today) return t('apiClient.history.today')
    if (key === yesterday) return t('apiClient.history.yesterday')
    return new Date(sample).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div data-testid="api-history">
      {failed && <p className="px-3 text-red-600">{t('apiClient.history.error')}</p>}
      {entries && entries.length === 0 && <p className="px-3 text-zinc-400">{t('apiClient.history.empty')}</p>}
      {groups.map(([key, list]) => (
        <div key={key}>
          <p className="px-3 pt-1 text-[11px] font-medium text-zinc-500">{label(key, list[0]!.at)}</p>
          <ul>
            {list.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => openHistoryEntry(e)}
                  title={`${e.method} ${e.url}`}
                  className="flex w-full flex-col items-start px-3 py-0.5 text-left hover:bg-zinc-200"
                >
                  <span className="flex w-full items-center gap-1.5">
                    <span className={`w-12 shrink-0 text-[11px] font-bold ${METHOD_CLASS[e.method] ?? 'text-zinc-600'}`}>{e.method}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11.5px]">{e.url || t('apiClient.history.noUrl')}</span>
                  </span>
                  <span className="flex w-full items-center gap-2 pl-[3.375rem] text-[11px] text-zinc-500">
                    <span className={`font-medium ${statusClass(e)}`}>{e.status ?? t('apiClient.history.failed')}</span>
                    {e.timeMs !== undefined && <span>{e.timeMs} ms</span>}
                    <span className="ml-auto">{new Date(e.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
