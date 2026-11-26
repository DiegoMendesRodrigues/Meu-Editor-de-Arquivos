// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Relatório do executor de coleção (.apirun): formato do arquivo (Zod), resumo e exportação em
 * JUnit XML, HTML (autocontido, sem scripts) e Markdown. O relatório nunca leva valores de segredos:
 * as URLs já chegam mascaradas do Main.
 */
import { z } from 'zod'
import { API_LIMITS as L } from './limits'
import { API_ERROR_CODES, type ApiRunItemResult } from './protocol'

export const RUN_SCHEMA_ID = 'meu-editor/api-run@1'
/** Itens guardados num relatório (iterações x requisições; o executor aceita até 1000 x 1000). */
export const RUN_MAX_ITEMS = 100_000

const testResultSchema = z.object({
  name: z.string().max(L.valueChars),
  passed: z.boolean(),
  actual: z.string().max(L.valueChars).optional(),
  error: z.string().max(256).optional()
})

export const runItemSchema = z.object({
  iteration: z.number().int().min(1),
  path: z.string().max(4096),
  folder: z.string().max(4096),
  name: z.string().max(L.nameChars),
  method: z.string().max(64),
  url: z.string().max(L.urlChars),
  status: z.number().int().optional(),
  timeMs: z.number().min(0).optional(),
  errorCode: z.enum(API_ERROR_CODES).optional(),
  tests: z.array(testResultSchema).max(L.assertions).default([])
})
export type ApiRunReportItem = z.infer<typeof runItemSchema>

export const runSummarySchema = z.object({
  total: z.number().int().min(0),
  passed: z.number().int().min(0),
  failed: z.number().int().min(0),
  avgMs: z.number().min(0),
  p95Ms: z.number().min(0)
})
export type ApiRunSummary = z.infer<typeof runSummarySchema>

export const RUN_STATUSES = ['running', 'finished', 'cancelled', 'stopped'] as const

export const apiRunReportSchema = z.object({
  $schema: z.literal(RUN_SCHEMA_ID),
  name: z.string().max(L.nameChars).default(''),
  /** ISO 8601. */
  startedAt: z.string().max(40),
  finishedAt: z.string().max(40).nullable().default(null),
  /** Nome do ambiente usado (ou nulo). */
  environment: z.string().max(L.nameChars).nullable().default(null),
  options: z
    .object({
      iterations: z.number().int().min(1).default(1),
      delayMs: z.number().int().min(0).default(0),
      stopOnFailure: z.boolean().default(false),
      dataRows: z.number().int().min(0).default(0),
      /** Quantidade de requisições escolhidas (por iteração). */
      requests: z.number().int().min(0).default(0)
    })
    .prefault({}),
  /** Total de execuções previstas (iterações x requisições), para a barra de andamento. */
  expected: z.number().int().min(0).default(0),
  /** Id da execução em andamento (some quando termina). */
  runId: z.string().max(64).nullable().default(null),
  status: z.enum(RUN_STATUSES).default('finished'),
  items: z.array(runItemSchema).max(RUN_MAX_ITEMS).default([]),
  summary: runSummarySchema.default({ total: 0, passed: 0, failed: 0, avgMs: 0, p95Ms: 0 })
})
export type ApiRunReport = z.infer<typeof apiRunReportSchema>

/** Uma execução falhou: erro de rede ou algum teste reprovado. */
export const isItemFailed = (item: Pick<ApiRunItemResult, 'errorCode' | 'tests'>): boolean =>
  !!item.errorCode || item.tests.some((t) => !t.passed)

/** Resumo: total, aprovadas, falhas, tempo médio e p95 (posto mais próximo) dos tempos medidos. */
export function summarizeItems(items: readonly Pick<ApiRunItemResult, 'errorCode' | 'tests' | 'timeMs'>[]): ApiRunSummary {
  const failed = items.filter(isItemFailed).length
  const times = items.map((i) => i.timeMs).filter((n): n is number => typeof n === 'number').sort((a, b) => a - b)
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0
  const p95 = times.length ? times[Math.max(0, Math.ceil(times.length * 0.95) - 1)] : 0
  return { total: items.length, passed: items.length - failed, failed, avgMs: Math.round(avg), p95Ms: Math.round(p95) }
}

export function newRunReport(init: {
  name: string
  startedAt: string
  environment: string | null
  runId: string | null
  expected: number
  options: Partial<ApiRunReport['options']>
}): ApiRunReport {
  return apiRunReportSchema.parse({
    $schema: RUN_SCHEMA_ID,
    name: init.name,
    startedAt: init.startedAt,
    environment: init.environment,
    options: init.options,
    expected: init.expected,
    runId: init.runId,
    status: 'running'
  })
}

/** Acrescenta itens e recalcula o resumo. */
export function withItems(report: ApiRunReport, items: ApiRunItemResult[]): ApiRunReport {
  const all = [...report.items, ...items].slice(0, RUN_MAX_ITEMS)
  return { ...report, items: all, summary: summarizeItems(all) }
}

/* ------------------------------------------------------------------ arquivo .apirun */

export type RunParseResult = { ok: true; report: ApiRunReport } | { ok: false; error: 'invalidJson' | 'invalidFormat' }

export function parseApiRun(text: string): RunParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'invalidJson' }
  }
  const parsed = apiRunReportSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: 'invalidFormat' }
  // O resumo sempre vem dos itens, para nunca ficar fora de sincronia.
  return { ok: true, report: { ...parsed.data, summary: summarizeItems(parsed.data.items) } }
}

export function serializeApiRun(report: ApiRunReport): string {
  return `${JSON.stringify(apiRunReportSchema.parse({ ...report, summary: summarizeItems(report.items) }), null, 2)}\n`
}

/* ------------------------------------------------------------------ exportação */

/** Rótulos do HTML e do Markdown (o Renderer passa o texto no idioma do app). */
export interface ReportLabels {
  title: string
  startedAt: string
  finishedAt: string
  environment: string
  total: string
  passed: string
  failed: string
  avgTime: string
  p95Time: string
  iteration: string
  request: string
  method: string
  url: string
  status: string
  time: string
  result: string
  tests: string
  ok: string
  fail: string
  error: string
  none: string
}

export const DEFAULT_REPORT_LABELS: ReportLabels = {
  title: 'Relatório de execução',
  startedAt: 'Início',
  finishedAt: 'Fim',
  environment: 'Ambiente',
  total: 'Total',
  passed: 'Aprovadas',
  failed: 'Falhas',
  avgTime: 'Tempo médio',
  p95Time: 'p95',
  iteration: 'Iteração',
  request: 'Requisição',
  method: 'Método',
  url: 'URL',
  status: 'Status',
  time: 'Tempo (ms)',
  result: 'Resultado',
  tests: 'Testes',
  ok: 'Aprovada',
  fail: 'Falhou',
  error: 'Erro',
  none: '-'
}

/** Caracteres de controle que o XML 1.0 não aceita. */
// eslint-disable-next-line no-control-regex
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

export function escapeXml(s: string): string {
  return s
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const escapeHtml = escapeXml

const seconds = (ms: number | undefined): string => ((ms ?? 0) / 1000).toFixed(3)

function failureText(item: ApiRunReportItem): string {
  return item.tests
    .filter((t) => !t.passed)
    .map((t) => `${t.name}${t.actual !== undefined ? ` (${t.actual})` : ''}${t.error ? ` [${t.error}]` : ''}`)
    .join('\n')
}

/** JUnit XML: um testcase por requisição executada; teste reprovado vira failure e erro de rede vira error. */
export function toJUnit(report: ApiRunReport): string {
  const items = report.items
  const errors = items.filter((i) => i.errorCode).length
  const failures = items.filter((i) => !i.errorCode && i.tests.some((t) => !t.passed)).length
  const totalTime = items.reduce((a, i) => a + (i.timeMs ?? 0), 0)
  const suite = escapeXml(report.name || 'collection')
  const cases = items.map((item) => {
    const classname = item.folder || report.name || 'collection'
    const name = `[${item.iteration}] ${item.method} ${item.name}`.trim()
    let inner = ''
    if (item.errorCode) {
      inner = `\n      <error type="${escapeXml(item.errorCode)}" message="${escapeXml(item.errorCode)}">${escapeXml(`${item.method} ${item.url}`)}</error>\n    `
    } else if (item.tests.some((t) => !t.passed)) {
      const n = item.tests.filter((t) => !t.passed).length
      inner = `\n      <failure type="assertion" message="${escapeXml(`${n} / ${item.tests.length}`)}">${escapeXml(failureText(item))}</failure>\n    `
    }
    return `    <testcase classname="${escapeXml(classname)}" name="${escapeXml(name)}" time="${seconds(item.timeMs)}">${inner}</testcase>`
  })
  const counts = `tests="${items.length}" failures="${failures}" errors="${errors}"`
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="${suite}" ${counts} time="${seconds(totalTime)}">`,
    `  <testsuite name="${suite}" ${counts} skipped="0" time="${seconds(totalTime)}" timestamp="${escapeXml(report.startedAt)}">`,
    ...cases,
    '  </testsuite>',
    '</testsuites>',
    ''
  ].join('\n')
}

const itemResult = (item: ApiRunReportItem, l: ReportLabels): string =>
  item.errorCode ? `${l.error}: ${item.errorCode}` : isItemFailed(item) ? l.fail : l.ok

/** HTML autocontido: só CSS embutido, sem scripts, e CSP que bloqueia tudo o que não é estilo. */
export function toHtml(report: ApiRunReport, labels: Partial<ReportLabels> = {}): string {
  const l = { ...DEFAULT_REPORT_LABELS, ...labels }
  const s = summarizeItems(report.items)
  const e = escapeHtml
  const rows = report.items
    .map((item) => {
      const bad = isItemFailed(item)
      const tests = item.tests.length
        ? `<ul>${item.tests
            .map(
              (t) =>
                `<li class="${t.passed ? 'p' : 'f'}">${t.passed ? '&#10003;' : '&#10007;'} ${e(t.name)}${t.actual !== undefined && !t.passed ? ` <small>(${e(t.actual)})</small>` : ''}${t.error ? ` <small>[${e(t.error)}]</small>` : ''}</li>`
            )
            .join('')}</ul>`
        : e(l.none)
      return `<tr class="${bad ? 'f' : 'p'}"><td>${item.iteration}</td><td>${e(item.folder ? `${item.folder}/${item.name}` : item.name)}</td><td>${e(item.method)}</td><td class="u">${e(item.url)}</td><td>${item.status ?? e(l.none)}</td><td>${item.timeMs !== undefined ? Math.round(item.timeMs) : e(l.none)}</td><td>${e(itemResult(item, l))}</td><td>${tests}</td></tr>`
    })
    .join('\n')
  const css = [
    'body{font:14px system-ui,sans-serif;margin:24px;color:#18181b}',
    'h1{font-size:20px}dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px}dt{color:#52525b}dd{margin:0}',
    '.cards{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.card{border:1px solid #d4d4d8;border-radius:6px;padding:8px 14px}.card b{display:block;font-size:20px}',
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #d4d4d8;padding:4px 8px;text-align:left;vertical-align:top}th{background:#f4f4f5}',
    'td.u{word-break:break-all;font-family:ui-monospace,monospace;font-size:12px}ul{margin:0;padding-left:16px;list-style:none}',
    'tr.f td:nth-child(7){color:#b91c1c;font-weight:600}tr.p td:nth-child(7){color:#047857}li.f{color:#b91c1c}li.p{color:#047857}'
  ].join('\n')
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(l.title)}: ${e(report.name)}</title>
<style>
${css}
</style></head><body>
<h1>${e(l.title)}: ${e(report.name)}</h1>
<dl><dt>${e(l.startedAt)}</dt><dd>${e(report.startedAt)}</dd><dt>${e(l.finishedAt)}</dt><dd>${e(report.finishedAt ?? l.none)}</dd><dt>${e(l.environment)}</dt><dd>${e(report.environment ?? l.none)}</dd></dl>
<div class="cards"><div class="card">${e(l.total)}<b>${s.total}</b></div><div class="card">${e(l.passed)}<b>${s.passed}</b></div><div class="card">${e(l.failed)}<b>${s.failed}</b></div><div class="card">${e(l.avgTime)}<b>${s.avgMs} ms</b></div><div class="card">${e(l.p95Time)}<b>${s.p95Ms} ms</b></div></div>
<table><thead><tr><th>${e(l.iteration)}</th><th>${e(l.request)}</th><th>${e(l.method)}</th><th>${e(l.url)}</th><th>${e(l.status)}</th><th>${e(l.time)}</th><th>${e(l.result)}</th><th>${e(l.tests)}</th></tr></thead>
<tbody>
${rows}
</tbody></table>
</body></html>
`
}

const mdCell = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

export function toMarkdown(report: ApiRunReport, labels: Partial<ReportLabels> = {}): string {
  const l = { ...DEFAULT_REPORT_LABELS, ...labels }
  const s = summarizeItems(report.items)
  const out: string[] = [`# ${l.title}: ${report.name}`, '']
  out.push(`- ${l.startedAt}: ${report.startedAt}`)
  out.push(`- ${l.finishedAt}: ${report.finishedAt ?? l.none}`)
  out.push(`- ${l.environment}: ${report.environment ?? l.none}`, '')
  out.push(`| ${l.total} | ${l.passed} | ${l.failed} | ${l.avgTime} (ms) | ${l.p95Time} (ms) |`, '| ---: | ---: | ---: | ---: | ---: |')
  out.push(`| ${s.total} | ${s.passed} | ${s.failed} | ${s.avgMs} | ${s.p95Ms} |`, '')
  out.push(`| ${l.iteration} | ${l.request} | ${l.method} | ${l.url} | ${l.status} | ${l.time} | ${l.result} |`, '| ---: | --- | --- | --- | ---: | ---: | --- |')
  for (const item of report.items) {
    out.push(
      `| ${item.iteration} | ${mdCell(item.folder ? `${item.folder}/${item.name}` : item.name)} | ${mdCell(item.method)} | ${mdCell(item.url)} | ${item.status ?? l.none} | ${item.timeMs !== undefined ? Math.round(item.timeMs) : l.none} | ${mdCell(itemResult(item, l))} |`
    )
  }
  const withFailures = report.items.filter((i) => i.tests.some((t) => !t.passed))
  if (withFailures.length) {
    out.push('', `## ${l.failed}`, '')
    for (const item of withFailures) {
      out.push(`- [${item.iteration}] ${item.method} ${item.name}`)
      for (const t of item.tests.filter((x) => !x.passed)) {
        out.push(`  - ${t.name}${t.actual !== undefined ? ` (${t.actual})` : ''}${t.error ? ` [${t.error}]` : ''}`)
      }
    }
  }
  return `${out.join('\n')}\n`
}
