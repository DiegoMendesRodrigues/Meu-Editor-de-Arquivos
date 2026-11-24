// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { aiSettingsSchema, type AiSetSettingsResult, type AiSettings, type AiStatus } from '@shared/ai'
import { IpcChannels } from '@shared/ipc'
import { handle } from '../ipc/secure'
import { cancelChat, startChat } from './generations'
import { checkHost, getStatus } from './ollama'
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
}
