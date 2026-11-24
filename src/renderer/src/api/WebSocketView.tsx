// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eraser, Pause, Play, Plug, PlugZap, Save, Send, Trash2, TriangleAlert } from 'lucide-react'
import { create } from 'zustand'
import { API_LIMITS } from '@shared/api/limits'
import type { ApiWsEvent } from '@shared/api/protocol'
import { apiWebSocketSchema, type ApiWebSocket, type KeyValue, type WsMessageTemplate } from '@shared/api/schema'
import { applyEol } from '@shared/eol'
import type { MessageKey } from '@shared/i18n'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from '@/components/Modal'
import { useT } from '@/i18n'
import { getSendContext } from '@/store/api'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { KeyValueTable } from './KeyValueTable'
import { base64Valid, listenWs, prettyJson, wsErrorKey } from './wsEvents'

/* ------------------------------------------------------------------ estado das conexões (só na memória) */

interface LogEntry {
  n: number
  type: ApiWsEvent['type']
  direction?: 'in' | 'out'
  at: string
  data?: string
  binary?: boolean
  size?: number
  truncated?: boolean
  code?: number | string
}

interface WsState {
  status: 'idle' | 'connecting' | 'open'
  connId: string | null
  protocol: string
  entries: LogEntry[]
  bytes: number
  paused: boolean
  error: { key: string; params?: Record<string, string | number> } | null
}

const EMPTY: WsState = { status: 'idle', connId: null, protocol: '', entries: [], bytes: 0, paused: false, error: null }

const useWsStore = create<{ byDoc: Record<string, WsState>; patch: (docId: string, p: Partial<WsState>) => void }>((set) => ({
  byDoc: {},
  patch: (docId, p) => set((s) => ({ byDoc: { ...s.byDoc, [docId]: { ...(s.byDoc[docId] ?? EMPTY), ...p } } }))
}))

const unlisten = new Map<string, () => void>()
let counter = 0
const sizeOf = (e: LogEntry): number => (e.data?.length ?? 0) + 64

/** Acrescenta ao registro, descartando as mais antigas acima de wsLogMessages / wsLogBytes. */
function appendEntry(docId: string, entry: Omit<LogEntry, 'n'>): void {
  const cur = useWsStore.getState().byDoc[docId] ?? EMPTY
  const full: LogEntry = { ...entry, n: ++counter }
  const entries = [...cur.entries, full]
  let bytes = cur.bytes + sizeOf(full)
  let drop = 0
  while ((entries.length - drop > API_LIMITS.wsLogMessages || bytes > API_LIMITS.wsLogBytes) && drop < entries.length - 1) bytes -= sizeOf(entries[drop++])
  useWsStore.getState().patch(docId, { entries: drop > 0 ? entries.slice(drop) : entries, bytes })
}

function finishConnection(docId: string, error?: WsState['error']): void {
  unlisten.get(docId)?.()
  unlisten.delete(docId)
  useWsStore.getState().patch(docId, { status: 'idle', connId: null, protocol: '', ...(error !== undefined ? { error } : {}) })
}

export function disconnectWs(docId: string): void {
  const cur = useWsStore.getState().byDoc[docId]
  if (cur?.connId) void window.api.apiWsClose(cur.connId).catch(() => undefined)
  finishConnection(docId)
}

async function connectDoc(doc: EditorDocument, ws: ApiWebSocket, confirmSecretHost?: string): Promise<{ confirmHost?: string }> {
  const store = useWsStore.getState()
  if ((store.byDoc[doc.id] ?? EMPTY).status !== 'idle') return {}
  const connId = crypto.randomUUID()
  store.patch(doc.id, { status: 'connecting', connId, error: null })
  unlisten.set(
    doc.id,
    listenWs(connId, (e) => {
      if (e.type === 'close') {
        appendEntry(doc.id, { type: 'close', at: e.at, code: e.code })
        finishConnection(doc.id)
        return
      }
      if (e.type === 'open') {
        appendEntry(doc.id, { type: 'open', at: e.at })
        return
      }
      if (useWsStore.getState().byDoc[doc.id]?.paused && e.type === 'message' && e.direction === 'in') return
      appendEntry(doc.id, { type: e.type, direction: e.direction, at: e.at, data: e.data, binary: e.binary, size: e.size, truncated: e.truncated, code: e.code })
    })
  )
  try {
    const ctx = await getSendContext(doc)
    const result = await window.api.apiWsConnect({
      connId,
      url: ws.url,
      headers: ws.headers,
      protocols: ws.protocols,
      environment: ctx.environment,
      collection: ctx.collection,
      verifyTls: ws.settings.verifyTls,
      ...(confirmSecretHost ? { confirmSecretHost } : {})
    })
    if (useWsStore.getState().byDoc[doc.id]?.connId !== connId) return {} // desconectou enquanto conectava
    if (result.ok) {
      useWsStore.getState().patch(doc.id, { status: 'open', protocol: result.protocol })
      return {}
    }
    finishConnection(doc.id)
    if (result.code === 'secretHostNotConfirmed' && result.host) return { confirmHost: result.host }
    useWsStore.getState().patch(doc.id, {
      error: { key: wsErrorKey(result.code), ...(result.status ? { params: { status: result.status } } : {}) }
    })
  } catch {
    finishConnection(doc.id, { key: 'apiClient.error.unknown' })
  }
  return {}
}

/* ------------------------------------------------------------------ visualização */

const hhmmss = (iso: string): string => {
  const d = new Date(iso)
  const p = (n: number, w = 2): string => String(n).padStart(w, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

const humanSize = (n: number): string => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)

type ConfigTab = 'headers' | 'protocols' | 'settings'
type MsgKind = WsMessageTemplate['kind']

function parseDoc(text: string): ApiWebSocket | null {
  try {
    const r = apiWebSocketSchema.safeParse(JSON.parse(text))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

/** Construtor de conexões WebSocket: a visualização de um documento .apiws. O registro fica só na memória. */
export function WebSocketView({ doc }: { doc: EditorDocument }) {
  const t = useT()
  const updateContent = useDocuments((s) => s.updateContent)
  const setMode = useDocuments((s) => s.setMode)
  const state = useWsStore((s) => s.byDoc[doc.id]) ?? EMPTY
  const patch = useWsStore((s) => s.patch)
  const ws = useMemo(() => parseDoc(doc.content), [doc.content])
  const [tab, setTab] = useState<ConfigTab>('headers')
  const [kind, setKind] = useState<MsgKind>('text')
  const [message, setMessage] = useState('')
  const [saveName, setSaveName] = useState('')
  const [filter, setFilter] = useState('')
  const [dirFilter, setDirFilter] = useState<'all' | 'in' | 'out'>('all')
  const [selected, setSelected] = useState<number | null>(null)
  const [confirmHost, setConfirmHost] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  // Ao fechar a aba do documento, fecha a conexão (trocar de aba não fecha).
  const docId = doc.id
  useEffect(
    () => () => {
      if (!useDocuments.getState().documents.some((d) => d.id === docId)) disconnectWs(docId)
    },
    [docId]
  )

  const entries = state.entries
  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return entries.filter((e) => {
      if (dirFilter !== 'all' && e.direction !== dirFilter) return false
      return f === '' || (e.data ?? '').toLowerCase().includes(f)
    })
  }, [entries, filter, dirFilter])

  useEffect(() => {
    const el = logRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [visible.length])

  if (!ws) {
    return (
      <div className="grid h-full place-items-center bg-surface p-6" data-testid="api-invalid">
        <div className="max-w-lg rounded-md border border-amber-300 bg-amber-50 p-4 text-zinc-800">
          <p className="mb-3 flex items-center gap-2 font-semibold">
            <TriangleAlert size={16} className="text-amber-600" /> {t('apiClient.invalid')}
          </p>
          <button type="button" className={buttonClass} onClick={() => setMode(doc.id, 'edit')}>
            {t('toolbar.editText')}
          </button>
        </div>
      </div>
    )
  }

  const write = (next: ApiWebSocket): void => {
    const text = applyEol(JSON.stringify(next, null, 2) + '\n', doc.eol)
    if (text !== doc.content) updateContent(doc.id, text)
  }
  const update = (p: Partial<ApiWebSocket>): void => write({ ...ws, ...p })

  const connect = async (host?: string): Promise<void> => {
    const r = await connectDoc(doc, ws, host)
    if (r.confirmHost) setConfirmHost(r.confirmHost)
  }

  const messageProblem = ((): 'json' | 'base64' | null => {
    if (kind === 'json' && message.trim() !== '' && prettyJson(message) === null && !/^(-?\d|true|false|null|")/.test(message.trim())) return 'json'
    if (kind === 'json' && message.trim() !== '') {
      try {
        JSON.parse(message)
      } catch {
        return 'json'
      }
    }
    if (kind === 'binary' && message.trim() !== '' && !base64Valid(message)) return 'base64'
    return null
  })()

  const open = state.status === 'open'
  const send = async (data = message, k: MsgKind = kind): Promise<void> => {
    if (!open || !state.connId) return
    if (k === 'binary' && !base64Valid(data)) return
    await window.api.apiWsSend(state.connId, { data: k === 'binary' ? data.replace(/\s+/g, '') : data, binary: k === 'binary' })
  }

  const saveCurrent = (): void => {
    if (message === '') return
    const name = saveName.trim() || message.slice(0, 30)
    update({ messages: [...ws.messages, { name, kind, data: message }].slice(0, 200) })
    setSaveName('')
  }

  const selectedEntry = selected === null ? null : (entries.find((e) => e.n === selected) ?? null)
  const detailText = selectedEntry?.data === undefined ? '' : ((!selectedEntry.binary && prettyJson(selectedEntry.data)) || selectedEntry.data)
  const statusKey: MessageKey = open ? 'apiClient.ws.status.open' : state.status === 'connecting' ? 'apiClient.ws.status.connecting' : 'apiClient.ws.status.idle'
  const counts = { headers: ws.headers.filter((h) => h.enabled && h.key !== '').length, protocols: ws.protocols.length }

  return (
    <div className="flex h-full flex-col bg-surface" data-testid="api-ws-view">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <input
          value={ws.url}
          onChange={(e) => update({ url: e.target.value })}
          disabled={state.status !== 'idle'}
          placeholder="wss://api.exemplo.com.br/socket"
          aria-label={t('apiClient.ws.url')}
          spellCheck={false}
          data-testid="ws-url"
          className={`${fieldClass} min-w-0 flex-1 font-mono text-[12.5px]`}
        />
        {state.status === 'idle' ? (
          <button type="button" className={primaryButtonClass} disabled={ws.url.trim() === ''} onClick={() => void connect()} data-testid="ws-connect">
            <Plug size={14} className="mr-1 inline" /> {t('apiClient.ws.connect')}
          </button>
        ) : (
          <button type="button" className={buttonClass} onClick={() => disconnectWs(doc.id)} data-testid="ws-disconnect">
            <PlugZap size={14} className="mr-1 inline" /> {t('apiClient.ws.disconnect')}
          </button>
        )}
        <span role="status" data-testid="ws-status" data-state={state.status} className={`flex items-center gap-1.5 text-[12.5px] ${open ? 'text-emerald-700' : 'text-zinc-500'}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${open ? 'bg-emerald-500' : state.status === 'connecting' ? 'bg-amber-500' : 'bg-zinc-400'}`} />
          {t(statusKey)}
          {open && state.protocol ? ` (${state.protocol})` : ''}
        </span>
      </div>

      {state.error && (
        <div role="alert" className="flex items-center gap-1.5 border-b border-red-300 bg-red-50 px-3 py-1 text-[12.5px] text-red-700" data-testid="ws-error">
          <TriangleAlert size={14} /> {t(state.error.key as MessageKey, state.error.params)}
        </div>
      )}

      <div className="shrink-0 border-b border-border px-3 py-1.5">
        <div role="tablist" aria-label={t('apiClient.ws.config')} className="mb-1.5 flex gap-4 text-[12.5px]">
          {(['headers', 'protocols', 'settings'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`border-b-2 pb-0.5 ${tab === id ? 'border-accent font-medium' : 'border-transparent text-zinc-600 hover:text-zinc-900'}`}
            >
              {t(`apiClient.ws.tab.${id}` as MessageKey)}
              {id !== 'settings' && counts[id] > 0 ? ` (${counts[id]})` : ''}
            </button>
          ))}
        </div>
        <div className="max-h-40 overflow-auto">
          {tab === 'headers' && <KeyValueTable label={t('apiClient.headers.title')} rows={ws.headers} onChange={(headers: KeyValue[]) => update({ headers })} showDescription={false} />}
          {tab === 'protocols' && (
            <label className="flex flex-col gap-1 text-[12.5px] text-zinc-600">
              {t('apiClient.ws.protocolsHint')}
              <input
                value={ws.protocols.join(', ')}
                onChange={(e) => update({ protocols: e.target.value.split(',').map((p) => p.trim()).filter((p) => p !== '').slice(0, 20) })}
                aria-label={t('apiClient.ws.protocols')}
                placeholder="graphql-transport-ws, chat"
                spellCheck={false}
                className={`${fieldClass} font-mono text-[12.5px]`}
              />
            </label>
          )}
          {tab === 'settings' && (
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={ws.settings.verifyTls} onChange={(e) => update({ settings: { ...ws.settings, verifyTls: e.target.checked } })} />
              {t('apiClient.ws.verifyTls')}
            </label>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] divide-x divide-border">
        <div className="flex min-h-0 flex-col gap-2 overflow-auto p-3">
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="font-medium">{t('apiClient.ws.message')}</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as MsgKind)} aria-label={t('apiClient.ws.kind')} className={`${fieldClass} !w-auto py-0.5 text-[12.5px]`} data-testid="ws-kind">
              <option value="text">{t('apiClient.ws.kind.text')}</option>
              <option value="json">JSON</option>
              <option value="binary">{t('apiClient.ws.kind.binary')}</option>
            </select>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !messageProblem) {
                e.preventDefault()
                void send()
              }
            }}
            aria-label={t('apiClient.ws.messageLabel')}
            spellCheck={false}
            rows={6}
            data-testid="ws-message"
            className={`${fieldClass} min-h-24 flex-1 resize-y font-mono text-[12.5px]`}
          />
          {messageProblem && (
            <div role="alert" className="flex items-center gap-1.5 text-[12.5px] text-amber-700">
              <TriangleAlert size={14} /> {t(messageProblem === 'json' ? 'apiClient.ws.jsonInvalid' : 'apiClient.ws.base64Invalid')}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={primaryButtonClass} disabled={!open || !!messageProblem || message === ''} onClick={() => void send()} title="Ctrl+Enter" data-testid="ws-send">
              <Send size={14} className="mr-1 inline" /> {t('apiClient.ws.send')}
            </button>
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={t('apiClient.ws.saveName')}
              aria-label={t('apiClient.ws.saveName')}
              className={`${fieldClass} !w-36 py-0.5 text-[12.5px]`}
              data-testid="ws-save-name"
            />
            <button type="button" className={buttonClass} disabled={message === ''} onClick={saveCurrent} data-testid="ws-save-message">
              <Save size={14} className="mr-1 inline" /> {t('apiClient.ws.saveMessage')}
            </button>
          </div>
          <div className="text-[12.5px] font-medium">{t('apiClient.ws.saved')}</div>
          <ul aria-label={t('apiClient.ws.saved')} className="flex flex-col gap-1" data-testid="ws-saved-list">
            {ws.messages.length === 0 && <li className="text-[12.5px] text-zinc-500">{t('apiClient.ws.noSaved')}</li>}
            {ws.messages.map((m, i) => (
              <li key={i} className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-[12.5px]">
                <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" title={m.data} onClick={() => { setKind(m.kind); setMessage(m.data) }}>
                  {m.name || m.data.slice(0, 30)} <span className="text-zinc-400">({m.kind})</span>
                </button>
                <button type="button" className={`${buttonClass} !px-1.5 !py-0.5`} disabled={!open} aria-label={t('apiClient.ws.sendSaved', { name: m.name })} onClick={() => void send(m.data, m.kind)}>
                  <Send size={12} />
                </button>
                <button type="button" className={`${buttonClass} !px-1.5 !py-0.5`} aria-label={t('apiClient.ws.deleteSaved', { name: m.name })} onClick={() => update({ messages: ws.messages.filter((_, j) => j !== i) })}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[12.5px]">
            <span className="font-medium">{t('apiClient.ws.log')}</span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('apiClient.ws.filter')} aria-label={t('apiClient.ws.filter')} className={`${fieldClass} !w-32 py-0.5 text-[12.5px]`} />
            <select value={dirFilter} onChange={(e) => setDirFilter(e.target.value as 'all' | 'in' | 'out')} aria-label={t('apiClient.ws.direction')} className={`${fieldClass} !w-auto py-0.5 text-[12.5px]`}>
              <option value="all">{t('apiClient.ws.dir.all')}</option>
              <option value="in">{t('apiClient.ws.dir.in')}</option>
              <option value="out">{t('apiClient.ws.dir.out')}</option>
            </select>
            <button type="button" className={buttonClass} aria-pressed={state.paused} onClick={() => patch(doc.id, { paused: !state.paused })}>
              {state.paused ? <Play size={13} className="mr-1 inline" /> : <Pause size={13} className="mr-1 inline" />}
              {state.paused ? t('apiClient.ws.resume') : t('apiClient.ws.pause')}
            </button>
            <button type="button" className={buttonClass} onClick={() => { patch(doc.id, { entries: [], bytes: 0 }); setSelected(null) }} data-testid="ws-clear">
              <Eraser size={13} className="mr-1 inline" /> {t('apiClient.ws.clear')}
            </button>
            <span className="ml-auto text-zinc-500">{t('apiClient.ws.count', { shown: visible.length, total: entries.length })}</span>
          </div>
          <div
            ref={logRef}
            onScroll={(e) => {
              const el = e.currentTarget
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
            }}
            className="min-h-0 flex-1 overflow-auto font-mono text-[12px]"
            data-testid="ws-log"
            role="log"
            aria-label={t('apiClient.ws.log')}
          >
            {visible.length === 0 && <p className="p-3 font-sans text-[12.5px] text-zinc-500">{t('apiClient.ws.empty')}</p>}
            {visible.map((e) => (
              <button
                key={e.n}
                type="button"
                onClick={() => setSelected(e.n === selected ? null : e.n)}
                data-testid="ws-entry"
                data-direction={e.direction ?? e.type}
                className={`flex w-full items-baseline gap-2 border-b border-border/50 px-3 py-0.5 text-left hover:bg-zinc-100 ${selected === e.n ? 'bg-blue-50' : ''}`}
              >
                <span className="shrink-0 text-zinc-400">{hhmmss(e.at)}</span>
                {e.direction === 'in' && <ArrowDown size={13} className="shrink-0 text-emerald-600" aria-label={t('apiClient.ws.dir.in')} />}
                {e.direction === 'out' && <ArrowUp size={13} className="shrink-0 text-sky-600" aria-label={t('apiClient.ws.dir.out')} />}
                {e.direction === undefined && <span className={`shrink-0 ${e.type === 'error' ? 'text-red-600' : 'text-zinc-500'}`}>●</span>}
                <span className="w-16 shrink-0 text-right text-zinc-500">{e.size !== undefined ? humanSize(e.size) : ''}</span>
                <span className={`min-w-0 flex-1 truncate ${e.type === 'error' ? 'text-red-600' : e.direction === undefined ? 'font-sans text-zinc-500' : ''}`}>
                  {e.type === 'message'
                    ? e.binary
                      ? `[base64] ${e.data ?? ''}`
                      : (e.data ?? '')
                    : e.type === 'error'
                      ? t(wsErrorKey(String(e.code ?? 'unknown')) as MessageKey, { status: 0 })
                      : t(e.type === 'open' ? 'apiClient.ws.event.open' : 'apiClient.ws.event.close', { code: e.code ?? '' })}
                </span>
              </button>
            ))}
          </div>
          {selectedEntry && selectedEntry.type === 'message' && (
            <div className="flex max-h-[40%] shrink-0 flex-col border-t border-border" data-testid="ws-detail">
              <div className="flex items-center gap-2 px-3 py-1 text-[12.5px]">
                <span className="font-medium">{t('apiClient.ws.detail')}</span>
                {selectedEntry.truncated && <span className="text-amber-700">{t('apiClient.ws.truncated')}</span>}
                <button type="button" className={`${buttonClass} ml-auto !py-0.5`} onClick={() => setSelected(null)}>
                  {t('common.close')}
                </button>
              </div>
              <pre className="min-h-0 flex-1 select-text overflow-auto whitespace-pre-wrap break-all px-3 pb-2 font-mono text-[12px]">{detailText}</pre>
            </div>
          )}
        </div>
      </div>

      {confirmHost && (
        <Modal title={t('apiClient.secretHost.title', { host: confirmHost })} description={t('apiClient.secretHost.body', { host: confirmHost })} onClose={() => setConfirmHost(null)} size="sm">
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={() => setConfirmHost(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              data-testid="api-secret-host-confirm"
              onClick={() => {
                const host = confirmHost
                setConfirmHost(null)
                void connect(host)
              }}
            >
              {t('apiClient.secretHost.confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
