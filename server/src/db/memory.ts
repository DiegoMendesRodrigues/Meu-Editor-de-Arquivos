// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { randomUUID } from 'node:crypto'
import { PURGE_SINCE, PURGED_LAST_ACCESS } from './store.js'
import type { AppLocale, CloudPurgeNotice, FileMeta, PlanExpiry, PlanExpiryEmail, RemoteFile, Store, Subscription, Usage, User, Workspace } from './store.js'

const meta = ({ content: _c, ...m }: RemoteFile): FileMeta => m

/** Planos da memória, iguais aos do banco de produção (users_groups). */
const PLANS = new Map<number, { name: string; maxFiles: number; maxSizeMb: number; waitingDays: number }>([
  [1, { name: 'Gratuito', maxFiles: 100, maxSizeMb: 5, waitingDays: 30 }],
  [2, { name: 'Explorador', maxFiles: 500, maxSizeMb: 25, waitingDays: 30 }],
  [3, { name: 'Criador', maxFiles: 1000, maxSizeMb: 50, waitingDays: 30 }],
  [4, { name: 'Mestre', maxFiles: 2000, maxSizeMb: 100, waitingDays: 30 }]
])
const DAY_MS = 24 * 3600 * 1000

type SubscriptionRow = Omit<Subscription, 'planName'>
const newSubscription = (): SubscriptionRow => ({
  usersGroupsId: 1,
  period: null,
  status: null,
  active: false,
  lastPaymentAt: null,
  nextPaymentAt: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null
})

/** Implementação em memória: usada nos testes e para experimentar o app sem um servidor SQL. */
export function createMemoryStore(): Store {
  const users = new Map<string, User>()
  const sessions = new Map<string, { userId: string; expiresAt: Date }>()
  const resets = new Map<string, { userId: string; expiresAt: Date; used: boolean }>()
  const files = new Map<string, RemoteFile & { userId: string }>()
  const folders = new Map<string, Set<string>>() // usuário -> pastas criadas
  const workspaces = new Map<string, Workspace>()
  const usage = new Map<string, Usage>() // usuário -> uso gravado (bytes e arquivos)
  const subscriptions = new Map<string, SubscriptionRow>() // usuário -> plano e assinatura
  const previousGroup = new Map<string, number>() // usuário -> plano antes de voltar ao Gratuito
  const purgeNotices = new Map<string, CloudPurgeNotice>()
  const manageTokens = new Map<string, { userId: string; expiresAt: Date; used: boolean }>()
  const locales = new Map<string, AppLocale>()
  const expiryNoticeFor = new Map<string, number>() // usuário -> next_payment_at do aviso já mostrado
  const expiryEmailFor = new Map<string, number>() // usuário -> next_payment_at do e-mail já enviado
  /** Plano pago que não renova e termina em até withinMs. */
  const expiringPlan = (userId: string, now: Date, withinMs: number): PlanExpiry | null => {
    const sub = subscriptions.get(userId)
    if (!sub || !sub.active || sub.usersGroupsId < 2 || !sub.nextPaymentAt) return null
    if (sub.status !== 'canceled' && sub.status !== 'payment_failed') return null
    const left = sub.nextPaymentAt.getTime() - now.getTime()
    if (left <= 0 || left > withinMs) return null
    return { at: new Date(sub.nextPaymentAt), planName: PLANS.get(sub.usersGroupsId)?.name ?? '' }
  }
  const subscriptionOf = (userId: string): SubscriptionRow => {
    let sub = subscriptions.get(userId)
    if (!sub) subscriptions.set(userId, (sub = newSubscription()))
    return sub
  }
  const userFolders = (userId: string): Set<string> => {
    let set = folders.get(userId)
    if (!set) folders.set(userId, (set = new Set()))
    return set
  }

  return {
    async createUser({ email, name, passwordHash }) {
      if ([...users.values()].some((u) => u.email === email)) return null
      const user: User = { id: randomUUID(), email, name, passwordHash, createdAt: new Date(), lastAccess: new Date() }
      users.set(user.id, user)
      return user
    },
    async findUserByEmail(email) {
      return [...users.values()].find((u) => u.email === email) ?? null
    },
    async findUserById(id) {
      return users.get(id) ?? null
    },
    async updateUserName(id, name) {
      const u = users.get(id)
      if (u) u.name = name
    },
    async setPassword(id, passwordHash) {
      const u = users.get(id)
      if (u) u.passwordHash = passwordHash
    },

    async touchLastAccess(userId, at) {
      const u = users.get(userId)
      if (u) u.lastAccess = at
    },

    async createSession(userId, tokenHash, expiresAt) {
      sessions.set(tokenHash, { userId, expiresAt })
    },
    async findSession(tokenHash) {
      return sessions.get(tokenHash) ?? null
    },
    async deleteSession(tokenHash) {
      sessions.delete(tokenHash)
    },
    async deleteSessionsExcept(userId, keep) {
      for (const [hash, s] of sessions) if (s.userId === userId && hash !== keep) sessions.delete(hash)
    },

    async createReset(userId, tokenHash, expiresAt) {
      for (const [h, r] of resets) if (r.userId === userId) resets.delete(h)
      resets.set(tokenHash, { userId, expiresAt, used: false })
    },
    async consumeReset(tokenHash) {
      const r = resets.get(tokenHash)
      if (!r || r.used || r.expiresAt.getTime() < Date.now()) return null
      r.used = true
      return r.userId
    },

    async listFiles(userId) {
      return [...files.values()]
        .filter((f) => f.userId === userId)
        .map(meta)
        .sort((a, b) => a.path.localeCompare(b.path))
    },
    async getFile(userId, id) {
      const f = files.get(id)
      return f && f.userId === userId ? f : null
    },
    async upsertFile(userId, input) {
      const existing = [...files.values()].find((f) => f.userId === userId && f.path === input.path)
      const size = Buffer.byteLength(input.content, 'utf8')
      if (!existing) {
        if (input.baseVersion !== null && !input.force) {
          // O cliente achava que o arquivo existia, mas ele foi removido: trata como conflito.
          return { ok: false, current: { id: '', path: input.path, encoding: input.encoding, version: 0, size: 0, updatedAt: new Date(0) } }
        }
        const file = { id: randomUUID(), userId, path: input.path, content: input.content, encoding: input.encoding, version: 1, size, updatedAt: new Date() }
        files.set(file.id, file)
        return { ok: true, file: meta(file) }
      }
      if (!input.force && input.baseVersion !== existing.version) return { ok: false, current: meta(existing) }
      existing.content = input.content
      existing.encoding = input.encoding
      existing.version += 1
      existing.size = size
      existing.updatedAt = new Date()
      return { ok: true, file: meta(existing) }
    },
    async deleteFile(userId, id) {
      const f = files.get(id)
      if (!f || f.userId !== userId) return false
      files.delete(id)
      return true
    },
    async moveFile(userId, id, newPath) {
      const f = files.get(id)
      if (!f || f.userId !== userId) return { ok: false, reason: 'not_found' }
      if (f.path === newPath) return { ok: true, file: meta(f) }
      if ([...files.values()].some((o) => o.userId === userId && o.path === newPath)) return { ok: false, reason: 'exists' }
      f.path = newPath
      f.version += 1
      f.updatedAt = new Date()
      return { ok: true, file: meta(f) }
    },
    async listFolders(userId) {
      return [...userFolders(userId)].sort((a, b) => a.localeCompare(b))
    },
    async createFolder(userId, path) {
      userFolders(userId).add(path)
    },
    async deleteFolder(userId, path) {
      const set = userFolders(userId)
      const prefix = `${path}/`
      const hasFiles = [...files.values()].some((f) => f.userId === userId && f.path.startsWith(prefix))
      const hasSub = [...set].some((p) => p.startsWith(prefix))
      if (hasFiles || hasSub) return 'not_empty'
      return set.delete(path) ? 'ok' : 'not_found'
    },
    async renameFolder(userId, from, to) {
      if (from === to) return 'ok'
      const set = userFolders(userId)
      const inside = (root: string, p: string): boolean => p === root || p.startsWith(`${root}/`)
      const mine = [...files.values()].filter((f) => f.userId === userId)
      if (!set.has(from) && ![...set].some((p) => inside(from, p)) && !mine.some((f) => inside(from, f.path))) return 'not_found'
      const lower = (p: string): string => p.toLowerCase() // como no MySQL (comparação sem maiúsculas)
      const clash = (p: string): boolean => inside(lower(to), lower(p)) && !inside(lower(from), lower(p))
      if ([...set].some(clash) || mine.some((f) => clash(f.path))) return 'exists'
      const moved = (p: string): string => to + p.slice(from.length)
      if ([...set].some((p) => inside(from, p) && moved(p).length > 512) || mine.some((f) => inside(from, f.path) && moved(f.path).length > 512)) return 'too_long'
      for (const f of mine) {
        if (!f.path.startsWith(`${from}/`)) continue
        f.path = moved(f.path)
        f.version += 1
        f.updatedAt = new Date()
      }
      for (const p of [...set]) {
        if (!inside(from, p)) continue
        set.delete(p)
        set.add(moved(p))
      }
      return 'ok'
    },
    async getWorkspace(userId) {
      const w = workspaces.get(userId)
      return w ? { ...w } : null
    },
    async putWorkspace(userId, data, baseVersion) {
      const current = workspaces.get(userId)
      if ((current?.version ?? 0) !== baseVersion) return { ok: false, current: current ?? { data: '', version: 0, updatedAt: new Date(0) } }
      const w: Workspace = { data, version: baseVersion + 1, updatedAt: new Date() }
      workspaces.set(userId, w)
      return { ok: true, workspace: { ...w } }
    },
    async getUsage(userId) {
      const u = usage.get(userId) ?? { storageBytes: 0, storedFiles: 0 }
      const { waitingDays: _w, ...plan } = PLANS.get(subscriptionOf(userId).usersGroupsId)!
      return { ...u, plan }
    },
    async refreshUsage(userId) {
      let storageBytes = Buffer.byteLength(workspaces.get(userId)?.data ?? '', 'utf8')
      let storedFiles = 0
      for (const f of files.values()) {
        if (f.userId !== userId) continue
        storageBytes += f.size
        storedFiles++
      }
      const total = { storageBytes, storedFiles }
      usage.set(userId, total)
      return { ...total }
    },
    async planExists(usersGroupsId) {
      return PLANS.has(usersGroupsId)
    },
    async getSubscription(userId) {
      if (!users.has(userId)) return null
      const sub = subscriptionOf(userId)
      return { ...sub, planName: PLANS.get(sub.usersGroupsId)!.name }
    },
    async updateSubscription(userId, update, opts) {
      if (!users.has(userId)) return
      const sub = subscriptionOf(userId)
      const { nextPaymentAt, ...rest } = update
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) (sub as unknown as Record<string, unknown>)[k] = v
      if (nextPaymentAt !== undefined) {
        sub.nextPaymentAt = !opts?.exact && nextPaymentAt && sub.nextPaymentAt && sub.nextPaymentAt > nextPaymentAt ? sub.nextPaymentAt : nextPaymentAt
      }
    },
    async findUserIdByStripeSubscription(stripeSubscriptionId) {
      for (const [id, sub] of subscriptions) if (sub.stripeSubscriptionId === stripeSubscriptionId) return id
      return null
    },
    async expireSubscriptions(now, graceMs) {
      let n = 0
      for (const [userId, sub] of subscriptions) {
        if (!sub.active || !sub.nextPaymentAt) continue
        const lapsed = sub.status === 'active' ? sub.nextPaymentAt.getTime() + graceMs < now.getTime() : sub.nextPaymentAt <= now
        if (!lapsed) continue
        previousGroup.set(userId, sub.usersGroupsId)
        Object.assign(sub, { usersGroupsId: 1, active: false, status: 'ended' })
        const u = users.get(userId)
        if (u) u.lastAccess = now
        n++
      }
      return n
    },
    async purgeInactiveUsers(now) {
      let n = 0
      for (const u of users.values()) {
        const sub = subscriptionOf(u.id)
        if (sub.usersGroupsId !== 1 || sub.active || !u.lastAccess || u.lastAccess <= PURGE_SINCE) continue
        const days = PLANS.get(previousGroup.get(u.id) ?? 1)!.waitingDays
        if (now.getTime() - u.lastAccess.getTime() <= days * DAY_MS) continue
        for (const [id, f] of files) if (f.userId === u.id) files.delete(id)
        folders.delete(u.id)
        workspaces.delete(u.id)
        usage.set(u.id, { storageBytes: 0, storedFiles: 0 })
        u.lastAccess = new Date(PURGED_LAST_ACCESS)
        previousGroup.delete(u.id)
        purgeNotices.set(u.id, { at: now, days })
        n++
      }
      return n
    },
    async getCloudPurgeNotice(userId) {
      const notice = purgeNotices.get(userId)
      return notice ? { ...notice } : null
    },
    async clearCloudPurgeNotice(userId) {
      purgeNotices.delete(userId)
    },
    async createManageToken(userId, tokenHash, expiresAt) {
      manageTokens.set(tokenHash, { userId, expiresAt, used: false })
    },
    async consumeManageToken(tokenHash) {
      const t = manageTokens.get(tokenHash)
      if (!t || t.used || t.expiresAt.getTime() < Date.now()) return null
      t.used = true
      return t.userId
    },
    async setUserLocale(userId, locale) {
      locales.set(userId, locale)
    },
    async getPlanExpiryNotice(userId, now, withinMs) {
      const plan = expiringPlan(userId, now, withinMs)
      return plan && expiryNoticeFor.get(userId) !== plan.at.getTime() ? plan : null
    },
    async ackPlanExpiryNotice(userId) {
      const at = subscriptions.get(userId)?.nextPaymentAt
      if (at) expiryNoticeFor.set(userId, at.getTime())
    },
    async claimPlanExpiryEmails(now, withinMs) {
      const out: PlanExpiryEmail[] = []
      for (const u of users.values()) {
        const plan = expiringPlan(u.id, now, withinMs)
        if (!plan || expiryEmailFor.get(u.id) === plan.at.getTime()) continue
        expiryEmailFor.set(u.id, plan.at.getTime())
        out.push({ ...plan, userId: u.id, email: u.email, name: u.name, locale: locales.get(u.id) ?? null })
      }
      return out
    },
    async releasePlanExpiryEmail(userId) {
      expiryEmailFor.delete(userId)
    },
    async purgeExpired(now) {
      for (const [h, s] of sessions) if (s.expiresAt < now) sessions.delete(h)
      for (const [h, r] of resets) if (r.expiresAt < now || r.used) resets.delete(h)
      for (const [h, t] of manageTokens) if (t.expiresAt < now || t.used) manageTokens.delete(h)
    },
    async close() {}
  }
}
