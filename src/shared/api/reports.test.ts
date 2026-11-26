// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import type { ApiRunItemResult } from './protocol'
import { newRunReport, parseApiRun, serializeApiRun, summarizeItems, toHtml, toJUnit, toMarkdown, withItems } from './reports'

const item = (over: Partial<ApiRunItemResult> = {}): ApiRunItemResult => ({
  iteration: 1,
  path: '/c/a.apireq',
  folder: 'pasta',
  name: 'Listar',
  method: 'GET',
  url: 'http://127.0.0.1/x?a=1&b=2',
  status: 200,
  timeMs: 100,
  tests: [{ name: 'status eq 200', passed: true }],
  ...over
})

const base = () =>
  newRunReport({ name: 'Col <1> & "x"', startedAt: '2026-01-01T10:00:00.000Z', environment: 'Homolog', runId: null, expected: 3, options: { iterations: 1 } })

describe('resumo', () => {
  it('conta aprovadas e falhas e calcula média e p95', () => {
    const times = Array.from({ length: 20 }, (_, i) => item({ timeMs: (i + 1) * 10 }))
    const s = summarizeItems([
      ...times,
      item({ errorCode: 'timeout', status: undefined, timeMs: undefined, tests: [] }),
      item({ tests: [{ name: 't', passed: false }] })
    ])
    expect(s.total).toBe(22)
    expect(s.failed).toBe(2)
    expect(s.passed).toBe(20)
    expect(s.p95Ms).toBeGreaterThanOrEqual(190)
  })

  it('sem itens devolve zeros', () => {
    expect(summarizeItems([])).toEqual({ total: 0, passed: 0, failed: 0, avgMs: 0, p95Ms: 0 })
  })
})

describe('arquivo .apirun', () => {
  it('serializa e lê de volta, recalculando o resumo', () => {
    const r = withItems(base(), [item(), item({ tests: [{ name: 'x', passed: false }] })])
    const back = parseApiRun(serializeApiRun(r))
    expect(back.ok && back.report.summary).toMatchObject({ total: 2, passed: 1, failed: 1 })
    expect(back.ok && back.report.$schema).toBe('meu-editor/api-run@1')
  })

  it('recusa JSON inválido e formato desconhecido', () => {
    expect(parseApiRun('{')).toEqual({ ok: false, error: 'invalidJson' })
    expect(parseApiRun('{"$schema":"outro"}')).toEqual({ ok: false, error: 'invalidFormat' })
  })
})

describe('JUnit', () => {
  it('escapa o XML e distingue failure de error', () => {
    const r = withItems(base(), [
      item({ name: 'a<b>&"c\'', url: 'http://x/?a=1&b=2' }),
      item({ tests: [{ name: 'body contains <x>', passed: false, actual: 'a&b' }] }),
      item({ errorCode: 'ECONNREFUSED', status: undefined, timeMs: undefined, tests: [] })
    ])
    const xml = toJUnit(r)
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('tests="3" failures="1" errors="1"')
    expect(xml).toContain('name="Col &lt;1&gt; &amp; &quot;x&quot;"')
    expect(xml).toContain('a&lt;b&gt;&amp;&quot;c&apos;')
    expect(xml).toContain('body contains &lt;x&gt; (a&amp;b)')
    expect(xml).toContain('<error type="ECONNREFUSED"')
    expect(xml).not.toMatch(/<x>/)
  })

  it('remove caracteres de controle inválidos no XML', () => {
    const xml = toJUnit(withItems(base(), [item({ name: 'a\u0001b' })]))
    expect(xml).toContain('name="[1] GET ab"')
  })
})

describe('HTML e Markdown', () => {
  const r = withItems(base(), [
    item({ name: '<script>alert(1)</script>', url: 'http://x/?q="><img src=x onerror=1>' }),
    item({ tests: [{ name: '<b>x</b>', passed: false, actual: '<i>' }] })
  ])

  it('o HTML é autocontido, escapado e sem scripts', () => {
    const html = toHtml(r)
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain("default-src 'none'")
    expect(html).not.toMatch(/<(img|a|link|iframe|object)/i)
  })

  it('o Markdown escapa as barras verticais e traz o resumo', () => {
    const md = toMarkdown(withItems(base(), [item({ name: 'a|b' })]))
    expect(md).toContain('a\\|b')
    expect(md).toContain('| 1 | 1 | 0 | 100 | 100 |')
  })
})
