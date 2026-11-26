// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Lógica pura dos testes e extrações da resposta (sem thread, sem Electron).
 * Códigos de erro: badJsonPath, badRegex, notJson, badSchema, schemaFileUnsupported,
 * badXPath, notXml, badExpected, evalFailed (e timeout, aplicado pelo runner).
 */
import Ajv from 'ajv'
import type { Assertion, Extraction } from '@shared/api/schema'
import type { AssertionResult } from '@shared/api/protocol'
import xpath from 'xpath'
import { parseXmlSafe, XmlError } from '@shared/api/xmlSafe'
import { evalJsonPath, JsonPathError } from './jsonPath'

/** O que os testes e as extrações enxergam da resposta (corpo como texto UTF-8). */
export interface ResponseForAssertions {
  status: number
  timeMs: number
  sizeBytes: number
  headers: { key: string; value: string }[]
  cookies: { name: string; value: string }[]
  body: string
  contentType: string
}

class EvalError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

const ACTUAL_MAX = 200

/** Cache do JSON do corpo, para várias asserções não reanalisarem o texto. */
interface Ctx {
  response: ResponseForAssertions
  json?: { ok: true; value: unknown } | { ok: false }
  xml?: { ok: true; doc: Document; ns: Record<string, string> } | { ok: false }
}

const makeCtx = (response: ResponseForAssertions): Ctx => ({ response })

function bodyJson(ctx: Ctx): unknown {
  if (!ctx.json) {
    try {
      ctx.json = { ok: true, value: JSON.parse(ctx.response.body) }
    } catch {
      ctx.json = { ok: false }
    }
  }
  if (!ctx.json.ok) throw new EvalError('notJson')
  return ctx.json.value
}

const XML_BODY_MAX = 5 * 1024 * 1024

/** Documento XML do corpo (analisado uma vez) e os prefixos de namespace declarados nele. */
function bodyXml(ctx: Ctx): { doc: Document; ns: Record<string, string> } {
  if (!ctx.xml) {
    try {
      const doc = parseXmlSafe(ctx.response.body, XML_BODY_MAX)
      const ns: Record<string, string> = {}
      const walk = (el: Element, depth: number): void => {
        for (let i = 0; i < el.attributes.length; i++) {
          const at = el.attributes[i]!
          if (at.name.startsWith('xmlns:') && !(at.name.slice(6) in ns)) ns[at.name.slice(6)] = at.value
        }
        if (depth > 50) return
        for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) walk(n as Element, depth + 1)
      }
      walk(doc.documentElement, 0)
      ctx.xml = { ok: true, doc, ns }
    } catch {
      ctx.xml = { ok: false }
    }
  }
  if (!ctx.xml.ok) throw new EvalError('notXml')
  return ctx.xml
}

const nodeText = (n: Node): string => (n.nodeType === 2 || n.nodeType === 3 || n.nodeType === 4 ? (n.nodeValue ?? '') : (n.textContent ?? ''))

/** XPath: nó único vira texto, vários viram lista; número, texto e booleano voltam como estão. */
function evalXPath(ctx: Ctx, path: string): { values: unknown[]; value: unknown } {
  const { doc, ns } = bodyXml(ctx)
  let result: xpath.SelectReturnType
  try {
    result = xpath.useNamespaces(ns)(path, doc as unknown as Node)
  } catch (e) {
    if (e instanceof XmlError) throw new EvalError('notXml')
    throw new EvalError('badXPath')
  }
  if (Array.isArray(result)) {
    const values = result.map((n) => nodeText(n as Node))
    return { values, value: values.length <= 1 ? values[0] : values }
  }
  return { values: [result], value: result }
}

export function summarize(v: unknown): string {
  let s: string
  if (v === undefined) s = ''
  else if (typeof v === 'string') s = v
  else {
    try {
      s = JSON.stringify(v) ?? String(v)
    } catch {
      s = String(v)
    }
  }
  return s.length > ACTUAL_MAX ? s.slice(0, ACTUAL_MAX - 1) + '…' : s
}

/** Texto comparável: objetos viram JSON; o resto, String(). */
function str(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null) return JSON.stringify(v)
  return String(v)
}

function looseEq(actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'number' || typeof expected === 'number') {
    const a = Number(actual)
    const b = Number(expected)
    if (Number.isFinite(a) && Number.isFinite(b) && actual !== '' && expected !== '' && actual !== null && expected !== null && typeof actual !== 'boolean' && typeof expected !== 'boolean') return a === b
  }
  return str(actual) === str(expected)
}

/** Aceita /padrão/flags ou texto puro. */
export function parseRegex(src: string): RegExp {
  let pattern = src
  let flags = ''
  const m = /^\/([\s\S]+)\/([a-z]*)$/.exec(src)
  if (m) {
    pattern = m[1]
    flags = m[2]
  }
  try {
    return new RegExp(pattern, flags)
  } catch {
    throw new EvalError('badRegex')
  }
}

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function expectedNum(expected: unknown): number {
  const n = toNum(expected)
  if (n === undefined) throw new EvalError('badExpected')
  return n
}

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  return typeof v
}

const TYPES = ['string', 'number', 'boolean', 'array', 'object', 'null']

function lengthOf(v: unknown): number | undefined {
  if (typeof v === 'string' || Array.isArray(v)) return v.length
  return undefined
}

function schemaFrom(a: Assertion): unknown {
  if (typeof a.expected === 'string' && a.expected.trim() !== '') {
    try {
      return JSON.parse(a.expected)
    } catch {
      throw new EvalError('badSchema')
    }
  }
  // Arquivo de schema da coleção entra em fase posterior.
  if (a.path && a.path.trim() !== '') throw new EvalError('schemaFileUnsupported')
  throw new EvalError('badSchema')
}

function matchesSchema(actual: unknown, a: Assertion): boolean {
  const schema = schemaFrom(a)
  if (typeof schema !== 'object' || schema === null) throw new EvalError('badSchema')
  let validate
  try {
    validate = new Ajv({ strict: false, allErrors: false }).compile(schema as object)
  } catch {
    throw new EvalError('badSchema')
  }
  return validate(actual) === true
}

/** Valor recebido para o alvo da asserção. */
function targetValue(a: Assertion, ctx: Ctx): unknown {
  const r = ctx.response
  switch (a.target) {
    case 'status':
      return r.status
    case 'time':
      return r.timeMs
    case 'size':
      return r.sizeBytes
    case 'header': {
      const name = (a.name ?? '').toLowerCase()
      return r.headers.find((h) => h.key.toLowerCase() === name)?.value
    }
    case 'cookie':
      return r.cookies.find((c) => c.name === (a.name ?? ''))?.value
    case 'body':
      return r.body
    case 'jsonPath': {
      const data = bodyJson(ctx)
      try {
        return evalJsonPath(data, a.path ?? '$').value
      } catch (e) {
        if (e instanceof JsonPathError) throw new EvalError('badJsonPath')
        throw e
      }
    }
    case 'jsonSchema':
      return bodyJson(ctx)
    case 'xPath':
      return evalXPath(ctx, a.path ?? '').value
  }
}

function compare(a: Assertion, actual: unknown): boolean {
  const exp = a.expected
  const needExpected = (): NonNullable<Assertion['expected']> | null => {
    if (exp === undefined) throw new EvalError('badExpected')
    return exp
  }
  switch (a.op) {
    case 'exists':
      return actual !== undefined
    case 'notExists':
      return actual === undefined
    case 'eq':
      needExpected()
      return actual !== undefined && looseEq(actual, exp)
    case 'neq':
      needExpected()
      return actual === undefined || !looseEq(actual, exp)
    case 'contains':
    case 'notContains': {
      needExpected()
      let found = false
      if (Array.isArray(actual)) found = actual.some((x) => looseEq(x, exp))
      else if (typeof actual === 'string') found = actual.includes(str(exp))
      return a.op === 'contains' ? found : !found
    }
    case 'startsWith':
      needExpected()
      return typeof actual === 'string' && actual.startsWith(str(exp))
    case 'matches': {
      needExpected()
      const re = parseRegex(str(exp))
      return actual !== undefined && re.test(str(actual))
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const e = expectedNum(needExpected())
      const n = toNum(actual)
      if (n === undefined) return false
      return a.op === 'gt' ? n > e : a.op === 'gte' ? n >= e : a.op === 'lt' ? n < e : n <= e
    }
    case 'isType': {
      const t = str(needExpected()).toLowerCase()
      if (!TYPES.includes(t)) throw new EvalError('badExpected')
      return actual !== undefined && typeOf(actual) === t
    }
    case 'lengthEq':
    case 'lengthGt':
    case 'lengthLt': {
      const e = expectedNum(needExpected())
      const len = lengthOf(actual)
      if (len === undefined) return false
      return a.op === 'lengthEq' ? len === e : a.op === 'lengthGt' ? len > e : len < e
    }
    case 'in': {
      if (!Array.isArray(exp)) throw new EvalError('badExpected')
      return actual !== undefined && exp.some((x) => looseEq(actual, x))
    }
    case 'matchesSchema': {
      let value = actual
      if (a.target === 'body' && typeof actual === 'string') {
        try {
          value = JSON.parse(actual)
        } catch {
          throw new EvalError('notJson')
        }
      }
      if (value === undefined) {
        schemaFrom(a) // valida o schema mesmo sem valor
        return false
      }
      return matchesSchema(value, a)
    }
  }
}

export function evaluateAssertion(index: number, a: Assertion, ctx: Ctx): AssertionResult {
  if (a.enabled === false) return { index, passed: true }
  let actual: unknown
  try {
    actual = targetValue(a, ctx)
    const passed = compare(a, actual)
    return { index, passed, actual: actual === undefined ? undefined : summarize(actual) }
  } catch (e) {
    const code = e instanceof EvalError ? e.code : 'evalFailed'
    return { index, passed: false, error: code, ...(actual !== undefined ? { actual: summarize(actual) } : {}) }
  }
}

export function evaluateExtraction(e: Extraction, ctx: Ctx): string | undefined {
  if (e.enabled === false) return undefined
  const r = ctx.response
  try {
    switch (e.from) {
      case 'jsonPath': {
        const v = evalJsonPath(bodyJson(ctx), e.path).values[0]
        if (v === undefined) return undefined
        return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)
      }
      case 'header': {
        const name = e.path.toLowerCase()
        return r.headers.find((h) => h.key.toLowerCase() === name)?.value
      }
      case 'cookie':
        return r.cookies.find((c) => c.name === e.path)?.value
      case 'regex': {
        const m = parseRegex(e.path).exec(r.body)
        if (!m) return undefined
        return m[1] ?? m[0]
      }
      case 'xPath': {
        const v = evalXPath(ctx, e.path).values[0]
        return v === undefined ? undefined : String(v)
      }
    }
  } catch {
    return undefined
  }
}

export { makeCtx }
export type { Ctx }

/** Avalia tudo de uma vez, sem thread (usado nos testes e dentro do worker). */
export function evaluateAll(tests: Assertion[], extract: Extraction[], response: ResponseForAssertions): { tests: AssertionResult[]; extracted: (string | undefined)[] } {
  const ctx = makeCtx(response)
  return { tests: tests.map((t, i) => evaluateAssertion(i, t, ctx)), extracted: extract.map((x) => evaluateExtraction(x, ctx)) }
}
