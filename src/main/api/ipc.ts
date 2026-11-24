// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels, type ApiSecretsInfo } from '@shared/ipc'
import { API_LIMITS } from '@shared/api/limits'
import { VARIABLE_NAME_RE } from '@shared/api/variables'
import { handle } from '../ipc/secure'
import { SecretVault } from './secrets'

/**
 * Canais do Cliente de API. Todos passam por handle() (confere o remetente) e validam a entrada com Zod.
 * Fase 0: só o cofre de segredos. O Renderer grava, consulta e apaga segredos, mas nunca lê o valor.
 */

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

/** Escopo: id do ambiente ou da coleção, ou "globals". */
const scopeSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/).refine((s) => s !== '__proto__')
const nameSchema = z.string().regex(VARIABLE_NAME_RE)
const valueSchema = z.string().max(API_LIMITS.secretChars)

export function registerApiHandlers(): void {
  handle(IpcChannels.apiSecretsInfo, (): ApiSecretsInfo => ({ persistent: secretVault.persistent }))

  handle(IpcChannels.apiSecretSet, async (_e, scope: unknown, name: unknown, value: unknown): Promise<void> => {
    await secretVault.set(scopeSchema.parse(scope), nameSchema.parse(name), valueSchema.parse(value))
  })

  handle(IpcChannels.apiSecretHas, (_e, scope: unknown, name: unknown): Promise<boolean> =>
    secretVault.has(scopeSchema.parse(scope), nameSchema.parse(name))
  )

  handle(IpcChannels.apiSecretNames, (_e, scope: unknown): Promise<string[]> => secretVault.names(scopeSchema.parse(scope)))

  handle(IpcChannels.apiSecretDelete, async (_e, scope: unknown, name: unknown): Promise<void> => {
    await secretVault.delete(scopeSchema.parse(scope), nameSchema.parse(name))
  })
}
