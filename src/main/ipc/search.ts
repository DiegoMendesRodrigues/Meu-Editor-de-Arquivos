// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { resolve } from 'node:path'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels, type ReplaceResponse, type SearchResponse } from '@shared/ipc'
import { buildRegex } from '@shared/search'
import { assertAuthorized, isInside } from './access'
import { tm } from '../i18n'
import { handle } from './secure'
import createSearchWorker from './searchWorker?nodeWorker'
import { MAX_FILES_SCANNED, type ReplaceWorkResult, type WorkRequest } from './searchTypes'

/** Tempo máximo de uma busca ou substituição (protege contra expressões regulares muito custosas). */
const TIMEOUT_MS = 60_000

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

/** Executa o trabalho numa thread própria, encerrada ao terminar ou ao passar do tempo limite. */
function runInWorker<T>(req: WorkRequest): Promise<T> {
  return new Promise((done, fail) => {
    const worker = createSearchWorker({})
    const finish = (): void => {
      clearTimeout(timer)
      void worker.terminate()
    }
    const timer = setTimeout(() => {
      finish()
      fail(new Error(tm('err.searchTimeout')))
    }, TIMEOUT_MS)
    worker.once('message', (msg: { ok: true; result: T } | { ok: false; message: string }) => {
      finish()
      if (msg.ok) done(msg.result)
      else fail(new Error(msg.message))
    })
    worker.once('error', (err) => {
      finish()
      fail(err)
    })
    worker.postMessage(req)
  })
}

async function searchFolder(raw: unknown): Promise<SearchResponse> {
  const req = requestSchema.parse(raw)
  const root = await assertAuthorized(req.folder)
  buildRegex(req, tm) // valida a expressão aqui, com a mensagem de erro no idioma do usuário
  return runInWorker<SearchResponse>({ kind: 'search', root, options: req, include: req.include })
}

async function replaceInFiles(raw: unknown): Promise<ReplaceResponse> {
  const req = replaceSchema.parse(raw)
  const root = await assertAuthorized(req.folder)
  buildRegex(req, tm)
  // Só arquivos dentro da pasta pesquisada e autorizados (inclusive após resolver links).
  const errors: string[] = []
  const paths: string[] = []
  for (const target of req.paths) {
    const path = resolve(target)
    try {
      if (!isInside(root, path)) throw new Error(tm('err.outsideFolder'))
      paths.push(await assertAuthorized(path))
    } catch (err) {
      errors.push(`${path}: ${(err as Error).message}`)
    }
  }
  const result = await runInWorker<ReplaceWorkResult>({
    kind: 'replace',
    root,
    options: req,
    replacement: req.replacement,
    paths,
    binaryOrLarge: tm('err.binaryOrLarge')
  })
  for (const line of result.changed) log.info(`Substituição aplicada: ${line}`)
  return { filesChanged: result.filesChanged, replacements: result.replacements, errors: [...errors, ...result.errors] }
}

export function registerSearchHandlers(): void {
  handle(IpcChannels.searchFolder, (_e, raw: unknown) => searchFolder(raw))
  handle(IpcChannels.replaceInFiles, (_e, raw: unknown) => replaceInFiles(raw))
}
