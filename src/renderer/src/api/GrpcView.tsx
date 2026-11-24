// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Eraser, FilePlus2, Play, RefreshCw, Save, Send, Square, Trash2, TriangleAlert, Wand2, X } from 'lucide-react'
import { create } from 'zustand'
import { API_LIMITS } from '@shared/api/limits'
import type { ApiGrpcEvent, ApiGrpcMethodKind, ApiGrpcService } from '@shared/api/protocol'
import { apiGrpcSchema, type ApiGrpc, type KeyValue } from '@shared/api/schema'
import { dirOfPath, relativizeProtoPaths } from '@shared/api/grpcPaths'
import { applyEol } from '@shared/eol'
import type { MessageKey } from '@shared/i18n'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from '@/components/Modal'
import { useT } from '@/i18n'
import { getSendContext } from '@/store/api'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { useWorkspace } from '@/store/workspace'
import { BodyMonaco } from './BodyMonaco'
import { KeyValueTable } from './KeyValueTable'

/* ------------------------------------------------------------------ estado (só na memória) */

interface LogEntry {
  n: number
  type: ApiGrpcEvent['type']
  direction: 'in' | 'out'
  at: string
  data: string
  code?: number
  codeName?: string
  details?: string
  truncated?: boolean
  /** Resumo: mensagens recebidas que não foram exibidas (limite de eventos por segundo). */
  dropped?: number
}

interface GrpcState {
  status: 'idle' | 'starting' | 'running'
  callId: string | null
  kind: ApiGrpcMethodKind | null
  services: ApiGrpcService[]
  loadingServices: boolean
  entries: LogEntry[]
  bytes: number
  error: string | null
}

const EMPTY: GrpcState = { status: 'idle', callId: null, kind: null, services: [], loadingServices: false, entries: [], bytes: 0, error: null }

const useGrpcStore = create<{ byDoc: Record<string, GrpcState>; patch: (docId: string, p: Partial<GrpcState>) => void }>((set) => ({
  byDoc: {},
  patch: (docId, p) => set((s) => ({ byDoc: { ...s.byDoc, [docId]: { ...(s.byDoc[docId] ?? EMPTY), ...p } } }))
}))

/** Um único ouvinte de api:grpc-event para a janela; cada chamada registra o seu pelo callId. */
const listeners = new Map<string, (event: ApiGrpcEvent) => void>()
let off: (() => void) | null = null
function listenGrpc(callId: string, listener: (event: ApiGrpcEvent) => void): () => void {
  off ??= window.api.onApiGrpcEvent((e) => listeners.get(e.callId)?.(e))
  listeners.set(callId, listener)
  return () => {
    listeners.delete(callId)
    if (listeners.size === 0 && off) {
      off()
      off = null
    }
  }
}

const unlisten = new Map<string, () => void>()
let counter = 0
const sizeOf = (e: LogEntry): number => e.data.length + 64

function appendEntry(docId: string, entry: Omit<LogEntry, 'n'>): void {
  const cur = useGrpcStore.getState().byDoc[docId] ?? EMPTY
  const full: LogEntry = { ...entry, n: ++counter }
  const entries = [...cur.entries, full]
  let bytes = cur.bytes + sizeOf(full)
  let drop = 0
  while ((entries.length - drop > API_LIMITS.wsLogMessages || bytes > API_LIMITS.wsLogBytes) && drop < entries.length - 1) bytes -= sizeOf(entries[drop++])
  useGrpcStore.getState().patch(docId, { entries: drop > 0 ? entries.slice(drop) : entries, bytes })
}

function finishCall(docId: string, error?: string | null): void {
  unlisten.get(docId)?.()
  unlisten.delete(docId)
  useGrpcStore.getState().patch(docId, { status: 'idle', callId: null, kind: null, ...(error !== undefined ? { error } : {}) })
}

export function cancelGrpcCall(docId: string): void {
  const cur = useGrpcStore.getState().byDoc[docId]
  if (cur?.callId) void window.api.apiGrpcCancel(cur.callId).catch(() => undefined)
}

/** Chave i18n do erro; `code` vem do Main (ApiErrorCode ou um código do gRPC). */
export function grpcErrorKey(code: string): string {
  if (['protoInvalid', 'protoNotAuthorized', 'reflectionUnavailable', 'methodNotFound', 'messageInvalid', 'tooManyCalls'].includes(code)) return `apiClient.grpc.error.${code}`
  return `apiClient.error.${code}`
}

/* ------------------------------------------------------------------ visualização */

const hhmmss = (iso: string): string => {
  const d = new Date(iso)
  const p = (n: number, w = 2): string => String(n).padStart(w, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
}

function parseDoc(text: string): ApiGrpc | null {
  try {
    const r = apiGrpcSchema.safeParse(JSON.parse(text))
    return r.success ? r.data : null
  } catch {
    return null
  }
}

const KIND_KEYS: Record<ApiGrpcMethodKind, MessageKey> = {
  unary: 'apiClient.grpc.kind.unary',
  server: 'apiClient.grpc.kind.server',
  client: 'apiClient.grpc.kind.client',
  bidi: 'apiClient.grpc.kind.bidi'
}

/** Construtor de chamadas gRPC: a visualização de um documento .apigrpc. O registro fica só na memória. */
export function GrpcView({ doc }: { doc: EditorDocument }) {
  const t = useT()
  const updateContent = useDocuments((s) => s.updateContent)
  const setMode = useDocuments((s) => s.setMode)
  const state = useGrpcStore((s) => s.byDoc[doc.id]) ?? EMPTY
  const patch = useGrpcStore((s) => s.patch)
  const grpc = useMemo(() => parseDoc(doc.content), [doc.content])
  const [saveName, setSaveName] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [confirmHost, setConfirmHost] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'start' | 'load'>('start')
  const logRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  // Ao fechar a aba do documento, cancela a chamada (trocar de aba não cancela).
  const docId = doc.id
  useEffect(
    () => () => {
      if (!useDocuments.getState().documents.some((d) => d.id === docId)) {
        cancelGrpcCall(docId)
        finishCall(docId)
      }
    },
    [docId]
  )

  const protoKey = grpc?.source.type === 'proto' ? grpc.source.files.join('\n') : ''
  const loadedOnce = useRef(false)
  // Com arquivos .proto não há rede: carrega os serviços sozinho na primeira vez.
  useEffect(() => {
    if (!loadedOnce.current && grpc?.source.type === 'proto' && grpc.source.files.length > 0 && state.services.length === 0) {
      loadedOnce.current = true
      void loadServices()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protoKey])

  // Primeiro salvamento: os .proto que estavam absolutos e ficam na pasta do .apigrpc passam a relativos.
  const docPath = doc.path
  const prevPath = useRef(docPath)
  useEffect(() => {
    // Só na transição "sem arquivo" para "salvo" (abrir um documento antigo não o altera).
    if (!prevPath.current && docPath) makeProtoPathsRelative()
    prevPath.current = docPath
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docPath])

  useEffect(() => {
    const el = logRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [state.entries.length])

  if (!grpc) {
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

  const write = (next: ApiGrpc): void => {
    const text = applyEol(JSON.stringify(next, null, 2) + '\n', doc.eol)
    if (text !== doc.content) updateContent(doc.id, text)
  }
  const update = (p: Partial<ApiGrpc>): void => write({ ...grpc, ...p })

  const service = state.services.find((s) => s.name === grpc.service)
  const method = service?.methods.find((m) => m.name === grpc.method)
  const kind = method?.kind ?? null
  const busy = state.status !== 'idle'
  const running = state.status === 'running'

  /** Com o .apigrpc salvo, grava os caminhos dos .proto relativos à pasta dele (só os que estão nela ou abaixo). */
  function makeProtoPathsRelative(): ApiGrpc | null {
    if (!grpc || !doc.path || grpc.source.type !== 'proto') return null
    const base = dirOfPath(doc.path)
    const files = relativizeProtoPaths(base, grpc.source.files)
    const importPaths = relativizeProtoPaths(base, grpc.source.importPaths)
    if (files === grpc.source.files && importPaths === grpc.source.importPaths) return null
    const next: ApiGrpc = { ...grpc, source: { ...grpc.source, files, importPaths } }
    write(next)
    return next
  }

  const common = async (source: ApiGrpc['source'] = grpc.source) => {
    const ctx = await getSendContext(doc)
    return {
      // Caminhos relativos valem contra a pasta do .apigrpc: o Main resolve (e recusa o que sai dela).
      source: source.type === 'proto' && doc.path ? { ...source, baseDir: dirOfPath(doc.path) } : source,
      // O Main exige um endereço; com .proto não há rede, então um espaço reservado basta.
      address: grpc.address.trim() === '' ? 'localhost' : grpc.address,
      tls: grpc.settings.tls,
      verifyTls: grpc.settings.verifyTls,
      metadata: grpc.metadata,
      environment: ctx.environment,
      collection: ctx.collection
    }
  }

  async function loadServices(host?: string): Promise<void> {
    if (!grpc || state.loadingServices) return
    patch(doc.id, { loadingServices: true, error: null })
    try {
      const current = makeProtoPathsRelative() ?? grpc
      const result = await window.api.apiGrpcLoad({ ...(await common(current.source)), ...(host ? { confirmSecretHost: host } : {}) })
      if (result.ok) {
        patch(doc.id, { services: result.services, loadingServices: false })
        // Primeira carga sem escolha: já seleciona o primeiro serviço e método.
        if (grpc.service === '' && result.services[0]?.methods[0]) {
          const m = result.services[0].methods[0]
          write({ ...current, service: result.services[0].name, method: m.name, message: m.template })
        }
        return
      }
      patch(doc.id, { loadingServices: false })
      if (result.code === 'secretHostNotConfirmed' && result.host) {
        setConfirmAction('load')
        setConfirmHost(result.host)
        return
      }
      patch(doc.id, { error: grpcErrorKey(result.code) })
    } catch {
      patch(doc.id, { loadingServices: false, error: 'apiClient.error.unknown' })
    }
  }

  const startCall = async (host?: string): Promise<void> => {
    if (busy || !kind) return
    const callId = crypto.randomUUID()
    patch(doc.id, { status: 'starting', callId, kind, error: null })
    unlisten.set(
      doc.id,
      listenGrpc(callId, (e) => {
        if (e.type === 'status') {
          appendEntry(doc.id, { type: 'status', direction: 'in', at: e.at, data: '', code: e.code, codeName: e.codeName, details: e.details })
          finishCall(doc.id)
          return
        }
        appendEntry(doc.id, { type: e.type, direction: e.direction, at: e.at, data: e.data, details: e.details, truncated: e.truncated, dropped: e.dropped })
      })
    )
    try {
      const result = await window.api.apiGrpcStart({
        ...(await common()),
        callId,
        service: grpc.service,
        method: grpc.method,
        message: kind === 'unary' || kind === 'server' ? grpc.message : '',
        deadlineMs: grpc.settings.deadlineMs,
        ...(host ? { confirmSecretHost: host } : {})
      })
      if (useGrpcStore.getState().byDoc[doc.id]?.callId !== callId) return // já terminou
      if (result.ok) {
        patch(doc.id, { status: 'running' })
        return
      }
      finishCall(doc.id)
      if (result.code === 'secretHostNotConfirmed' && result.host) {
        setConfirmAction('start')
        setConfirmHost(result.host)
        return
      }
      patch(doc.id, { error: grpcErrorKey(result.code) })
    } catch {
      finishCall(doc.id, 'apiClient.error.unknown')
    }
  }

  const sendMessage = async (text = grpc.message): Promise<void> => {
    if (!running || !state.callId) return
    await window.api.apiGrpcSend(state.callId, text)
  }

  const pickProtos = async (): Promise<void> => {
    if (grpc.source.type !== 'proto') return
    const paths = await window.api.apiPickFiles('proto', true).catch(() => [] as string[])
    if (paths.length === 0) return
    // Documento salvo: caminhos relativos à pasta do .apigrpc quando o arquivo está nela ou abaixo; senão, absolutos.
    const chosen = doc.path ? relativizeProtoPaths(dirOfPath(doc.path), paths) : paths
    const files = [...new Set([...grpc.source.files, ...chosen])].slice(0, 50)
    loadedOnce.current = false
    patch(doc.id, { services: [] })
    write({ ...grpc, source: { ...grpc.source, files } })
  }

  // Os arquivos podem estar numa pasta que ainda não foi aberta neste computador: abrir a pasta os autoriza.
  const openFolderAndReload = async (): Promise<void> => {
    const folder = await window.api.openFolder().catch(() => null)
    if (!folder) return
    useWorkspace.getState().setFolder(folder)
    await loadServices()
  }

  const saveCurrent = (): void => {
    if (grpc.message.trim() === '') return
    update({ messages: [...grpc.messages, { name: saveName.trim() || grpc.message.slice(0, 30), data: grpc.message }].slice(0, 200) })
    setSaveName('')
  }

  const entries = state.entries
  const selectedEntry = selected === null ? null : (entries.find((e) => e.n === selected) ?? null)
  const messageHint = grpc.message.trim() !== '' && !grpc.message.includes('{{') && (() => {
    try {
      JSON.parse(grpc.message)
      return false
    } catch {
      return true
    }
  })()

  return (
    <div className="flex h-full flex-col bg-surface" data-testid="api-grpc-view">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <input
          value={grpc.address}
          onChange={(e) => update({ address: e.target.value })}
          disabled={busy}
          placeholder="api.exemplo.com.br:443"
          aria-label={t('apiClient.grpc.address')}
          spellCheck={false}
          data-testid="grpc-address"
          className={`${fieldClass} min-w-48 flex-1 font-mono text-[12.5px]`}
        />
        <label className="flex items-center gap-1.5 text-[12.5px]">
          <input type="checkbox" checked={grpc.settings.tls} disabled={busy} onChange={(e) => update({ settings: { ...grpc.settings, tls: e.target.checked } })} data-testid="grpc-tls" />
          {t('apiClient.grpc.tls')}
        </label>
        <label className={`flex items-center gap-1.5 text-[12.5px] ${grpc.settings.tls ? '' : 'opacity-50'}`}>
          <input type="checkbox" checked={grpc.settings.verifyTls} disabled={busy || !grpc.settings.tls} onChange={(e) => update({ settings: { ...grpc.settings, verifyTls: e.target.checked } })} />
          {t('apiClient.grpc.verifyTls')}
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px]">
          {t('apiClient.grpc.deadline')}
          <input
            type="number"
            min={0}
            max={3_600_000}
            value={grpc.settings.deadlineMs}
            disabled={busy}
            onChange={(e) => update({ settings: { ...grpc.settings, deadlineMs: Math.min(3_600_000, Math.max(0, Math.round(Number(e.target.value) || 0))) } })}
            aria-label={t('apiClient.grpc.deadline')}
            className={`${fieldClass} !w-24 py-0.5 text-[12.5px]`}
          />
        </label>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-[12.5px]">
        <select
          value={grpc.source.type}
          disabled={busy}
          onChange={(e) => {
            patch(doc.id, { services: [] })
            loadedOnce.current = false
            update({ source: e.target.value === 'proto' ? { type: 'proto', files: [], importPaths: [] } : { type: 'reflection' } })
          }}
          aria-label={t('apiClient.grpc.source')}
          data-testid="grpc-source"
          className={`${fieldClass} !w-auto py-0.5 text-[12.5px]`}
        >
          <option value="reflection">{t('apiClient.grpc.source.reflection')}</option>
          <option value="proto">{t('apiClient.grpc.source.proto')}</option>
        </select>
        {grpc.source.type === 'proto' && (
          <>
            <button type="button" className={buttonClass} disabled={busy} onClick={() => void pickProtos()} data-testid="grpc-pick-proto">
              <FilePlus2 size={13} className="mr-1 inline" /> {t('apiClient.grpc.addProto')}
            </button>
            <ul aria-label={t('apiClient.grpc.protoFiles')} className="flex flex-wrap gap-1" data-testid="grpc-proto-files">
              {grpc.source.files.length === 0 && <li className="text-zinc-500">{t('apiClient.grpc.noProto')}</li>}
              {grpc.source.files.map((f) => (
                <li key={f} className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-[12px]" title={f}>
                  {f.split(/[\\/]/).pop()}
                  <button
                    type="button"
                    aria-label={t('apiClient.grpc.removeProto', { name: f.split(/[\\/]/).pop() ?? f })}
                    disabled={busy}
                    onClick={() => {
                      if (grpc.source.type !== 'proto') return
                      patch(doc.id, { services: [] })
                      write({ ...grpc, source: { ...grpc.source, files: grpc.source.files.filter((x) => x !== f) } })
                    }}
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <button
          type="button"
          className={buttonClass}
          disabled={busy || state.loadingServices || (grpc.source.type === 'proto' ? grpc.source.files.length === 0 : grpc.address.trim() === '')}
          onClick={() => void loadServices()}
          data-testid="grpc-load"
        >
          <RefreshCw size={13} className={`mr-1 inline ${state.loadingServices ? 'animate-spin' : ''}`} /> {t(state.loadingServices ? 'apiClient.grpc.loading' : 'apiClient.grpc.load')}
        </button>
        <select
          value={grpc.service}
          disabled={busy || state.services.length === 0}
          onChange={(e) => {
            const s = state.services.find((x) => x.name === e.target.value)
            const m = s?.methods[0]
            update({ service: e.target.value, method: m?.name ?? '', ...(m ? { message: m.template } : {}) })
          }}
          aria-label={t('apiClient.grpc.service')}
          data-testid="grpc-service"
          className={`${fieldClass} !w-auto max-w-64 py-0.5 text-[12.5px]`}
        >
          {state.services.length === 0 && <option value={grpc.service}>{grpc.service === '' ? t('apiClient.grpc.noServices') : grpc.service}</option>}
          {state.services.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={grpc.method}
          disabled={busy || !service}
          onChange={(e) => {
            const m = service?.methods.find((x) => x.name === e.target.value)
            update({ method: e.target.value, ...(m ? { message: m.template } : {}) })
          }}
          aria-label={t('apiClient.grpc.method')}
          data-testid="grpc-method"
          className={`${fieldClass} !w-auto max-w-56 py-0.5 text-[12.5px]`}
        >
          {!service && <option value={grpc.method}>{grpc.method}</option>}
          {service?.methods.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        {kind && (
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700" data-testid="grpc-kind" data-kind={kind}>
            {t(KIND_KEYS[kind])}
          </span>
        )}
      </div>

      {state.error && (
        <div role="alert" className="flex items-center gap-1.5 border-b border-red-300 bg-red-50 px-3 py-1 text-[12.5px] text-red-700" data-testid="grpc-error">
          <TriangleAlert size={14} /> {t(state.error as MessageKey)}
          {state.error === 'apiClient.grpc.error.protoNotAuthorized' && (
            <span className="ml-2 flex items-center gap-1.5">
              <button type="button" className={`${buttonClass} !py-0.5`} onClick={() => void pickProtos()} data-testid="grpc-reselect-proto">
                {t('apiClient.grpc.protoReselect')}
              </button>
              <button type="button" className={`${buttonClass} !py-0.5`} onClick={() => void openFolderAndReload()} data-testid="grpc-open-folder">
                {t('apiClient.grpc.protoOpenFolder')}
              </button>
            </span>
          )}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] divide-x divide-border">
        <div className="flex min-h-0 flex-col gap-2 overflow-auto p-3">
          <div className="max-h-36 shrink-0 overflow-auto">
            <KeyValueTable label={t('apiClient.grpc.metadata')} rows={grpc.metadata} onChange={(metadata: KeyValue[]) => update({ metadata })} showDescription={false} />
          </div>
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className="font-medium">{t('apiClient.grpc.message')}</span>
            <button type="button" className={buttonClass} disabled={!method} onClick={() => method && update({ message: method.template })} data-testid="grpc-template">
              <Wand2 size={13} className="mr-1 inline" /> {t('apiClient.grpc.useTemplate')}
            </button>
          </div>
          <div className="flex min-h-40 flex-1 flex-col" data-testid="grpc-message">
            <BodyMonaco language="json" value={grpc.message} onChange={(message) => update({ message })} label={t('apiClient.grpc.messageLabel')} />
          </div>
          {messageHint && (
            <div role="alert" className="flex items-center gap-1.5 text-[12.5px] text-amber-700">
              <TriangleAlert size={14} /> {t('apiClient.grpc.jsonInvalid')}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {(kind === 'unary' || kind === 'server') && (
              <button type="button" className={primaryButtonClass} disabled={busy} onClick={() => void startCall()} data-testid="grpc-invoke">
                <Play size={14} className="mr-1 inline" /> {t('apiClient.grpc.invoke')}
              </button>
            )}
            {(kind === 'client' || kind === 'bidi') && (
              <>
                <button type="button" className={primaryButtonClass} disabled={busy} onClick={() => void startCall()} data-testid="grpc-start">
                  <Play size={14} className="mr-1 inline" /> {t('apiClient.grpc.start')}
                </button>
                <button type="button" className={buttonClass} disabled={!running || grpc.message.trim() === ''} onClick={() => void sendMessage()} data-testid="grpc-send">
                  <Send size={14} className="mr-1 inline" /> {t('apiClient.grpc.send')}
                </button>
                <button type="button" className={buttonClass} disabled={!running} onClick={() => state.callId && void window.api.apiGrpcEnd(state.callId)} data-testid="grpc-end">
                  {t('apiClient.grpc.end')}
                </button>
              </>
            )}
            <button type="button" className={buttonClass} disabled={!busy} onClick={() => cancelGrpcCall(doc.id)} data-testid="grpc-cancel">
              <Square size={13} className="mr-1 inline" /> {t('apiClient.grpc.cancel')}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={t('apiClient.grpc.saveName')}
              aria-label={t('apiClient.grpc.saveName')}
              className={`${fieldClass} !w-36 py-0.5 text-[12.5px]`}
            />
            <button type="button" className={buttonClass} disabled={grpc.message.trim() === ''} onClick={saveCurrent} data-testid="grpc-save-message">
              <Save size={14} className="mr-1 inline" /> {t('apiClient.grpc.saveMessage')}
            </button>
          </div>
          <div className="text-[12.5px] font-medium">{t('apiClient.grpc.saved')}</div>
          <ul aria-label={t('apiClient.grpc.saved')} className="flex flex-col gap-1" data-testid="grpc-saved-list">
            {grpc.messages.length === 0 && <li className="text-[12.5px] text-zinc-500">{t('apiClient.grpc.noSaved')}</li>}
            {grpc.messages.map((m, i) => (
              <li key={i} className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-[12.5px]">
                <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" title={m.data} onClick={() => update({ message: m.data })}>
                  {m.name || m.data.slice(0, 30)}
                </button>
                <button type="button" className={`${buttonClass} !px-1.5 !py-0.5`} disabled={!running} aria-label={t('apiClient.grpc.sendSaved', { name: m.name })} onClick={() => void sendMessage(m.data)}>
                  <Send size={12} />
                </button>
                <button type="button" className={`${buttonClass} !px-1.5 !py-0.5`} aria-label={t('apiClient.grpc.deleteSaved', { name: m.name })} onClick={() => update({ messages: grpc.messages.filter((_, j) => j !== i) })}>
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5 text-[12.5px]">
            <span className="font-medium">{t('apiClient.grpc.log')}</span>
            <span role="status" data-testid="grpc-status" data-state={state.status} className="text-zinc-500">
              {state.status === 'idle' ? '' : t(state.status === 'starting' ? 'apiClient.grpc.starting' : 'apiClient.grpc.running')}
            </span>
            <button
              type="button"
              className={`${buttonClass} ml-auto`}
              onClick={() => {
                patch(doc.id, { entries: [], bytes: 0 })
                setSelected(null)
              }}
              data-testid="grpc-clear"
            >
              <Eraser size={13} className="mr-1 inline" /> {t('apiClient.grpc.clear')}
            </button>
          </div>
          <div
            ref={logRef}
            onScroll={(e) => {
              const el = e.currentTarget
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
            }}
            className="min-h-0 flex-1 overflow-auto font-mono text-[12px]"
            data-testid="grpc-log"
            role="log"
            aria-label={t('apiClient.grpc.log')}
          >
            {entries.length === 0 && <p className="p-3 font-sans text-[12.5px] text-zinc-500">{t('apiClient.grpc.empty')}</p>}
            {entries.map((e) => {
              const statusOk = e.type === 'status' && e.code === 0
              const statusBad = e.type === 'status' && e.code !== 0
              return (
                <button
                  key={e.n}
                  type="button"
                  onClick={() => setSelected(e.n === selected ? null : e.n)}
                  data-testid="grpc-entry"
                  data-type={e.type}
                  data-dropped={e.dropped}
                  data-direction={e.direction}
                  className={`flex w-full items-baseline gap-2 border-b border-border/50 px-3 py-0.5 text-left hover:bg-zinc-100 ${selected === e.n ? 'bg-blue-50' : ''}`}
                >
                  <span className="shrink-0 text-zinc-400">{hhmmss(e.at)}</span>
                  {e.direction === 'in' ? <ArrowDown size={13} className="shrink-0 text-emerald-600" aria-label={t('apiClient.grpc.dir.in')} /> : <ArrowUp size={13} className="shrink-0 text-sky-600" aria-label={t('apiClient.grpc.dir.out')} />}
                  <span className={`min-w-0 flex-1 truncate ${e.dropped !== undefined ? 'font-sans text-amber-700' : ''} ${statusOk ? 'text-emerald-700' : statusBad || e.type === 'error' ? 'text-red-600' : e.type === 'metadata' ? 'font-sans text-zinc-500' : ''}`}>
                    {e.dropped !== undefined
                      ? t('apiClient.grpc.dropped', { count: String(e.dropped) })
                      : e.type === 'status'
                      ? `${e.codeName ?? ''} (${e.code ?? ''})${e.details ? ` ${e.details}` : ''}`
                      : e.type === 'error'
                        ? t(grpcErrorKey(e.data) as MessageKey)
                        : e.type === 'metadata'
                          ? `${t(e.details === 'trailers' ? 'apiClient.grpc.event.trailers' : 'apiClient.grpc.event.metadata')} ${e.data.replace(/\s+/g, ' ')}`
                          : e.data.replace(/\s+/g, ' ')}
                  </span>
                </button>
              )
            })}
          </div>
          {selectedEntry && selectedEntry.type !== 'error' && (
            <div className="flex max-h-[40%] shrink-0 flex-col border-t border-border" data-testid="grpc-detail">
              <div className="flex items-center gap-2 px-3 py-1 text-[12.5px]">
                <span className="font-medium">{t('apiClient.grpc.detail')}</span>
                {selectedEntry.truncated && <span className="text-amber-700">{t('apiClient.grpc.truncated')}</span>}
                <button type="button" className={`${buttonClass} ml-auto !py-0.5`} onClick={() => setSelected(null)}>
                  {t('common.close')}
                </button>
              </div>
              <pre className="min-h-0 flex-1 select-text overflow-auto whitespace-pre-wrap break-all px-3 pb-2 font-mono text-[12px]">
                {selectedEntry.type === 'status' ? `${selectedEntry.codeName ?? ''} (${selectedEntry.code ?? ''})\n${selectedEntry.details ?? ''}` : selectedEntry.data}
              </pre>
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
                void (confirmAction === 'load' ? loadServices(host) : startCall(host))
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
