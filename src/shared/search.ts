/**
 * Lógica pura de busca e substituição em texto (sem acesso a disco).
 * Usada pelo Main na busca em pastas e coberta por testes unitários.
 */

export interface SearchOptions {
  query: string
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
}

export interface SearchMatch {
  /** Linha (base 1) e coluna (base 1) do início da ocorrência. */
  line: number
  column: number
  length: number
  /** Trecho da linha (cortado em PREVIEW_MAX) e posição da ocorrência dentro dele. */
  preview: string
  previewStart: number
}

export const PREVIEW_MAX = 240

const WORD = '[\\p{L}\\p{N}_]'

/** Monta a expressão; lança Error com mensagem em português se o padrão for inválido. */
export function buildRegex(opts: SearchOptions): RegExp {
  if (opts.query === '') throw new Error('Digite o texto a procurar.')
  let source = opts.regex ? opts.query : opts.query.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
  if (opts.wholeWord) source = `(?<!${WORD})(?:${source})(?!${WORD})`
  try {
    return new RegExp(source, `gmu${opts.caseSensitive ? '' : 'i'}`)
  } catch (err) {
    throw new Error(`Expressão regular inválida: ${(err as Error).message.replace(/^Invalid regular expression: (?:\/.*\/[a-z]*: )?/, '')}`)
  }
}

/** Posições (offsets) em que cada linha começa. */
function lineStarts(text: string): number[] {
  const starts = [0]
  for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) starts.push(i + 1)
  return starts
}

function lineOf(starts: number[], offset: number): number {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Procura as ocorrências em `text` (já com quebras LF). Para em `limit`. */
export function searchText(text: string, re: RegExp, limit = Infinity): SearchMatch[] {
  const matches: SearchMatch[] = []
  const starts = lineStarts(text)
  re.lastIndex = 0
  for (let m = re.exec(text); m !== null && matches.length < limit; m = re.exec(text)) {
    if (m[0] === '') {
      re.lastIndex++ // evita laço infinito com padrões que casam vazio
      continue
    }
    const lineIdx = lineOf(starts, m.index)
    const lineStart = starts[lineIdx]
    const lineEnd = lineIdx + 1 < starts.length ? starts[lineIdx + 1] - 1 : text.length
    const column = m.index - lineStart
    // Mantém a ocorrência visível mesmo em linhas muito longas.
    const from = Math.max(0, Math.min(column - 40, lineEnd - lineStart - PREVIEW_MAX))
    const preview = text.slice(lineStart + from, Math.min(lineEnd, lineStart + from + PREVIEW_MAX))
    matches.push({
      line: lineIdx + 1,
      column: column + 1,
      length: Math.min(m[0].length, Math.max(0, preview.length - (column - from))),
      preview,
      previewStart: column - from
    })
  }
  return matches
}

/** Expande $1, $<nome>, $&, $$ como o String.replace faz com texto. */
function expandReplacement(template: string, args: unknown[]): string {
  const last = args[args.length - 1]
  const hasGroups = typeof last === 'object' && last !== null
  const groups = hasGroups ? (last as Record<string, string>) : undefined
  const tail = hasGroups ? 3 : 2 // posição, texto inteiro (+ grupos nomeados)
  const caps = args.slice(1, args.length - tail) as (string | undefined)[]
  const match = args[0] as string
  const position = args[args.length - tail] as number
  const whole = args[args.length - tail + 1] as string
  return template.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]*>)/g, (all, token: string) => {
    if (token === '$') return '$'
    if (token === '&') return match
    if (token === '`') return whole.slice(0, position)
    if (token === "'") return whole.slice(position + match.length)
    if (token.startsWith('<')) return groups?.[token.slice(1, -1)] ?? (groups ? '' : all)
    const n = Number(token)
    if (n >= 1 && n <= caps.length) return caps[n - 1] ?? ''
    return all
  })
}

/** Substitui todas as ocorrências. No modo regex, $1, $& etc. funcionam; fora dele o texto é literal. */
export function replaceText(text: string, re: RegExp, replacement: string, regex: boolean): { text: string; count: number } {
  let count = 0
  re.lastIndex = 0
  const out = text.replace(re, (...args) => {
    const m = args[0] as string
    if (m === '') return m
    count++
    return regex ? expandReplacement(replacement, args) : replacement
  })
  return { text: out, count }
}

/** Converte padrões como "*.ts, docs/**" em um teste de caminho relativo (com /). Null se vazio. */
export function buildGlobFilter(patterns: string): ((relPath: string) => boolean) | null {
  const list = patterns
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (list.length === 0) return null
  const regs = list.map((p) => {
    const anchored = p.includes('/')
    const body = p
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0001')
      .replace(/\*\*/g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')
      .replace(/\u0001/g, '(?:.*/)?')
      .replace(/\u0000/g, '.*')
    return new RegExp(anchored ? `^${body}$` : `(?:^|/)${body}$`, 'i')
  })
  return (relPath) => regs.some((r) => r.test(relPath))
}
