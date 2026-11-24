// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Square } from 'lucide-react'
import {
  isItemFailed,
  parseApiRun,
  summarizeItems,
  toHtml,
  toJUnit,
  toMarkdown,
  type ApiRunReport,
  type ApiRunReportItem,
  type ReportLabels
} from '@shared/api/reports'
import { buttonClass } from '@/components/Modal'
import { useT } from '@/i18n'
import type { EditorDocument } from '@/store/documents'
import { isRunActive } from './runSession'

const PAGE = 500

type Translate = ReturnType<typeof useT>

function reportLabels(t: Translate): ReportLabels {
  return {
    title: t('apiClient.report.title'),
    startedAt: t('apiClient.report.started'),
    finishedAt: t('apiClient.report.finished'),
    environment: t('apiClient.report.environment'),
    total: t('apiClient.report.total'),
    passed: t('apiClient.report.passed'),
    failed: t('apiClient.report.failed'),
    avgTime: t('apiClient.report.avg'),
    p95Time: t('apiClient.report.p95'),
    iteration: t('apiClient.report.iteration'),
    request: t('apiClient.report.request'),
    method: t('apiClient.report.method'),
    url: t('apiClient.report.url'),
    status: t('apiClient.report.status'),
    time: t('apiClient.report.time'),
    result: t('apiClient.report.result'),
    tests: t('apiClient.report.tests'),
    ok: t('apiClient.report.ok'),
    fail: t('apiClient.report.fail'),
    error: t('apiClient.report.error'),
    none: '-'
  }
}

const safeFile = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim().slice(0, 80) || 'report'

/** Relatório do executor (.apirun): resumo, tempos e tabela por requisição, com exportação. */
export function RunReportView({ doc }: { doc: EditorDocument }) {
  const t = useT()
  const parsed = useMemo(() => parseApiRun(doc.content), [doc.content])
  const [exportError, setExportError] = useState(false)

  if (!parsed.ok) {
    return (
      <div role="alert" className="h-full overflow-auto bg-surface p-4 text-sm text-red-600">
        {t('apiClient.report.invalid')}
      </div>
    )
  }
  const report = parsed.report
  const running = report.status === 'running'
  const live = running && isRunActive(report.runId)
  const interrupted = running && !live
  const summary = summarizeItems(report.items)

  const exportAs = async (kind: 'junit' | 'html' | 'markdown'): Promise<void> => {
    setExportError(false)
    const labels = reportLabels(t)
    const base = safeFile(report.name)
    const spec = {
      junit: { ext: 'xml', text: () => toJUnit(report) },
      html: { ext: 'html', text: () => toHtml(report, labels) },
      markdown: { ext: 'md', text: () => toMarkdown(report, labels) }
    }[kind]
    try {
      await window.api.saveFileAs({ suggestedName: `${base}.${spec.ext}`, content: spec.text(), encoding: 'UTF-8' })
    } catch {
      setExportError(true)
    }
  }

  const statusText = interrupted
    ? t('apiClient.report.statusInterrupted')
    : running
      ? t('apiClient.report.running', { done: report.items.length, total: report.expected })
      : report.status === 'cancelled'
        ? t('apiClient.report.statusCancelled')
        : report.status === 'stopped'
          ? t('apiClient.report.statusStopped')
          : t('apiClient.report.statusFinished')

  return (
    <div className="h-full overflow-auto bg-surface p-4 text-sm">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold">
          {t('apiClient.report.title')}: {report.name}
        </h2>
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs">{statusText}</span>
        <div className="flex-1" />
        {live && report.runId ? (
          <button type="button" className={buttonClass} onClick={() => void window.api.apiRunCancel(report.runId as string)}>
            <Square size={14} className="mr-1 inline" aria-hidden />
            {t('apiClient.report.cancel')}
          </button>
        ) : null}
        <span className="text-xs text-zinc-500">
          <Download size={14} className="mr-1 inline" aria-hidden />
          {t('apiClient.report.export')}:
        </span>
        <button type="button" className={buttonClass} disabled={report.items.length === 0} onClick={() => void exportAs('junit')}>
          {t('apiClient.report.exportJunit')}
        </button>
        <button type="button" className={buttonClass} disabled={report.items.length === 0} onClick={() => void exportAs('html')}>
          {t('apiClient.report.exportHtml')}
        </button>
        <button type="button" className={buttonClass} disabled={report.items.length === 0} onClick={() => void exportAs('markdown')}>
          {t('apiClient.report.exportMarkdown')}
        </button>
      </div>
      {exportError ? (
        <p role="alert" className="mb-2 text-red-600">
          {t('apiClient.report.exportError')}
        </p>
      ) : null}

      {running && report.expected > 0 ? (
        <progress
          className="mb-3 h-2 w-full"
          aria-label={t('apiClient.report.running', { done: report.items.length, total: report.expected })}
          value={report.items.length}
          max={report.expected}
        />
      ) : null}

      <dl className="mb-3 grid grid-cols-[max-content_1fr] gap-x-3 text-xs">
        <dt className="text-zinc-500">{t('apiClient.report.started')}</dt>
        <dd>{new Date(report.startedAt).toLocaleString()}</dd>
        {report.finishedAt ? (
          <>
            <dt className="text-zinc-500">{t('apiClient.report.finished')}</dt>
            <dd>{new Date(report.finishedAt).toLocaleString()}</dd>
          </>
        ) : null}
        <dt className="text-zinc-500">{t('apiClient.report.environment')}</dt>
        <dd>{report.environment ?? '-'}</dd>
      </dl>

      <div className="mb-4 flex flex-wrap gap-3">
        <Card label={t('apiClient.report.total')} value={String(summary.total)} />
        <Card label={t('apiClient.report.passed')} value={String(summary.passed)} tone="text-emerald-600" />
        <Card label={t('apiClient.report.failed')} value={String(summary.failed)} tone={summary.failed > 0 ? 'text-red-600' : undefined} />
        <Card label={t('apiClient.report.avg')} value={`${summary.avgMs} ms`} />
        <Card label={t('apiClient.report.p95')} value={`${summary.p95Ms} ms`} />
      </div>

      <TimesChart items={report.items} title={t('apiClient.report.chart')} />
      <ItemsTable report={report} t={t} />
    </div>
  )
}

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded border border-border px-3 py-1.5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={`text-lg font-semibold ${tone ?? ''}`}>{value}</div>
    </div>
  )
}

/** Barras simples dos tempos das últimas execuções (verde: aprovada; vermelho: falha). */
function TimesChart({ items, title }: { items: ApiRunReportItem[]; title: string }) {
  const shown = items.slice(-200)
  const timed = shown.filter((i) => i.timeMs !== undefined)
  if (timed.length < 2) return null
  const max = Math.max(1, ...timed.map((i) => i.timeMs ?? 0))
  const w = 600
  const h = 70
  const bar = w / shown.length
  return (
    <figure className="mb-4">
      <figcaption className="mb-1 text-xs text-zinc-500">{title}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full max-w-3xl" role="img" aria-label={title} preserveAspectRatio="none">
        {shown.map((item, i) => {
          const bh = ((item.timeMs ?? 0) / max) * (h - 2)
          return (
            <rect
              key={i}
              x={i * bar}
              y={h - bh}
              width={Math.max(1, bar - 1)}
              height={bh}
              fill="currentColor"
              className={isItemFailed(item) ? 'text-red-500' : 'text-emerald-500'}
            />
          )
        })}
      </svg>
    </figure>
  )
}

function ItemsTable({ report, t }: { report: ApiRunReport; t: Translate }) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [limit, setLimit] = useState(PAGE)
  const rows = report.items.slice(0, limit)
  const toggle = (i: number): void =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(i)) next.add(i)
      return next
    })
  const errorText = (code: string): string => {
    const key = `apiClient.error.${code}` as Parameters<Translate>[0]
    const text = t(key)
    return text === key ? code : text
  }

  return (
    <>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-zinc-100 text-left">
            <th className="w-6 border border-border p-1" />
            <th className="border border-border p-1">{t('apiClient.report.iteration')}</th>
            <th className="border border-border p-1">{t('apiClient.report.request')}</th>
            <th className="border border-border p-1">{t('apiClient.report.method')}</th>
            <th className="border border-border p-1">{t('apiClient.report.status')}</th>
            <th className="border border-border p-1">{t('apiClient.report.time')}</th>
            <th className="border border-border p-1">{t('apiClient.report.result')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => {
            const failed = isItemFailed(item)
            const expanded = open.has(i)
            return (
              <Fragment key={i}>
                <tr>
                  <td className="border border-border p-1">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={expanded ? t('apiClient.report.hideTests') : t('apiClient.report.showTests')}
                      className="rounded hover:bg-zinc-200"
                      onClick={() => toggle(i)}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </td>
                  <td className="border border-border p-1">{item.iteration}</td>
                  <td className="border border-border p-1" title={item.url}>
                    {item.folder ? `${item.folder}/` : ''}
                    {item.name}
                  </td>
                  <td className="border border-border p-1 font-mono">{item.method}</td>
                  <td className="border border-border p-1">{item.status ?? '-'}</td>
                  <td className="border border-border p-1">{item.timeMs !== undefined ? Math.round(item.timeMs) : '-'}</td>
                  <td className={`border border-border p-1 font-semibold ${failed ? 'text-red-600' : 'text-emerald-600'}`}>
                    {item.errorCode ? errorText(item.errorCode) : failed ? t('apiClient.report.fail') : t('apiClient.report.ok')}
                  </td>
                </tr>
                {expanded ? (
                  <tr>
                    <td className="border border-border p-1" />
                    <td colSpan={6} className="border border-border p-2">
                      <div className="mb-1 break-all font-mono text-zinc-500">{item.url}</div>
                      {item.tests.length === 0 ? (
                        <span className="text-zinc-500">{t('apiClient.report.noTests')}</span>
                      ) : (
                        <ul>
                          {item.tests.map((test, k) => (
                            <li key={k} className={test.passed ? 'text-emerald-600' : 'text-red-600'}>
                              {test.passed ? '✓' : '✗'} {test.name}
                              {!test.passed && test.actual !== undefined ? <span className="text-zinc-500"> ({test.actual})</span> : null}
                              {test.error ? <span className="text-zinc-500"> [{test.error}]</span> : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {report.items.length > limit ? (
        <button type="button" className={`${buttonClass} mt-2`} onClick={() => setLimit(limit + PAGE)}>
          {t('apiClient.report.showMore', { n: Math.min(PAGE, report.items.length - limit) })}
        </button>
      ) : null}
    </>
  )
}
