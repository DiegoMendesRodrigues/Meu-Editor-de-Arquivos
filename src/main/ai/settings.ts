// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import { aiSettingsSchema, DEFAULT_AI_SETTINGS, type AiSettings } from '@shared/ai'
import { checkHost } from './ollama'

/** Configuração do assistente em userData/ai-settings.json (endereço, modelo, temperatura e opção remota). */
const file = (): string => join(app.getPath('userData'), 'ai-settings.json')

export async function readAiSettings(): Promise<AiSettings> {
  try {
    const parsed = aiSettingsSchema.safeParse(JSON.parse(await readFile(file(), 'utf8')))
    if (!parsed.success) return { ...DEFAULT_AI_SETTINGS }
    // Arquivo editado à mão com um host não permitido: volta ao padrão local.
    if (!checkHost(parsed.data.host, parsed.data.allowRemote).ok) return { ...parsed.data, host: DEFAULT_AI_SETTINGS.host, allowRemote: false }
    return parsed.data
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export async function writeAiSettings(settings: AiSettings): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  const tmp = `${file()}.tmp`
  await writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8')
  await rename(tmp, file())
}
