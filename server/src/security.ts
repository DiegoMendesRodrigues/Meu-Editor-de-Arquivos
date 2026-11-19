// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * Senhas: scrypt (embutido no Node, sem dependência nativa) com sal aleatório.
 * Tokens de sessão e de redefinição: aleatórios; só o hash SHA-256 fica no banco.
 */
const N = 32768
const R = 8
const P = 1
const KEY_LEN = 64

function scryptAsync(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, opts, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

const options = (n: number, r: number, p: number): ScryptOptions => ({ N: n, r, p, maxmem: 128 * n * r * 2 })

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password.normalize('NFKC'), salt, options(N, R, P))
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const key = await scryptAsync(password.normalize('NFKC'), Buffer.from(salt, 'base64'), options(Number(n), Number(r), Number(p)))
  return key.length === expected.length && timingSafeEqual(key, expected)
}

export const newToken = (): string => randomBytes(32).toString('base64url')
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')
