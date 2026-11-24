// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useMemo, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Pencil, Send, TriangleAlert } from 'lucide-react'
import {
  parseApiRequest,
  RESPONSE_TYPES,
  serializeApiRequest,
  type ApiRequest,
  type RequestParseError
} from '@shared/api/schema'
import { HTTP_METHODS, API_LIMITS } from '@shared/api/limits'
import { applyEol } from '@shared/eol'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { KeyValueTable } from './KeyValueTable'
import { AuthEditor, BodyEditor, SettingsEditor } from './RequestSections'
import { ResponsePanel } from './ResponsePanel'

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
 * Construtor de requisições: a "visualização" de um documento .apireq. Cada alteração regrava o JSON do
 * documento (o mesmo texto que "Editar texto" mostra), então salvar, desfazer pelo texto, sessão e
 * nuvem funcionam como em qualquer arquivo. O envio chega na fase 1.
 */
export function ApiRequestView({ doc }: { doc: EditorDocument }) {
  const t = useT()
  const updateContent = useDocuments((s) => s.updateContent)
  const setMode = useDocuments((s) => s.setMode)
  const [tab, setTab] = useState<RequestTab>('params')
  const parsed = useMemo(() => parseApiRequest(doc.content), [doc.content])

  if (!parsed.ok) return <InvalidRequest error={parsed.error} onEdit={() => setMode(doc.id, 'edit')} />
  const request = parsed.request

  const update = (patch: Partial<ApiRequest>): void => {
    const text = applyEol(serializeApiRequest({ ...request, ...patch }), doc.eol)
    if (text !== doc.content) updateContent(doc.id, text)
  }

  const activeRows = (rows: { key: string; enabled: boolean }[]): number => rows.filter((r) => r.enabled && r.key !== '').length
  const counts: Partial<Record<RequestTab, number>> = {
    params: activeRows(request.params),
    headers: activeRows(request.headers),
    tests: request.tests.filter((a) => a.enabled).length
  }
  const methods: string[] = HTTP_METHODS.includes(request.method as (typeof HTTP_METHODS)[number]) ? [...HTTP_METHODS] : [...HTTP_METHODS, request.method]

  return (
    <div className="flex h-full flex-col bg-surface" data-testid="api-request">
      {/* Barra da requisição: método, URL e enviar. */}
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
        <input
          value={request.url}
          onChange={(e) => update({ url: e.target.value })}
          maxLength={API_LIMITS.urlChars}
          placeholder={t('apiClient.urlPlaceholder')}
          aria-label={t('apiClient.url')}
          spellCheck={false}
          className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 font-mono text-[12.5px] outline-none placeholder:font-sans placeholder:text-zinc-400 focus:border-accent"
        />
        <button
          type="button"
          disabled
          title={t('apiClient.sendSoon')}
          className="flex items-center gap-1.5 rounded bg-accent px-3 py-1 font-medium text-white disabled:opacity-50"
        >
          <Send size={14} />
          {t('apiClient.send')}
        </button>
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
                  <KeyValueTable label={t('apiClient.params.title')} rows={request.params} onChange={(params) => update({ params })} />
                </>
              )}
              {tab === 'headers' && (
                <>
                  <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.headers.title')}</h3>
                  <KeyValueTable label={t('apiClient.headers.title')} rows={request.headers} onChange={(headers) => update({ headers })} />
                </>
              )}
              {tab === 'auth' && <AuthEditor auth={request.auth} onChange={(auth) => update({ auth })} />}
              {tab === 'body' && <BodyEditor body={request.body} onChange={(body) => update({ body })} />}
              {tab === 'settings' && <SettingsEditor settings={request.settings} onChange={(settings) => update({ settings })} />}
              {tab === 'tests' && <p className="py-4 text-zinc-500">{t('apiClient.soon')}</p>}
            </div>
          </div>
        </Panel>
        <Separator className="h-px bg-border transition-colors data-[separator]:hover:bg-accent" />
        <Panel id="api-response-panel" minSize={80}>
          <ResponsePanel />
        </Panel>
      </Group>
    </div>
  )
}
