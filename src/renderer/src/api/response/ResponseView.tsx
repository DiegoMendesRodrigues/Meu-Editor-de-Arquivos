// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useMemo, useState } from 'react'
import { CheckCircle2, Copy, ExternalLink, Save, ShieldAlert, TriangleAlert, XCircle } from 'lucide-react'
import type { Assertion } from '@shared/api/schema'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'
import { useDocuments } from '@/store/documents'
import { useNotice } from '@/store/notice'
import { assertionSummary } from '../TestsEditor'
import { bodyKind, bodyText, formatBytes, formatMs, statusClass, toSavedResponse, type ViewResponse } from './model'
import { ResponseBody } from './ResponseBody'

type Tab = 'body' | 'headers' | 'cookies' | 'tests' | 'timings'

const th = 'border-b border-border px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500'
const td = 'select-text break-all border-b border-border px-2 py-1 align-top font-mono text-[12px]'

function HeadersTab({ res }: { res: ViewResponse }) {
  const t = useT()
  const [q, setQ] = useState('')
  const rows = res.headers.filter((h) => `${h.key} ${h.value}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="p-3">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('apiClient.response.headers.search')} aria-label={t('apiClient.response.headers.search')} className="mb-2 w-64 rounded border border-border bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-accent" />
      <table aria-label={t('apiClient.response.tab.headers')} className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th className={`${th} w-1/3`}>{t('apiClient.kv.key')}</th>
            <th className={th}>{t('apiClient.kv.value')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h, i) => (
            <tr key={i}>
              <td className={`${td} font-semibold`}>{h.key}</td>
              <td className={td}>{h.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CookiesTab({ res }: { res: ViewResponse }) {
  const t = useT()
  if (res.cookies.length === 0) return <p className="p-4 text-zinc-500">{t('apiClient.response.noCookies')}</p>
  return (
    <div className="p-3">
      <table aria-label={t('apiClient.response.tab.cookies')} className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {(['name', 'value', 'domain', 'path', 'expires', 'flags'] as const).map((c) => (
              <th key={c} className={th}>
                {t(`apiClient.response.cookie.${c}` as MessageKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {res.cookies.map((c, i) => (
            <tr key={i}>
              <td className={td}>{c.name}</td>
              <td className={td}>{c.value}</td>
              <td className={td}>{c.domain ?? ''}</td>
              <td className={td}>{c.path ?? ''}</td>
              <td className={td}>{c.expires ?? ''}</td>
              <td className={td}>{[c.httpOnly && 'HttpOnly', c.secure && 'Secure', c.sameSite && `SameSite=${c.sameSite}`].filter(Boolean).join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TestsTab({ res, assertions }: { res: ViewResponse; assertions: Assertion[] }) {
  const t = useT()
  const results = res.tests ?? []
  if (results.length === 0) return <p className="p-4 text-zinc-500">{t('apiClient.response.noTests')}</p>
  return (
    <ul className="p-3" data-testid="api-test-results">
      {results.map((r) => {
        const a = assertions[r.index]
        const ignored = a && !a.enabled
        return (
          <li key={r.index} className={`flex items-start gap-2 border-b border-border py-1.5 ${ignored ? 'text-zinc-400' : ''}`} data-passed={ignored ? 'skipped' : String(r.passed)}>
            {ignored ? (
              <span className="mt-0.5 size-3.5 shrink-0 rounded-full border border-zinc-400" />
            ) : r.passed ? (
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-700" />
            ) : (
              <XCircle size={15} className="mt-0.5 shrink-0 text-red-600" />
            )}
            <div className="min-w-0 flex-1">
              <p className="select-text break-words">{a ? assertionSummary(a, t) : `#${r.index + 1}`}</p>
              {ignored && <p className="text-xs">{t('apiClient.response.testSkipped')}</p>}
              {!ignored && r.error && <p className="text-xs text-amber-700">{t(`apiClient.assert.error.${r.error}` as MessageKey)}</p>}
              {!ignored && !r.passed && r.actual !== undefined && (
                <p className="select-text break-all font-mono text-xs text-zinc-600">{t('apiClient.response.received', { value: r.actual })}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function TimingsTab({ res }: { res: ViewResponse }) {
  const t = useT()
  const tm = res.timings
  const parts = [
    ['dns', tm.dns],
    ['tcp', tm.tcp],
    ['tls', tm.tls],
    ['firstByte', tm.firstByte],
    ['download', tm.download]
  ] as const
  const max = Math.max(1, ...parts.map(([, v]) => v))
  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="max-w-xl">
        {parts.map(([k, v]) => (
          <div key={k} className="mb-1 grid grid-cols-[110px_1fr_70px] items-center gap-2 text-[12.5px]">
            <span className="text-zinc-600">{t(`apiClient.response.timing.${k}` as MessageKey)}</span>
            <div className="h-2.5 rounded bg-zinc-100">
              <div className="h-full rounded bg-accent" style={{ width: `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%` }} />
            </div>
            <span className="text-right tabular-nums">{formatMs(v)}</span>
          </div>
        ))}
        <p className="mt-1 text-[12.5px] font-semibold">
          {t('apiClient.response.timing.total')}: {formatMs(tm.total)}
        </p>
      </div>
      {res.tls && (
        <div>
          <h3 className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {t('apiClient.response.tls')}
            {!res.tls.authorized && <ShieldAlert size={13} className="text-amber-700" />}
          </h3>
          <dl className="grid max-w-xl grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[12.5px]">
            <dt className="text-zinc-600">{t('apiClient.response.tls.protocol')}</dt>
            <dd className="select-text">{res.tls.protocol}</dd>
            <dt className="text-zinc-600">{t('apiClient.response.tls.issuer')}</dt>
            <dd className="select-text break-all">{res.tls.issuer}</dd>
            <dt className="text-zinc-600">{t('apiClient.response.tls.subject')}</dt>
            <dd className="select-text break-all">{res.tls.subject}</dd>
            <dt className="text-zinc-600">{t('apiClient.response.tls.validity')}</dt>
            <dd className="select-text">{res.tls.validFrom ? `${res.tls.validFrom} → ` : ''}{res.tls.validTo}</dd>
            <dt className="text-zinc-600">{t('apiClient.response.tls.trusted')}</dt>
            <dd className={res.tls.authorized ? 'text-emerald-700' : 'text-amber-700'}>
              {res.tls.authorized ? t('apiClient.response.tls.valid') : t('apiClient.response.tls.invalid')}
              {res.tls.authorizationError ? ` (${res.tls.authorizationError})` : ''}
            </dd>
          </dl>
        </div>
      )}
      {res.redirects.length > 0 && (
        <div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.response.redirects')}</h3>
          <ul className="text-[12.5px]">
            {res.redirects.map((r, i) => (
              <li key={i} className="select-text break-all font-mono">
                {r.status} → {r.url}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * Painel de uma resposta (a recém-chegada ou a de um .apiresp): cabeçalho com status, tempo e tamanho,
 * botões e as abas Corpo, Cabeçalhos, Cookies, Testes e Tempos.
 */
export function ResponseView({
  res,
  requestId,
  assertions = [],
  forcedType,
  saved = false
}: {
  res: ViewResponse
  requestId: string
  assertions?: Assertion[]
  forcedType?: string
  /** Veio de um .apiresp: sem os botões de salvar e sem a aba de testes. */
  saved?: boolean
}) {
  const t = useT()
  const [tab, setTab] = useState<Tab>('body')
  const kind = bodyKind(res.body, forcedType)
  const text = useMemo(() => (kind === 'image' || kind === 'binary' ? '' : bodyText(res.body)), [res.body, kind])
  const results = res.tests ?? []
  const active = results.filter((r) => !(assertions[r.index] && !assertions[r.index]!.enabled))
  const failed = active.filter((r) => !r.passed).length
  const showTests = !saved
  const tab2: Tab = !showTests && tab === 'tests' ? 'body' : tab

  const saveResponse = (): void => {
    const saved = toSavedResponse(res, requestId)
    if (!saved) {
      useNotice.getState().show(t('apiClient.response.saveFailed'))
      return
    }
    useDocuments.getState().newDocumentFrom(`${t('apiClient.response.fileName', { status: res.status })}.apiresp`, `${JSON.stringify(saved, null, 2)}\n`)
  }
  const openBody = (): void => {
    const ext = kind === 'json' ? 'json' : kind === 'xml' ? 'xml' : kind === 'html' ? 'html' : 'txt'
    useDocuments.getState().newDocumentFrom(`${t('apiClient.response.bodyFileName')}.${ext}`, text)
  }
  const textual = kind !== 'image' && kind !== 'binary' && !res.body.file && !res.body.savedTo

  const tabs: { id: Tab; label: string; badge?: React.ReactNode }[] = [
    { id: 'body', label: t('apiClient.response.tab.body') },
    { id: 'headers', label: t('apiClient.response.tab.headers'), badge: res.headers.length },
    { id: 'cookies', label: t('apiClient.response.tab.cookies'), badge: res.cookies.length || undefined },
    ...(showTests ? [{ id: 'tests' as Tab, label: t('apiClient.response.tab.tests'), badge: active.length ? `${active.length - failed}/${active.length}` : undefined }] : []),
    { id: 'timings', label: t('apiClient.response.tab.timings') }
  ]

  return (
    <div className="flex h-full flex-col" data-testid="api-response-ok">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-chrome px-3 py-1 text-xs">
        <span className="font-semibold uppercase tracking-wide text-zinc-600">{t('apiClient.response')}</span>
        <span className={`font-bold ${statusClass(res.status)}`} data-testid="api-status">
          {res.status} {res.statusText}
        </span>
        <span data-testid="api-time" title={`${res.httpVersion}`}>
          {formatMs(res.timings.total)}
        </span>
        <span
          data-testid="api-size"
          title={`${t('apiClient.response.sizeHeaders')}: ${formatBytes(res.size.headers)}${res.size.compressed !== undefined ? ` · ${t('apiClient.response.sizeCompressed')}: ${formatBytes(res.size.compressed)}` : ''}`}
        >
          {formatBytes(res.size.body)}
        </span>
        {res.sentAt && saved && <span className="text-zinc-500">{res.sentAt}</span>}
        <span className="ml-auto flex items-center gap-1">
          <button type="button" disabled={!textual} onClick={() => void navigator.clipboard.writeText(text)} title={t('apiClient.response.copyBody')} aria-label={t('apiClient.response.copyBody')} className="rounded p-1 hover:bg-zinc-200 disabled:opacity-40">
            <Copy size={14} />
          </button>
          {!saved && (
            <button type="button" onClick={saveResponse} title={t('apiClient.response.saveResponse')} aria-label={t('apiClient.response.saveResponse')} className="rounded p-1 hover:bg-zinc-200">
              <Save size={14} />
            </button>
          )}
          <button type="button" disabled={!textual} onClick={openBody} title={t('apiClient.response.openBody')} aria-label={t('apiClient.response.openBody')} className="rounded p-1 hover:bg-zinc-200 disabled:opacity-40">
            <ExternalLink size={14} />
          </button>
        </span>
      </div>
      {res.body.truncated && (
        <p role="status" className="flex shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700">
          <TriangleAlert size={13} /> {t('apiClient.response.truncated')}
        </p>
      )}
      {res.missingVariables.length > 0 && (
        <p role="status" className="flex shrink-0 items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700" data-testid="api-missing-vars">
          <TriangleAlert size={13} /> {t('apiClient.response.missingVars', { names: res.missingVariables.map((n) => `{{${n}}}`).join(', ') })}
        </p>
      )}
      <div role="tablist" aria-label={t('apiClient.response')} className="flex h-8 shrink-0 items-center gap-4 border-b border-border px-3 text-[12.5px]">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab2 === x.id}
            onClick={() => setTab(x.id)}
            className={`flex h-full items-center gap-1 border-b-2 ${tab2 === x.id ? 'border-accent font-semibold text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800'} ${x.id === 'tests' && failed > 0 ? 'text-red-600' : ''}`}
          >
            {x.label}
            {x.badge !== undefined && <span className="rounded-full bg-zinc-200 px-1.5 text-[10.5px] text-zinc-600">{x.badge}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-h-0 flex-1 overflow-auto">
        {tab2 === 'body' && <ResponseBody res={res} forcedType={forcedType} />}
        {tab2 === 'headers' && <HeadersTab res={res} />}
        {tab2 === 'cookies' && <CookiesTab res={res} />}
        {tab2 === 'tests' && <TestsTab res={res} assertions={assertions} />}
        {tab2 === 'timings' && <TimingsTab res={res} />}
      </div>
    </div>
  )
}
