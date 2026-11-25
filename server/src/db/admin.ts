// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHash } from 'node:crypto'

export interface AdminSeed {
  name: string
  email: string
  /** SHA-256 em hexadecimal (64 caracteres). */
  passwordHash: string
}

/** Grava (ou atualiza, se o e-mail já existir) o administrador. Parametrizado. */
export const ADMIN_UPSERT_SQL =
  'INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash)'

/**
 * Administrador a cadastrar na migração: só existe se ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD
 * estiverem todos definidos (e não vazios). Nada disso fica em arquivo nem em log.
 * Atenção: SHA-256 simples, sem sal, é fraco; scrypt é o recomendado (a escolha do SHA-256 foi do projeto).
 */
export function adminSeed(env: Record<string, string | undefined>): AdminSeed | null {
  const name = env.ADMIN_NAME?.trim()
  const email = env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = env.ADMIN_PASSWORD
  if (!name || !email || !password) return null
  if (name.length > 200 || email.length > 200) throw new Error('ADMIN_NAME e ADMIN_EMAIL aceitam até 200 caracteres.')
  return { name, email, passwordHash: createHash('sha256').update(password, 'utf8').digest('hex') }
}
