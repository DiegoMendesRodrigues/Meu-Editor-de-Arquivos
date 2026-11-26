// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { BrowserWindow, dialog } from 'electron'
import { z } from 'zod'
import { AI_LIMITS, aiSettingsSchema, type AiInstallInfo, type AiOpResult, type AiSetSettingsResult, type AiSettings, type AiStatus } from '@shared/ai'
import { IpcChannels } from '@shared/ipc'
import { tm } from '../i18n'
import { handle } from '../ipc/secure'
import { cancelChat, startChat } from './generations'
import { cancelOp, getInstallInfo, startInstall, startPull, startServer } from './installOps'
import { checkHost, getStatus, LOOPBACK } from './ollama'
import { deleteModel } from './pull'
import { readAiSettings, writeAiSettings } from './settings'

/** Canais do assistente de IA local. Todos passam por handle() e validam a entrada com Zod. */
export function registerAiHandlers(): void {
  handle(IpcChannels.aiStatus, async (): Promise<AiStatus> => getStatus(await readAiSettings()))

  handle(IpcChannels.aiGetSettings, (): Promise<AiSettings> => readAiSettings())

  handle(IpcChannels.aiSetSettings, async (e, raw: unknown): Promise<AiSetSettingsResult> => {
    const parsed = aiSettingsSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'invalidSettings' }
    const settings = parsed.data
    const host = checkHost(settings.host, settings.allowRemote)
    if (!host.ok) return { ok: false, code: host.code }
    // Liberar servidor remoto ou trocar para outro host fora do loopback exige confirmação nativa no Main.
    const current = await readAiSettings()
    const hostname = new URL(host.origin).hostname.toLowerCase()
    const remoteHost = !LOOPBACK.has(hostname)
    const currentHostname = (() => {
      try {
        return new URL(current.host).hostname.toLowerCase()
      } catch {
        return ''
      }
    })()
    const newRemoteHost = remoteHost && (!current.allowRemote || currentHostname !== hostname)
    const enablingRemote = settings.allowRemote && !current.allowRemote
    if (newRemoteHost || enablingRemote) {
      const win = BrowserWindow.fromWebContents(e.sender)
      const options: Electron.MessageBoxOptions = {
        type: 'warning',
        title: tm('security.remoteAi.title'),
        message: tm('security.remoteAi.message'),
        detail: tm('security.remoteAi.detail', { host: remoteHost ? hostname : host.origin }),
        buttons: [tm('security.remoteAi.cancel'), tm('security.remoteAi.allow')],
        defaultId: 0,
        cancelId: 0,
        noLink: true
      }
      const answer = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
      if (answer.response !== 1) return { ok: false, code: 'hostNotAllowed' }
    }
    const saved: AiSettings = { ...settings, host: host.origin }
    await writeAiSettings(saved)
    return { ok: true, settings: saved }
  })

  handle(IpcChannels.aiChat, async (e, raw: unknown) => startChat(e.sender, raw, await readAiSettings()))

  handle(IpcChannels.aiCancel, (e, id: unknown): void => cancelChat(e.sender, id))

  // Instalação do Ollama e modelos: URLs e caminhos de executáveis são fixos no Main.
  handle(IpcChannels.aiInstallInfo, async (): Promise<AiInstallInfo> => getInstallInfo(await readAiSettings()))
  handle(IpcChannels.aiInstallStart, async (e): Promise<AiOpResult> => startInstall(e.sender, await readAiSettings()))
  handle(IpcChannels.aiInstallCancel, (e): void => cancelOp(e.sender, 'install'))
  handle(IpcChannels.aiStartServer, async (e): Promise<AiOpResult> => startServer(e.sender, await readAiSettings()))
  handle(IpcChannels.aiPull, async (e, raw: unknown): Promise<AiOpResult> => startPull(e.sender, raw, await readAiSettings()))
  handle(IpcChannels.aiPullCancel, (e): void => cancelOp(e.sender, 'pull'))
  handle(IpcChannels.aiDeleteModel, async (_e, raw: unknown): Promise<AiOpResult> => {
    const name = z.string().min(1).max(AI_LIMITS.modelChars).safeParse(raw)
    if (!name.success) return { ok: false, code: 'modelNameInvalid' }
    return deleteModel(await readAiSettings(), name.data)
  })
}
