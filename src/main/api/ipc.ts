// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { z } from 'zod'
import { IpcChannels, type ApiSecretsInfo } from '@shared/ipc'
import { API_LIMITS } from '@shared/api/limits'
import { VARIABLE_NAME_RE } from '@shared/api/variables'
import { handle } from '../ipc/secure'
import { secretVault } from './vault'
import { registerSendHandlers } from './sendIpc'
import { registerImportHandlers } from './importIpc'
import { registerRunnerHandlers } from './runnerIpc'
import { registerOAuthHandlers } from './oauthIpc'

/**
 * Canais do Cliente de API. Todos passam por handle() (confere o remetente) e validam a entrada com Zod.
 * Fase 0: só o cofre de segredos. O Renderer grava, consulta e apaga segredos, mas nunca lê o valor.
 */

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

  registerSendHandlers()
  registerImportHandlers()
  registerRunnerHandlers()
  registerOAuthHandlers()
}
