import { randomUUID } from 'node:crypto'
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import type { FileMeta, RemoteFile, Store, UpsertResult, User } from './store.js'

/** Implementação para MySQL/MariaDB. Todas as consultas são parametrizadas. */
export function createMysqlStore(uri: string): Store {
  const pool: Pool = mysql.createPool({ uri, connectionLimit: 10, charset: 'utf8mb4', timezone: 'Z', dateStrings: false })

  const toUser = (r: RowDataPacket): User => ({
    id: r.id,
    email: r.email,
    name: r.name,
    passwordHash: r.password_hash,
    createdAt: r.created_at
  })
  const toMeta = (r: RowDataPacket): FileMeta => ({
    id: r.id,
    path: r.path,
    encoding: r.encoding,
    version: r.version,
    size: r.size,
    updatedAt: r.updated_at
  })

  const META_COLUMNS = 'id, path, encoding, version, size, updated_at'

  async function withTransaction<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const result = await fn(conn)
      await conn.commit()
      return result
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  }

  return {
    async createUser({ email, name, passwordHash }) {
      const id = randomUUID()
      const createdAt = new Date()
      try {
        await pool.execute('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)', [id, email, name, passwordHash, createdAt])
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') return null
        throw err
      }
      return { id, email, name, passwordHash, createdAt }
    },
    async findUserByEmail(email) {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM users WHERE email = ?', [email])
      return rows[0] ? toUser(rows[0]) : null
    },
    async findUserById(id) {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [id])
      return rows[0] ? toUser(rows[0]) : null
    },
    async updateUserName(id, name) {
      await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name, id])
    },
    async setPassword(id, passwordHash) {
      await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id])
    },

    async createSession(userId, tokenHash, expiresAt) {
      await pool.execute('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [tokenHash, userId, expiresAt])
    },
    async findSession(tokenHash) {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?', [tokenHash])
      return rows[0] ? { userId: rows[0].user_id, expiresAt: rows[0].expires_at } : null
    },
    async deleteSession(tokenHash) {
      await pool.execute('DELETE FROM sessions WHERE token_hash = ?', [tokenHash])
    },
    async deleteSessionsExcept(userId, keep) {
      if (keep === null) await pool.execute('DELETE FROM sessions WHERE user_id = ?', [userId])
      else await pool.execute('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [userId, keep])
    },

    async createReset(userId, tokenHash, expiresAt) {
      await pool.execute('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', [tokenHash, userId, expiresAt])
    },
    async consumeReset(tokenHash) {
      // UPDATE condicional: só um pedido consegue consumir o token.
      const [res] = await pool.execute<ResultSetHeader>(
        'UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
        [new Date(), tokenHash, new Date()]
      )
      if (res.affectedRows !== 1) return null
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT user_id FROM password_resets WHERE token_hash = ?', [tokenHash])
      return rows[0]?.user_id ?? null
    },

    async listFiles(userId) {
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT ${META_COLUMNS} FROM files WHERE user_id = ? ORDER BY path`, [userId])
      return rows.map(toMeta)
    },
    async getFile(userId, id) {
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT ${META_COLUMNS}, content FROM files WHERE user_id = ? AND id = ?`, [userId, id])
      return rows[0] ? ({ ...toMeta(rows[0]), content: rows[0].content } as RemoteFile) : null
    },
    async upsertFile(userId, input): Promise<UpsertResult> {
      const size = Buffer.byteLength(input.content, 'utf8')
      return withTransaction(async (conn) => {
        const [rows] = await conn.execute<RowDataPacket[]>(`SELECT ${META_COLUMNS} FROM files WHERE user_id = ? AND path = ? FOR UPDATE`, [userId, input.path])
        const now = new Date()
        if (!rows[0]) {
          if (input.baseVersion !== null && !input.force) {
            return { ok: false, current: { id: '', path: input.path, encoding: input.encoding, version: 0, size: 0, updatedAt: new Date(0) } }
          }
          const id = randomUUID()
          try {
            await conn.execute('INSERT INTO files (id, user_id, path, content, encoding, version, size, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', [id, userId, input.path, input.content, input.encoding, size, now])
          } catch (err) {
            if ((err as { code?: string }).code !== 'ER_DUP_ENTRY') throw err
            // Outro computador criou o mesmo caminho no mesmo instante: conflito.
            const [again] = await conn.execute<RowDataPacket[]>(`SELECT ${META_COLUMNS} FROM files WHERE user_id = ? AND path = ?`, [userId, input.path])
            return { ok: false, current: toMeta(again[0]) }
          }
          return { ok: true, file: { id, path: input.path, encoding: input.encoding, version: 1, size, updatedAt: now } }
        }
        const current = toMeta(rows[0])
        if (!input.force && input.baseVersion !== current.version) return { ok: false, current }
        const version = current.version + 1
        await conn.execute('UPDATE files SET content = ?, encoding = ?, version = ?, size = ?, updated_at = ? WHERE id = ?', [input.content, input.encoding, version, size, now, current.id])
        return { ok: true, file: { ...current, encoding: input.encoding, version, size, updatedAt: now } }
      })
    },
    async deleteFile(userId, id) {
      const [res] = await pool.execute<ResultSetHeader>('DELETE FROM files WHERE user_id = ? AND id = ?', [userId, id])
      return res.affectedRows === 1
    },
    async close() {
      await pool.end()
    }
  }
}

/** Aplica o esquema (CREATE TABLE IF NOT EXISTS). */
export async function migrate(uri: string, sql: string): Promise<void> {
  const conn = await mysql.createConnection({ uri, multipleStatements: true })
  try {
    await conn.query(sql)
  } finally {
    await conn.end()
  }
}
