// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { lstat, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'
import { parseApiRequest } from '@shared/api/schema'

/**
 * Confiança nos scripts, por computador (nunca sincroniza), em userData/api-script-trust.json: guarda o
 * SHA-256 de (pre + "\0" + post) por chave (pasta da coleção ou requisição). Se o script muda, o hash
 * muda e a confiança cai. Um .apireq importado ou da nuvem traz scripts de terceiros: só roda depois
 * que o usuário confia, e só nesta versão do texto.
 * (O arquivo é separado de api-trust.json, que guarda os hosts confirmados para os segredos.)
 */
const trustPath = (): string => join(app.getPath('userData'), 'api-script-trust.json')

const MAX_KEYS = 2000
const MAX_HASHES_PER_KEY = 5000
const MAX_REQUEST_FILES = 5000
const MAX_REQUEST_BYTES = 12 * 1024 * 1024
export const COLLECTION_FILE = 'collection.apicol'

let cache: Map<string, string[]> | null = null
let loading: Promise<Map<string, string[]>> | null = null
let writing: Promise<void> = Promise.resolve()

/** Caminhos comparam sem diferenciar maiúsculas no Windows; outras chaves (id de documento) ficam como estão. */
function normPath(p: string): string {
  const abs = resolve(p)
  return process.platform === 'win32' ? abs.toLowerCase() : abs
}
const isPathLike = (k: string): boolean => /^([A-Za-z]:[\\/]|[\\/])/.test(k)
export const requestKeyOf = (key: string): string => `req:${isPathLike(key) ? normPath(key) : key}`
export const collectionKeyOf = (dir: string): string => `dir:${normPath(dir)}`

export const scriptHash = (pre: string, post: string): string => createHash('sha256').update(`${pre}\0${post}`, 'utf8').digest('hex')

function load(): Promise<Map<string, string[]>> {
  if (cache) return Promise.resolve(cache)
  return (loading ??= read())
}

async function read(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  try {
    const data = JSON.parse(await readFile(trustPath(), 'utf8')) as { keys?: unknown }
    if (data.keys && typeof data.keys === 'object') {
      for (const [key, hashes] of Object.entries(data.keys as Record<string, unknown>).slice(0, MAX_KEYS)) {
        if (key === '__proto__' || !Array.isArray(hashes)) continue
        map.set(key, hashes.filter((h): h is string => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h)).slice(-MAX_HASHES_PER_KEY))
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') log.warn('Cliente de API: lista de scripts confiáveis ilegível, começando vazia')
  }
  cache = map
  loading = null
  return map
}

function persist(): Promise<void> {
  const keys: Record<string, string[]> = {}
  for (const [k, v] of cache ?? []) keys[k] = v
  const text = JSON.stringify({ version: 1, keys })
  writing = writing
    .then(async () => {
      const tmp = `${trustPath()}.tmp`
      await writeFile(tmp, text, 'utf8')
      await rename(tmp, trustPath())
    })
    .catch(() => log.warn('Cliente de API: falha ao gravar os scripts confiáveis'))
  return writing
}

/** Pasta da coleção que contém o arquivo (sobe até 12 níveis procurando collection.apicol). */
export function collectionDirOf(documentPath: string | null | undefined): string | null {
  if (!documentPath || !/^([A-Za-z]:[\\/]|[\\/])/.test(documentPath)) return null
  let dir = dirname(resolve(documentPath))
  for (let level = 0; level < 12; level++) {
    try {
      if (existsSync(join(dir, COLLECTION_FILE))) return dir
    } catch {
      return null
    }
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
  return null
}

/** Os scripts (pre e post) estão confiados em alguma das chaves? Sem script, não há o que confiar. */
export async function isScriptTrusted(input: { pre: string; post: string; keys: { dir?: string | null; request?: (string | null | undefined)[] } }): Promise<boolean> {
  if (input.pre.trim() === '' && input.post.trim() === '') return true
  const map = await load()
  const hash = scriptHash(input.pre, input.post)
  const keys: string[] = []
  if (input.keys.dir) keys.push(collectionKeyOf(input.keys.dir))
  for (const r of input.keys.request ?? []) if (r) keys.push(requestKeyOf(r))
  return keys.some((k) => map.get(k)?.includes(hash))
}

/** Registra hashes numa chave. `replace`: a lista inteira da chave passa a ser esta (confiar na coleção inteira). */
export async function trustHashes(key: string, hashes: string[], replace = false): Promise<void> {
  const map = await load()
  let list = replace ? [] : (map.get(key) ?? [])
  if (!map.has(key) && map.size >= MAX_KEYS) return
  for (const h of hashes) if (!list.includes(h)) list.push(h)
  list = list.slice(-MAX_HASHES_PER_KEY)
  map.set(key, list)
  await persist()
}

/** Hashes dos scripts atuais de todos os .apireq da pasta (sem seguir links simbólicos). */
export async function collectionScriptHashes(dir: string): Promise<string[]> {
  const hashes = new Set<string>()
  let files = 0
  const walk = async (current: string, depth: number): Promise<void> => {
    if (depth > 12 || files >= MAX_REQUEST_FILES) return
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (files >= MAX_REQUEST_FILES) return
      const full = join(current, e.name)
      if (e.isDirectory()) await walk(full, depth + 1)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.apireq')) {
        files++
        try {
          if ((await lstat(full)).size > MAX_REQUEST_BYTES) continue
          const parsed = parseApiRequest(await readFile(full, 'utf8'))
          const s = parsed.ok ? parsed.request.scripts : undefined
          if (s && (s.pre.trim() !== '' || s.post.trim() !== '')) hashes.add(scriptHash(s.pre, s.post))
        } catch {
          /* arquivo ilegível: ignora */
        }
      }
    }
  }
  await walk(dir, 0)
  return [...hashes]
}

/** Só para os testes: esquece o cache em memória. */
export const resetScriptTrustCache = (): void => {
  cache = null
  loading = null
}
