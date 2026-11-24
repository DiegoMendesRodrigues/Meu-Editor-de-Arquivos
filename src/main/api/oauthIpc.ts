// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { shell, type WebContents } from 'electron'
import { z } from 'zod'
import { IpcChannels } from '@shared/ipc'
import { oauthInputSchema, type ApiOAuthResult, type ApiOAuthTokenInfo } from '@shared/api/protocol'
import { VARIABLE_NAME_RE } from '@shared/api/variables'
import { handle } from '../ipc/secure'
import { authorizeOAuth2, clearOAuthToken, oauthTokenInfo } from './auth/oauth2'
import { buildOAuthResolver } from './auth/resolver'

/** Mesmo formato de escopo do cofre (ipc.ts): id do ambiente ou da coleção, ou "globals". */
const scopeSchema = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/).refine((s) => s !== '__proto__')
const nameSchema = z.string().regex(VARIABLE_NAME_RE)
const runIdSchema = z.string().uuid()

/** Obtenções em andamento: o Renderer só cancela as que ele mesmo abriu. */
const running = new Map<string, { controller: AbortController; owner: WebContents }>()
const MAX_RUNNING = 5

/** Canais do OAuth 2.0 do Cliente de API: obter token (navegador do sistema, Device Code...), consultar e limpar. */
export function registerOAuthHandlers(): void {
  handle(IpcChannels.apiOAuthAuthorize, async (e, raw: unknown): Promise<ApiOAuthResult> => {
    const parsed = oauthInputSchema.safeParse(raw)
    if (!parsed.success || parsed.data.auth.type !== 'oauth2') return { ok: false, code: 'invalidConfig' }
    const { runId, auth, environment, collection, verifyTls } = parsed.data
    if (running.has(runId) || running.size >= MAX_RUNNING) return { ok: false, code: 'invalidConfig' }

    const controller = new AbortController()
    running.set(runId, { controller, owner: e.sender })
    // A janela fechou ou recarregou: encerra o servidor de loopback e o polling.
    const onGone = (): void => controller.abort()
    const onNavigate = (details: { isMainFrame: boolean; isSameDocument: boolean }): void => {
      if (details.isMainFrame && !details.isSameDocument) onGone()
    }
    e.sender.once('destroyed', onGone)
    e.sender.on('did-start-navigation', onNavigate)
    try {
      return await authorizeOAuth2(environment?.id ?? 'globals', auth, {
        verifyTls,
        signal: controller.signal,
        resolve: await buildOAuthResolver(environment, collection),
        openExternal: (url) => {
          if (!/^https?:\/\//i.test(url)) throw new Error('esquema não permitido')
          return shell.openExternal(url)
        },
        onProgress: (p) => {
          if (!e.sender.isDestroyed()) e.sender.send(IpcChannels.apiOAuthProgress, { runId, ...p })
        }
      })
    } catch {
      return { ok: false, code: 'unknown' }
    } finally {
      running.delete(runId)
      e.sender.removeListener('destroyed', onGone)
      e.sender.removeListener('did-start-navigation', onNavigate)
    }
  })

  handle(IpcChannels.apiOAuthCancel, (e, runId: unknown): void => {
    // Só quem abriu a obtenção pode cancelá-la.
    const r = running.get(runIdSchema.parse(runId))
    if (r && r.owner === e.sender) r.controller.abort()
  })

  handle(IpcChannels.apiOAuthTokenInfo, (_e, scope: unknown, tokenVar: unknown): Promise<ApiOAuthTokenInfo> =>
    oauthTokenInfo(scopeSchema.parse(scope), nameSchema.parse(tokenVar))
  )

  handle(IpcChannels.apiOAuthClear, async (_e, scope: unknown, tokenVar: unknown): Promise<void> => {
    await clearOAuthToken(scopeSchema.parse(scope), nameSchema.parse(tokenVar))
  })
}
