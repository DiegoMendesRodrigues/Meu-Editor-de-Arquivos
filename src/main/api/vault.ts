// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import log from 'electron-log/main'
import { SecretVault } from './secrets'

/** Cofre de segredos do Cliente de API (instância única do Main). Use secretVault.get só no Main. */
const vaultPath = (): string => join(app.getPath('userData'), 'api-secrets.json')

export const secretVault = new SecretVault(
  {
    // No Linux sem chaveiro, o Electron pode usar o "basic_text" (chave fixa no código) e ainda dizer que
    // há cifra: nesse caso os segredos ficam só na memória.
    available: () =>
      safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (encoded) => safeStorage.decryptString(Buffer.from(encoded, 'base64'))
  },
  {
    read: async () => {
      try {
        return await readFile(vaultPath(), 'utf8')
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
        throw err
      }
    },
    write: async (text) => {
      const tmp = `${vaultPath()}.tmp`
      await writeFile(tmp, text, 'utf8')
      await rename(tmp, vaultPath())
    }
  },
  // Só a mensagem técnica; nenhum nome ou valor de segredo vai para o log.
  (message) => log.warn(`Cliente de API: ${message}`)
)
