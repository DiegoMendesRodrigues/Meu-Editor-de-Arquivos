import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels, type SessionData } from '@shared/ipc'
import { authorizeFile, authorizeRoot } from './access'
import { handle } from './secure'

/**
 * Sessão do editor: abas abertas, pasta, preferências e textos não salvos.
 * Fica na pasta de dados do usuário e é gravada de forma atômica
 * (arquivo temporário + renomear), para não corromper se o app travar no meio.
 */
const MAX_SESSION_CHARS = 100 * 1024 * 1024

export const sessionSchema = z.object({
  version: z.literal(1),
  folder: z.string().min(1).nullable(),
  activeIndex: z.number().int().min(-1),
  documents: z
    .array(
      z.object({
        path: z.string().min(1).nullable(),
        name: z.string().min(1).max(1024),
        mode: z.enum(['preview', 'edit']),
        encoding: z.enum(['UTF-8', 'UTF-8 BOM']),
        eol: z.enum(['LF', 'CRLF']),
        language: z.string().max(40).optional(),
        cloud: z.object({ id: z.string().min(1).max(64), path: z.string().min(1).max(512), version: z.number().int().min(0) }).optional(),
        unsavedContent: z.string().optional()
      })
    )
    .max(500),
  view: z.object({
    sidebarVisible: z.boolean(),
    bottomPanelVisible: z.boolean(),
    wordWrap: z.boolean(),
    showInvisibles: z.boolean(),
    insertSpaces: z.boolean().optional(),
    fontSize: z.number().int().min(8).max(40).optional(),
    tabSize: z.number().int().min(1).max(16).optional()
  })
})

const sessionPath = (): string => join(app.getPath('userData'), 'session.json')

/** Serializa as gravações: a última sempre vence e nunca há duas ao mesmo tempo. */
let writing: Promise<void> = Promise.resolve()

async function persist(data: SessionData): Promise<void> {
  const target = sessionPath()
  const tmp = `${target}.tmp`
  await writeFile(tmp, JSON.stringify(data), 'utf8')
  await rename(tmp, target)
}

export function registerSessionHandlers(): void {
  handle(IpcChannels.sessionLoad, async (): Promise<SessionData | null> => {
    let data: SessionData
    try {
      data = sessionSchema.parse(JSON.parse(await readFile(sessionPath(), 'utf8')))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') log.warn(`Sessão ignorada (inválida): ${String(err)}`)
      return null
    }
    // Arquivos e pasta da sessão foram escolhidos pelo usuário antes; podem ser reabertos.
    for (const doc of data.documents) if (doc.path) authorizeFile(doc.path)
    if (data.folder) authorizeRoot(data.folder)
    return data
  })

  handle(IpcChannels.sessionSave, async (_e, raw: unknown): Promise<void> => {
    const data = sessionSchema.parse(raw)
    const size = data.documents.reduce((n, d) => n + (d.unsavedContent?.length ?? 0), 0)
    if (size > MAX_SESSION_CHARS) {
      // Textos não salvos muito grandes não entram no backup; o restante da sessão sim.
      log.warn('Textos não salvos acima do limite; backup salvo sem o conteúdo.')
      data.documents = data.documents.map(({ unsavedContent: _, ...d }) => d)
    }
    writing = writing.then(() => persist(data)).catch((err) => log.error(`Falha ao gravar a sessão: ${String(err)}`))
    await writing
  })
}
