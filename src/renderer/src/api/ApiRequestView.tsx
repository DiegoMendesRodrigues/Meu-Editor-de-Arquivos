// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Code2, Pencil, Send, TriangleAlert } from 'lucide-react'
import {
  parseApiRequest,
  RESPONSE_TYPES,
  serializeApiRequest,
  type ApiRequest,
  type KeyValue,
  type RequestParseError
} from '@shared/api/schema'
import { HTTP_METHODS, API_LIMITS } from '@shared/api/limits'
import { findVariables } from '@shared/api/variables'
import type { ApiSendResult } from '@shared/api/protocol'
import { applyEol } from '@shared/eol'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'
import { Modal, buttonClass, primaryButtonClass } from '@/components/Modal'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { useNotice } from '@/store/notice'
import { applyExtractedVariables, getSendContext, useApiStore } from '@/store/api'
import { CodegenDialog } from './CodegenDialog'
import { openExample, saveResponseExample } from './exampleActions'
import { EnvironmentSelect } from './EnvironmentSelect'
import { KeyValueTable } from './KeyValueTable'
import { AuthEditor, BodyEditor, SettingsEditor } from './RequestSections'
import { ResponsePanel } from './ResponsePanel'
import { TestsEditor } from './TestsEditor'
import { useDocResponse, useResponses } from './responses'
import { effectiveRequest, isPathParam, paramsFromUrl, urlFromParams, withPathParams } from '@shared/api/urlParams'

/** Cor do método no seletor, nas abas e na barra lateral (as cores têm versão escura no styles.css). */
export const METHOD_CLASS: Record<string, string> = {
  GET: 'text-emerald-700',
  POST: 'text-amber-700',
  PUT: 'text-sky-600',
  PATCH: 'text-violet-600',
  DELETE: 'text-red-600',
  HEAD: 'text-zinc-600',
  OPTIONS: 'text-zinc-600'
}

type RequestTab = 'params' | 'auth' | 'headers' | 'body' | 'tests' | 'settings'
const TABS: { id: RequestTab; label: MessageKey }[] = [
  { id: 'params', label: 'apiClient.tab.params' },
  { id: 'auth', label: 'apiClient.tab.auth' },
  { id: 'headers', label: 'apiClient.tab.headers' },
  { id: 'body', label: 'apiClient.tab.body' },
  { id: 'tests', label: 'apiClient.tab.tests' },
  { id: 'settings', label: 'apiClient.tab.settings' }
]

const RESPONSE_TYPE_LABEL: Record<(typeof RESPONSE_TYPES)[number], MessageKey | string> = {
  auto: 'apiClient.responseType.auto',
  json: 'JSON',
  xml: 'XML',
  html: 'HTML',
  text: 'apiClient.responseType.text',
  binary: 'apiClient.responseType.binary'
}

const selectClass = 'rounded border border-border bg-surface px-1.5 py-0.5 text-[12.5px] outline-none focus:border-accent'
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CURL_RE = /^\s*curl(\.exe)?\s/i

function InvalidRequest({ error, onEdit }: { error: RequestParseError; onEdit: () => void }) {
  const t = useT()
  const detail =
    error.code === 'json'
      ? t('apiClient.invalid.json', { detail: error.detail })
      : error.code === 'newerVersion'
        ? t('apiClient.invalid.newerVersion', { version: error.version })
        : error.code === 'invalid'
          ? t('apiClient.invalid.field', { detail: error.detail || '$' })
          : error.code === 'tooLarge'
            ? t('apiClient.invalid.tooLarge')
            : t('apiClient.invalid.notRequest')
  return (
    <div className="grid h-full place-items-center bg-surface p-6" data-testid="api-invalid">
      <div className="max-w-lg rounded-md border border-amber-300 bg-amber-50 p-4 text-zinc-800">
        <p className="mb-1 flex items-center gap-2 font-semibold">
          <TriangleAlert size={16} className="text-amber-600" /> {t('apiClient.invalid')}
        </p>
        <p className="mb-3 select-text break-words">{detail}</p>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-1.5 hover:bg-zinc-100"
        >
          <Pencil size={14} /> {t('toolbar.editText')}
        </button>
      </div>
    </div>
  )
}

/**
 * Campo da URL com as {{variáveis}} destacadas: o texto real fica num input transparente sobre uma camada
 * que desenha o mesmo texto colorido (em vermelho, as variáveis que faltaram no último envio).
 */
function UrlField({ value, missing, onChange, onPasteCurl, label, placeholder }: { value: string; missing: string[]; onChange: (v: string) => void; onPasteCurl: (text: string) => void; label: string; placeholder: string }) {
  const backdrop = useRef<HTMLDivElement>(null)
  const parts = useMemo(() => {
    const out: { text: string; variable?: string }[] = []
    let at = 0
    for (const tok of findVariables(value)) {
      if (tok.start > at) out.push({ text: value.slice(at, tok.start) })
      out.push({ text: value.slice(tok.start, tok.end), variable: tok.name })
      at = tok.end
    }
    if (at < value.length) out.push({ text: value.slice(at) })
    return out
  }, [value])
  const sync = (el: HTMLInputElement): void => {
    if (backdrop.current) backdrop.current.scrollLeft = el.scrollLeft
  }
  return (
    <div className="relative min-w-0 flex-1 rounded border border-border bg-surface focus-within:border-accent">
      <div ref={backdrop} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-2 py-1 font-mono text-[12.5px]" data-testid="api-url-highlight">
        {parts.map((p, i) =>
          p.variable ? (
            <span key={i} className={`rounded-sm ${missing.includes(p.variable) ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-600'}`}>
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </div>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          sync(e.target)
        }}
        onScroll={(e) => sync(e.currentTarget)}
        onKeyUp={(e) => sync(e.currentTarget)}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (CURL_RE.test(text)) {
            e.preventDefault()
            onPasteCurl(text)
          }
        }}
        maxLength={API_LIMITS.urlChars}
        placeholder={placeholder}
        aria-label={label}
        spellCheck={false}
        className="relative w-full min-w-0 bg-transparent px-2 py-1 font-mono text-[12.5px] text-transparent caret-zinc-900 outline-none selection:bg-blue-200 selection:text-transparent placeholder:font-sans placeholder:text-zinc-400"
      />
    </div>
  )
}

/**
 * Construtor de requisições: a "visualização" de um documento .apireq. Cada alteração regrava o JSON do
 * documento (o mesmo texto que "Editar texto" mostra), então salvar, desfazer pelo texto, sessão e
 * nuvem funcionam como em qualquer arquivo. A última resposta fica só na memória (responses.ts).
 */
export function ApiRequestView({ doc }: { doc: EditorDocument }) {
  const t = useT()
  const updateContent = useDocuments((s) => s.updateContent)
  const setMode = useDocuments((s) => s.setMode)
  const [tab, setTab] = useState<RequestTab>('params')
  const [confirmProd, setConfirmProd] = useState<{ saveToFile: boolean; env: string } | null>(null)
  const [confirmSecret, setConfirmSecret] = useState<{ saveToFile: boolean; productionConfirmed: boolean; host: string } | null>(null)
  const [pendingCurl, setPendingCurl] = useState<string | null>(null)
  const [codeOpen, setCodeOpen] = useState(false)
  const { runId, result } = useDocResponse(doc.id)
  const parsed = useMemo(() => parseApiRequest(doc.content), [doc.content])

  if (!parsed.ok) return <InvalidRequest error={parsed.error} onEdit={() => setMode(doc.id, 'edit')} />
  const request = parsed.request

  const write = (next: ApiRequest): void => {
    const text = applyEol(serializeApiRequest(next), doc.eol)
    if (text !== doc.content) updateContent(doc.id, text)
  }
  const update = (patch: Partial<ApiRequest>): void => write({ ...request, ...patch })

  const missing = result ? (result.ok ? result.missingVariables : (result.missingVariables ?? [])) : []

  const cancel = (): void => {
    if (runId) void window.api.apiCancel(runId)
  }

  const send = async (opts: { saveToFile?: boolean; productionConfirmed?: boolean; confirmSecretHost?: string } = {}): Promise<void> => {
    if (useResponses.getState().byDoc[doc.id]?.runId) return
    const id = crypto.randomUUID()
    const store = useResponses.getState()
    store.start(doc.id, id)
    let outcome: ApiSendResult
    let envName: string | null = null
    try {
      const ctx = await getSendContext(doc)
      envName = ctx.environment?.name ?? null
      if (ctx.environment?.production && WRITE_METHODS.has(request.method) && !opts.productionConfirmed) {
        // Produção com método que altera dados: pergunta antes de enviar.
        useResponses.getState().abort(doc.id, id)
        setConfirmProd({ saveToFile: !!opts.saveToFile, env: ctx.environment.name })
        return
      }
      outcome = await window.api.apiSend({
        runId: id,
        request: effectiveRequest(request),
        environment: ctx.environment,
        collection: ctx.collection,
        documentPath: doc.path,
        saveToFile: !!opts.saveToFile,
        productionConfirmed: !!opts.productionConfirmed,
        ...(opts.confirmSecretHost ? { confirmSecretHost: opts.confirmSecretHost } : {})
      })
    } catch {
      outcome = { ok: false, runId: id, code: 'unknown' }
    }
    if (!outcome.ok && outcome.code === 'productionNotConfirmed') {
      useResponses.getState().abort(doc.id, id)
      setConfirmProd({ saveToFile: !!opts.saveToFile, env: envName ?? '' })
      return
    }
    if (!outcome.ok && outcome.code === 'secretHostNotConfirmed' && outcome.host) {
      useResponses.getState().abort(doc.id, id)
      setConfirmSecret({ saveToFile: !!opts.saveToFile, productionConfirmed: !!opts.productionConfirmed, host: outcome.host })
      return
    }
    if (outcome.ok) {
      const values = outcome.extracted.filter((x) => x.ok && !x.secret && x.value !== undefined).map((x) => ({ key: x.to, value: x.value! }))
      if (values.length > 0) applyExtractedVariables(values)
    }
    useResponses.getState().finish(doc.id, id, outcome, envName)
    // O histórico da barra lateral relê a lista depois de cada envio.
    useApiStore.getState().bumpHistory()
  }

  const importCurl = async (text: string): Promise<void> => {
    try {
      const r = await window.api.apiImportParse({ text, format: 'curl' })
      const first = r.ok ? r.items[0] : undefined
      if (!first) return useNotice.getState().show(t('apiClient.curl.failed'))
      write({ ...first.request, id: request.id, name: request.name })
    } catch {
      useNotice.getState().show(t('apiClient.curl.failed'))
    }
  }

  const onUrl = (url: string): void => update({ url, params: withPathParams(url, paramsFromUrl(url, request.params)) })
  const onQuery = (rows: KeyValue[]): void => {
    const params = [...request.params.filter(isPathParam), ...rows]
    update({ params, url: urlFromParams(request.url, params) })
  }
  const queryRows = request.params.filter((r) => !isPathParam(r))
  const pathRows = request.params.filter(isPathParam)

  const activeRows = (rows: { key: string; enabled: boolean }[]): number => rows.filter((r) => r.enabled && r.key !== '').length
  const counts: Partial<Record<RequestTab, number>> = {
    params: activeRows(queryRows),
    headers: activeRows(request.headers),
    tests: request.tests.filter((a) => a.enabled).length + request.extract.filter((x) => x.enabled).length
  }
  const methods: string[] = HTTP_METHODS.includes(request.method as (typeof HTTP_METHODS)[number]) ? [...HTTP_METHODS] : [...HTTP_METHODS, request.method]

  return (
    <div
      className="flex h-full flex-col bg-surface"
      data-testid="api-request"
      onKeyDownCapture={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          e.stopPropagation()
          void send()
        } else if (e.key === 'Escape' && runId) {
          e.preventDefault()
          cancel()
        }
      }}
    >
      {/* Barra da requisição: método, URL, ambiente e enviar. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <select
          value={request.method}
          onChange={(e) => update({ method: e.target.value })}
          aria-label={t('apiClient.method')}
          className={`w-28 rounded border border-border bg-surface px-2 py-1 font-bold outline-none focus:border-accent ${METHOD_CLASS[request.method] ?? 'text-zinc-700'}`}
        >
          {methods.map((m) => (
            <option key={m} value={m} className={METHOD_CLASS[m] ?? ''}>
              {m}
            </option>
          ))}
        </select>
        <UrlField value={request.url} missing={missing} onChange={onUrl} onPasteCurl={setPendingCurl} label={t('apiClient.url')} placeholder={t('apiClient.urlPlaceholder')} />
        <EnvironmentSelect doc={doc} />
        <button type="button" onClick={() => setCodeOpen(true)} title={t('apiClient.code')} className="flex items-center gap-1.5 rounded border border-border px-2 py-1 hover:bg-zinc-100">
          <Code2 size={14} />
          {t('apiClient.code')}
        </button>
        <span className="flex">
          <button
            type="button"
            disabled={!!runId}
            onClick={() => void send()}
            title={t('apiClient.sendHint')}
            data-testid="api-send"
            className="flex items-center gap-1.5 rounded-l bg-accent px-3 py-1 font-medium text-white disabled:opacity-50"
          >
            <Send size={14} />
            {t('apiClient.send')}
          </button>
          <Dropdown.Root>
            <Dropdown.Trigger disabled={!!runId} aria-label={t('apiClient.sendMore')} className="rounded-r border-l border-white/30 bg-accent px-1.5 text-white disabled:opacity-50">
              <ChevronDown size={14} />
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" className="z-50 min-w-48 rounded-md border border-border bg-surface p-1 text-[12.5px] shadow-lg">
                <Dropdown.Item onSelect={() => void send({ saveToFile: true })} className="cursor-default rounded px-2 py-1.5 outline-none data-[highlighted]:bg-zinc-100">
                  {t('apiClient.sendDownload')}
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        </span>
      </div>

      <Group orientation="vertical" className="min-h-0 flex-1">
        <Panel id="api-request-panel" defaultSize="55%" minSize={120}>
          <div className="flex h-full flex-col">
            <div className="flex h-8 shrink-0 items-center gap-4 border-b border-border px-3 text-[12.5px]">
              <div role="tablist" aria-label={t('apiClient.tabs')} className="flex h-full items-center gap-4">
                {TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={`flex h-full items-center gap-1 border-b-2 ${tab === id ? 'border-accent font-semibold text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}
                  >
                    {t(label)}
                    {!!counts[id] && <span className="rounded-full bg-zinc-200 px-1.5 text-[10.5px] text-zinc-600">{counts[id]}</span>}
                  </button>
                ))}
              </div>
              <label className="ml-auto flex items-center gap-2 text-zinc-500">
                {t('apiClient.responseType')}
                <select value={request.responseType} onChange={(e) => update({ responseType: e.target.value as ApiRequest['responseType'] })} className={selectClass}>
                  {RESPONSE_TYPES.map((r) => {
                    const label = RESPONSE_TYPE_LABEL[r]
                    return (
                      <option key={r} value={r}>
                        {label.startsWith('apiClient.') ? t(label as MessageKey) : label}
                      </option>
                    )
                  })}
                </select>
              </label>
            </div>
            <div role="tabpanel" className="min-h-0 flex-1 overflow-auto px-3 py-2">
              {tab === 'params' && (
                <>
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.params.title')}</h3>
                  <KeyValueTable label={t('apiClient.params.title')} rows={queryRows} onChange={onQuery} />
                  {pathRows.length > 0 && (
                    <>
                      <h3 className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.params.path')}</h3>
                      <table aria-label={t('apiClient.params.path')} data-testid="api-path-params" className="w-full table-fixed border-collapse">
                        <tbody>
                          {pathRows.map((row) => (
                            <tr key={row.key}>
                              <td className="w-1/4 border-b border-border px-2 py-1 font-mono text-[12px] font-semibold">{row.key.slice(1)}</td>
                              <td className="border-b border-l border-border p-0">
                                <input
                                  value={row.value}
                                  maxLength={API_LIMITS.valueChars}
                                  aria-label={`${t('apiClient.params.path')} ${row.key.slice(1)}`}
                                  spellCheck={false}
                                  onChange={(e) => update({ params: request.params.map((r) => (r.key === row.key ? { ...r, value: e.target.value } : r)) })}
                                  className="w-full min-w-0 bg-transparent px-2 py-1 font-mono text-[12px] outline-none focus:bg-blue-50"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </>
              )}
              {tab === 'headers' && (
                <>
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.headers.title')}</h3>
                  <KeyValueTable label={t('apiClient.headers.title')} rows={request.headers} onChange={(headers) => update({ headers })} />
                </>
              )}
              {tab === 'auth' && <AuthEditor auth={request.auth} onChange={(auth) => update({ auth })} docId={doc.id} />}
              {tab === 'body' && (
                <>
                  <BodyEditor body={request.body} onChange={(body) => update({ body })} doc={doc} />
                  {request.examples.length > 0 && (
                    <label className="mt-3 flex items-center gap-2 text-[12.5px] text-zinc-600" data-testid="api-examples">
                      {t('apiClient.response.examples', { count: request.examples.length })}
                      <select
                        value=""
                        aria-label={t('apiClient.response.openExample')}
                        onChange={(e) => e.target.value && void openExample(doc, e.target.value, t)}
                        className={selectClass}
                      >
                        <option value="">{t('apiClient.response.openExample')}</option>
                        {request.examples.map((x) => (
                          <option key={x} value={x}>
                            {x.split('/').pop()}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
              {tab === 'settings' && <SettingsEditor settings={request.settings} onChange={(settings) => update({ settings })} />}
              {tab === 'tests' && <TestsEditor tests={request.tests} extract={request.extract} onChange={(patch) => update(patch)} />}
            </div>
          </div>
        </Panel>
        <Separator className="h-px bg-border transition-colors data-[separator]:hover:bg-accent" />
        <Panel id="api-response-panel" minSize={80}>
          <ResponsePanel docId={doc.id} requestId={request.id} assertions={request.tests} forcedType={request.responseType} onCancel={cancel} onSaveExample={(res) => void saveResponseExample(doc, request, res, t, write)} />
        </Panel>
      </Group>

      <CodegenDialog open={codeOpen} onClose={() => setCodeOpen(false)} request={request} />

      {confirmProd && (
        <Modal title={t('apiClient.production.title')} description={t('apiClient.production.body', { env: confirmProd.env, method: request.method })} onClose={() => setConfirmProd(null)} size="sm">
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={() => setConfirmProd(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              data-testid="api-production-confirm"
              onClick={() => {
                const c = confirmProd
                setConfirmProd(null)
                void send({ saveToFile: c.saveToFile, productionConfirmed: true })
              }}
            >
              {t('apiClient.production.confirm')}
            </button>
          </div>
        </Modal>
      )}

      {confirmSecret && (
        <Modal title={t('apiClient.secretHost.title', { host: confirmSecret.host })} description={t('apiClient.secretHost.body', { host: confirmSecret.host })} onClose={() => setConfirmSecret(null)} size="sm">
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={() => setConfirmSecret(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              data-testid="api-secret-host-confirm"
              onClick={() => {
                const c = confirmSecret
                setConfirmSecret(null)
                void send({ saveToFile: c.saveToFile, productionConfirmed: c.productionConfirmed, confirmSecretHost: c.host })
              }}
            >
              {t('apiClient.secretHost.confirm')}
            </button>
          </div>
        </Modal>
      )}

      {pendingCurl !== null && (
        <Modal title={t('apiClient.curl.title')} description={t('apiClient.curl.body')} onClose={() => setPendingCurl(null)} size="sm">
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={() => setPendingCurl(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                const text = pendingCurl
                setPendingCurl(null)
                void importCurl(text)
              }}
            >
              {t('apiClient.curl.import')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
