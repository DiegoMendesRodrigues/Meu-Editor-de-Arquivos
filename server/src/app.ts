// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Store, User } from './db/store.js'
import { hashPassword, hashToken, newToken, verifyPassword } from './security.js'

export interface Mailer {
  /** Envia o e-mail de redefinição de senha. Em produção, ligue a um serviço de e-mail real. */
  sendPasswordReset(to: string, token: string): Promise<void>
}

export interface AppOptions {
  store: Store
  mailer: Mailer
  sessionDays?: number
  resetMinutes?: number
  /** Tentativas de login com erro permitidas por janela (por IP + e-mail). */
  loginAttempts?: number
  loginWindowMs?: number
  /** Requisições às rotas de conta (cadastro, login, recuperação de senha) permitidas por IP e por janela. */
  authRequestsPerWindow?: number
  /** Confiar no cabeçalho X-Forwarded-For (só atrás de um proxy reverso de confiança). */
  trustProxy?: boolean
  logger?: boolean
}

const MAX_FILE_BYTES = 10 * 1024 * 1024

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const passwordSchema = z.string().min(10, 'A senha deve ter ao menos 10 caracteres.').max(200)
const nameSchema = z.string().trim().min(1, 'Informe o nome.').max(100)

/** Caminho lógico do arquivo na nuvem: relativo, com "/", sem "..". */
const cloudPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (p) =>
      !p.startsWith('/') &&
      !p.includes('\\') &&
      // eslint-disable-next-line no-control-regex
      !/[\u0000-\u001f]/.test(p) &&
      p.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..'),
    'Caminho inválido.'
  )

const registerSchema = z.object({ email: emailSchema, name: nameSchema, password: passwordSchema })
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) })
const profileSchema = z.object({ name: nameSchema })
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema })
const resetRequestSchema = z.object({ email: emailSchema })
const resetConfirmSchema = z.object({ token: z.string().min(10).max(200), newPassword: passwordSchema })
const putFileSchema = z.object({
  path: cloudPathSchema,
  content: z.string(),
  encoding: z.enum(['UTF-8', 'UTF-8 BOM']),
  baseVersion: z.number().int().min(0).nullable(),
  force: z.boolean().default(false)
})

class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
  }
}

const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt.toISOString() })

const fileMeta = (f: { id: string; path: string; encoding: string; version: number; size: number; updatedAt: Date }) => ({
  id: f.id,
  path: f.path,
  encoding: f.encoding,
  version: f.version,
  size: f.size,
  updatedAt: f.updatedAt.toISOString()
})

declare module 'fastify' {
  interface FastifyRequest {
    user?: User
    tokenHash?: string
  }
}

export function buildApp(opts: AppOptions): FastifyInstance {
  const { store, mailer } = opts
  const sessionMs = (opts.sessionDays ?? 30) * 24 * 3600 * 1000
  const resetMs = (opts.resetMinutes ?? 30) * 60 * 1000
  const maxAttempts = opts.loginAttempts ?? 5
  const windowMs = opts.loginWindowMs ?? 15 * 60 * 1000

  const maxAuthRequests = opts.authRequestsPerWindow ?? 30

  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: MAX_FILE_BYTES + 1024 * 1024, trustProxy: opts.trustProxy ?? false })

  // Cabeçalhos de segurança: a API só devolve JSON, que não deve ser interpretado nem guardado em cache.
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Cache-Control', 'no-store')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('X-Frame-Options', 'DENY')
  })

  // Padrão de erro: { error: { code, message } }, sem detalhes internos.
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } })
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: { code: 'invalid_request', message: err.issues[0]?.message ?? 'Dados inválidos.' } })
    }
    const status = (err as { statusCode?: number }).statusCode
    if (status && status < 500) return reply.status(status).send({ error: { code: 'bad_request', message: 'Requisição inválida.' } })
    req.log.error(err)
    return reply.status(500).send({ error: { code: 'internal', message: 'Erro interno do servidor.' } })
  })

  // Contadores por janela de tempo: erros de login (por IP + e-mail) e uso das rotas de conta (por IP).
  const failures = new Map<string, { count: number; resetAt: number }>()
  const authRequests = new Map<string, { count: number; resetAt: number }>()
  const attemptKey = (req: FastifyRequest, email: string): string => `${req.ip}|${email}`
  const over = (map: Map<string, { count: number; resetAt: number }>, key: string, limit: number): boolean => {
    const f = map.get(key)
    if (!f) return false
    if (f.resetAt < Date.now()) {
      map.delete(key)
      return false
    }
    return f.count >= limit
  }
  const count = (map: Map<string, { count: number; resetAt: number }>, key: string): void => {
    const f = map.get(key)
    if (!f || f.resetAt < Date.now()) map.set(key, { count: 1, resetAt: Date.now() + windowMs })
    else f.count++
  }
  const blocked = (key: string): boolean => over(failures, key, maxAttempts)
  const fail = (key: string): void => count(failures, key)
  const tooMany = (): HttpError => new HttpError(429, 'too_many_attempts', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.')
  /** Limite por IP nas rotas de conta: segura cadastros em massa, envio de e-mails e tentativas com vários e-mails. */
  const limitAuth = async (req: FastifyRequest): Promise<void> => {
    if (over(authRequests, req.ip, maxAuthRequests)) throw tooMany()
    count(authRequests, req.ip)
  }
  const authLimited = { preHandler: limitAuth }

  // Limpa os contadores vencidos (sem isso, a memória cresceria com cada IP/e-mail novo).
  const prune = setInterval(() => {
    const now = Date.now()
    for (const map of [failures, authRequests]) for (const [key, f] of map) if (f.resetAt < now) map.delete(key)
  }, 60_000)
  prune.unref()
  app.addHook('onClose', async () => clearInterval(prune))

  async function issueSession(userId: string): Promise<string> {
    const token = newToken()
    await store.createSession(userId, hashToken(token), new Date(Date.now() + sessionMs))
    return token
  }

  async function authenticate(req: FastifyRequest): Promise<void> {
    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const unauthorized = new HttpError(401, 'unauthorized', 'Sessão inválida ou expirada. Entre novamente.')
    if (!token) throw unauthorized
    const tokenHash = hashToken(token)
    const session = await store.findSession(tokenHash)
    if (!session || session.expiresAt.getTime() < Date.now()) {
      if (session) await store.deleteSession(tokenHash)
      throw unauthorized
    }
    const user = await store.findUserById(session.userId)
    if (!user) throw unauthorized
    req.user = user
    req.tokenHash = tokenHash
  }
  const auth = { preHandler: authenticate }

  // Hash "falso" para gastar o mesmo tempo quando o e-mail não existe (evita enumerar contas pelo tempo de resposta).
  const dummyHash = hashPassword('senha-que-nunca-sera-usada')

  app.get('/v1/health', async () => ({ ok: true }))

  app.post('/v1/auth/register', authLimited, async (req, reply: FastifyReply) => {
    const body = registerSchema.parse(req.body)
    const user = await store.createUser({ email: body.email, name: body.name, passwordHash: await hashPassword(body.password) })
    if (!user) throw new HttpError(409, 'email_in_use', 'Já existe uma conta com este e-mail.')
    const token = await issueSession(user.id)
    return reply.status(201).send({ token, user: publicUser(user) })
  })

  app.post('/v1/auth/login', authLimited, async (req) => {
    const body = loginSchema.parse(req.body)
    const key = attemptKey(req, body.email)
    if (blocked(key)) throw tooMany()
    const user = await store.findUserByEmail(body.email)
    const ok = await verifyPassword(body.password, user?.passwordHash ?? (await dummyHash))
    if (!user || !ok) {
      fail(key)
      throw new HttpError(401, 'invalid_credentials', 'E-mail ou senha incorretos.')
    }
    failures.delete(key)
    return { token: await issueSession(user.id), user: publicUser(user) }
  })

  app.post('/v1/auth/logout', auth, async (req, reply) => {
    await store.deleteSession(req.tokenHash!)
    return reply.status(204).send()
  })

  // Recuperar senha: a resposta é sempre a mesma, exista ou não a conta.
  app.post('/v1/auth/password-reset/request', authLimited, async (req, reply) => {
    const body = resetRequestSchema.parse(req.body)
    const user = await store.findUserByEmail(body.email)
    if (user) {
      const token = newToken()
      await store.createReset(user.id, hashToken(token), new Date(Date.now() + resetMs))
      await mailer.sendPasswordReset(user.email, token).catch((err) => req.log.error(err))
    }
    return reply.status(202).send({ ok: true })
  })

  app.post('/v1/auth/password-reset/confirm', authLimited, async (req, reply) => {
    const body = resetConfirmSchema.parse(req.body)
    const userId = await store.consumeReset(hashToken(body.token))
    if (!userId) throw new HttpError(400, 'invalid_token', 'Código inválido ou expirado.')
    await store.setPassword(userId, await hashPassword(body.newPassword))
    await store.deleteSessionsExcept(userId, null) // quem tinha a senha antiga é desconectado
    return reply.status(204).send()
  })

  app.get('/v1/me', auth, async (req) => ({ user: publicUser(req.user!) }))

  // Espaço usado na nuvem (bytes): arquivos + textos não salvos da área de trabalho.
  /**
   * Recalcula o espaço usado depois de uma gravação. Uma falha aqui (banco sem a coluna nova, por exemplo)
   * não pode transformar uma gravação já feita em erro: registra no log e responde sem o total.
   */
  const refreshStorage = async (userId: string): Promise<number | undefined> => {
    try {
      return await store.refreshStorageBytes(userId)
    } catch (err) {
      app.log.error({ err }, 'Falha ao recalcular o espaço usado na nuvem')
      return undefined
    }
  }

  app.get('/v1/me/storage', auth, async (req) => ({ storageBytes: await store.getStorageBytes(req.user!.id) }))

  app.patch('/v1/me', auth, async (req) => {
    const body = profileSchema.parse(req.body)
    await store.updateUserName(req.user!.id, body.name)
    return { user: publicUser({ ...req.user!, name: body.name }) }
  })

  app.post('/v1/me/password', auth, async (req, reply) => {
    const body = changePasswordSchema.parse(req.body)
    if (!(await verifyPassword(body.currentPassword, req.user!.passwordHash))) {
      throw new HttpError(403, 'wrong_password', 'A senha atual está incorreta.')
    }
    await store.setPassword(req.user!.id, await hashPassword(body.newPassword))
    await store.deleteSessionsExcept(req.user!.id, req.tokenHash!) // os outros computadores precisam entrar de novo
    return reply.status(204).send()
  })

  app.get('/v1/files', auth, async (req) => ({ files: (await store.listFiles(req.user!.id)).map(fileMeta) }))

  app.get('/v1/files/:id', auth, async (req) => {
    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(req.params)
    const file = await store.getFile(req.user!.id, id)
    if (!file) throw new HttpError(404, 'not_found', 'Arquivo não encontrado.')
    return { file: { ...fileMeta(file), content: file.content } }
  })

  app.put('/v1/files', auth, async (req, reply) => {
    const body = putFileSchema.parse(req.body)
    if (Buffer.byteLength(body.content, 'utf8') > MAX_FILE_BYTES) {
      throw new HttpError(413, 'too_large', 'O arquivo passa de 10 MB.')
    }
    const result = await store.upsertFile(req.user!.id, body)
    if (!result.ok) {
      return reply.status(409).send({
        error: { code: 'conflict', message: 'A versão na nuvem mudou desde a sua última sincronização.' },
        current: fileMeta(result.current)
      })
    }
    return { file: fileMeta(result.file), storageBytes: await refreshStorage(req.user!.id) }
  })

  // Mover ou renomear: muda o caminho do arquivo (pasta e/ou nome).
  app.patch('/v1/files/:id', auth, async (req) => {
    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(req.params)
    const body = z.object({ path: cloudPathSchema }).parse(req.body)
    const result = await store.moveFile(req.user!.id, id, body.path)
    if (!result.ok && result.reason === 'not_found') throw new HttpError(404, 'not_found', 'Arquivo não encontrado.')
    if (!result.ok) throw new HttpError(409, 'path_in_use', 'Já existe um arquivo com este nome nesta pasta.')
    return { file: fileMeta(result.file) }
  })

  // Área de trabalho (abas e textos não salvos) sincronizada entre os computadores do usuário.
  app.get('/v1/workspace', auth, async (req) => {
    const w = await store.getWorkspace(req.user!.id)
    return w ? { data: w.data, version: w.version, updatedAt: w.updatedAt.toISOString() } : { data: null, version: 0, updatedAt: null }
  })

  app.put('/v1/workspace', auth, async (req) => {
    const body = z.object({ data: z.string().max(MAX_FILE_BYTES), baseVersion: z.number().int().min(0) }).parse(req.body)
    if (Buffer.byteLength(body.data, 'utf8') > MAX_FILE_BYTES) throw new HttpError(413, 'too_large', 'O arquivo passa de 10 MB.')
    const result = await store.putWorkspace(req.user!.id, body.data, body.baseVersion)
    if (!result.ok) throw new HttpError(409, 'workspace_conflict', 'A área de trabalho mudou em outro computador.')
    return {
      version: result.workspace.version,
      updatedAt: result.workspace.updatedAt.toISOString(),
      storageBytes: await refreshStorage(req.user!.id)
    }
  })

  app.get('/v1/folders', auth, async (req) => ({ folders: await store.listFolders(req.user!.id) }))

  app.post('/v1/folders', auth, async (req, reply) => {
    const body = z.object({ path: cloudPathSchema }).parse(req.body)
    const user = req.user!.id
    // Cria também as pastas acima (a/b/c cria a e a/b), para a árvore ficar completa.
    const parts = body.path.split('/')
    for (let i = 1; i <= parts.length; i++) await store.createFolder(user, parts.slice(0, i).join('/'))
    return reply.status(201).send({ path: body.path })
  })

  app.delete('/v1/folders', auth, async (req, reply) => {
    const { path } = z.object({ path: cloudPathSchema }).parse(req.query)
    const result = await store.deleteFolder(req.user!.id, path)
    if (result === 'not_found') throw new HttpError(404, 'not_found', 'Pasta não encontrada.')
    if (result === 'not_empty') throw new HttpError(409, 'folder_not_empty', 'A pasta não está vazia.')
    return reply.status(204).send()
  })

  app.delete('/v1/files/:id', auth, async (req) => {
    const { id } = z.object({ id: z.string().min(1).max(64) }).parse(req.params)
    if (!(await store.deleteFile(req.user!.id, id))) throw new HttpError(404, 'not_found', 'Arquivo não encontrado.')
    return { storageBytes: await refreshStorage(req.user!.id) }
  })

  return app
}
