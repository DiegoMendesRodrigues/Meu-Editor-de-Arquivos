// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { open, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import log from 'electron-log/main'
import { z } from 'zod'
import {
  IpcChannels,
  type ReplaceResponse,
  type SearchFileResult,
  type SearchResponse
} from '@shared/ipc'
import { buildGlobFilter, buildRegex, replaceText, searchText } from '@shared/search'
import { assertAuthorized, isInside } from './access'
import { decodeText, encodeText } from './textCodec'
import { tm } from '../i18n'
import { handle } from './secure'

/** Limites para manter a interface responsiva em pastas grandes. */
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_MATCHES = 5000
const MAX_FILES_SCANNED = 20000

/** Pastas que quase nunca interessam numa busca (dependências, controle de versão, builds). */
const IGNORED_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', 'out', 'dist', 'build', '.next', '.cache', '__pycache__'])

const requestSchema = z.object({
  folder: z.string().min(1),
  include: z.string().max(500),
  query: z.string().min(1).max(2000),
  caseSensitive: z.boolean(),
  wholeWord: z.boolean(),
  regex: z.boolean()
})
const replaceSchema = requestSchema.extend({
  replacement: z.string().max(10000),
  paths: z.array(z.string().min(1)).max(MAX_FILES_SCANNED)
})

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

async function searchFolder(raw: unknown): Promise<SearchResponse> {
  const req = requestSchema.parse(raw)
  const root = await assertAuthorized(req.folder)
  const re = buildRegex(req, tm)
  const matchesInclude = buildGlobFilter(req.include)

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

async function replaceInFiles(raw: unknown): Promise<ReplaceResponse> {
  const req = replaceSchema.parse(raw)
  const root = await assertAuthorized(req.folder)
  const re = buildRegex(req, tm)
  const result: ReplaceResponse = { filesChanged: 0, replacements: 0, errors: [] }

  for (const target of req.paths) {
    const path = resolve(target)
    const label = toPosix(relative(root, path))
    try {
      // Só arquivos dentro da pasta pesquisada (e autorizados, inclusive após resolver links).
      if (!isInside(root, path)) throw new Error(tm('err.outsideFolder'))
      await assertAuthorized(path)
      const buf = await readFile(path)
      if ((await stat(path)).size > MAX_FILE_BYTES || buf.subarray(0, 8192).includes(0)) throw new Error(tm('err.binaryOrLarge'))
      const decoded = decodeText(buf)
      const replaced = replaceText(decoded.content.replace(/\r\n/g, '\n'), re, req.replacement, req.regex)
      if (replaced.count === 0) continue
      const out = decoded.eol === 'CRLF' ? replaced.text.replace(/\n/g, '\r\n') : replaced.text
      await writeFile(path, encodeText(out, decoded.encoding))
      result.filesChanged++
      result.replacements += replaced.count
      log.info(`Substituição aplicada: ${path} (${replaced.count})`)
    } catch (err) {
      result.errors.push(`${label}: ${(err as Error).message}`)
    }
  }
  return result
}

export function registerSearchHandlers(): void {
  handle(IpcChannels.searchFolder, (_e, raw: unknown) => searchFolder(raw))
  handle(IpcChannels.replaceInFiles, (_e, raw: unknown) => replaceInFiles(raw))
}
