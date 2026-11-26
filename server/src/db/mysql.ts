// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { randomUUID } from 'node:crypto'
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import { ADMIN_UPSERT_SQL, adminSeed } from './admin.js'
import type { DeleteFolderResult, FileMeta, MoveResult, PutWorkspaceResult, RemoteFile, RenameFolderResult, Store, Subscription, SubscriptionUpdate, UpsertResult, User, Workspace } from './store.js'

/**
 * Espaço usado por um usuário: tamanho dos arquivos (bytes UTF-8, coluna size) + área de trabalho
 * (LENGTH conta bytes). Os "?" são o id do usuário (duas vezes).
 */
const STORAGE_SUM =
  '(SELECT COALESCE(SUM(size), 0) FROM files WHERE user_id = ?) + COALESCE((SELECT LENGTH(data) FROM workspaces WHERE user_id = ?), 0)'

/** Implementação para MySQL/MariaDB. Todas as consultas são parametrizadas. */
export function createMysqlStore(uri: string): Store {
  const pool: Pool = mysql.createPool({ uri, connectionLimit: 10, charset: 'utf8mb4', timezone: 'Z', dateStrings: false })

  const toUser = (r: RowDataPacket): User => ({
    id: r.id,
    email: r.email,
    name: r.name,
    passwordHash: r.password_hash,
    createdAt: r.created_at,
    lastAccess: r.last_access ?? undefined
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
        await pool.execute('INSERT INTO users (id, email, name, password_hash, created_at, last_access) VALUES (?, ?, ?, ?, ?, ?)', [id, email, name, passwordHash, createdAt, createdAt])
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') return null
        throw err
      }
      return { id, email, name, passwordHash, createdAt, lastAccess: createdAt }
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
      // Senha nova: códigos de redefinição pendentes deixam de valer.
      await pool.execute('DELETE FROM password_resets WHERE user_id = ?', [id])
    },

    async touchLastAccess(userId, at) {
      await pool.execute('UPDATE users SET last_access = ? WHERE id = ?', [at, userId])
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
      // Só o código mais recente vale.
      await pool.execute('DELETE FROM password_resets WHERE user_id = ?', [userId])
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
    async moveFile(userId, id, newPath): Promise<MoveResult> {
      return withTransaction(async (conn) => {
        const [rows] = await conn.execute<RowDataPacket[]>(`SELECT ${META_COLUMNS} FROM files WHERE user_id = ? AND id = ? FOR UPDATE`, [userId, id])
        if (!rows[0]) return { ok: false, reason: 'not_found' }
        const current = toMeta(rows[0])
        if (current.path === newPath) return { ok: true, file: current }
        const now = new Date()
        try {
          await conn.execute('UPDATE files SET path = ?, version = version + 1, updated_at = ? WHERE id = ?', [newPath, now, id])
        } catch (err) {
          if ((err as { code?: string }).code === 'ER_DUP_ENTRY') return { ok: false, reason: 'exists' }
          throw err
        }
        return { ok: true, file: { ...current, path: newPath, version: current.version + 1, updatedAt: now } }
      })
    },
    async listFolders(userId) {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT path FROM folders WHERE user_id = ? ORDER BY path', [userId])
      return rows.map((r) => r.path as string)
    },
    async createFolder(userId, path) {
      await pool.execute('INSERT IGNORE INTO folders (user_id, path) VALUES (?, ?)', [userId, path])
    },
    async deleteFolder(userId, path): Promise<DeleteFolderResult> {
      // Os curingas do LIKE no nome da pasta são escapados: "%", "_" e "\" valem como texto.
      const prefix = `${path.replace(/[\\%_]/g, (c) => `\\${c}`)}/%`
      const [inside] = await pool.execute<RowDataPacket[]>(
        'SELECT (SELECT COUNT(*) FROM files WHERE user_id = ? AND path LIKE ?) + (SELECT COUNT(*) FROM folders WHERE user_id = ? AND path LIKE ?) AS n',
        [userId, prefix, userId, prefix]
      )
      if (Number(inside[0]?.n) > 0) return 'not_empty'
      const [res] = await pool.execute<ResultSetHeader>('DELETE FROM folders WHERE user_id = ? AND path = ?', [userId, path])
      return res.affectedRows === 1 ? 'ok' : 'not_found'
    },
    async renameFolder(userId, from, to): Promise<RenameFolderResult> {
      if (from === to) return 'ok'
      const under = (p: string): string => `${p.replace(/[\\%_]/g, (c) => `\\${c}`)}/%`
      return withTransaction(async (conn) => {
        const [found] = await conn.execute<RowDataPacket[]>(
          'SELECT (SELECT COUNT(*) FROM folders WHERE user_id = ? AND (path = ? OR path LIKE ?)) + (SELECT COUNT(*) FROM files WHERE user_id = ? AND path LIKE ?) AS n',
          [userId, from, under(from), userId, under(from)]
        )
        if (Number(found[0]?.n) === 0) return 'not_found'
        // Algo já ocupa o destino (fora da própria pasta: mudar só maiúsculas/minúsculas é permitido).
        const [clash] = await conn.execute<RowDataPacket[]>(
          `SELECT (SELECT COUNT(*) FROM folders WHERE user_id = ? AND (path = ? OR path LIKE ?) AND NOT (path = ? OR path LIKE ?))
                + (SELECT COUNT(*) FROM files WHERE user_id = ? AND (path = ? OR path LIKE ?) AND NOT (path LIKE ?)) AS n`,
          [userId, to, under(to), from, under(from), userId, to, under(to), under(from)]
        )
        if (Number(clash[0]?.n) > 0) return 'exists'
        const [long] = await conn.execute<RowDataPacket[]>(
          `SELECT (SELECT COUNT(*) FROM files WHERE user_id = ? AND path LIKE ? AND CHAR_LENGTH(path) - CHAR_LENGTH(?) + CHAR_LENGTH(?) > 512)
                + (SELECT COUNT(*) FROM folders WHERE user_id = ? AND (path = ? OR path LIKE ?) AND CHAR_LENGTH(path) - CHAR_LENGTH(?) + CHAR_LENGTH(?) > 512) AS n`,
          [userId, under(from), from, to, userId, from, under(from), from, to]
        )
        if (Number(long[0]?.n) > 0) return 'too_long'
        await conn.execute(
          'UPDATE files SET path = CONCAT(?, SUBSTRING(path, CHAR_LENGTH(?) + 1)), version = version + 1, updated_at = ? WHERE user_id = ? AND path LIKE ?',
          [to, from, new Date(), userId, under(from)]
        )
        await conn.execute('UPDATE folders SET path = CONCAT(?, SUBSTRING(path, CHAR_LENGTH(?) + 1)) WHERE user_id = ? AND (path = ? OR path LIKE ?)', [
          to,
          from,
          userId,
          from,
          under(from)
        ])
        return 'ok'
      })
    },
    async getWorkspace(userId): Promise<Workspace | null> {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT data, version, updated_at FROM workspaces WHERE user_id = ?', [userId])
      const r = rows[0]
      return r ? { data: r.data as string, version: Number(r.version), updatedAt: new Date(r.updated_at) } : null
    },
    async putWorkspace(userId, data, baseVersion): Promise<PutWorkspaceResult> {
      return withTransaction(async (conn) => {
        const [rows] = await conn.execute<RowDataPacket[]>('SELECT data, version, updated_at FROM workspaces WHERE user_id = ? FOR UPDATE', [userId])
        const r = rows[0]
        const current: Workspace = r
          ? { data: r.data as string, version: Number(r.version), updatedAt: new Date(r.updated_at) }
          : { data: '', version: 0, updatedAt: new Date(0) }
        if (current.version !== baseVersion) return { ok: false, current }
        const now = new Date()
        if (r) await conn.execute('UPDATE workspaces SET data = ?, version = ?, updated_at = ? WHERE user_id = ?', [data, baseVersion + 1, now, userId])
        else await conn.execute('INSERT INTO workspaces (user_id, data, version, updated_at) VALUES (?, ?, 1, ?)', [userId, data, now])
        return { ok: true, workspace: { data, version: baseVersion + 1, updatedAt: now } }
      })
    },
    async getUsage(userId) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT u.storage_bytes, u.stored_files, g.name, g.max_files, g.max_size_mb
           FROM users u JOIN users_groups g ON g.id = u.users_groups_id WHERE u.id = ?`,
        [userId]
      )
      const r = rows[0]
      return {
        storageBytes: Number(r?.storage_bytes ?? 0),
        storedFiles: Number(r?.stored_files ?? 0),
        plan: { name: String(r?.name ?? 'Gratuito'), maxFiles: Number(r?.max_files ?? 100), maxSizeMb: Number(r?.max_size_mb ?? 5) }
      }
    },
    async refreshUsage(userId) {
      // Recalculado a partir dos dados (e não somado aos poucos): os totais nunca se desencontram.
      await pool.execute(`UPDATE users SET storage_bytes = ${STORAGE_SUM}, stored_files = ${FILE_COUNT} WHERE id = ?`, [userId, userId, userId, userId])
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT storage_bytes, stored_files FROM users WHERE id = ?', [userId])
      return { storageBytes: Number(rows[0]?.storage_bytes ?? 0), storedFiles: Number(rows[0]?.stored_files ?? 0) }
    },
    async planExists(usersGroupsId) {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT 1 FROM users_groups WHERE id = ?', [usersGroupsId])
      return rows.length > 0
    },
    async getSubscription(userId): Promise<Subscription | null> {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT u.users_groups_id, g.name, u.subscription_period, u.subscription_status, u.subscription_active,
                u.last_payment_at, u.next_payment_at, u.stripe_customer_id, u.stripe_subscription_id
           FROM users u JOIN users_groups g ON g.id = u.users_groups_id WHERE u.id = ?`,
        [userId]
      )
      const r = rows[0]
      if (!r) return null
      return {
        usersGroupsId: Number(r.users_groups_id),
        planName: String(r.name),
        period: r.subscription_period ?? null,
        status: r.subscription_status ?? null,
        active: Number(r.subscription_active) === 1,
        lastPaymentAt: r.last_payment_at ?? null,
        nextPaymentAt: r.next_payment_at ?? null,
        stripeCustomerId: r.stripe_customer_id ?? null,
        stripeSubscriptionId: r.stripe_subscription_id ?? null
      }
    },
    async updateSubscription(userId, update) {
      // Só as colunas da lista fixa entram no SQL; os valores vão como parâmetros.
      const sets: string[] = []
      const values: unknown[] = []
      for (const [key, column] of Object.entries(SUBSCRIPTION_COLUMNS) as [keyof SubscriptionUpdate, string][]) {
        const value = update[key]
        if (value === undefined) continue
        if (key === 'nextPaymentAt' && value !== null) {
          sets.push(`${column} = GREATEST(COALESCE(${column}, ?), ?)`)
          values.push(value, value)
        } else {
          sets.push(`${column} = ?`)
          values.push(key === 'active' ? (value ? 1 : 0) : value)
        }
      }
      if (sets.length === 0) return
      await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...values, userId] as never[])
    },
    async findUserIdByStripeSubscription(stripeSubscriptionId) {
      const [rows] = await pool.execute<RowDataPacket[]>('SELECT id FROM users WHERE stripe_subscription_id = ?', [stripeSubscriptionId])
      return rows[0]?.id ?? null
    },
    async expireSubscriptions(now, graceMs) {
      const [res] = await pool.execute<ResultSetHeader>(
        `UPDATE users SET users_groups_id = 1, subscription_active = 0, subscription_status = 'ended'
          WHERE subscription_active = 1 AND next_payment_at IS NOT NULL
            AND ((subscription_status = 'active' AND next_payment_at < ?) OR (subscription_status <> 'active' AND next_payment_at <= ?))`,
        [new Date(now.getTime() - graceMs), now]
      )
      return res.affectedRows
    },
    async purgeExpired(now) {
      await pool.execute('DELETE FROM sessions WHERE expires_at < ?', [now])
      await pool.execute('DELETE FROM password_resets WHERE expires_at < ? OR used_at IS NOT NULL', [now])
    },
    async close() {
      await pool.end()
    }
  }
}

const FILE_COUNT = '(SELECT COUNT(*) FROM files WHERE user_id = ?)'

/** Colunas de assinatura em users (nome no código -> coluna). */
const SUBSCRIPTION_COLUMNS: Record<keyof SubscriptionUpdate, string> = {
  usersGroupsId: 'users_groups_id',
  period: 'subscription_period',
  status: 'subscription_status',
  active: 'subscription_active',
  lastPaymentAt: 'last_payment_at',
  nextPaymentAt: 'next_payment_at',
  stripeCustomerId: 'stripe_customer_id',
  stripeSubscriptionId: 'stripe_subscription_id'
}

/** Colunas novas de users para as assinaturas (ALTER TABLE em bancos já existentes). */
const SUBSCRIPTION_DDL: [string, string][] = [
  ['subscription_period', "VARCHAR(10) NULL COMMENT 'mensal, semestral ou anual'"],
  ['subscription_status', "VARCHAR(20) NULL COMMENT 'pending, active, canceled, payment_failed ou ended'"],
  ['subscription_active', "TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'No período pago'"],
  ['last_payment_at', "DATETIME(3) NULL COMMENT 'Data do último pagamento'"],
  ['next_payment_at', "DATETIME(3) NULL COMMENT 'Data do próximo pagamento (fim do período pago)'"],
  ['stripe_customer_id', 'VARCHAR(255) NULL'],
  ['stripe_subscription_id', 'VARCHAR(255) NULL']
]

async function columnExists(conn: mysql.Connection, table: string, column: string): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  )
  return rows.length > 0
}

/**
 * Aplica o esquema (CREATE TABLE IF NOT EXISTS) e as colunas novas em bancos já existentes
 * (storage_bytes, da 1.1.0; last_access, users_groups_id e stored_files, dos planos; semestral, valor semestral;
 * colunas de assinatura da Stripe em users), de forma idempotente,
 * recalculando o uso de todos os usuários. Se ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD estiverem
 * definidos, cadastra (ou atualiza) o administrador. Devolve se o administrador foi gravado.
 */
export async function migrate(uri: string, sql: string, env: Record<string, string | undefined> = process.env): Promise<{ adminSaved: boolean }> {
  const conn = await mysql.createConnection({ uri, multipleStatements: true })
  try {
    await conn.query(sql)
    if (!(await columnExists(conn, 'users', 'storage_bytes'))) await conn.query('ALTER TABLE users ADD COLUMN storage_bytes BIGINT NOT NULL DEFAULT 0')
    if (!(await columnExists(conn, 'users', 'last_access'))) {
      await conn.query('ALTER TABLE users ADD COLUMN last_access DATETIME(3) NULL')
      // Usuários que já existiam: o último acesso conhecido é agora (UTC, como o pool usa timezone Z).
      await conn.query('UPDATE users SET last_access = UTC_TIMESTAMP(3) WHERE last_access IS NULL')
    }
    // A coluna nova com DEFAULT 1 já preenche as linhas existentes com o grupo Gratuito.
    if (!(await columnExists(conn, 'users', 'users_groups_id'))) await conn.query('ALTER TABLE users ADD COLUMN users_groups_id INT UNSIGNED NOT NULL DEFAULT 1')
    if (!(await columnExists(conn, 'users_groups', 'semestral'))) {
      await conn.query("ALTER TABLE users_groups ADD COLUMN semestral DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Valor semestral' AFTER monthly_amount")
    }
    if (!(await columnExists(conn, 'users', 'stored_files'))) await conn.query('ALTER TABLE users ADD COLUMN stored_files INT UNSIGNED NOT NULL DEFAULT 0')
    for (const [column, ddl] of SUBSCRIPTION_DDL) {
      if (!(await columnExists(conn, 'users', column))) await conn.query(`ALTER TABLE users ADD COLUMN ${column} ${ddl}`)
    }
    const [ix] = await conn.query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'ix_users_stripe_subscription'"
    )
    if (ix.length === 0) await conn.query('ALTER TABLE users ADD KEY ix_users_stripe_subscription (stripe_subscription_id)')
    const [fks] = await conn.query<RowDataPacket[]>(
      "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'fk_users_group' AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
    )
    if (fks.length === 0) {
      await conn.query('ALTER TABLE users ADD CONSTRAINT fk_users_group FOREIGN KEY (users_groups_id) REFERENCES users_groups (id)')
    }
    await conn.query(`UPDATE users u SET u.storage_bytes = ${STORAGE_SUM.replace(/\?/g, 'u.id')}, u.stored_files = ${FILE_COUNT.replace(/\?/g, 'u.id')}`)
    const admin = adminSeed(env)
    if (admin) await conn.execute(ADMIN_UPSERT_SQL, [admin.name, admin.email, admin.passwordHash])
    return { adminSaved: admin !== null }
  } finally {
    await conn.end()
  }
}
