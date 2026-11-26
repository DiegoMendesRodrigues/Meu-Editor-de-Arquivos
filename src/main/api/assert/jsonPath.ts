// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Subconjunto seguro de JSONPath, sem eval: $, .prop, ['prop'], [n], [-n], [*], ..prop,
 * [a,b], [start:end] e filtros simples [?(@.campo == 'x')] / [?(@.campo)].
 */

export class JsonPathError extends Error {}

const MAX_DEPTH = 64
const MAX_RESULTS = 10_000
const MAX_PATH_CHARS = 2000

type Selector =
  | { k: 'name'; v: string }
  | { k: 'index'; v: number }
  | { k: 'wild' }
  | { k: 'slice'; s?: number; e?: number }
  | { k: 'filter'; path: (string | number)[]; op?: string; lit?: unknown }

interface Step {
  desc: boolean
  selectors: Selector[]
}

export interface JsonPathQuery {
  steps: Step[]
  /** Curinga, filtro, fatia, união ou descendente: o resultado é uma lista. */
  multi: boolean
}

const IDENT = /[A-Za-z0-9_$-]/

function parseQuoted(src: string, i: number): { value: string; end: number } {
  const q = src[i]
  let out = ''
  let j = i + 1
  while (j < src.length && src[j] !== q) {
    if (src[j] === '\\' && j + 1 < src.length) j++
    out += src[j]
    j++
  }
  if (j >= src.length) throw new JsonPathError('unterminated string')
  return { value: out, end: j + 1 }
}

/** Divide por vírgulas fora de aspas e parênteses. */
function splitTop(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === "'" || c === '"') {
      const { end } = parseQuoted(s, i)
      cur += s.slice(i, end)
      i = end - 1
      continue
    }
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += c
  }
  parts.push(cur)
  return parts.map((p) => p.trim())
}

function parseLiteral(s: string): unknown {
  const t = s.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null') return null
  if (t.length >= 2 && (t[0] === "'" || t[0] === '"')) {
    const { value, end } = parseQuoted(t, 0)
    if (end !== t.length) throw new JsonPathError('bad literal')
    return value
  }
  const n = Number(t)
  if (t !== '' && Number.isFinite(n)) return n
  throw new JsonPathError('bad literal')
}

/** Caminho simples relativo a @: .a.b, ['a'], [0]. */
function parseRelPath(s: string): (string | number)[] {
  const t = s.trim()
  if (!t.startsWith('@')) throw new JsonPathError('filter must start with @')
  const out: (string | number)[] = []
  let i = 1
  while (i < t.length) {
    if (t[i] === '.') {
      let j = i + 1
      while (j < t.length && IDENT.test(t[j])) j++
      if (j === i + 1) throw new JsonPathError('bad filter path')
      out.push(t.slice(i + 1, j))
      i = j
    } else if (t[i] === '[') {
      if (t[i + 1] === "'" || t[i + 1] === '"') {
        const { value, end } = parseQuoted(t, i + 1)
        if (t[end] !== ']') throw new JsonPathError('bad filter path')
        out.push(value)
        i = end + 1
      } else {
        const close = t.indexOf(']', i)
        const n = Number(t.slice(i + 1, close))
        if (close < 0 || !Number.isInteger(n)) throw new JsonPathError('bad filter path')
        out.push(n)
        i = close + 1
      }
    } else throw new JsonPathError('bad filter path')
  }
  return out
}

function parseFilter(sel: string): Selector {
  const m = /^\?\s*\(([\s\S]*)\)\s*$/.exec(sel)
  if (!m) throw new JsonPathError('bad filter')
  const expr = m[1].trim()
  // Procura o operador fora de aspas.
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]
    if (c === "'" || c === '"') {
      i = parseQuoted(expr, i).end - 1
      continue
    }
    const two = expr.slice(i, i + 2)
    const op = ['==', '!=', '<=', '>='].includes(two) ? two : c === '<' || c === '>' ? c : ''
    if (op) return { k: 'filter', path: parseRelPath(expr.slice(0, i)), op, lit: parseLiteral(expr.slice(i + op.length)) }
  }
  return { k: 'filter', path: parseRelPath(expr) }
}

function parseSelector(raw: string): Selector {
  const s = raw.trim()
  if (s === '*') return { k: 'wild' }
  if (s.startsWith('?')) return parseFilter(s)
  if (s.startsWith("'") || s.startsWith('"')) {
    const { value, end } = parseQuoted(s, 0)
    if (end !== s.length) throw new JsonPathError('bad selector')
    return { k: 'name', v: value }
  }
  if (/^-?\d+$/.test(s)) return { k: 'index', v: Number(s) }
  const sl = /^(-?\d*)\s*:\s*(-?\d*)$/.exec(s)
  if (sl) return { k: 'slice', s: sl[1] === '' ? undefined : Number(sl[1]), e: sl[2] === '' ? undefined : Number(sl[2]) }
  throw new JsonPathError('bad selector')
}

export function parseJsonPath(path: string): JsonPathQuery {
  const src = path.trim()
  if (src.length > MAX_PATH_CHARS) throw new JsonPathError('path too long')
  if (!src.startsWith('$')) throw new JsonPathError('path must start with $')
  const steps: Step[] = []
  let multi = false
  let i = 1
  while (i < src.length) {
    let desc = false
    if (src.startsWith('..', i)) {
      desc = true
      multi = true
      i += 2
      if (src[i] === '*') {
        steps.push({ desc, selectors: [{ k: 'wild' }] })
        i++
        continue
      }
      if (src[i] !== '[') {
        let j = i
        while (j < src.length && IDENT.test(src[j])) j++
        if (j === i) throw new JsonPathError('bad descendant')
        steps.push({ desc, selectors: [{ k: 'name', v: src.slice(i, j) }] })
        i = j
        continue
      }
      // ..[...] aplica o colchete aos descendentes
    } else if (src[i] === '.') {
      i++
      if (src[i] === '*') {
        steps.push({ desc, selectors: [{ k: 'wild' }] })
        multi = true
        i++
        continue
      }
      let j = i
      while (j < src.length && IDENT.test(src[j])) j++
      if (j === i) throw new JsonPathError('bad property')
      steps.push({ desc, selectors: [{ k: 'name', v: src.slice(i, j) }] })
      i = j
      continue
    }
    if (src[i] !== '[') throw new JsonPathError('unexpected character')
    // Acha o ] correspondente (fora de aspas).
    let j = i + 1
    let depth = 0
    while (j < src.length) {
      const c = src[j]
      if (c === "'" || c === '"') {
        j = parseQuoted(src, j).end
        continue
      }
      if (c === '[') depth++
      if (c === ']') {
        if (depth === 0) break
        depth--
      }
      j++
    }
    if (j >= src.length) throw new JsonPathError('missing ]')
    const selectors = splitTop(src.slice(i + 1, j)).map(parseSelector)
    if (selectors.length > 1 || selectors.some((s) => s.k === 'wild' || s.k === 'slice' || s.k === 'filter')) multi = true
    steps.push({ desc, selectors })
    i = j + 1
  }
  return { steps, multi }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k)

function children(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (isObj(v)) return Object.values(v)
  return []
}

function walkPath(v: unknown, path: (string | number)[]): unknown {
  let cur = v
  for (const p of path) {
    if (typeof p === 'number') cur = Array.isArray(cur) ? cur[p < 0 ? cur.length + p : p] : undefined
    else cur = isObj(cur) && has(cur, p) ? cur[p] : undefined
    if (cur === undefined) return undefined
  }
  return cur
}

function filterMatch(item: unknown, sel: Extract<Selector, { k: 'filter' }>): boolean {
  const left = walkPath(item, sel.path)
  if (!sel.op) return left !== undefined && left !== null && left !== false
  const r = sel.lit
  if (sel.op === '==') return left === r
  if (sel.op === '!=') return left !== r
  const bothNum = typeof left === 'number' && typeof r === 'number'
  const bothStr = typeof left === 'string' && typeof r === 'string'
  if (!bothNum && !bothStr) return false
  const a = left as number
  const b = r as number
  return sel.op === '<' ? a < b : sel.op === '<=' ? a <= b : sel.op === '>' ? a > b : a >= b
}

function applySelector(node: unknown, sel: Selector, out: unknown[]): void {
  switch (sel.k) {
    case 'name':
      if (isObj(node) && has(node, sel.v)) out.push(node[sel.v])
      return
    case 'index':
      if (Array.isArray(node)) {
        const v = node[sel.v < 0 ? node.length + sel.v : sel.v]
        if (v !== undefined) out.push(v)
      }
      return
    case 'wild':
      out.push(...children(node))
      return
    case 'slice':
      if (Array.isArray(node)) {
        const len = node.length
        const norm = (n: number | undefined, d: number): number => (n === undefined ? d : n < 0 ? Math.max(0, len + n) : Math.min(n, len))
        out.push(...node.slice(norm(sel.s, 0), norm(sel.e, len)))
      }
      return
    case 'filter':
      for (const c of children(node)) if (filterMatch(c, sel)) out.push(c)
  }
}

function descendants(node: unknown, depth: number, out: unknown[]): void {
  if (depth > MAX_DEPTH || out.length > MAX_RESULTS) return
  out.push(node)
  for (const c of children(node)) descendants(c, depth + 1, out)
}

export function queryJsonPath(data: unknown, q: JsonPathQuery): unknown[] {
  let nodes: unknown[] = [data]
  for (const step of q.steps) {
    const next: unknown[] = []
    for (const n of nodes) {
      let pool: unknown[] = [n]
      if (step.desc) {
        pool = []
        descendants(n, 0, pool)
      }
      for (const p of pool) {
        for (const sel of step.selectors) {
          applySelector(p, sel, next)
          if (next.length > MAX_RESULTS) throw new JsonPathError('too many results')
        }
      }
    }
    nodes = next
  }
  return nodes
}

/** Resultado de uma expressão: a lista inteira quando ela tem curinga/filtro; senão o primeiro valor (ou undefined). */
export function evalJsonPath(data: unknown, path: string): { values: unknown[]; multi: boolean; value: unknown } {
  const q = parseJsonPath(path)
  const values = queryJsonPath(data, q)
  return { values, multi: q.multi, value: q.multi ? values : values[0] }
}
