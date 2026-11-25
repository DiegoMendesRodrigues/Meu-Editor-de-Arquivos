// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { parseApiRequest } from '@shared/api/schema'
import type { CollectionRequestItem, CollectionTree as SharedCollectionTree } from '@shared/api/collectionTypes'
import { planLimitReached } from '@/cloud'
import { useCloud, joinPath, parentOf, baseName } from '@/store/cloud'
import { parseCollection } from './environment'

export type { CollectionRequestItem } from '@shared/api/collectionTypes'

export interface CollectionTree extends SharedCollectionTree {
  /** Subpastas da coleção (relativas, com "/"), inclusive as vazias. */
  folders?: string[]
}

export const COLLECTION_FILE = 'collection.apicol'
export const FOLDER_FILE = 'folder.apicol'
export const ENVIRONMENTS_DIR = 'ambientes'

/** Limites de leitura: uma coleção enorme não pode travar a interface. */
const MAX_FILES = 2000
const MAX_DEPTH = 8

/** Caminho do disco é absoluto ("C:\..." ou "/..."); o da nuvem é relativo e usa "/". */
export const isCloudDir = (dir: string): boolean => !/^([A-Za-z]:[\\/]|[\\/])/.test(dir)

const slash = (p: string): string => p.replace(/\\/g, '/')
const sepOf = (p: string): string => (p.includes('\\') ? '\\' : '/')
export const joinDisk = (dir: string, ...parts: string[]): string => [dir.replace(/[\\/]+$/, ''), ...parts].join(sepOf(dir))
export const dirOf = (path: string): string => {
  const i = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return i <= 0 ? '' : path.slice(0, i)
}
const relativeTo = (dir: string, path: string): string => {
  const d = slash(dir).replace(/\/+$/, '')
  const p = slash(path)
  return p.toLowerCase().startsWith(`${d.toLowerCase()}/`) ? p.slice(d.length + 1) : p
}
const isHidden = (name: string): boolean => name.startsWith('.') || name === 'node_modules'

/** Lê o conteúdo de um arquivo da nuvem pelo caminho (null se não existe ou falhou). */
async function readCloudText(path: string): Promise<string | null> {
  const meta = useCloud.getState().files.find((f) => f.path === path)
  if (!meta) return null
  try {
    return (await window.api.cloudRead(meta.id)).content
  } catch {
    return null
  }
}

async function readDiskText(path: string): Promise<string | null> {
  try {
    return (await window.api.readFile(path)).content
  } catch {
    return null
  }
}

/** Lê vários itens, poucos por vez, sem derrubar a leitura se um falhar. */
async function mapLimited<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  return out
}

async function walkDisk(dir: string): Promise<{ files: { path: string; rel: string }[]; folders: string[] }> {
  const files: { path: string; rel: string }[] = []
  const folders: string[] = []
  const walk = async (current: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) return
    let entries
    try {
      entries = await window.api.listFolder(current)
    } catch {
      return
    }
    for (const entry of entries) {
      if (isHidden(entry.name)) continue
      const rel = relativeTo(dir, entry.path)
      if (entry.isDirectory) {
        folders.push(rel)
        await walk(entry.path, depth + 1)
      } else if (files.length < MAX_FILES) files.push({ path: entry.path, rel })
    }
  }
  await walk(dir, 0)
  return { files, folders }
}

function walkCloud(dir: string): { files: { path: string; rel: string }[]; folders: string[] } {
  const { files, folders } = useCloud.getState()
  const prefix = dir ? `${dir}/` : ''
  const inside = files.filter((f) => f.path.startsWith(prefix) && !f.path.slice(prefix.length).split('/').some(isHidden))
  const set = new Set<string>()
  for (const f of inside) {
    for (let p = parentOf(f.path); p && p !== dir && p.startsWith(prefix); p = parentOf(p)) set.add(p.slice(prefix.length))
  }
  for (const f of folders) if (f.startsWith(prefix) && f !== dir && !f.slice(prefix.length).split('/').some(isHidden)) set.add(f.slice(prefix.length))
  return { files: inside.slice(0, MAX_FILES).map((f) => ({ path: f.path, rel: f.path.slice(prefix.length) })), folders: [...set].sort() }
}

/** Lê a coleção inteira (para o executor, exportar e documentar). */
export async function readCollection(dir: string): Promise<CollectionTree> {
  const cloud = isCloudDir(dir)
  const { files, folders } = cloud ? walkCloud(dir) : await walkDisk(dir)
  const read = cloud ? readCloudText : readDiskText
  const tree: CollectionTree = { dir, location: cloud ? 'cloud' : 'disk', collection: null, requests: [], environments: [], folders }

  const colFile = files.find((f) => f.rel === COLLECTION_FILE)
  if (colFile) {
    const text = await read(colFile.path)
    tree.collection = text === null ? null : parseCollection(text)
  }
  tree.environments = files.filter((f) => f.rel.toLowerCase().endsWith('.apienv')).map((f) => f.path)

  const requestFiles = files.filter((f) => f.rel.toLowerCase().endsWith('.apireq'))
  const items = await mapLimited(requestFiles, 8, async (f): Promise<CollectionRequestItem | null> => {
    const text = await read(f.path)
    if (text === null) return null
    const parsed = parseApiRequest(text)
    if (!parsed.ok) return null
    const i = f.rel.lastIndexOf('/')
    return { path: f.path, folder: i < 0 ? '' : f.rel.slice(0, i), request: parsed.request }
  })
  tree.requests = items.filter((i): i is CollectionRequestItem => i !== null)
  // A ordem do collection.apicol (nomes de arquivos) vale dentro de cada pasta; o resto, alfabética.
  const order = tree.collection?.order ?? []
  const rank = (path: string): number => {
    const i = order.indexOf(baseName(slash(path)))
    return i < 0 ? Number.MAX_SAFE_INTEGER : i
  }
  tree.requests.sort((a, b) => a.folder.localeCompare(b.folder) || rank(a.path) - rank(b.path) || baseName(slash(a.path)).localeCompare(baseName(slash(b.path))))
  return tree
}

/** Nome livre na nuvem: acrescenta " (2)", " (3)"... antes da extensão se já existir. */
function freeCloudPath(path: string): string {
  const taken = new Set(useCloud.getState().files.map((f) => f.path))
  if (!taken.has(path)) return path
  const dot = path.lastIndexOf('.')
  const hasExt = dot > path.lastIndexOf('/')
  const stem = hasExt ? path.slice(0, dot) : path
  const ext = hasExt ? path.slice(dot) : ''
  for (let n = 2; n < 1000; n++) if (!taken.has(`${stem} (${n})${ext}`)) return `${stem} (${n})${ext}`
  return path
}

/** Grava arquivos dentro da coleção (disco ou nuvem) e devolve os caminhos criados. Não sobrescreve. */
export async function writeCollectionFiles(dir: string, files: { relativePath: string; content: string }[]): Promise<string[]> {
  if (!isCloudDir(dir)) return window.api.apiWriteFiles({ dir, files })
  const created: string[] = []
  for (const file of files) {
    const path = freeCloudPath(joinPath(dir, file.relativePath))
    const res = await window.api.cloudSave({ path, content: file.content, encoding: 'UTF-8', baseVersion: null, force: false })
    // Limite do plano: o aviso já apareceu; para aqui e devolve o que foi gravado até agora.
    if (planLimitReached(res)) break
    if (!res.ok) throw new Error('cloud-conflict')
    useCloud.getState().upsertFile(res.file)
    created.push(res.file.path)
  }
  return created
}

/**
 * Acha a coleção de um documento: sobe as pastas a partir do arquivo procurando collection.apicol.
 * No disco só entram as pastas que o app pode ler (as demais falham e são ignoradas).
 */
export async function findCollection(doc: { path: string | null; cloud?: { path: string } }): Promise<{ dir: string; text: string } | null> {
  if (doc.path) {
    let dir = dirOf(doc.path)
    for (let level = 0; dir && level < 12; level++) {
      const text = await readDiskText(joinDisk(dir, COLLECTION_FILE))
      if (text !== null) return { dir, text }
      const up = dirOf(dir)
      if (up === dir) break
      dir = up
    }
    return null
  }
  if (doc.cloud) {
    let dir = parentOf(doc.cloud.path)
    for (let level = 0; level < 12; level++) {
      const text = await readCloudText(joinPath(dir, COLLECTION_FILE))
      if (text !== null) return { dir, text }
      if (!dir) break
      dir = parentOf(dir)
    }
  }
  return null
}

/** Arquivos .apienv da pasta ambientes/ de uma coleção (caminhos). */
export async function listCollectionEnvironments(dir: string): Promise<string[]> {
  if (isCloudDir(dir)) {
    const prefix = joinPath(dir, `${ENVIRONMENTS_DIR}/`)
    return useCloud
      .getState()
      .files.filter((f) => f.path.startsWith(prefix) && f.path.toLowerCase().endsWith('.apienv'))
      .map((f) => f.path)
  }
  try {
    const entries = await window.api.listFolder(joinDisk(dir, ENVIRONMENTS_DIR))
    return entries.filter((e) => !e.isDirectory && e.name.toLowerCase().endsWith('.apienv')).map((e) => e.path)
  } catch {
    return []
  }
}

/** Pastas (a partir de uma pasta aberta) que têm collection.apicol; não desce dentro de uma coleção. */
export async function discoverDiskCollections(root: string, maxDepth = 4): Promise<string[]> {
  const found: string[] = []
  let visited = 0
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > maxDepth || visited++ > 300) return
    let entries
    try {
      entries = await window.api.listFolder(dir)
    } catch {
      return
    }
    if (entries.some((e) => !e.isDirectory && e.name === COLLECTION_FILE)) {
      found.push(dir)
      return
    }
    for (const e of entries) if (e.isDirectory && !isHidden(e.name)) await walk(e.path, depth + 1)
  }
  await walk(root, 0)
  return found
}
