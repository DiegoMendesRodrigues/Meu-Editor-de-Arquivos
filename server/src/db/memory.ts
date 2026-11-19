// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { randomUUID } from 'node:crypto'
import type { FileMeta, RemoteFile, Store, User } from './store.js'

const meta = ({ content: _c, ...m }: RemoteFile): FileMeta => m

/** Implementação em memória: usada nos testes e para experimentar o app sem um servidor SQL. */
export function createMemoryStore(): Store {
  const users = new Map<string, User>()
  const sessions = new Map<string, { userId: string; expiresAt: Date }>()
  const resets = new Map<string, { userId: string; expiresAt: Date; used: boolean }>()
  const files = new Map<string, RemoteFile & { userId: string }>()

  return {
    async createUser({ email, name, passwordHash }) {
      if ([...users.values()].some((u) => u.email === email)) return null
      const user: User = { id: randomUUID(), email, name, passwordHash, createdAt: new Date() }
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
    async close() {}
  }
}
