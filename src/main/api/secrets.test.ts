// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { SecretVault, type Cipher, type VaultStorage } from './secrets'

/** Cifra de mentira para o teste: reversível e visivelmente diferente do texto puro. */
const fakeCipher = (available = true): Cipher => ({
  available: async () => available,
  encrypt: async (plain) => Buffer.from(`enc:${plain}`).toString('base64'),
  decrypt: async (encoded) => {
    const text = Buffer.from(encoded, 'base64').toString()
    if (!text.startsWith('enc:')) throw new Error('outra chave')
    return text.slice(4)
  }
})

const memoryStorage = (initial: string | null = null): VaultStorage & { text: string | null; writes: number } => {
  const s = {
    text: initial,
    writes: 0,
    read: async () => s.text,
    write: async (t: string) => {
      s.text = t
      s.writes++
    }
  }
  return s
}

describe('cofre de segredos', () => {
  it('guarda cifrado e lê de novo numa nova instância', async () => {
    const storage = memoryStorage()
    const vault = new SecretVault(fakeCipher(), storage)
    await vault.set('hml', 'token', 'segredo-123')
    expect(storage.text).not.toContain('segredo-123')
    const again = new SecretVault(fakeCipher(), storage)
    expect(await again.get('hml', 'token')).toBe('segredo-123')
    expect(await again.has('hml', 'token')).toBe(true)
    expect(await again.has('prod', 'token')).toBe(false)
  })

  it('falha passageira na leitura não regrava o arquivo por cima dos segredos', async () => {
    const storage = memoryStorage()
    await new SecretVault(fakeCipher(), storage).set('hml', 'token', 'segredo-123')
    const saved = storage.text
    let fail = true
    const flaky: VaultStorage = {
      read: async () => {
        if (fail) throw new Error('EBUSY')
        return storage.text
      },
      write: storage.write
    }
    const vault = new SecretVault(fakeCipher(), flaky)
    await vault.set('hml', 'outro', 'x')
    expect(storage.text).toBe(saved)
    // Na próxima operação a leitura funciona: os segredos antigos voltam e os novos são gravados juntos.
    fail = false
    await vault.set('hml', 'mais', 'y')
    const again = new SecretVault(fakeCipher(), storage)
    expect(await again.get('hml', 'token')).toBe('segredo-123')
    expect(await again.get('hml', 'mais')).toBe('y')
  })

  it('lista só os nomes, separados por escopo', async () => {
    const vault = new SecretVault(fakeCipher(), memoryStorage())
    await vault.set('hml', 'token', 'a')
    await vault.set('hml', 'clientSecret', 'b')
    await vault.set('prod', 'token', 'c')
    expect(await vault.names('hml')).toEqual(['clientSecret', 'token'])
    expect(await vault.names('nenhum')).toEqual([])
  })

  it('exclui um segredo e o escopo inteiro', async () => {
    const storage = memoryStorage()
    const vault = new SecretVault(fakeCipher(), storage)
    await vault.set('hml', 'a', '1')
    await vault.set('hml', 'b', '2')
    await vault.delete('hml', 'a')
    expect(await vault.names('hml')).toEqual(['b'])
    await vault.deleteScope('hml')
    expect(await new SecretVault(fakeCipher(), storage).names('hml')).toEqual([])
  })

  it('excluir o que não existe não grava nada', async () => {
    const storage = memoryStorage()
    const vault = new SecretVault(fakeCipher(), storage)
    await vault.delete('hml', 'x')
    await vault.deleteScope('hml')
    expect(storage.writes).toBe(0)
  })

  it('sem cifra do sistema, fica só na memória e não grava no disco', async () => {
    const storage = memoryStorage()
    const vault = new SecretVault(fakeCipher(false), storage)
    expect(await vault.isPersistent()).toBe(false)
    await vault.set('hml', 'token', 'x')
    expect(await vault.get('hml', 'token')).toBe('x')
    expect(storage.text).toBeNull()
  })

  it('ignora arquivo corrompido e segredos cifrados com outra chave', async () => {
    const errors: string[] = []
    expect(await new SecretVault(fakeCipher(), memoryStorage('{ quebrado'), (m) => errors.push(m)).names('x')).toEqual([])
    expect(errors.length).toBe(1)
    const other = JSON.stringify({ version: 1, scopes: { hml: { token: Buffer.from('outra').toString('base64'), ok: await fakeCipher().encrypt('v') } } })
    const vault = new SecretVault(fakeCipher(), memoryStorage(other))
    expect(await vault.names('hml')).toEqual(['ok'])
  })

  it('chamadas simultâneas na abertura esperam a mesma leitura e não apagam o que está no disco', async () => {
    const storage = memoryStorage()
    await new SecretVault(fakeCipher(), storage).set('hml', 'antigo', '1')
    const vault = new SecretVault(fakeCipher(), storage)
    await Promise.all([vault.names('hml'), vault.set('hml', 'novo', '2')])
    expect(await new SecretVault(fakeCipher(), storage).names('hml')).toEqual(['antigo', 'novo'])
  })

  it('regrava sem mudar o segredo que não pôde ser decifrado, até ser informado de novo', async () => {
    const foreign = Buffer.from('outra').toString('base64')
    const storage = memoryStorage(JSON.stringify({ version: 1, scopes: { hml: { token: foreign } } }))
    const vault = new SecretVault(fakeCipher(), storage)
    await vault.set('hml', 'ok', 'v')
    expect(JSON.parse(storage.text!).scopes.hml.token).toBe(foreign)
    await vault.set('hml', 'token', 'novo')
    expect(await new SecretVault(fakeCipher(), storage).get('hml', 'token')).toBe('novo')
  })

  it('escopo ou nome "__proto__" vira chave comum do arquivo', async () => {
    const storage = memoryStorage()
    await new SecretVault(fakeCipher(), storage).set('__proto__', '__proto__', 'x')
    expect(await new SecretVault(fakeCipher(), storage).get('__proto__', '__proto__')).toBe('x')
  })
})
