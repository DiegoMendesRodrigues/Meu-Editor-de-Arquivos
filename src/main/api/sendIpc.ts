// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { BrowserWindow, dialog, type OpenDialogOptions, type WebContents } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { API_LIMITS } from '@shared/api/limits'
import { PICK_PURPOSES, sendInputSchema, type ApiPickPurpose, type ApiSendResult } from '@shared/api/protocol'
import { IpcChannels } from '@shared/ipc'
import { authorizeFile, authorizeMainOnlyFile, isAuthorized, isAuthorizedRoot, isInside } from '../ipc/access'
import { handle } from '../ipc/secure'
import { clearCookies, listCookies } from './cookies'
import { executeRequest } from './engine'
import { clearHistory, addHistory, listHistory } from './history'

/**
 * Canais do Cliente de API: envio, cancelamento, histórico, cookies, escolha de arquivos e gravação de
 * coleções. O cancelamento só vale para a janela que abriu o envio; tudo é abortado quando ela fecha ou recarrega.
 */

interface Running {
  owner: WebContents
  ac: AbortController
}

const running = new Map<string, Running>()
const watched = new WeakSet<WebContents>()

function abortOwned(owner: WebContents): void {
  for (const [id, r] of running) {
    if (r.owner === owner) {
      r.ac.abort()
      running.delete(id)
    }
  }
}

function watchOwner(owner: WebContents): void {
  if (watched.has(owner)) return
  watched.add(owner)
  owner.once('destroyed', () => abortOwned(owner))
  owner.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) abortOwned(owner)
  })
}

const countOf = (owner: WebContents): number => [...running.values()].filter((r) => r.owner === owner).length

const idSchema = z.string().uuid()
const jarSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/)

/** Nome de arquivo sugerido no diálogo "Salvar resposta": só o que é seguro em qualquer sistema. */
const safeFileName = (name: string): string => name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 80) || 'resposta'

async function askSavePath(owner: WebContents, requestName: string): Promise<string | undefined> {
  const win = BrowserWindow.fromWebContents(owner)
  const options = { defaultPath: safeFileName(requestName) }
  const r = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  return r.canceled || !r.filePath ? undefined : r.filePath
}

function hostOfUrl(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return '?'
  }
}

export function sendRequest(owner: WebContents, raw: unknown): Promise<ApiSendResult> {
  return (async (): Promise<ApiSendResult> => {
    const parsed = sendInputSchema.safeParse(raw)
    const rawId = typeof raw === 'object' && raw !== null ? (raw as { runId?: unknown }).runId : undefined
    if (!parsed.success) return { ok: false, runId: typeof rawId === 'string' ? rawId.slice(0, 64) : '', code: 'invalidRequest' }
    const input = parsed.data
    if (running.has(input.runId)) return { ok: false, runId: input.runId, code: 'invalidRequest' }
    if (countOf(owner) >= API_LIMITS.concurrentRequests) return { ok: false, runId: input.runId, code: 'tooManyRequests' }

    const ac = new AbortController()
    running.set(input.runId, { owner, ac })
    watchOwner(owner)
    try {
      let saveToPath: string | undefined
      if (input.saveToFile) {
        saveToPath = await askSavePath(owner, input.request.name || 'resposta')
        if (!saveToPath) return { ok: false, runId: input.runId, code: 'saveCancelled' }
      }
      const started = Date.now()
      const result = await executeRequest(input, { signal: ac.signal, saveToPath })
      const timeMs = result.ok ? result.timings.total : Date.now() - started
      // O log tem só método, host, status (ou código) e tempo; nunca caminho, cabeçalhos ou corpo.
      log.info(
        `API ${input.request.method} ${result.ok ? hostOfUrl(result.sentRequest.url) : hostOfUrl(input.request.url)} ${result.ok ? result.status : result.code} ${Math.round(timeMs)}ms`
      )
      if (result.ok || (result.code !== 'cancelled' && result.code !== 'productionNotConfirmed')) {
        await addHistory({
          request: input.request,
          status: result.ok ? result.status : undefined,
          timeMs: Math.round(timeMs),
          errorCode: result.ok ? undefined : result.code,
          environment: input.environment?.name
        }).catch(() => undefined)
      }
      return result
    } finally {
      running.delete(input.runId)
    }
  })()
}

const FILTERS: Record<ApiPickPurpose, Electron.FileFilter[]> = {
  body: [{ name: 'Todos os arquivos', extensions: ['*'] }],
  certificate: [{ name: 'Certificado', extensions: ['pem', 'crt', 'cer'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
  privateKey: [{ name: 'Chave privada', extensions: ['pem', 'key'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
  ca: [{ name: 'Certificado', extensions: ['pem', 'crt', 'cer'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
  pfx: [{ name: 'PKCS#12', extensions: ['pfx', 'p12'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
  data: [{ name: 'CSV / JSON', extensions: ['csv', 'json'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
  proto: [{ name: 'Protocol Buffers', extensions: ['proto'] }, { name: 'Todos os arquivos', extensions: ['*'] }],
  import: [
    { name: 'Coleções e requisições', extensions: ['json', 'yaml', 'yml', 'har', 'http', 'rest', 'txt', 'xml', 'wsdl'] },
    { name: 'Todos os arquivos', extensions: ['*'] }
  ]
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
// eslint-disable-next-line no-control-regex
const BAD_NAME_CHARS = /[<>:"|?*\u0000-\u001f]/

/** Divide e confere um caminho relativo: sem "..", sem caminho absoluto, sem nomes que o sistema recusa. */
export function safeSegments(relativePath: string): string[] {
  if (relativePath === '' || /^([/\\]|[A-Za-z]:)/.test(relativePath)) throw new Error('caminho inválido')
  const segments = relativePath.split(/[/\\]/)
  for (const seg of segments) {
    if (seg === '' || seg === '.' || seg === '..' || seg.length > 255 || BAD_NAME_CHARS.test(seg) || /[. ]$/.test(seg) || WINDOWS_RESERVED.test(seg)) throw new Error('caminho inválido')
  }
  return segments
}

/** Grava sem sobrescrever: se o arquivo existe, tenta "nome (2).ext", "nome (3).ext"... */
async function writeUnique(path: string, content: string): Promise<string> {
  const ext = extname(path)
  const stem = join(dirname(path), basename(path, ext))
  for (let n = 1; n < 1000; n++) {
    const target = n === 1 ? path : `${stem} (${n})${ext}`
    try {
      await writeFile(target, content, { encoding: 'utf8', flag: 'wx' })
      return target
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }
  }
  throw new Error('nomes esgotados')
}

const writeFilesSchema = z.object({
  dir: z.string().min(1).max(4096),
  files: z
    .array(z.object({ relativePath: z.string().min(1).max(1024), content: z.string().max(API_LIMITS.importChars) }))
    .max(5000)
})

/** Ancestral mais próximo que já existe (o próprio caminho, se existir). */
async function nearestExisting(path: string): Promise<string> {
  let current = path
  for (;;) {
    try {
      await stat(current)
      return current
    } catch {
      const parent = dirname(current)
      if (parent === current) return current
      current = parent
    }
  }
}

export async function writeCollectionFiles(raw: unknown): Promise<string[]> {
  const { dir, files } = writeFilesSchema.parse(raw)
  if (!isAuthorizedRoot(dir) && !(await isAuthorized(dir))) throw new Error('pasta não autorizada')
  // Confere todos os caminhos antes de gravar o primeiro.
  const planned = files.map((f) => ({ segments: safeSegments(f.relativePath), content: f.content }))
  const created: string[] = []
  for (const { segments, content } of planned) {
    const target = join(dir, ...segments)
    if (!isInside(dir, target)) throw new Error('caminho inválido')
    // Antes de criar pastas, o ancestral que já existe não pode sair da pasta autorizada por um link simbólico.
    const ancestor = await realpath(await nearestExisting(dirname(target)))
    if (!isInside(await realpath(dir), ancestor) || !(await isAuthorized(ancestor))) throw new Error('pasta não autorizada')
    await mkdir(dirname(target), { recursive: true })
    // Depois de criar as subpastas, confere de novo (links simbólicos não levam para fora da pasta autorizada).
    if (!(await isAuthorized(dirname(target)))) throw new Error('pasta não autorizada')
    created.push(await writeUnique(target, content))
  }
  return created
}

export function registerSendHandlers(): void {
  handle(IpcChannels.apiSend, (e, raw: unknown) => sendRequest(e.sender, raw))

  handle(IpcChannels.apiCancel, (e, rawId: unknown): void => {
    const id = idSchema.parse(rawId)
    const r = running.get(id)
    // Só quem abriu o envio pode cancelá-lo.
    if (r && r.owner === e.sender) r.ac.abort()
  })

  handle(IpcChannels.apiHistoryList, () => listHistory())
  handle(IpcChannels.apiHistoryClear, () => clearHistory())

  handle(IpcChannels.apiCookiesList, (_e, jar: unknown) => listCookies(jarSchema.parse(jar)))
  handle(IpcChannels.apiCookiesClear, (_e, jar: unknown, domain?: unknown, name?: unknown): void => {
    clearCookies(jarSchema.parse(jar), z.string().max(255).optional().parse(domain), z.string().max(256).optional().parse(name))
  })

  handle(IpcChannels.apiPickFiles, async (e, rawPurpose: unknown, rawMultiple?: unknown): Promise<string[]> => {
    const purpose = z.enum(PICK_PURPOSES).parse(rawPurpose)
    const multiple = z.boolean().optional().parse(rawMultiple) ?? false
    const options: OpenDialogOptions = { properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'], filters: FILTERS[purpose] }
    const win = BrowserWindow.fromWebContents(e.sender)
    const r = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (r.canceled) return []
    // Chaves e certificados: só o Main lê (o Renderer não recebe o conteúdo pelo readFile genérico).
    const mainOnly = purpose === 'certificate' || purpose === 'privateKey' || purpose === 'ca' || purpose === 'pfx'
    for (const p of r.filePaths) (mainOnly ? authorizeMainOnlyFile : authorizeFile)(p)
    return r.filePaths
  })

  handle(IpcChannels.apiWriteFiles, (_e, raw: unknown) => writeCollectionFiles(raw))
}
