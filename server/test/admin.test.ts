// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { adminSeed } from '../src/db/admin.js'

describe('adminSeed', () => {
  const env = { ADMIN_NAME: ' Fulana de Tal ', ADMIN_EMAIL: ' Admin@Exemplo.COM ', ADMIN_PASSWORD: 'senha-de-teste' }

  it('devolve nome, e-mail em minúsculas e o SHA-256 hexadecimal da senha', () => {
    const seed = adminSeed(env)
    expect(seed).toEqual({
      name: 'Fulana de Tal',
      email: 'admin@exemplo.com',
      passwordHash: createHash('sha256').update('senha-de-teste').digest('hex')
    })
    expect(seed?.passwordHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('só cadastra com as três variáveis definidas e não vazias', () => {
    expect(adminSeed({})).toBeNull()
    expect(adminSeed({ ...env, ADMIN_NAME: undefined })).toBeNull()
    expect(adminSeed({ ...env, ADMIN_EMAIL: '   ' })).toBeNull()
    expect(adminSeed({ ...env, ADMIN_PASSWORD: '' })).toBeNull()
  })

  it('recusa nome ou e-mail maiores que a coluna', () => {
    expect(() => adminSeed({ ...env, ADMIN_NAME: 'x'.repeat(201) })).toThrow()
  })
})
