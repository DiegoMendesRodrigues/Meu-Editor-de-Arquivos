// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Pencil, Play, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { API_LIMITS } from '@shared/api/limits'
import type { ApiMonitorRun, ApiMonitorState } from '@shared/api/protocol'
import type { MessageKey } from '@shared/i18n'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from '@/components/Modal'
import { useT } from '@/i18n'
import { useApiStore } from '@/store/api'
import { isCloudDir, readCollection, type CollectionTree } from './collections'

const th = 'border-b border-border px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500'
const baseName = (p: string): string => p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1)
const when = (iso?: string): string => (iso ? new Date(iso).toLocaleString() : '')

/** Gráfico simples (SVG próprio): uma barra por execução, vermelha quando falhou. */
function RunChart({ runs, name }: { runs: ApiMonitorRun[]; name: string }) {
  const t = useT()
  if (runs.length === 0) return <p className="text-xs text-zinc-500">{t('apiClient.monitor.chart.empty')}</p>
  const shown = runs.slice(-60)
  const max = Math.max(1, ...shown.map((r) => r.totalMs))
  const W = 600
  const H = 90
  const slot = W / shown.length
  const failed = shown.filter((r) => !r.ok).length
  return (
    <svg viewBox={`0 0 ${W} ${H + 4}`} role="img" aria-label={`${name}: ${t('apiClient.monitor.chart.alt', { n: shown.length, failed })}`} className="h-24 w-full rounded border border-border">
      {shown.map((r, i) => {
        const h = Math.max(2, (r.totalMs / max) * H)
        return (
          <rect key={r.at + i} x={i * slot + 1} y={H + 2 - h} width={Math.max(1, slot - 2)} height={h} className={r.ok ? 'fill-emerald-500' : 'fill-red-500'} data-ok={r.ok}>
            <title>{`${when(r.at)} - ${r.totalMs} ms - ${t(r.ok ? 'apiClient.monitor.ok' : 'apiClient.monitor.fail')}`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

function RunsTable({ runs, name }: { runs: ApiMonitorRun[]; name: string }) {
  const t = useT()
  return (
    <div className="max-h-48 overflow-auto rounded border border-border">
      <table className="w-full text-xs" aria-label={t('apiClient.monitor.table.runs', { name })}>
        <thead className="sticky top-0 bg-surface">
          <tr>
            <th className={th}>{t('apiClient.monitor.table.when')}</th>
            <th className={th}>{t('apiClient.monitor.table.result')}</th>
            <th className={th}>{t('apiClient.monitor.table.passed')}</th>
            <th className={th}>{t('apiClient.monitor.table.failed')}</th>
            <th className={th}>{t('apiClient.monitor.table.errors')}</th>
            <th className={th}>{t('apiClient.monitor.table.total')}</th>
            <th className={th}>{t('apiClient.monitor.table.avg')}</th>
          </tr>
        </thead>
        <tbody>
          {[...runs].reverse().map((r, i) => (
            <tr key={r.at + i} data-testid="monitor-run">
              <td className="px-2 py-1">{when(r.at)}</td>
              <td className={`px-2 py-1 font-medium ${r.ok ? 'text-emerald-700' : 'text-red-700'}`}>{t(r.ok ? 'apiClient.monitor.ok' : 'apiClient.monitor.fail')}</td>
              <td className="px-2 py-1">{r.passed}</td>
              <td className="px-2 py-1">{r.failed}</td>
              <td className="px-2 py-1">{r.errors}</td>
              <td className="px-2 py-1">{r.totalMs}</td>
              <td className="px-2 py-1">{r.avgMs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface Draft {
  id: string
  name: string
  collectionDir: string
  environment: string
  requests: string[]
  chooseRequests: boolean
  intervalMin: number
  notifyOnFailure: boolean
  enabled: boolean
}

const newDraft = (dir: string): Draft => ({
  id: crypto.randomUUID(),
  name: baseName(dir.replace(/[\\/]+$/, '')),
  collectionDir: dir,
  environment: '',
  requests: [],
  chooseRequests: false,
  intervalMin: 5,
  notifyOnFailure: true,
  enabled: true
})

const relativePath = (dir: string, path: string): string => {
  const d = dir.replace(/\\/g, '/').replace(/\/+$/, '')
  const p = path.replace(/\\/g, '/')
  return p.toLowerCase().startsWith(`${d.toLowerCase()}/`) ? p.slice(d.length + 1) : p
}

function MonitorForm({ draft, isNew, onSaved, onCancel }: { draft: Draft; isNew: boolean; onSaved: () => void; onCancel: () => void }) {
  const t = useT()
  const envInfo = useApiStore((s) => s.envInfo)
  const [d, setD] = useState(draft)
  const [tree, setTree] = useState<CollectionTree | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    setTree(null)
    setLoadFailed(false)
    if (!d.collectionDir || isCloudDir(d.collectionDir)) {
      setLoadFailed(!!d.collectionDir)
      return
    }
    readCollection(d.collectionDir).then(
      (loaded) => alive && setTree(loaded),
      () => alive && setLoadFailed(true)
    )
    return () => {
      alive = false
    }
  }, [d.collectionDir])

  const activeKey = envInfo && !envInfo.key.startsWith('cloud:') && !/^doc-\d+$/.test(envInfo.key) ? envInfo.key : null
  const envOptions = useMemo(() => {
    const list = (tree?.environments ?? []).map((p) => ({ value: p, label: baseName(p) }))
    if (activeKey && !list.some((o) => o.value === activeKey)) list.push({ value: activeKey, label: t('apiClient.monitor.form.envActive', { name: envInfo?.name ?? baseName(activeKey) }) })
    return list
  }, [tree, activeKey, envInfo, t])

  const pickFolder = async (): Promise<void> => {
    const folder = await window.api.openFolder()
    if (folder?.path) setD((x) => ({ ...x, collectionDir: folder.path, name: x.name || baseName(folder.path), requests: [], environment: '' }))
  }

  const toggle = (rel: string, on: boolean): void =>
    setD((x) => ({ ...x, requests: on ? [...x.requests, rel] : x.requests.filter((r) => r !== rel) }))

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (busy) return
    if (!d.collectionDir) return setError('apiClient.monitor.form.noCollection')
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.apiMonitorSave({
        id: d.id,
        name: d.name.trim() || baseName(d.collectionDir),
        collectionDir: d.collectionDir,
        requests: d.chooseRequests ? d.requests : [],
        ...(d.environment ? { environment: d.environment } : {}),
        intervalMin: Math.max(1, Math.round(d.intervalMin) || 1),
        enabled: d.enabled,
        notifyOnFailure: d.notifyOnFailure
      })
      if (res.ok) return onSaved()
      setError(res.code === 'notAuthorized' ? 'apiClient.monitor.error.notAuthorized' : res.code === 'tooManyMonitors' ? 'apiClient.monitor.error.tooManyMonitors' : 'apiClient.monitor.error.invalid')
    } catch {
      setError('apiClient.monitor.error.generic')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={(e) => void save(e)} className="flex flex-col gap-3 text-sm" aria-label={t(isNew ? 'apiClient.monitor.new' : 'apiClient.monitor.edit')}>
      <label className="flex flex-col gap-1">
        {t('apiClient.monitor.form.name')}
        <input value={d.name} maxLength={200} onChange={(e) => setD({ ...d, name: e.target.value })} className={fieldClass} />
      </label>
      <div className="flex flex-col gap-1">
        <span>{t('apiClient.monitor.form.collection')}</span>
        <div className="flex items-center gap-2">
          <input readOnly aria-label={t('apiClient.monitor.form.collection')} value={d.collectionDir} className={`${fieldClass} flex-1`} />
          <button type="button" onClick={() => void pickFolder()} className={buttonClass}>
            {t('apiClient.monitor.form.pickFolder')}
          </button>
        </div>
        {loadFailed && (
          <p role="alert" className="text-xs text-red-700">
            {t('apiClient.monitor.form.loadError')}
          </p>
        )}
      </div>
      <label className="flex flex-col gap-1">
        {t('apiClient.monitor.form.environment')}
        <select value={d.environment} onChange={(e) => setD({ ...d, environment: e.target.value })} className={fieldClass}>
          <option value="">{t('apiClient.monitor.form.envNone')}</option>
          {envOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1">{t('apiClient.monitor.form.requests')}</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="monitor-requests" checked={!d.chooseRequests} onChange={() => setD({ ...d, chooseRequests: false })} />
          {t('apiClient.monitor.form.allRequests')}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="monitor-requests" checked={d.chooseRequests} onChange={() => setD({ ...d, chooseRequests: true })} />
          {t('apiClient.monitor.form.chooseRequests')}
        </label>
        {d.chooseRequests && tree && (
          <div className="ml-6 max-h-40 overflow-auto rounded border border-border p-2">
            {tree.requests.map((r) => {
              const rel = relativePath(d.collectionDir, r.path)
              return (
                <label key={r.path} className="flex items-center gap-2">
                  <input type="checkbox" checked={d.requests.includes(rel)} onChange={(e) => toggle(rel, e.target.checked)} />
                  <span className="w-14 shrink-0 font-mono text-xs text-zinc-500">{r.request.method}</span>
                  <span className="truncate">{r.request.name || r.request.url}</span>
                </label>
              )
            })}
          </div>
        )}
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          {t('apiClient.monitor.form.interval')}
          <input type="number" min={1} max={1440} value={d.intervalMin} onChange={(e) => setD({ ...d, intervalMin: Number(e.target.value) })} className={fieldClass} />
        </label>
        <label className="flex items-end gap-2 pb-1">
          <input type="checkbox" checked={d.notifyOnFailure} onChange={(e) => setD({ ...d, notifyOnFailure: e.target.checked })} />
          {t('apiClient.monitor.form.notify')}
        </label>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {t(error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={busy || !d.collectionDir} className={primaryButtonClass}>
          {t('apiClient.monitor.form.save')}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

/** Monitores de coleção: lista, formulário, gráfico de tempos e tabela das execuções. */
export function MonitorDialog({ onClose, dir }: { onClose: () => void; dir?: string }) {
  const t = useT()
  const [list, setList] = useState<ApiMonitorState[]>([])
  const [editing, setEditing] = useState<{ draft: Draft; isNew: boolean } | null>(dir ? { draft: newDraft(dir), isNew: true } : null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setList(await window.api.apiMonitorList())
    } catch {
      setList([])
    }
  }, [])

  useEffect(() => {
    void refresh()
    return window.api.onApiMonitorEvent(({ monitor }) =>
      setList((prev) => (prev.some((m) => m.id === monitor.id) ? prev.map((m) => (m.id === monitor.id ? monitor : m)) : [...prev, monitor]))
    )
  }, [refresh])

  const selected = list.find((m) => m.id === selectedId) ?? list[0]
  const edit = (m: ApiMonitorState): void =>
    setEditing({
      isNew: false,
      draft: { id: m.id, name: m.name, collectionDir: m.collectionDir, environment: m.environment ?? '', requests: m.requests, chooseRequests: m.requests.length > 0, intervalMin: m.intervalMin, notifyOnFailure: m.notifyOnFailure, enabled: m.enabled }
    })
  const toggle = async (m: ApiMonitorState, enabled: boolean): Promise<void> => {
    await window.api.apiMonitorSave({ ...m, enabled })
    void refresh()
  }
  const remove = async (m: ApiMonitorState): Promise<void> => {
    await window.api.apiMonitorDelete(m.id)
    void refresh()
  }

  const status = (m: ApiMonitorState): string => {
    if (m.running) return t('apiClient.monitor.running')
    const last = m.runs[m.runs.length - 1]
    return last ? `${t(last.ok ? 'apiClient.monitor.ok' : 'apiClient.monitor.fail')} - ${when(last.at)}` : t('apiClient.monitor.never')
  }

  return (
    <Modal title={t('apiClient.monitor.title')} description={t('apiClient.monitor.description')} onClose={onClose}>
      <div data-testid="monitor-dialog" className="flex flex-col gap-3 text-sm">
        <p role="note" className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <TriangleAlert size={14} className="shrink-0" />
          {t('apiClient.monitor.warning')}
        </p>
        {editing ? (
          <>
            <button type="button" onClick={() => setEditing(null)} className="flex w-fit items-center gap-1 text-xs text-accent hover:underline">
              <ArrowLeft size={12} /> {t('apiClient.monitor.back')}
            </button>
            <MonitorForm
              key={editing.draft.id}
              draft={editing.draft}
              isNew={editing.isNew}
              onSaved={() => {
                setEditing(null)
                void refresh()
              }}
              onCancel={() => setEditing(null)}
            />
          </>
        ) : (
          <>
            <div className="flex justify-end">
              <button type="button" onClick={() => setEditing({ draft: newDraft(''), isNew: true })} className={`${primaryButtonClass} flex items-center gap-1`}>
                <Plus size={14} /> {t('apiClient.monitor.new')}
              </button>
            </div>
            {list.length === 0 ? (
              <p className="text-zinc-500">{t('apiClient.monitor.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label={t('apiClient.monitor.title')}>
                {list.map((m) => {
                  const last = m.runs[m.runs.length - 1]
                  return (
                    <li key={m.id} data-testid="monitor-item" className={`flex flex-col gap-1 rounded border p-2 ${selected?.id === m.id ? 'border-accent' : 'border-border'}`}>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setSelectedId(m.id)} className="flex-1 truncate text-left font-medium hover:underline">
                          {m.name}
                        </button>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" aria-label={t('apiClient.monitor.toggleNamed', { name: m.name })} checked={m.enabled} onChange={(e) => void toggle(m, e.target.checked)} />
                          {t('apiClient.monitor.enabled')}
                        </label>
                        <button type="button" onClick={() => void window.api.apiMonitorRunNow(m.id)} disabled={m.running} aria-label={t('apiClient.monitor.runNowNamed', { name: m.name })} className={`${buttonClass} flex items-center gap-1 text-xs`}>
                          <Play size={12} /> {t('apiClient.monitor.runNow')}
                        </button>
                        <button type="button" onClick={() => edit(m)} aria-label={t('apiClient.monitor.editNamed', { name: m.name })} className="rounded p-1 hover:bg-zinc-200">
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => void remove(m)} aria-label={t('apiClient.monitor.deleteNamed', { name: m.name })} className="rounded p-1 hover:bg-zinc-200">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-xs text-zinc-500">
                        <span className="truncate" title={m.collectionDir}>
                          {baseName(m.collectionDir.replace(/[\\/]+$/, ''))}
                        </span>
                        <span>{t('apiClient.monitor.every', { n: m.intervalMin })}</span>
                        <span data-testid="monitor-status" className={last && !m.running ? (last.ok ? 'text-emerald-700' : 'text-red-700') : ''}>
                          {t('apiClient.monitor.lastRun')}: {status(m)}
                        </span>
                        <span>
                          {t('apiClient.monitor.nextRun')}: {m.enabled && m.nextAt ? when(m.nextAt) : t('apiClient.monitor.off')}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {selected && (
              <section className="flex flex-col gap-2" aria-label={t('apiClient.monitor.table.runs', { name: selected.name })}>
                <h3 className="text-xs font-semibold uppercase text-zinc-500">{t('apiClient.monitor.chart.title')}</h3>
                <RunChart runs={selected.runs.slice(-API_LIMITS.monitorRuns)} name={selected.name} />
                <RunsTable runs={selected.runs} name={selected.name} />
              </section>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
