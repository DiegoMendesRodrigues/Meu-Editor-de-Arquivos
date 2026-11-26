// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileSpreadsheet, Play } from 'lucide-react'
import { parseDataFile, type DataFileResult } from '@shared/api/dataFile'
import type { ApiCollectionPayload, ApiEnvironmentPayload } from '@shared/api/protocol'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from '@/components/Modal'
import { useT } from '@/i18n'
import { getSendContext } from '@/store/api'
import type { EditorDocument } from '@/store/documents'
import { readCollection, type CollectionTree } from './collections'
import { startRun } from './runSession'

/** Nome seguro para o documento: sem separadores de caminho nem caracteres que o Windows recusa. */
const safeName = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 80) || 'collection'

interface DataState {
  name: string
  rows: Record<string, string>[]
  columns: string[]
  skipped: string[]
}

/** Executar a coleção: pastas e requisições, ambiente, iterações, atraso, arquivo de dados (CSV ou JSON). */
export function RunnerDialog({ open, onClose, dir }: { open: boolean; onClose: () => void; dir?: string }) {
  if (!open) return null
  return <RunnerForm onClose={onClose} dir={dir} />
}

function RunnerForm({ onClose, dir }: { onClose: () => void; dir?: string }) {
  const t = useT()
  const [tree, setTree] = useState<CollectionTree | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [iterations, setIterations] = useState(1)
  const [delayMs, setDelayMs] = useState(0)
  const [stopOnFailure, setStopOnFailure] = useState(false)
  const [data, setData] = useState<DataState | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const [environment, setEnvironment] = useState<ApiEnvironmentPayload | null>(null)
  const [confirmProd, setConfirmProd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (!dir) {
      setLoadFailed(true)
      return
    }
    void (async () => {
      try {
        const loaded = await readCollection(dir)
        if (!alive) return
        setTree(loaded)
        setSelected(new Set(loaded.requests.map((r) => r.path)))
        // O ambiente ativo vem do mesmo lugar que o envio de uma requisição.
        const first = loaded.requests[0]
        const ctx = await getSendContext({ id: '', path: first?.path ?? null, name: '', content: '' } as unknown as EditorDocument)
        if (alive) setEnvironment(ctx.environment)
      } catch {
        if (alive) setLoadFailed(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [dir])

  const folders = useMemo(() => {
    const map = new Map<string, NonNullable<typeof tree>['requests']>()
    for (const r of tree?.requests ?? []) {
      const list = map.get(r.folder)
      if (list) list.push(r)
      else map.set(r.folder, [r])
    }
    return [...map.entries()]
  }, [tree])

  const total = (data ? data.rows.length : iterations) * selected.size
  const production = !!environment?.production
  const canStart = !busy && !!tree && selected.size > 0 && (!production || confirmProd)

  const toggle = (paths: string[], on: boolean): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of paths) on ? next.add(p) : next.delete(p)
      return next
    })

  const pickData = async (): Promise<void> => {
    setDataError(null)
    try {
      const [path] = await window.api.apiPickFiles('data', false)
      if (!path) return
      const file = await window.api.readFile(path)
      const result: DataFileResult = parseDataFile(file.content, file.name)
      if (!result.ok) {
        setData(null)
        setDataError(t(`apiClient.runner.dataError.${result.code}`))
        return
      }
      setData({ name: file.name, rows: result.rows, columns: result.columns, skipped: result.skippedColumns })
    } catch {
      setData(null)
      setDataError(t('apiClient.runner.dataError.read'))
    }
  }

  const start = async (): Promise<void> => {
    if (!tree || !canStart) return
    setBusy(true)
    setError(null)
    const items = tree.requests.filter((r) => selected.has(r.path)).map((r) => ({ path: r.path, folder: r.folder, request: r.request }))
    const collection: ApiCollectionPayload | null = tree.collection
      ? { id: tree.collection.id, variables: tree.collection.variables, auth: tree.collection.auth }
      : null
    const name = tree.collection?.name || tree.dir.split(/[\\/]/).filter(Boolean).pop() || 'collection'
    try {
      await startRun({
        collectionName: name,
        docName: t('apiClient.runner.docName', { name: safeName(name) }),
        environmentName: environment?.name ?? null,
        expected: total,
        dataRows: data?.rows.length ?? 0,
        input: {
          runId: crypto.randomUUID(),
          name,
          items,
          environment,
          collection,
          iterations: data ? 1 : iterations,
          delayMs,
          stopOnFailure,
          data: data?.rows ?? [],
          productionConfirmed: production && confirmProd
        }
      })
      onClose()
    } catch {
      setError(t('apiClient.runner.startError'))
      setBusy(false)
    }
  }

  return (
    <Modal title={t('apiClient.runner.title')} description={t('apiClient.runner.description')} onClose={onClose}>
      {loadFailed ? (
        <p role="alert" className="text-sm text-red-600">
          {t('apiClient.runner.loadError')}
        </p>
      ) : !tree ? null : tree.requests.length === 0 ? (
        <p className="text-sm text-zinc-500">{t('apiClient.runner.noRequests')}</p>
      ) : (
        <div className="flex flex-col gap-4 text-sm">
          <section aria-label={t('apiClient.runner.requests')}>
            <div className="mb-1 flex items-center gap-3">
              <h3 className="flex-1 text-xs font-semibold uppercase text-zinc-500">{t('apiClient.runner.requests')}</h3>
              <button type="button" className="text-xs text-accent hover:underline" onClick={() => toggle(tree.requests.map((r) => r.path), true)}>
                {t('apiClient.runner.selectAll')}
              </button>
              <button type="button" className="text-xs text-accent hover:underline" onClick={() => toggle(tree.requests.map((r) => r.path), false)}>
                {t('apiClient.runner.selectNone')}
              </button>
            </div>
            <div className="max-h-52 overflow-auto rounded border border-border p-2">
              {folders.map(([folder, list]) => {
                const paths = list.map((r) => r.path)
                const all = paths.every((p) => selected.has(p))
                const some = paths.some((p) => selected.has(p))
                return (
                  <div key={folder} className="mb-1">
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={all}
                        ref={(el) => {
                          if (el) el.indeterminate = some && !all
                        }}
                        onChange={(e) => toggle(paths, e.target.checked)}
                      />
                      {folder || t('apiClient.runner.rootFolder')}
                    </label>
                    {list.map((r) => (
                      <label key={r.path} className="ml-6 flex items-center gap-2">
                        <input type="checkbox" checked={selected.has(r.path)} onChange={(e) => toggle([r.path], e.target.checked)} />
                        <span className="w-14 shrink-0 font-mono text-xs text-zinc-500">{r.request.method}</span>
                        <span className="truncate">{r.request.name || r.request.url}</span>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              {t('apiClient.runner.iterations')}
              <input
                type="number"
                min={1}
                max={1000}
                className={fieldClass}
                value={data ? data.rows.length : iterations}
                disabled={!!data}
                onChange={(e) => setIterations(Math.min(1000, Math.max(1, Math.floor(Number(e.target.value)) || 1)))}
              />
            </label>
            <label className="flex flex-col gap-1">
              {t('apiClient.runner.delay')}
              <input
                type="number"
                min={0}
                max={60000}
                className={fieldClass}
                value={delayMs}
                onChange={(e) => setDelayMs(Math.min(60_000, Math.max(0, Math.floor(Number(e.target.value)) || 0)))}
              />
            </label>
          </div>
          {data ? <p className="-mt-2 text-xs text-zinc-500">{t('apiClient.runner.iterationsFromData')}</p> : null}

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={stopOnFailure} onChange={(e) => setStopOnFailure(e.target.checked)} />
            {t('apiClient.runner.stopOnFailure')}
          </label>

          <section aria-label={t('apiClient.runner.dataFile')} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex-1">{t('apiClient.runner.dataFile')}</span>
              <button type="button" className={buttonClass} onClick={() => void pickData()}>
                <FileSpreadsheet size={14} className="mr-1 inline" aria-hidden />
                {t('apiClient.runner.dataPick')}
              </button>
              {data ? (
                <button type="button" className={buttonClass} onClick={() => setData(null)}>
                  {t('apiClient.runner.dataClear')}
                </button>
              ) : null}
            </div>
            {data ? (
              <p className="text-xs text-zinc-500">
                {t('apiClient.runner.dataLoaded', { name: data.name, rows: data.rows.length, columns: data.columns.length })}
              </p>
            ) : null}
            {data && data.skipped.length > 0 ? (
              <p className="text-xs text-amber-600">{t('apiClient.runner.dataSkipped', { names: data.skipped.join(', ') })}</p>
            ) : null}
            {dataError ? (
              <p role="alert" className="text-xs text-red-600">
                {dataError}
              </p>
            ) : null}
          </section>

          <p>
            <span className="text-zinc-500">{t('apiClient.runner.environment')}: </span>
            <span className="font-medium">{environment?.name ?? t('apiClient.runner.noEnvironment')}</span>
          </p>

          {production ? (
            <div role="alert" className="rounded border border-amber-300 bg-amber-50 p-3">
              <p className="flex items-start gap-2 text-amber-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                {t('apiClient.runner.productionWarning')}
              </p>
              <label className="mt-2 flex items-center gap-2 font-medium">
                <input type="checkbox" checked={confirmProd} onChange={(e) => setConfirmProd(e.target.checked)} />
                {t('apiClient.runner.productionConfirm')}
              </label>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <span className="flex-1 text-xs text-zinc-500">{t('apiClient.runner.summary', { count: total })}</span>
            <button type="button" className={primaryButtonClass} disabled={!canStart} onClick={() => void start()}>
              <Play size={14} className="mr-1 inline" aria-hidden />
              {t('apiClient.runner.start')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
