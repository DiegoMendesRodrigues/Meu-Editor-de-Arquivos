// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { z } from 'zod'
import { AI_LIMITS, aiSettingsSchema, type AiInstallInfo, type AiOpResult, type AiSetSettingsResult, type AiSettings, type AiStatus } from '@shared/ai'
import { IpcChannels } from '@shared/ipc'
import { handle } from '../ipc/secure'
import { cancelChat, startChat } from './generations'
import { cancelOp, getInstallInfo, startInstall, startPull, startServer } from './installOps'
import { checkHost, getStatus } from './ollama'
import { deleteModel } from './pull'
import { readAiSettings, writeAiSettings } from './settings'

/** Canais do assistente de IA local. Todos passam por handle() e validam a entrada com Zod. */
export function registerAiHandlers(): void {
  handle(IpcChannels.aiStatus, async (): Promise<AiStatus> => getStatus(await readAiSettings()))

  handle(IpcChannels.aiGetSettings, (): Promise<AiSettings> => readAiSettings())

  handle(IpcChannels.aiSetSettings, async (_e, raw: unknown): Promise<AiSetSettingsResult> => {
    const parsed = aiSettingsSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, code: 'invalidSettings' }
    const settings = parsed.data
    const host = checkHost(settings.host, settings.allowRemote)
    if (!host.ok) return { ok: false, code: host.code }
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
