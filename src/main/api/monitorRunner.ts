// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Execução de um monitor: lê a coleção do disco (no Main), monta a entrada do executor e resume o
 * resultado. Reaproveita runCollection (o mesmo do executor da interface), com uma iteração.
 */
import { randomUUID } from 'node:crypto'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { API_LIMITS } from '@shared/api/limits'
import { runInputSchema, type ApiMonitorRun, type ApiMonitor } from '@shared/api/protocol'
import { apiCollectionSchema, apiEnvironmentSchema, parseApiRequest } from '@shared/api/schema'
import type { CollectionRequestItem } from '@shared/api/collectionTypes'
import { runCollection } from './runner'

const MAX_FILES = 2000
const MAX_DEPTH = 8
const COLLECTION_FILE = 'collection.apicol'

export type Failure = Omit<ApiMonitorRun, 'at'>
const FAILED: Failure = { ok: false, passed: 0, failed: 0, errors: 1, totalMs: 0, avgMs: 0 }

/** Lista os arquivos da pasta (sem seguir links, sem ocultos), com caminho relativo em "/". */
async function walk(dir: string): Promise<{ path: string; rel: string }[]> {
  const out: { path: string; rel: string }[] = []
  const visit = async (current: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || out.length >= MAX_FILES) return
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.isSymbolicLink()) continue
      const full = join(current, entry.name)
      if (entry.isDirectory()) await visit(full, depth + 1)
      else if (entry.isFile() && out.length < MAX_FILES) out.push({ path: full, rel: relative(dir, full).split(sep).join('/') })
    }
  }
  await visit(dir, 0)
  return out
}

async function readText(path: string): Promise<string | null> {
  try {
    const s = await lstat(path)
    if (!s.isFile() || s.size > API_LIMITS.requestFileChars * 4) return null
    const text = await readFile(path, 'utf8')
    return text.length > API_LIMITS.requestFileChars ? null : text
  } catch {
    return null
  }
}

/** Resume os resultados dos itens: testes ok e com falha, erros de rede e tempos. */
export function summarize(items: { errorCode?: string; timeMs?: number; tests: { passed: boolean }[] }[]): Failure {
  let passed = 0
  let failed = 0
  let errors = 0
  let total = 0
  let timed = 0
  for (const item of items) {
    if (item.errorCode) errors++
    for (const t of item.tests) t.passed ? passed++ : failed++
    if (item.timeMs !== undefined) {
      total += item.timeMs
      timed++
    }
  }
  return { ok: items.length > 0 && failed === 0 && errors === 0, passed, failed, errors, totalMs: total, avgMs: timed ? Math.round(total / timed) : 0 }
}

/** De onde a coleção é lida: disco ou nuvem (sempre só leitura). */
export interface CollectionSource {
  list(): Promise<{ path: string; rel: string }[]>
  read(path: string): Promise<string | null>
  /** Caminho do arquivo (ambiente) fora da lista, só do disco. */
  readEnvironment(path: string): Promise<string | null>
}

export function diskSource(collectionDir: string): CollectionSource {
  return {
    list: () => walk(resolve(collectionDir)),
    read: readText,
    readEnvironment: (p) => readText(resolve(p))
  }
}

/** Acesso à nuvem da conta, pelo Main (injetado para teste). */
export interface CloudReader {
  signedIn(): boolean
  listAll(): Promise<{ files: { id: string; path: string }[]; folders: string[] }>
  readText(id: string): Promise<string>
}

const isHiddenName = (name: string): boolean => name.startsWith('.') || name === 'node_modules'

/** A pasta da nuvem existe (tem arquivos ou está na lista de pastas)? */
export function cloudDirExists(dir: string, listing: { files: { path: string }[]; folders: string[] }): boolean {
  const prefix = `${dir}/`
  return listing.folders.some((f) => f === dir || f.startsWith(prefix)) || listing.files.some((f) => f.path.startsWith(prefix))
}

export function cloudSource(collectionDir: string, reader: CloudReader): CollectionSource {
  const ids = new Map<string, string>()
  let loaded: Promise<void> | null = null
  const load = (): Promise<void> =>
    (loaded ??= reader.listAll().then(({ files }) => {
      for (const f of files) ids.set(f.path, f.id)
    }))
  const readById = async (path: string): Promise<string | null> => {
    await load()
    const id = ids.get(path)
    if (!id) return null
    try {
      const text = await reader.readText(id)
      return text.length > API_LIMITS.requestFileChars ? null : text
    } catch {
      return null
    }
  }
  return {
    async list() {
      await load()
      const prefix = `${collectionDir}/`
      const out: { path: string; rel: string }[] = []
      for (const path of ids.keys()) {
        if (!path.startsWith(prefix) || out.length >= MAX_FILES) continue
        const rel = path.slice(prefix.length)
        const parts = rel.split('/')
        if (parts.length - 1 > MAX_DEPTH || parts.some(isHiddenName)) continue
        out.push({ path, rel })
      }
      return out
    },
    read: readById,
    readEnvironment: readById
  }
}

export async function executeMonitor(monitor: ApiMonitor, signal: AbortSignal, reader?: CloudReader): Promise<Failure> {
  if (monitor.location === 'cloud') {
    // Sem conta conectada (ou sessão expirada): é falha, com o motivo para a notificação dizer.
    if (!reader || !reader.signedIn()) return { ...FAILED, code: 'notSignedIn' }
    try {
      return await executeFromSource(monitor, cloudSource(monitor.collectionDir, reader), signal)
    } catch {
      return reader.signedIn() ? FAILED : { ...FAILED, code: 'notSignedIn' }
    }
  }
  return executeFromSource(monitor, diskSource(monitor.collectionDir), signal)
}

export async function executeFromSource(monitor: ApiMonitor, source: CollectionSource, signal: AbortSignal): Promise<Failure> {
  const files = await source.list()
  const readText = source.read
  let collection = null
  const colFile = files.find((f) => f.rel === COLLECTION_FILE)
  const colText = colFile ? await readText(colFile.path) : null
  if (colText) {
    try {
      const parsed = apiCollectionSchema.safeParse(JSON.parse(colText))
      if (parsed.success) collection = { id: parsed.data.id, variables: parsed.data.variables, auth: parsed.data.auth }
    } catch {
      // coleção ilegível: roda sem as variáveis dela
    }
  }

  let environment = null
  if (monitor.environment) {
    const text = await source.readEnvironment(monitor.environment)
    let parsed
    try {
      parsed = text ? apiEnvironmentSchema.safeParse(JSON.parse(text)) : null
    } catch {
      parsed = null
    }
    if (!parsed?.success) return FAILED
    const env = parsed.data
    environment = { id: env.id, name: env.name, production: env.production, variables: env.variables }
  }

  const wanted = new Set(monitor.requests.map((r) => r.replaceAll('\\', '/')))
  const order = (() => {
    try {
      return colText ? (apiCollectionSchema.parse(JSON.parse(colText)).order ?? []) : []
    } catch {
      return []
    }
  })()
  const items: CollectionRequestItem[] = []
  const candidates = files.filter((f) => f.rel.toLowerCase().endsWith('.apireq') && (wanted.size === 0 || wanted.has(f.rel)))
  for (const f of candidates) {
    const text = await readText(f.path)
    if (text === null) continue
    const parsed = parseApiRequest(text)
    if (!parsed.ok) continue
    const i = f.rel.lastIndexOf('/')
    items.push({ path: f.path, folder: i < 0 ? '' : f.rel.slice(0, i), request: parsed.request })
  }
  const base = (p: string): string => p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1)
  const rank = (p: string): number => {
    const i = order.indexOf(base(p))
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  items.sort((a, b) => a.folder.localeCompare(b.folder) || rank(a.path) - rank(b.path) || base(a.path).localeCompare(base(b.path)))
  if (items.length === 0) return FAILED

  const input = runInputSchema.parse({
    runId: randomUUID(),
    name: monitor.name,
    items: items.slice(0, 1000),
    environment,
    collection,
    iterations: 1
  })
  const results = await runCollection(input, { signal, onProgress: () => {} })
  return summarize(results)
}
