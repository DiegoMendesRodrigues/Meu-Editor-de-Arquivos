// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Busca e substituição em pastas, executadas numa thread separada (worker_threads).
 * Uma expressão regular muito custosa pode levar muito tempo; aqui ela não trava o processo
 * principal, que encerra a thread se passar do tempo limite.
 * A autorização dos caminhos é feita no processo principal, antes de chegar aqui.
 */
import { parentPort } from 'node:worker_threads'
import { open, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import type { SearchFileResult, SearchResponse } from '@shared/ipc'
import { buildGlobFilter, buildRegex, replaceText, searchText } from '@shared/search'
import { decodeText, encodeText } from './textCodec'
import { MAX_FILES_SCANNED, type ReplaceWorkResult, type WorkRequest } from './searchTypes'

/** Limites para manter a busca rápida em pastas grandes. */
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_MATCHES = 5000

/** Pastas que quase nunca interessam numa busca (dependências, controle de versão, builds). */
const IGNORED_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', 'out', 'dist', 'build', '.next', '.cache', '__pycache__'])

const toPosix = (p: string): string => p.split('\\').join('/')

/** Arquivos com byte NUL no início são tratados como binários. */
async function looksBinary(path: string): Promise<boolean> {
  const fh = await open(path, 'r')
  try {
    const buf = Buffer.alloc(8192)
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
    return buf.subarray(0, bytesRead).includes(0)
  } finally {
    await fh.close()
  }
}

/** Percorre a pasta (sem seguir links simbólicos, para evitar laços e saídas da pasta). */
async function* walk(root: string): AsyncGenerator<string> {
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let dirents
    try {
      dirents = await readdir(dir, { withFileTypes: true })
    } catch {
      continue // sem permissão ou pasta removida durante a busca
    }
    dirents.sort((a, b) => a.name.localeCompare(b.name))
    const subdirs: string[] = []
    for (const d of dirents) {
      if (d.isDirectory()) {
        if (!IGNORED_DIRS.has(d.name)) subdirs.push(join(dir, d.name))
      } else if (d.isFile()) {
        yield join(dir, d.name)
      }
    }
    stack.push(...subdirs.reverse())
  }
}

async function searchFolder(root: string, options: Extract<WorkRequest, { kind: 'search' }>['options'], include: string): Promise<SearchResponse> {
  const re = buildRegex(options)
  const matchesInclude = buildGlobFilter(include)
  const files: SearchFileResult[] = []
  let totalMatches = 0
  let filesScanned = 0
  let filesSkipped = 0
  let truncated = false

  for await (const path of walk(root)) {
    const relPath = toPosix(relative(root, path))
    if (matchesInclude && !matchesInclude(relPath)) continue
    if (filesScanned >= MAX_FILES_SCANNED) {
      truncated = true
      break
    }
    filesScanned++
    try {
      if ((await stat(path)).size > MAX_FILE_BYTES || (await looksBinary(path))) {
        filesSkipped++
        continue
      }
      const text = decodeText(await readFile(path)).content.replace(/\r\n/g, '\n')
      const matches = searchText(text, re, MAX_MATCHES - totalMatches)
      if (matches.length > 0) {
        files.push({ path, relPath, matches })
        totalMatches += matches.length
      }
      if (totalMatches >= MAX_MATCHES) {
        truncated = true
        break
      }
    } catch {
      filesSkipped++
    }
  }
  return { files, totalMatches, filesScanned, filesSkipped, truncated }
}

async function replaceInFiles(req: Extract<WorkRequest, { kind: 'replace' }>): Promise<ReplaceWorkResult> {
  const re = buildRegex(req.options)
  const result: ReplaceWorkResult = { filesChanged: 0, replacements: 0, errors: [], changed: [] }
  for (const target of req.paths) {
    const path = resolve(target)
    const label = toPosix(relative(req.root, path))
    try {
      // O tamanho é conferido antes de ler o arquivo.
      if ((await stat(path)).size > MAX_FILE_BYTES) throw new Error(req.binaryOrLarge)
      const buf = await readFile(path)
      if (buf.subarray(0, 8192).includes(0)) throw new Error(req.binaryOrLarge)
      const decoded = decodeText(buf)
      const replaced = replaceText(decoded.content.replace(/\r\n/g, '\n'), re, req.replacement, req.options.regex)
      if (replaced.count === 0) continue
      const out = decoded.eol === 'CRLF' ? replaced.text.replace(/\n/g, '\r\n') : replaced.text
      await writeFile(path, encodeText(out, decoded.encoding))
      result.filesChanged++
      result.replacements += replaced.count
      result.changed.push(`${path} (${replaced.count})`)
    } catch (err) {
      result.errors.push(`${label}: ${(err as Error).message}`)
    }
  }
  return result
}

parentPort?.on('message', (req: WorkRequest) => {
  const job: Promise<SearchResponse | ReplaceWorkResult> = req.kind === 'search' ? searchFolder(req.root, req.options, req.include) : replaceInFiles(req)
  job.then(
    (result) => parentPort!.postMessage({ ok: true, result }),
    (err: unknown) => parentPort!.postMessage({ ok: false, message: (err as Error).message })
  )
})
