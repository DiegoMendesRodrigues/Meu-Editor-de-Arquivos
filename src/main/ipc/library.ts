import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'
import { z } from 'zod'
import { IpcChannels } from '@shared/ipc'
import { handle } from './secure'

/** Snippets e macros do usuário: JSON na pasta de dados, gravado de forma atômica. */
const snippetSchema = z.array(
  z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    prefix: z.string().min(1).max(100),
    body: z.string().max(100_000)
  })
).max(2000)

const macroSchema = z.array(
  z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    steps: z
      .array(
        z.discriminatedUnion('type', [
          z.object({ type: z.literal('text'), text: z.string().max(100_000) }),
          z.object({ type: z.literal('command'), id: z.string().min(1).max(100) })
        ])
      )
      .max(100_000)
  })
).max(500)

const kindSchema = z.enum(['snippets', 'macros'])
const schemas = { snippets: snippetSchema, macros: macroSchema }

const filePath = (kind: 'snippets' | 'macros'): string => join(app.getPath('userData'), `${kind}.json`)

const writing: Record<string, Promise<void>> = {}

export function registerLibraryHandlers(): void {
  handle(IpcChannels.libraryLoad, async (_e, rawKind: unknown): Promise<unknown[]> => {
    const kind = kindSchema.parse(rawKind)
    try {
      return schemas[kind].parse(JSON.parse(await readFile(filePath(kind), 'utf8')))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') log.warn(`${kind} ignorados (inválidos): ${String(err)}`)
      return []
    }
  })

  handle(IpcChannels.librarySave, async (_e, rawKind: unknown, raw: unknown): Promise<void> => {
    const kind = kindSchema.parse(rawKind)
    const data = schemas[kind].parse(raw)
    const target = filePath(kind)
    writing[kind] = (writing[kind] ?? Promise.resolve())
      .then(async () => {
        await writeFile(`${target}.tmp`, JSON.stringify(data, null, 2), 'utf8')
        await rename(`${target}.tmp`, target)
      })
      .catch((err) => log.error(`Falha ao gravar ${kind}: ${String(err)}`))
    await writing[kind]
  })
}
