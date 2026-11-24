// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Arquivo de dados do executor de coleção: CSV (aspas, vírgula, ponto e vírgula ou tabulação, com
 * cabeçalho) ou JSON (array de objetos). Cada linha vira as variáveis de uma iteração.
 */
import { API_LIMITS } from './limits'
import { VARIABLE_NAME_RE } from './variables'

export const DATA_FILE_LIMITS = {
  chars: 20 * 1024 * 1024,
  rows: 10_000,
  columns: 100
} as const

export type DataFileErrorCode =
  | 'empty'
  | 'tooLarge'
  | 'tooManyRows'
  | 'tooManyColumns'
  | 'invalidJson'
  | 'notArrayOfObjects'
  | 'invalidCsv'
  | 'noColumns'

export type DataFileResult =
  | { ok: true; format: 'csv' | 'json'; rows: Record<string, string>[]; columns: string[]; skippedColumns: string[] }
  | { ok: false; code: DataFileErrorCode }

const fail = (code: DataFileErrorCode): DataFileResult => ({ ok: false, code })

/** Valor da célula como texto, limitado ao tamanho de uma variável. */
const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return s.length > API_LIMITS.valueChars ? s.slice(0, API_LIMITS.valueChars) : s
}

/** Delimitador mais frequente (fora de aspas) na primeira linha. */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  for (const ch of text) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && (ch === '\n' || ch === '\r')) break
    else if (!quoted && ch in counts) counts[ch]++
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ','
}

/** Analisador CSV (RFC 4180): aspas duplas, "" como aspa literal e quebras de linha dentro de aspas. */
function parseCsvRows(text: string, delimiter: string): string[][] | null {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let i = 0
  const max = DATA_FILE_LIMITS.rows + 1
  const endField = (): void => {
    row.push(field)
    field = ''
  }
  const endRow = (): void => {
    endField()
    // linha totalmente vazia (só uma célula vazia) é ignorada
    if (!(row.length === 1 && row[0] === '')) rows.push(row)
    row = []
  }
  while (i < text.length) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
    } else if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) endField()
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      endRow()
      if (rows.length > max) return rows
    } else field += ch
    i++
  }
  if (quoted) return null
  if (field !== '' || row.length > 0) endRow()
  return rows
}

function fromCsv(text: string): DataFileResult {
  const rows = parseCsvRows(text, detectDelimiter(text))
  if (!rows) return fail('invalidCsv')
  if (rows.length === 0) return fail('empty')
  if (rows.length - 1 > DATA_FILE_LIMITS.rows) return fail('tooManyRows')
  const header = rows[0].map((h) => h.trim())
  if (header.length > DATA_FILE_LIMITS.columns) return fail('tooManyColumns')
  const columns: string[] = []
  const skipped: string[] = []
  const keep = header.map((h) => {
    if (VARIABLE_NAME_RE.test(h) && !columns.includes(h)) {
      columns.push(h)
      return true
    }
    skipped.push(h)
    return false
  })
  if (columns.length === 0) return fail('noColumns')
  const out = rows.slice(1).map((r) => {
    const o: Record<string, string> = {}
    header.forEach((h, c) => {
      if (keep[c]) o[h] = cell(r[c] ?? '')
    })
    return o
  })
  return { ok: true, format: 'csv', rows: out, columns, skippedColumns: skipped }
}

function fromJson(text: string): DataFileResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fail('invalidJson')
  }
  if (!Array.isArray(parsed) || !parsed.every((o) => o && typeof o === 'object' && !Array.isArray(o))) return fail('notArrayOfObjects')
  if (parsed.length === 0) return fail('empty')
  if (parsed.length > DATA_FILE_LIMITS.rows) return fail('tooManyRows')
  const columns: string[] = []
  const skipped: string[] = []
  const rows = (parsed as Record<string, unknown>[]).map((obj) => {
    const o: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (!VARIABLE_NAME_RE.test(k) || k === '__proto__') {
        if (!skipped.includes(k)) skipped.push(k)
        continue
      }
      if (!columns.includes(k)) columns.push(k)
      o[k] = cell(v)
    }
    return o
  })
  if (columns.length > DATA_FILE_LIMITS.columns) return fail('tooManyColumns')
  if (columns.length === 0) return fail('noColumns')
  return { ok: true, format: 'json', rows, columns, skippedColumns: skipped }
}

/** Lê o texto do arquivo de dados. O formato vem do nome (.json) ou do primeiro caractere ([ ou {). */
export function parseDataFile(text: string, fileName = ''): DataFileResult {
  if (text.length > DATA_FILE_LIMITS.chars) return fail('tooLarge')
  const body = text.replace(/^\uFEFF/, '')
  if (body.trim() === '') return fail('empty')
  const isJson = /\.json$/i.test(fileName) || /^\s*[[{]/.test(body)
  return isJson ? fromJson(body) : fromCsv(body)
}
