// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, BrowserWindow, safeStorage } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import {
  IpcChannels,
  type AccountStatus,
  type AccountUser,
  type CloudFileContent,
  type CloudFileMeta,
  type CloudSaveResult,
  type CloudUsage,
  type CloudUsageChange
} from '@shared/ipc'
import { fromStoredText } from '@shared/eol'
import { detectEol } from './textCodec'
import type { MessageKey } from '@shared/i18n'
import { tm } from '../i18n'
import { handle } from './secure'

/**
 * Conta de usuário e sincronização com a API intermediária.
 * O token de sessão só existe aqui no Main (guardado cifrado pelo cofre do sistema,
 * quando disponível); o Renderer recebe apenas o estado da conta.
 */
const REQUEST_TIMEOUT_MS = 20_000

interface Persisted {
  serverUrl: string | null
  /** Token cifrado com safeStorage, em base64. */
  tokenEnc: string | null
  user: AccountUser | null
}

let serverUrl: string | null = null
let token: string | null = null
let user: AccountUser | null = null
/** Há cofre do sistema para lembrar a sessão? (consultado uma vez, na carga da conta) */
let rememberSession = false

const storePath = (): string => join(app.getPath('userData'), 'cloud.json')
/** No Linux, `basic_text`/`unknown` cifram com chave fixa (sem cofre real): nesse caso a sessão não é lembrada. */
async function canRemember(): Promise<boolean> {
  if (!(await safeStorage.isAsyncEncryptionAvailable())) return false
  if (process.platform === 'linux') {
    const backend = safeStorage.getSelectedStorageBackend()
    if (backend === 'basic_text' || backend === 'unknown') return false
  }
  return true
}

let persisting: Promise<void> = Promise.resolve()
/** Gravações em fila: nunca duas ao mesmo tempo no mesmo arquivo temporário. */
function persist(): Promise<void> {
  persisting = persisting.then(persistNow).catch(() => log.warn('Não foi possível cifrar a sessão da conta'))
  return persisting
}

async function persistNow(): Promise<void> {
  const remember = await canRemember().catch(() => false)
  rememberSession = remember
  const data: Persisted = {
    serverUrl,
    tokenEnc: token && remember ? (await safeStorage.encryptStringAsync(token)).toString('base64') : null,
    user: token && remember ? user : null
  }
  try {
    const tmp = `${storePath()}.tmp`
    await writeFile(tmp, JSON.stringify(data), 'utf8')
    await rename(tmp, storePath())
  } catch (err) {
    log.warn(`Não foi possível gravar os dados da conta: ${String(err)}`)
  }
}

export async function loadAccount(): Promise<void> {
  rememberSession = await canRemember().catch(() => false)
  try {
    const data = JSON.parse(await readFile(storePath(), 'utf8')) as Partial<Persisted>
    // O endereço gravado é revalidado (o arquivo pode ter sido editado): inválido, descarta.
    const savedUrl = serverUrlSchema.safeParse(data.serverUrl)
    serverUrl = savedUrl.success ? savedUrl.data : null
    if (data.tokenEnc && rememberSession && serverUrl) {
      // Os dados da API síncrona antiga são lidos normalmente pela assíncrona.
      token = (await safeStorage.decryptStringAsync(Buffer.from(data.tokenEnc, 'base64'))).result
      user = data.user ?? null
    }
  } catch {
    /* sem dados ou ilegíveis: começa deslogado */
  }
}

const status = (): AccountStatus => ({ serverUrl, user: token ? user : null, rememberSession })

/** HTTPS é obrigatório, exceto para o próprio computador (desenvolvimento). */
const serverUrlSchema = z
  .string()
  .trim()
  .max(300)
  .transform((s) => s.replace(/\/+$/, ''))
  .refine((s) => {
    try {
      const u = new URL(s)
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
      return u.protocol === 'https:' || (u.protocol === 'http:' && local)
    } catch {
      return false
    }
  }, { error: () => tm('acct.badUrl') })

const emailSchema = z.string().trim().min(3).max(254)
const nameSchema = z.string().trim().min(1, { error: () => tm('acct.nameRequired') }).max(100)

/** Valida e, se falhar, lança um Error só com a mensagem (sem o JSON técnico do zod). */
function check<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? tm('api.invalid_request'))
  return result.data
}

/** Códigos de erro da API que têm mensagem traduzida. */
const API_CODES = new Set(['invalid_request', 'email_in_use', 'invalid_credentials', 'too_many_attempts', 'wrong_password', 'invalid_token', 'not_found', 'too_large', 'internal', 'path_in_use', 'folder_not_empty', 'folder_in_use', 'plan_file_limit', 'plan_storage_limit', 'folder_limit'])
const passwordSchema = z.string().min(1).max(200)
/** Caminho na nuvem: relativo, com "/", sem "..", "." nem segmentos vazios. */
const cloudPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((p) => !p.includes('\\') && p.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..'))

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown
  ) {
    super(message)
  }
}

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const storageSchema = z.object({ storageBytes: count, storedFiles: count.optional() })
const usageSchema = storageSchema.extend({
  plan: z.object({ name: z.string().max(20), maxFiles: count, maxSizeMb: count }).nullish()
})

/** Respostas que trazem o uso da nuvem (salvar, excluir, sincronizar) atualizam o rodapé das janelas. */
function reportStorage(json: unknown): void {
  const parsed = storageSchema.safeParse(json)
  if (!parsed.success) return
  const change: CloudUsageChange = { storageBytes: parsed.data.storageBytes, storedFiles: parsed.data.storedFiles ?? null }
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(IpcChannels.cloudStorageChanged, change)
}

/** Chama a API. Com auth=true envia o token; 401 encerra a sessão local. */
async function api<T>(method: string, path: string, opts: { body?: unknown; auth?: boolean; allow?: number[] } = {}): Promise<T> {
  if (!serverUrl) throw new Error(tm('acct.needServer'))
  if (opts.auth && !token) throw new Error(tm('acct.needLogin'))
  const headers: Record<string, string> = {}
  if (opts.auth) headers.authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['content-type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${serverUrl}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: 'error'
    })
  } catch {
    throw new Error(tm('acct.cannotConnect'))
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* resposta não-JSON */
  }
  if (res.ok || opts.allow?.includes(res.status)) {
    reportStorage(json)
    return json as T
  }

  const error = (json as { error?: { code?: string; message?: string } } | null)?.error
  // Só mensagens conhecidas, traduzidas aqui: o texto vindo do servidor não aparece direto na interface.
  const message = error?.code && API_CODES.has(error.code) ? tm(`api.${error.code}` as MessageKey) : undefined
  if (res.status === 401 && opts.auth) {
    token = null
    user = null
    await persist()
    throw new ApiError(tm('acct.sessionExpired'), 401, json)
  }
  throw new ApiError(message ?? tm('acct.serverError', { status: res.status }), res.status, json)
}

async function startSession(res: { token: string; user: AccountUser }): Promise<AccountStatus> {
  token = res.token
  user = { id: res.user.id, email: res.user.email, name: res.user.name }
  await persist()
  return status()
}

const toMeta = (f: CloudFileMeta): CloudFileMeta => ({ id: f.id, path: f.path, version: f.version, size: f.size, updatedAt: f.updatedAt })

/* Leitura da nuvem para o Main (monitores): reaproveita api(), com o token que só existe aqui. */

/** Há conta conectada com sessão válida (até a próxima resposta 401)? */
export const isCloudSignedIn = (): boolean => !!serverUrl && !!token

export async function cloudListAll(): Promise<{ files: CloudFileMeta[]; folders: string[] }> {
  const res = await api<{ files: CloudFileMeta[] }>('GET', '/v1/files', { auth: true })
  const folders = await api<{ folders: string[] }>('GET', '/v1/folders', { auth: true })
  return { files: res.files.map(toMeta), folders: z.array(z.string().max(512)).parse(folders.folders) }
}

/** Conteúdo em texto de um arquivo da nuvem (como está guardado; só leitura). */
export async function cloudReadText(id: string): Promise<string> {
  const res = await api<{ file: { content: string } }>('GET', `/v1/files/${encodeURIComponent(z.string().min(1).max(64).parse(id))}`, { auth: true })
  return res.file.content
}

export function registerAccountHandlers(): void {
  handle(IpcChannels.accountStatus, () => status())

  handle(IpcChannels.accountSetServer, async (_e, raw: unknown) => {
    const url = check(serverUrlSchema, raw)
    if (url !== serverUrl) {
      serverUrl = url
      token = null // a sessão pertence ao servidor anterior
      user = null
      await persist()
    }
    return status()
  })

  handle(IpcChannels.accountRegister, async (_e, email: unknown, name: unknown, password: unknown) => {
    const body = { email: emailSchema.parse(email), name: check(nameSchema, name), password: passwordSchema.parse(password) }
    return startSession(await api('POST', '/v1/auth/register', { body }))
  })

  handle(IpcChannels.accountLogin, async (_e, email: unknown, password: unknown) => {
    const body = { email: emailSchema.parse(email), password: passwordSchema.parse(password) }
    return startSession(await api('POST', '/v1/auth/login', { body }))
  })

  handle(IpcChannels.accountLogout, async () => {
    if (token) await api('POST', '/v1/auth/logout', { auth: true }).catch(() => undefined) // sai localmente mesmo sem rede
    token = null
    user = null
    await persist()
    return status()
  })

  handle(IpcChannels.accountUpdateProfile, async (_e, name: unknown) => {
    const res = await api<{ user: AccountUser }>('PATCH', '/v1/me', { auth: true, body: { name: check(nameSchema, name) } })
    user = { id: res.user.id, email: res.user.email, name: res.user.name }
    await persist()
    return status()
  })

  handle(IpcChannels.accountChangePassword, async (_e, current: unknown, next: unknown) => {
    await api('POST', '/v1/me/password', {
      auth: true,
      body: { currentPassword: passwordSchema.parse(current), newPassword: passwordSchema.parse(next) }
    })
  })

  handle(IpcChannels.accountRequestReset, async (_e, email: unknown) => {
    await api('POST', '/v1/auth/password-reset/request', { body: { email: emailSchema.parse(email) } })
  })

  handle(IpcChannels.accountConfirmReset, async (_e, code: unknown, next: unknown) => {
    await api('POST', '/v1/auth/password-reset/confirm', {
      body: { token: z.string().trim().min(1).max(200).parse(code), newPassword: passwordSchema.parse(next) }
    })
  })

  handle(IpcChannels.cloudList, async (): Promise<CloudFileMeta[]> => {
    const res = await api<{ files: CloudFileMeta[] }>('GET', '/v1/files', { auth: true })
    return res.files.map(toMeta)
  })

  const readCloudFile = async (raw: unknown): Promise<CloudFileContent> => {
    const id = z.string().min(1).max(64).parse(raw)
    const res = await api<{ file: CloudFileMeta & { content: string; encoding: 'UTF-8' | 'UTF-8 BOM' } }>('GET', `/v1/files/${encodeURIComponent(id)}`, { auth: true })
    const eol = detectEol(res.file.content)
    return { ...toMeta(res.file), content: fromStoredText(res.file.content, eol), encoding: res.file.encoding, eol }
  }

  handle(IpcChannels.cloudRead, (_e, raw: unknown) => readCloudFile(raw))

  // Para a área de trabalho sincronizada: arquivo excluído em outro computador não é erro.
  handle(IpcChannels.cloudReadIfExists, async (_e, raw: unknown): Promise<CloudFileContent | null> => {
    try {
      return await readCloudFile(raw)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null
      throw err
    }
  })

  handle(IpcChannels.cloudSave, async (_e, raw: unknown): Promise<CloudSaveResult> => {
    const req = z
      .object({
        path: z.string().min(1).max(512),
        content: z.string(),
        encoding: z.enum(['UTF-8', 'UTF-8 BOM']),
        baseVersion: z.number().int().min(0).nullable(),
        force: z.boolean()
      })
      .parse(raw)
    let res: { file?: CloudFileMeta; current?: CloudFileMeta }
    try {
      res = await api<{ file?: CloudFileMeta; current?: CloudFileMeta }>('PUT', '/v1/files', { auth: true, body: req, allow: [409] })
    } catch (err) {
      // Limite do plano atingido: o Renderer mostra o aviso próprio em vez de um erro genérico.
      const code = err instanceof ApiError && err.status === 403 ? (err.body as { error?: { code?: string } } | null)?.error?.code : undefined
      if (code === 'plan_file_limit') return { ok: false, limit: 'files' }
      if (code === 'plan_storage_limit') return { ok: false, limit: 'storage' }
      throw err
    }
    if (res.current && !res.file) return { ok: false, conflict: true, current: toMeta(res.current) }
    return { ok: true, file: toMeta(res.file!) }
  })

  handle(IpcChannels.cloudDelete, async (_e, raw: unknown) => {
    await api('DELETE', `/v1/files/${encodeURIComponent(z.string().min(1).max(64).parse(raw))}`, { auth: true })
  })

  handle(IpcChannels.cloudMove, async (_e, rawId: unknown, rawPath: unknown): Promise<CloudFileMeta> => {
    const id = z.string().min(1).max(64).parse(rawId)
    const path = cloudPathSchema.parse(rawPath)
    const res = await api<{ file: CloudFileMeta }>('PATCH', `/v1/files/${encodeURIComponent(id)}`, { auth: true, body: { path } })
    return toMeta(res.file)
  })

  handle(IpcChannels.workspaceGet, async () => {
    const res = await api<{ data: string | null; version: number }>('GET', '/v1/workspace', { auth: true })
    return z.object({ data: z.string().nullable(), version: z.number().int().min(0) }).parse({ data: res.data, version: res.version })
  })

  handle(IpcChannels.workspacePut, async (_e, rawData: unknown, rawVersion: unknown) => {
    const data = z.string().max(10 * 1024 * 1024).parse(rawData)
    const baseVersion = z.number().int().min(0).parse(rawVersion)
    const res = await api<{ version?: number }>('PUT', '/v1/workspace', { auth: true, body: { data, baseVersion }, allow: [409] })
    return typeof res.version === 'number' ? { ok: true as const, version: res.version } : { ok: false as const }
  })

  handle(IpcChannels.cloudFolders, async (): Promise<string[]> => {
    const res = await api<{ folders: string[] }>('GET', '/v1/folders', { auth: true })
    return z.array(z.string().max(512)).parse(res.folders)
  })

  handle(IpcChannels.cloudCreateFolder, async (_e, raw: unknown) => {
    await api('POST', '/v1/folders', { auth: true, body: { path: cloudPathSchema.parse(raw) } })
  })

  handle(IpcChannels.cloudStorage, async (): Promise<CloudUsage> => {
    const res = usageSchema.parse(await api<unknown>('GET', '/v1/me/storage', { auth: true }))
    return { storageBytes: res.storageBytes, storedFiles: res.storedFiles ?? null, plan: res.plan ?? null }
  })

  handle(IpcChannels.cloudDeleteFolder, async (_e, raw: unknown) => {
    await api('DELETE', `/v1/folders?path=${encodeURIComponent(cloudPathSchema.parse(raw))}`, { auth: true })
  })

  handle(IpcChannels.cloudRenameFolder, async (_e, rawFrom: unknown, rawTo: unknown) => {
    const body = { from: cloudPathSchema.parse(rawFrom), to: cloudPathSchema.parse(rawTo) }
    await api('PATCH', '/v1/folders', { auth: true, body })
  })
}
