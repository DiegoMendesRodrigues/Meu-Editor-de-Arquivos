// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useState } from 'react'
import { Copy, FileJson, Play, Square, TriangleAlert } from 'lucide-react'
import { create } from 'zustand'
import { newApiRequest, serializeApiRequest } from '@shared/api/schema'
import type { ApiMockLogEntry } from '@shared/api/protocol'
import { collectionExamplePaths, routesFromCollection, routesFromOpenApi, type MockRoute } from '@shared/api/mockRoutes'
import type { MessageKey } from '@shared/i18n'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from '@/components/Modal'
import { useT } from '@/i18n'
import { useDocuments } from '@/store/documents'
import { readCollection } from './collections'

const MAX_LOG = 200

interface ActiveMock {
  mockId: string
  name: string
  url: string
  port: number
  routes: number
  log: ApiMockLogEntry[]
}

/** Mocks ativos da janela: continuam rodando quando o diálogo fecha, até Parar ou fechar o app. */
const useMocks = create<{ active: ActiveMock[]; add: (m: ActiveMock) => void; remove: (id: string) => void; push: (e: ApiMockLogEntry) => void }>((set) => ({
  active: [],
  add: (m) => set((s) => ({ active: [...s.active, m] })),
  remove: (id) => set((s) => ({ active: s.active.filter((m) => m.mockId !== id) })),
  push: (e) =>
    set((s) => ({ active: s.active.map((m) => (m.mockId === e.mockId ? { ...m, log: [...m.log, e].slice(-MAX_LOG) } : m)) }))
}))

let listening = false
function listenLog(): void {
  if (listening) return
  listening = true
  window.api.onApiMockLog((e) => (e.stopped ? useMocks.getState().remove(e.mockId) : useMocks.getState().push(e)))
}

const th = 'border-b border-border px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500'

/** Abre a chamada recebida como requisição nova, apontando para o mock. */
function openAsRequest(mock: ActiveMock, e: ApiMockLogEntry): void {
  const req = { ...newApiRequest(`${e.method} ${e.path}`.slice(0, 200)), method: e.method, url: `${mock.url}${e.path}` }
  useDocuments.getState().newDocumentWithContent('mock.apireq', serializeApiRequest(req))
}

/** Servidor mock: rotas dos exemplos da coleção ou de um OpenAPI, porta, rede local e registro das chamadas. */
export function MockDialog({ onClose, dir }: { onClose: () => void; dir?: string }) {
  const t = useT()
  const active = useMocks((s) => s.active)
  const [source, setSource] = useState<'collection' | 'openapi'>(dir ? 'collection' : 'openapi')
  const [routes, setRoutes] = useState<MockRoute[]>([])
  const [sourceName, setSourceName] = useState('')
  const [message, setMessage] = useState<MessageKey | null>(null)
  const [port, setPort] = useState(4010)
  const [lan, setLan] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<MessageKey | null>(null)

  useEffect(() => {
    listenLog()
  }, [])

  const loadCollection = async (): Promise<void> => {
    if (!dir) return
    setMessage(null)
    try {
      const tree = await readCollection(dir)
      const contents: Record<string, string> = {}
      await Promise.all(
        collectionExamplePaths(tree)
          .slice(0, 500)
          .map(async (p) => {
            try {
              contents[p] = (await window.api.readFile(p)).content
            } catch {
              // exemplo apagado ou ilegível: fica de fora
            }
          })
      )
      setRoutes(routesFromCollection(tree, contents))
      setSourceName(tree.collection?.name ?? '')
    } catch {
      setRoutes([])
      setMessage('apiClient.mock.loadFailed')
    }
  }

  useEffect(() => {
    if (source === 'collection') void loadCollection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, dir])

  const pickOpenApi = async (): Promise<void> => {
    setMessage(null)
    try {
      const [path] = await window.api.apiPickFiles('import', false)
      if (!path) return
      const file = await window.api.readFile(path)
      const found = routesFromOpenApi(file.content)
      if (!found) {
        setRoutes([])
        return setMessage('apiClient.mock.openApiInvalid')
      }
      setRoutes(found)
      setSourceName(file.name)
    } catch {
      setMessage('apiClient.mock.loadFailed')
    }
  }

  const patch = (i: number, p: Partial<MockRoute>): void => setRoutes((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)))

  const start = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await window.api.apiMockStart({ name: sourceName.slice(0, 200), port, lan, routes })
      if (res.ok) useMocks.getState().add({ mockId: res.mockId, name: sourceName, url: res.url, port: res.port, routes: routes.length, log: [] })
      else setError(`apiClient.mock.error.${res.code}` as MessageKey)
    } catch {
      setError('apiClient.mock.error.unknown')
    }
    setBusy(false)
  }

  const stop = (id: string): void => {
    void window.api.apiMockStop(id)
    useMocks.getState().remove(id)
  }

  return (
    <Modal title={t('apiClient.mock.title')} onClose={onClose}>
      <div className="flex flex-col gap-4 text-[13px]" data-testid="mock-dialog">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">{t('apiClient.mock.source')}</span>
          {dir && (
            <label className="flex items-center gap-1.5">
              <input type="radio" name="mock-source" checked={source === 'collection'} onChange={() => setSource('collection')} />
              {t('apiClient.mock.fromCollection')}
            </label>
          )}
          <label className="flex items-center gap-1.5">
            <input type="radio" name="mock-source" checked={source === 'openapi'} onChange={() => setSource('openapi')} />
            {t('apiClient.mock.fromOpenApi')}
          </label>
          {source === 'openapi' && (
            <button type="button" className={buttonClass} onClick={() => void pickOpenApi()}>
              <FileJson size={14} className="mr-1 inline" />
              {t('apiClient.mock.pickOpenApi')}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            {t('apiClient.mock.port')}
            <input type="number" min={0} max={65535} value={port} onChange={(e) => setPort(Math.min(65535, Math.max(0, Number(e.target.value) || 0)))} className={`${fieldClass} w-28`} />
          </label>
          <label className="flex items-center gap-1.5 pb-1">
            <input type="checkbox" checked={lan} onChange={(e) => setLan(e.target.checked)} />
            {t('apiClient.mock.lan')}
          </label>
          <button type="button" disabled={busy || routes.length === 0} onClick={() => void start()} data-testid="mock-start" className={`${primaryButtonClass} ml-auto flex items-center gap-1.5`}>
            <Play size={14} /> {t('apiClient.mock.start')}
          </button>
        </div>
        {lan && (
          <p role="alert" className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-700">
            <TriangleAlert size={13} /> {t('apiClient.mock.lanWarning')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {t(error)}
          </p>
        )}
        {message && (
          <p role="alert" className="text-xs text-red-700">
            {t(message)}
          </p>
        )}

        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.mock.routes', { count: routes.length })}</h3>
          {routes.length === 0 ? (
            <p className="text-zinc-500">{t('apiClient.mock.noRoutes')}</p>
          ) : (
            <div className="max-h-52 overflow-auto">
              <table aria-label={t('apiClient.mock.routes', { count: routes.length })} className="w-full border-collapse" data-testid="mock-routes">
                <thead>
                  <tr>
                    <th className={th}>{t('apiClient.method')}</th>
                    <th className={th}>URL</th>
                    <th className={th}>{t('apiClient.mock.status')}</th>
                    <th className={th}>{t('apiClient.mock.delay')}</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r, i) => (
                    <tr key={i}>
                      <td className="border-b border-border px-2 py-1 font-mono text-[12px] font-semibold">{r.method}</td>
                      <td className="border-b border-border px-2 py-1 font-mono text-[12px]">
                        {r.path}
                        {r.example && <span className="ml-2 text-zinc-500">({r.example})</span>}
                      </td>
                      <td className="border-b border-border p-0.5">
                        <input type="number" min={100} max={599} value={r.status} aria-label={`${t('apiClient.mock.status')} ${r.method} ${r.path}`} onChange={(e) => patch(i, { status: Math.min(599, Math.max(100, Number(e.target.value) || 200)) })} className={`${fieldClass} w-20`} />
                      </td>
                      <td className="border-b border-border p-0.5">
                        <input type="number" min={0} max={60000} value={r.delayMs} aria-label={`${t('apiClient.mock.delay')} ${r.method} ${r.path}`} onChange={(e) => patch(i, { delayMs: Math.min(60000, Math.max(0, Number(e.target.value) || 0)) })} className={`${fieldClass} w-24`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {active.length > 0 && (
          <div data-testid="mock-active">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.mock.active')}</h3>
            {active.map((m) => (
              <div key={m.mockId} className="mb-3 rounded border border-border p-2">
                <div className="flex items-center gap-2">
                  <code className="select-text font-mono text-[12.5px]" data-testid="mock-url">
                    {m.url}
                  </code>
                  <span className="text-zinc-500">{m.name}</span>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(m.url)} title={t('apiClient.mock.copyUrl')} aria-label={t('apiClient.mock.copyUrl')} className="rounded p-1 hover:bg-zinc-200">
                    <Copy size={14} />
                  </button>
                  <button type="button" onClick={() => stop(m.mockId)} className={`${buttonClass} ml-auto flex items-center gap-1.5`}>
                    <Square size={13} /> {t('apiClient.mock.stop')}
                  </button>
                </div>
                <h4 className="mb-1 mt-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.mock.log')}</h4>
                {m.log.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t('apiClient.mock.logEmpty')}</p>
                ) : (
                  <ul className="max-h-36 overflow-auto" data-testid="mock-log">
                    {[...m.log].reverse().map((e, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => openAsRequest(m, e)} className="flex w-full items-center gap-3 px-1 py-0.5 text-left font-mono text-[12px] hover:bg-zinc-100">
                          <span className="w-14 font-semibold">{e.method}</span>
                          <span className="min-w-0 flex-1 truncate">{e.path}</span>
                          <span className={e.status >= 400 ? 'text-red-600' : 'text-emerald-700'}>{e.status}</span>
                          <span className="w-14 text-right text-zinc-500">{e.timeMs} ms</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
