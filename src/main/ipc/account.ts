import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import {
  IpcChannels,
  type AccountStatus,
  type AccountUser,
  type CloudFileContent,
  type CloudFileMeta,
  type CloudSaveResult
} from '@shared/ipc'
import { detectEol } from './textCodec'
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

const storePath = (): string => join(app.getPath('userData'), 'cloud.json')
const canRemember = (): boolean => safeStorage.isEncryptionAvailable()

async function persist(): Promise<void> {
  const data: Persisted = {
    serverUrl,
    tokenEnc: token && canRemember() ? safeStorage.encryptString(token).toString('base64') : null,
    user: token && canRemember() ? user : null
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
  try {
    const data = JSON.parse(await readFile(storePath(), 'utf8')) as Partial<Persisted>
    serverUrl = typeof data.serverUrl === 'string' ? data.serverUrl : null
    if (data.tokenEnc && canRemember()) {
      token = safeStorage.decryptString(Buffer.from(data.tokenEnc, 'base64'))
      user = data.user ?? null
    }
  } catch {
    /* sem dados ou ilegíveis: começa deslogado */
  }
}

const status = (): AccountStatus => ({ serverUrl, user: token ? user : null, rememberSession: canRemember() })

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
  }, 'Endereço inválido. Use https:// (ou http:// apenas para localhost).')

const emailSchema = z.string().trim().min(3).max(254)
const nameSchema = z.string().trim().min(1, 'Informe o nome.').max(100)
const passwordSchema = z.string().min(1).max(200)

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown
  ) {
    super(message)
  }
}

/** Chama a API. Com auth=true envia o token; 401 encerra a sessão local. */
async function api<T>(method: string, path: string, opts: { body?: unknown; auth?: boolean; allow?: number[] } = {}): Promise<T> {
  if (!serverUrl) throw new Error('Configure o endereço do servidor primeiro.')
  if (opts.auth && !token) throw new Error('Entre na sua conta para continuar.')
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
    throw new Error('Não foi possível conectar ao servidor. Verifique o endereço e a conexão.')
  }
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* resposta não-JSON */
  }
  if (res.ok || opts.allow?.includes(res.status)) return json as T

  const message = (json as { error?: { message?: string } } | null)?.error?.message
  if (res.status === 401 && opts.auth) {
    token = null
    user = null
    await persist()
    throw new ApiError('Sua sessão expirou. Entre novamente.', 401, json)
  }
  throw new ApiError(message ?? `O servidor respondeu com erro ${res.status}.`, res.status, json)
}

async function startSession(res: { token: string; user: AccountUser }): Promise<AccountStatus> {
  token = res.token
  user = { id: res.user.id, email: res.user.email, name: res.user.name }
  await persist()
  return status()
}

const toMeta = (f: CloudFileMeta): CloudFileMeta => ({ id: f.id, path: f.path, version: f.version, size: f.size, updatedAt: f.updatedAt })

export function registerAccountHandlers(): void {
  handle(IpcChannels.accountStatus, () => status())

  handle(IpcChannels.accountSetServer, async (_e, raw: unknown) => {
    const url = serverUrlSchema.parse(raw)
    if (url !== serverUrl) {
      serverUrl = url
      token = null // a sessão pertence ao servidor anterior
      user = null
      await persist()
    }
    return status()
  })

  handle(IpcChannels.accountRegister, async (_e, email: unknown, name: unknown, password: unknown) => {
    const body = { email: emailSchema.parse(email), name: nameSchema.parse(name), password: passwordSchema.parse(password) }
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
    const res = await api<{ user: AccountUser }>('PATCH', '/v1/me', { auth: true, body: { name: nameSchema.parse(name) } })
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

  handle(IpcChannels.cloudRead, async (_e, raw: unknown): Promise<CloudFileContent> => {
    const id = z.string().min(1).max(64).parse(raw)
    const res = await api<{ file: CloudFileMeta & { content: string; encoding: 'UTF-8' | 'UTF-8 BOM' } }>('GET', `/v1/files/${encodeURIComponent(id)}`, { auth: true })
    return { ...toMeta(res.file), content: res.file.content, encoding: res.file.encoding, eol: detectEol(res.file.content) }
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
    const res = await api<{ file?: CloudFileMeta; current?: CloudFileMeta }>('PUT', '/v1/files', { auth: true, body: req, allow: [409] })
    if (res.current && !res.file) return { ok: false, conflict: true, current: toMeta(res.current) }
    return { ok: true, file: toMeta(res.file!) }
  })

  handle(IpcChannels.cloudDelete, async (_e, raw: unknown) => {
    await api('DELETE', `/v1/files/${encodeURIComponent(z.string().min(1).max(64).parse(raw))}`, { auth: true })
  })
}
