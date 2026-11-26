// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest, type FastifyServerOptions } from 'fastify'
import { isIP } from 'node:net'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { applyStripeEvent, verifyStripeSignature } from './billing.js'
import { APP_LOCALES, type Store, type Subscription, type User } from './db/store.js'
import { DEFAULT_SITE_URL, EXPIRY_NOTICE_MS, daysLeft, sendPlanExpiryEmails } from './expiry.js'
import { hashPassword, hashToken, newToken, verifyPassword } from './security.js'

export interface Mailer {
  /** Envia o e-mail de redefinição de senha. Em produção, ligue a um serviço de e-mail real. */
  sendPasswordReset(to: string, token: string): Promise<void>
  /** E-mail de "plano perto de expirar" (texto já no idioma do usuário). Sem ele, o aviso por e-mail fica desligado. */
  sendPlanExpiring?(to: string, mail: { subject: string; text: string }): Promise<void>
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
  /**
   * Confiar no cabeçalho X-Forwarded-For (só atrás de um proxy reverso de confiança): true (todos os proxies),
   * número de saltos ou lista de IPs/CIDRs dos proxies de confiança.
   */
  trustProxy?: boolean | number | string[]
  logger?: boolean
  /** Chave que o site envia (X-Site-Key) para cadastrar usuários e consultar assinaturas. Sem ela, essas rotas ficam desligadas. */
  siteKey?: string
  /** Segredo do endpoint de webhook da Stripe (whsec_...). Sem ele, o webhook fica desligado. */
  stripeWebhookSecret?: string
  /** Tolerância para a renovação chegar depois de nextPaymentAt antes de voltar ao Gratuito (padrão: 2 dias). */
  subscriptionGraceMs?: number
  /** Endereço do site (links dos e-mails para a página de gestão da assinatura). */
  siteUrl?: string
  /**
   * POST /v1/auth/register (cadastro direto na API). O aplicativo não cria contas (isso é feito no site), então em
   * produção fica desligado (ALLOW_REGISTER=true liga, para servidores próprios); testes usam o padrão (ligado).
   */
  allowRegister?: boolean
}

const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Pastas por usuário e profundidade máxima de uma pasta. */
const MAX_FOLDERS = 2000
const MAX_FOLDER_DEPTH = 32

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
      // Sem espaços nas pontas dos nomes: o banco ignora espaços finais ao comparar e trataria nomes diferentes como iguais.
      p.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..' && seg.trim() === seg),
    'Caminho inválido.'
  )
  // Mesma forma Unicode (NFC) para o mesmo nome digitado em sistemas diferentes.
  .transform((p) => p.normalize('NFC'))

const registerSchema = z.object({ email: emailSchema, name: nameSchema, password: passwordSchema })
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(200) })
const profileSchema = z.object({ name: nameSchema })
const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema })
const resetRequestSchema = z.object({ email: emailSchema })
const resetConfirmSchema = z.object({ token: z.string().min(10).max(200), newPassword: passwordSchema })
/** Cadastro feito pelo site (página de planos): plano escolhido e, nos pagos, o período da assinatura. */
const siteSignupSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: z.string().min(1).max(200),
  plan: z.number().int().min(1).max(1000),
  period: z.enum(['mensal', 'semestral', 'anual']).optional()
})
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

/** Assinatura para o site (inclui os ids da Stripe; só nas rotas com X-Site-Key). */
const siteSubscription = (s: Subscription) => ({
  ...publicSubscription(s),
  stripeCustomerId: s.stripeCustomerId,
  stripeSubscriptionId: s.stripeSubscriptionId
})

const publicSubscription = (s: Subscription) => ({
  plan: { id: s.usersGroupsId, name: s.planName },
  period: s.period,
  status: s.status,
  active: s.active,
  lastPaymentAt: s.lastPaymentAt?.toISOString() ?? null,
  nextPaymentAt: s.nextPaymentAt?.toISOString() ?? null
})

/** Comparação de textos em tempo constante (chave do site). */
const sameSecret = (a: string, b: string): boolean => {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  return x.length === y.length && timingSafeEqual(x, y)
}

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

  // Corpo pequeno por padrão; só as rotas que gravam arquivos aceitam até 10 MB (fileBody).
  const app = Fastify({
    logger: opts.logger
      ? {
          // O log não guarda a query string (nomes de pastas e arquivos são dados do usuário).
          serializers: {
            req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url.split('?')[0] })
          }
        }
      : false,
    bodyLimit: 64 * 1024,
    trustProxy: opts.trustProxy ?? false
  } as FastifyServerOptions)
  const fileBody = { bodyLimit: MAX_FILE_BYTES * 2 + 1024 * 1024 }

  // Cabeçalhos de segurança: a API só devolve JSON, que não deve ser interpretado nem guardado em cache.
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Cache-Control', 'no-store')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Strict-Transport-Security', 'max-age=31536000')
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
  // Erros de login por e-mail, de qualquer IP: segura tentativas distribuídas (ou com IP forjado) contra uma conta.
  const emailFailures = new Map<string, { count: number; resetAt: number }>()
  const resetRequests = new Map<string, { count: number; resetAt: number }>()
  const siteRequests = new Map<string, { count: number; resetAt: number }>()
  const manageLinks = new Map<string, { count: number; resetAt: number }>()
  const blocked = (key: string, email: string): boolean => over(failures, key, maxAttempts) || over(emailFailures, email, maxAttempts * 4)
  const fail = (key: string, email: string): void => {
    count(failures, key)
    count(emailFailures, email)
  }
  const tooMany = (): HttpError => new HttpError(429, 'too_many_attempts', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.')
  /** Limite por IP nas rotas de conta: segura cadastros em massa, envio de e-mails e tentativas com vários e-mails. */
  const limitAuth = async (req: FastifyRequest): Promise<void> => {
    if (over(authRequests, req.ip, maxAuthRequests)) throw tooMany()
    count(authRequests, req.ip)
  }
  // onRequest: o limite vale antes de ler o corpo da requisição.
  const authLimited = { onRequest: limitAuth }

  // Limpa os contadores vencidos (sem isso, a memória cresceria com cada IP/e-mail novo).
  const prune = setInterval(() => {
    const now = Date.now()
    for (const map of [failures, authRequests, emailFailures, resetRequests, siteRequests, manageLinks]) for (const [key, f] of map) if (f.resetAt < now) map.delete(key)
    for (const [id, at] of lastTouch) if (now - at > 60_000) lastTouch.delete(id)
  }, 60_000)
  prune.unref()
  app.addHook('onClose', async () => clearInterval(prune))

  // Sessões e códigos de redefinição vencidos saem do banco de hora em hora; no mesmo passo, quem passou do
  // fim do período pago sem renovar volta ao plano Gratuito.
  const graceMs = opts.subscriptionGraceMs ?? 2 * 24 * 3600 * 1000
  const purge = setInterval(() => {
    const now = new Date()
    store.purgeExpired(now).catch((err) => app.log.error({ err }, 'Falha ao remover sessões vencidas'))
    store
      .expireSubscriptions(now, graceMs)
      .then((n) => n > 0 && app.log.info({ n }, 'Assinaturas encerradas: plano Gratuito'))
      .catch((err) => app.log.error({ err }, 'Falha ao encerrar assinaturas vencidas'))
      // Depois do encerramento: contas sem plano pago e sem acesso além do prazo do plano anterior perdem os arquivos.
      .then(() => store.purgeInactiveUsers(new Date()))
      .then((n) => n > 0 && app.log.info(`Limpeza por inatividade: arquivos apagados de ${n} conta(s)`))
      .catch((err) => app.log.error({ err }, 'Falha na limpeza por inatividade'))
    // Planos que não renovam e terminam em até 2 dias: e-mail com o link da página de gestão da assinatura.
    sendPlanExpiryEmails(store, opts.mailer, app.log, now, opts.siteUrl ?? DEFAULT_SITE_URL)
      .then((n) => n > 0 && app.log.info(`Avisos de plano perto de expirar enviados por e-mail: ${n}`))
      .catch((err) => app.log.error({ err }, 'Falha nos avisos de plano perto de expirar'))
  }, 3600_000)
  purge.unref()
  app.addHook('onClose', async () => clearInterval(purge))

  // Gravações do mesmo usuário em fila: a conferência dos limites do plano e a gravação não se intercalam.
  const userLocks = new Map<string, Promise<unknown>>()
  function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const prev = userLocks.get(userId) ?? Promise.resolve()
    const run = prev.then(fn, fn)
    const tail = run.catch(() => undefined)
    userLocks.set(userId, tail)
    void tail.then(() => {
      if (userLocks.get(userId) === tail) userLocks.delete(userId)
    })
    return run
  }

  async function issueSession(userId: string): Promise<string> {
    const token = newToken()
    await store.createSession(userId, hashToken(token), new Date(Date.now() + sessionMs))
    return token
  }

  /** Registra o último acesso (no máximo uma vez por minuto por usuário). Uma falha não pode derrubar a requisição. */
  const lastTouch = new Map<string, number>()
  async function touchAccess(userId: string, req: FastifyRequest): Promise<void> {
    const now = Date.now()
    if (now - (lastTouch.get(userId) ?? 0) < 60_000) return
    lastTouch.set(userId, now)
    try {
      await store.touchLastAccess(userId, new Date())
    } catch (err) {
      req.log.error({ err }, 'Falha ao gravar o último acesso')
    }
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
    await touchAccess(user.id, req)
  }
  // onRequest: sem sessão válida, o corpo nem é lido.
  const auth = { onRequest: authenticate }

  // Hash "falso" para gastar o mesmo tempo quando o e-mail não existe (evita enumerar contas pelo tempo de resposta).
  const dummyHash = hashPassword('senha-que-nunca-sera-usada')

  app.get('/v1/health', async () => ({ ok: true }))

  app.post('/v1/auth/register', authLimited, async (req, reply: FastifyReply) => {
    if (opts.allowRegister === false) throw new HttpError(403, 'register_disabled', 'O cadastro é feito no site.')
    const body = registerSchema.parse(req.body)
    const user = await store.createUser({ email: body.email, name: body.name, passwordHash: await hashPassword(body.password) })
    if (!user) throw new HttpError(409, 'email_in_use', 'Já existe uma conta com este e-mail.')
    const token = await issueSession(user.id)
    return reply.status(201).send({ token, user: publicUser(user) })
  })

  app.post('/v1/auth/login', authLimited, async (req) => {
    const body = loginSchema.parse(req.body)
    const key = attemptKey(req, body.email)
    const email = body.email.toLowerCase()
    if (blocked(key, email)) throw tooMany()
    // A tentativa conta antes da verificação (que é lenta): pedidos em paralelo não passam do limite.
    fail(key, email)
    const user = await store.findUserByEmail(body.email)
    const ok = await verifyPassword(body.password, user?.passwordHash ?? (await dummyHash))
    if (!user || !ok) throw new HttpError(401, 'invalid_credentials', 'E-mail ou senha incorretos.')
    failures.delete(key)
    const byEmail = emailFailures.get(email)
    if (byEmail && byEmail.count > 0) byEmail.count--
    await touchAccess(user.id, req)
    return { token: await issueSession(user.id), user: publicUser(user) }
  })

  app.post('/v1/auth/logout', auth, async (req, reply) => {
    await store.deleteSession(req.tokenHash!)
    return reply.status(204).send()
  })

  // Recuperar senha: a resposta é sempre a mesma, exista ou não a conta.
  app.post('/v1/auth/password-reset/request', authLimited, async (req, reply) => {
    const body = resetRequestSchema.parse(req.body)
    const email = body.email.toLowerCase()
    // No máximo 3 e-mails por conta a cada janela, de qualquer IP (a resposta continua a mesma).
    const limited = over(resetRequests, email, 3)
    count(resetRequests, email)
    const user = limited ? null : await store.findUserByEmail(body.email)
    if (user) {
      const token = newToken()
      await store.createReset(user.id, hashToken(token), new Date(Date.now() + resetMs))
      // Sem esperar o envio: o tempo de resposta não revela se a conta existe.
      void mailer.sendPasswordReset(user.email, token).catch((err) => req.log.error({ err }, 'Falha ao enviar o e-mail de redefinição'))
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

  app.get('/v1/me', auth, async (req) => {
    // Aviso de arquivos apagados por inatividade (o aplicativo mostra uma vez e confirma com o DELETE abaixo).
    const notice = await store.getCloudPurgeNotice(req.user!.id)
    // Plano que não vai renovar e termina em até 7 dias (o aplicativo mostra uma vez e confirma com o POST abaixo).
    const now = new Date()
    const expiry = await store.getPlanExpiryNotice(req.user!.id, now, EXPIRY_NOTICE_MS)
    return {
      user: {
        ...publicUser(req.user!),
        cloudPurge: notice ? { at: notice.at.toISOString(), days: notice.days } : null,
        planExpiry: expiry ? { at: expiry.at.toISOString(), days: daysLeft(expiry.at, now), plan: expiry.planName } : null
      }
    }
  })

  app.post('/v1/me/plan-expiry-notice', auth, async (req, reply) => {
    await store.ackPlanExpiryNotice(req.user!.id)
    return reply.status(204).send()
  })

  // Idioma do aplicativo: os e-mails da API (aviso de plano perto de expirar) seguem esse idioma.
  const localeSchema = z.object({ locale: z.enum(APP_LOCALES) })
  app.put('/v1/me/locale', auth, async (req, reply) => {
    await store.setUserLocale(req.user!.id, localeSchema.parse(req.body).locale)
    return reply.status(204).send()
  })

  app.delete('/v1/me/cloud-purge-notice', auth, async (req, reply) => {
    await store.clearCloudPurgeNotice(req.user!.id)
    return reply.status(204).send()
  })

  // Link de uso único (15 minutos) para a página de gestão da assinatura no site (assinatura.php?token=...).
  app.post('/v1/me/manage-link', auth, async (req) => {
    // Até 10 links por usuário a cada janela: cada um grava uma linha em manage_tokens.
    if (over(manageLinks, req.user!.id, 10)) throw tooMany()
    count(manageLinks, req.user!.id)
    const token = newToken()
    const expiresAt = new Date(Date.now() + 15 * 60_000)
    await store.createManageToken(req.user!.id, hashToken(token), expiresAt)
    return { token, expiresAt: expiresAt.toISOString() }
  })

  /**
   * Recalcula o uso (espaço e número de arquivos) depois de uma gravação. Uma falha aqui (banco sem a coluna nova,
   * por exemplo) não pode transformar uma gravação já feita em erro: registra no log e responde sem os totais.
   */
  const refreshUsage = async (userId: string): Promise<{ storageBytes?: number; storedFiles?: number }> => {
    try {
      const u = await store.refreshUsage(userId)
      return { storageBytes: u.storageBytes, storedFiles: u.storedFiles }
    } catch (err) {
      app.log.error({ err }, 'Falha ao recalcular o uso da nuvem')
      return { storageBytes: undefined, storedFiles: undefined }
    }
  }

  // Uso da nuvem: espaço (bytes: arquivos + textos não salvos), número de arquivos e limites do plano.
  app.get('/v1/me/storage', auth, async (req) => store.getUsage(req.user!.id))

  app.patch('/v1/me', auth, async (req) => {
    const body = profileSchema.parse(req.body)
    await store.updateUserName(req.user!.id, body.name)
    return { user: publicUser({ ...req.user!, name: body.name }) }
  })

  app.post('/v1/me/password', auth, async (req, reply) => {
    const body = changePasswordSchema.parse(req.body)
    const key = `senha|${req.user!.id}`
    if (over(failures, key, maxAttempts)) throw tooMany()
    if (!(await verifyPassword(body.currentPassword, req.user!.passwordHash))) {
      count(failures, key)
      throw new HttpError(403, 'wrong_password', 'A senha atual está incorreta.')
    }
    failures.delete(key)
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

  // Limites do plano (grupo) do usuário. A contagem e o espaço são recalculados antes de conferir, para
  // não depender de um total desatualizado.
  const fileLimitError = (): HttpError =>
    new HttpError(403, 'plan_file_limit', 'A quantidade máxima de arquivos armazenados na nuvem, permitidos pelo seu plano, foi excedida.')
  const storageLimitError = (): HttpError =>
    new HttpError(403, 'plan_storage_limit', 'O armazenamento total em MB permitido pelo seu plano foi excedido.')
  const currentUsage = async (userId: string) => {
    // Falha no recálculo não impede a gravação: confere com os totais já gravados.
    await store.refreshUsage(userId).catch((err) => app.log.error({ err }, 'Falha ao recalcular o uso antes de conferir o plano'))
    const usage = await store.getUsage(userId)
    return { ...usage, limitBytes: usage.plan.maxSizeMb * 1024 * 1024 }
  }

  app.put('/v1/files', { ...auth, ...fileBody }, async (req, reply) => {
    const body = putFileSchema.parse(req.body)
    return withUserLock(req.user!.id, () => saveFile(req, reply, body))
  })

  async function saveFile(req: FastifyRequest, reply: FastifyReply, body: z.infer<typeof putFileSchema>) {
    const bytes = Buffer.byteLength(body.content, 'utf8')
    if (bytes > MAX_FILE_BYTES) {
      throw new HttpError(413, 'too_large', 'O arquivo passa de 10 MB.')
    }
    // Arquivo novo: só se houver vaga na quantidade e espaço sobrando. Arquivo existente: só não pode crescer
    // além do limite (gravar algo do mesmo tamanho ou menor continua permitido, para liberar espaço).
    const usage = await currentUsage(req.user!.id)
    const lower = body.path.toLowerCase() // o banco compara caminhos sem diferenciar maiúsculas
    const existing = (await store.listFiles(req.user!.id)).find((f) => f.path.toLowerCase() === lower)
    if (!existing && usage.storedFiles >= usage.plan.maxFiles) throw fileLimitError()
    const growth = bytes - (existing?.size ?? 0)
    if ((!existing && usage.storageBytes >= usage.limitBytes) || (growth > 0 && usage.storageBytes + growth > usage.limitBytes)) {
      throw storageLimitError()
    }
    const result = await store.upsertFile(req.user!.id, body)
    if (!result.ok) {
      return reply.status(409).send({
        error: { code: 'conflict', message: 'A versão na nuvem mudou desde a sua última sincronização.' },
        current: fileMeta(result.current)
      })
    }
    return { file: fileMeta(result.file), ...(await refreshUsage(req.user!.id)) }
  }

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

  app.put('/v1/workspace', { ...auth, ...fileBody }, async (req) => {
    const body = z.object({ data: z.string().max(MAX_FILE_BYTES), baseVersion: z.number().int().min(0) }).parse(req.body)
    return withUserLock(req.user!.id, () => saveWorkspace(req, body))
  })

  async function saveWorkspace(req: FastifyRequest, body: { data: string; baseVersion: number }) {
    const bytes = Buffer.byteLength(body.data, 'utf8')
    if (bytes > MAX_FILE_BYTES) throw new HttpError(413, 'too_large', 'O arquivo passa de 10 MB.')
    // Os textos não salvos também ocupam o espaço do plano: acima do limite, a área de trabalho não cresce.
    const usage = await currentUsage(req.user!.id)
    const before = await store.getWorkspace(req.user!.id)
    const growth = bytes - (before ? Buffer.byteLength(before.data, 'utf8') : 0)
    if (growth > 0 && usage.storageBytes + growth > usage.limitBytes) throw storageLimitError()
    const result = await store.putWorkspace(req.user!.id, body.data, body.baseVersion)
    if (!result.ok) throw new HttpError(409, 'workspace_conflict', 'A área de trabalho mudou em outro computador.')
    return {
      version: result.workspace.version,
      updatedAt: result.workspace.updatedAt.toISOString(),
      ...(await refreshUsage(req.user!.id))
    }
  }

  app.get('/v1/folders', auth, async (req) => ({ folders: await store.listFolders(req.user!.id) }))

  app.post('/v1/folders', auth, async (req, reply) => {
    const body = z.object({ path: cloudPathSchema }).parse(req.body)
    const user = req.user!.id
    // Cria também as pastas acima (a/b/c cria a e a/b), para a árvore ficar completa.
    const parts = body.path.split('/')
    if (parts.length > MAX_FOLDER_DEPTH) throw new HttpError(400, 'invalid_request', 'Pastas aninhadas demais.')
    await withUserLock(user, async () => {
      // Limite de pastas por usuário: pastas não contam no plano, mas não podem crescer sem fim.
      const existing = new Set((await store.listFolders(user)).map((f) => f.toLowerCase()))
      const missing = parts.map((_, i) => parts.slice(0, i + 1).join('/')).filter((p) => !existing.has(p.toLowerCase()))
      if (existing.size + missing.length > MAX_FOLDERS) throw new HttpError(403, 'folder_limit', 'Limite de pastas atingido.')
      for (const p of missing) await store.createFolder(user, p)
    })
    return reply.status(201).send({ path: body.path })
  })

  // Renomear (ou mover) uma pasta, com os arquivos e as subpastas.
  app.patch('/v1/folders', auth, async (req) => {
    const { from, to } = z.object({ from: cloudPathSchema, to: cloudPathSchema }).parse(req.body)
    if (to.startsWith(`${from}/`)) throw new HttpError(400, 'invalid_request', 'A pasta não pode ir para dentro dela mesma.')
    const result = await store.renameFolder(req.user!.id, from, to)
    if (result === 'not_found') throw new HttpError(404, 'not_found', 'Pasta não encontrada.')
    if (result === 'exists') throw new HttpError(409, 'folder_in_use', 'Já existe uma pasta ou arquivo com este nome.')
    if (result === 'too_long') throw new HttpError(400, 'invalid_request', 'O caminho ficaria longo demais.')
    return { path: to }
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
    return { ...(await refreshUsage(req.user!.id)) }
  })

  // ---- Site: cadastro pela página de planos e consulta da assinatura ----
  // Só o servidor do site conhece a chave (X-Site-Key). Ele informa o IP do visitante em X-Client-IP, para o
  // limite de tentativas valer por visitante (todas as chamadas saem do mesmo servidor).
  const siteAuth = async (req: FastifyRequest): Promise<void> => {
    if (!opts.siteKey) throw new HttpError(503, 'site_signup_disabled', 'Cadastro pelo site indisponível.')
    const key = req.headers['x-site-key']
    if (typeof key !== 'string' || !sameSecret(key, opts.siteKey)) throw new HttpError(401, 'unauthorized', 'Não autorizado.')
  }
  const visitorIp = (req: FastifyRequest): string => {
    const ip = req.headers['x-client-ip']
    return typeof ip === 'string' && isIP(ip) ? ip : req.ip
  }
  const siteLimited = async (req: FastifyRequest): Promise<void> => {
    await siteAuth(req)
    const ip = visitorIp(req)
    if (over(siteRequests, ip, maxAuthRequests)) throw tooMany()
    count(siteRequests, ip)
  }

  app.post('/v1/site/signup', { onRequest: siteLimited }, async (req, reply) => {
    const body = siteSignupSchema.parse(req.body)
    if (!(await store.planExists(body.plan))) throw new HttpError(404, 'plan_not_found', 'Plano não encontrado.')
    const paid = body.plan !== 1
    if (paid && !body.period) throw new HttpError(400, 'invalid_request', 'Informe o período da assinatura.')

    let user = await store.findUserByEmail(body.email)
    let created = false
    if (user) {
      // Conta existente: só com a senha dela (mesmos limites do login).
      const key = `${visitorIp(req)}|${body.email}`
      if (blocked(key, body.email)) throw tooMany()
      if (!(await verifyPassword(body.password, user.passwordHash))) {
        fail(key, body.email)
        throw new HttpError(401, 'invalid_credentials', 'Este e-mail já tem uma conta e a senha não confere.')
      }
      failures.delete(key)
    } else {
      const password = passwordSchema.parse(body.password)
      user = await store.createUser({ email: body.email, name: body.name, passwordHash: await hashPassword(password) })
      if (!user) throw new HttpError(409, 'email_in_use', 'Já existe uma conta com este e-mail.')
      created = true
    }

    if (paid) {
      const sub = await store.getSubscription(user.id)
      // Já está num período pago: não abre outra assinatura por cima.
      if (sub?.active && sub.usersGroupsId !== 1) throw new HttpError(409, 'subscription_active', 'Esta conta já tem uma assinatura ativa.')
      await store.updateSubscription(user.id, { status: 'pending', period: body.period })
    }
    const sub = await store.getSubscription(user.id)
    return reply.status(created ? 201 : 200).send({ userId: user.id, created, subscription: sub ? publicSubscription(sub) : null })
  })

  app.get('/v1/site/users/:id/subscription', { onRequest: siteAuth }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const sub = await store.getSubscription(id)
    if (!sub) throw new HttpError(404, 'not_found', 'Usuário não encontrado.')
    return { subscription: siteSubscription(sub) }
  })

  // Página de gestão da assinatura: troca o token de uso único (gerado pelo aplicativo) pela conta.
  app.post('/v1/site/manage-token', { onRequest: siteLimited }, async (req) => {
    const { token } = z.object({ token: z.string().min(10).max(200) }).parse(req.body)
    const userId = await store.consumeManageToken(hashToken(token))
    const user = userId ? await store.findUserById(userId) : null
    const sub = user ? await store.getSubscription(user.id) : null
    if (!user || !sub) throw new HttpError(400, 'invalid_token', 'Link inválido ou expirado.')
    return { user: { id: user.id, email: user.email, name: user.name }, subscription: siteSubscription(sub) }
  })

  // Troca de plano, de período, cancelamento ou reativação feitos pelo site na Stripe: grava o resultado exato
  // (o fim do período pode encurtar ou alongar). O webhook continua cuidando das renovações.
  const siteSyncSchema = z.object({
    userId: z.string().uuid(),
    plan: z.number().int().min(2).max(1000),
    period: z.enum(['mensal', 'semestral', 'anual']),
    status: z.enum(['active', 'canceled']),
    stripeSubscriptionId: z.string().regex(/^sub_[A-Za-z0-9]{1,250}$/),
    periodEnd: z.number().int().positive(),
    paidAt: z.number().int().positive().optional()
  })
  app.post('/v1/site/subscription/sync', { onRequest: siteAuth }, async (req) => {
    const body = siteSyncSchema.parse(req.body)
    if (!(await store.planExists(body.plan))) throw new HttpError(404, 'plan_not_found', 'Plano não encontrado.')
    const current = await store.getSubscription(body.userId)
    if (!current) throw new HttpError(404, 'not_found', 'Usuário não encontrado.')
    // Só a assinatura que já é desta conta.
    if (current.stripeSubscriptionId !== body.stripeSubscriptionId) throw new HttpError(409, 'subscription_in_use', 'Assinatura de outra conta.')
    await store.updateSubscription(
      body.userId,
      {
        usersGroupsId: body.plan,
        period: body.period,
        status: body.status,
        active: true,
        nextPaymentAt: new Date(body.periodEnd * 1000),
        ...(body.paidAt ? { lastPaymentAt: new Date(body.paidAt * 1000) } : {})
      },
      { exact: true }
    )
    req.log.info(`Site: assinatura alterada (plano ${body.plan}, ${body.period}, ${body.status})`)
    const sub = await store.getSubscription(body.userId)
    return { subscription: sub ? siteSubscription(sub) : null }
  })

  // Confirmação pelo site logo depois do pagamento: o site conferiu a Checkout Session na API da Stripe (status
  // "complete" e client_reference_id do próprio cadastro) e repassa os dados da assinatura. Libera o plano na hora,
  // sem esperar o webhook (que continua cuidando das renovações, falhas e cancelamentos).
  const siteConfirmSchema = z.object({
    userId: z.string().uuid(),
    plan: z.number().int().min(2).max(1000),
    period: z.enum(['mensal', 'semestral', 'anual']),
    stripeCustomerId: z.string().regex(/^cus_[A-Za-z0-9]{1,250}$/).optional(),
    stripeSubscriptionId: z.string().regex(/^sub_[A-Za-z0-9]{1,250}$/),
    paidAt: z.number().int().positive().optional(),
    periodEnd: z.number().int().positive()
  })
  app.post('/v1/site/subscription/confirm', { onRequest: siteAuth }, async (req) => {
    const body = siteConfirmSchema.parse(req.body)
    if (!(await store.planExists(body.plan))) throw new HttpError(404, 'plan_not_found', 'Plano não encontrado.')
    const current = await store.getSubscription(body.userId)
    if (!current) throw new HttpError(404, 'not_found', 'Usuário não encontrado.')
    const owner = await store.findUserIdByStripeSubscription(body.stripeSubscriptionId)
    if (owner && owner !== body.userId) throw new HttpError(409, 'subscription_in_use', 'Assinatura de outra conta.')
    await store.updateSubscription(body.userId, {
      usersGroupsId: body.plan,
      period: body.period,
      active: true,
      status: 'active',
      lastPaymentAt: new Date((body.paidAt ?? Math.floor(Date.now() / 1000)) * 1000),
      nextPaymentAt: new Date(body.periodEnd * 1000),
      stripeSubscriptionId: body.stripeSubscriptionId,
      stripeCustomerId: body.stripeCustomerId
    })
    req.log.info(`Site: assinatura confirmada (plano ${body.plan}, ${body.period})`)
    const sub = await store.getSubscription(body.userId)
    return { subscription: sub ? publicSubscription(sub) : null }
  })

  // ---- Stripe: webhook das assinaturas (corpo cru, para conferir a assinatura) ----
  app.register(async (stripe) => {
    stripe.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 512 * 1024 }, (_req, body, done) => done(null, body))
    stripe.post('/v1/billing/stripe-webhook', async (req, reply) => {
      if (!opts.stripeWebhookSecret) throw new HttpError(503, 'billing_disabled', 'Webhook indisponível.')
      const raw = typeof req.body === 'string' ? req.body : ''
      const signature = req.headers['stripe-signature']
      if (!verifyStripeSignature(raw, typeof signature === 'string' ? signature : undefined, opts.stripeWebhookSecret)) {
        // A hospedagem só guarda o texto da mensagem no log: o motivo vai no próprio texto (sem o segredo).
        req.log.warn(
          `Stripe webhook recusado: assinatura inválida (cabeçalho ${typeof signature === 'string' ? 'presente' : 'ausente'}, ` +
            `corpo ${raw.length} caracteres, content-type ${String(req.headers['content-type'] ?? '')})`
        )
        throw new HttpError(400, 'invalid_signature', 'Assinatura inválida.')
      }
      let event: unknown
      try {
        event = JSON.parse(raw)
      } catch {
        throw new HttpError(400, 'invalid_request', 'JSON inválido.')
      }
      const e = event && typeof event === 'object' ? (event as Record<string, unknown>) : {}
      req.log.info(`Stripe webhook recebido: ${String(e.type ?? '?')} (livemode ${String(e.livemode ?? '?')})`)
      await applyStripeEvent(store, event, req.log)
      return reply.status(200).send({ received: true })
    })
  })

  return app
}
