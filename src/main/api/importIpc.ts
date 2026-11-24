// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile, stat } from 'node:fs/promises'
import log from 'electron-log/main'
import { z } from 'zod'
import { API_LIMITS } from '@shared/api/limits'
import { detectFormat } from '@shared/api/import'
import type { WsdlFilesOption } from '@shared/api/import/wsdlFiles'
import { IMPORT_FORMATS, type ApiImportResponse } from '@shared/api/protocol'
import { apiEnvironmentSchema, apiRequestSchema } from '@shared/api/schema'
import { IpcChannels } from '@shared/ipc'
import { assertAuthorized } from '../ipc/access'
import { handle } from '../ipc/secure'
import createImportWorker from './importWorker?nodeWorker'
import { collectWsdlFiles } from './wsdlFiles'

/** Canal de importação: a análise roda numa thread com tempo limite, e o resultado passa pelos schemas. */

const inputSchema = z.object({
  text: z.string().max(API_LIMITS.importChars).optional(),
  path: z.string().min(1).max(4096).optional(),
  format: z.enum(IMPORT_FORMATS)
})

function runInWorker(text: string, format: z.infer<typeof inputSchema>['format'], wsdl?: WsdlFilesOption): Promise<ApiImportResponse> {
  return new Promise((done) => {
    const worker = createImportWorker({})
    let finished = false
    const finish = (result: ApiImportResponse): void => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      void worker.terminate()
      done(result)
    }
    const timer = setTimeout(() => finish({ ok: false, code: 'timeout' }), API_LIMITS.importTimeoutMs)
    worker.once('message', (msg: ApiImportResponse) => finish(msg))
    worker.once('error', (err: Error) => {
      log.warn(`Falha na thread de importação: ${err.message}`)
      finish({ ok: false, code: 'invalid' })
    })
    worker.postMessage({ text, format, wsdl })
  })
}

/** Revalida o resultado da thread com os schemas (a thread não é confiável para o que grava em disco). */
function validate(result: ApiImportResponse): ApiImportResponse {
  if (!result.ok) return result
  try {
    return {
      ...result,
      name: result.name.slice(0, API_LIMITS.nameChars),
      items: result.items.map((i) => ({ folder: i.folder, request: apiRequestSchema.parse(i.request) })),
      environments: result.environments.map((e) => apiEnvironmentSchema.parse(e)),
      variables: result.variables.slice(0, API_LIMITS.variables),
      warnings: result.warnings.slice(0, 20)
    }
  } catch {
    return { ok: false, code: 'invalid' }
  }
}

export function registerImportHandlers(): void {
  handle(IpcChannels.apiImportParse, async (_e, raw: unknown): Promise<ApiImportResponse> => {
    const input = inputSchema.parse(raw)
    let text = input.text
    let wsdlPath: string | undefined
    if (text === undefined) {
      if (!input.path) return { ok: false, code: 'invalid' }
      const path = await assertAuthorized(input.path)
      if ((await stat(path)).size > API_LIMITS.importChars) return { ok: false, code: 'tooLarge' }
      text = await readFile(path, 'utf8')
      wsdlPath = path
    }
    if (text.length > API_LIMITS.importChars) return { ok: false, code: 'tooLarge' }
    // WSDL do disco: o Main lê os arquivos referenciados; colado como texto não há pasta base.
    const isWsdl = input.format === 'wsdl' || (input.format === 'auto' && detectFormat(text) === 'wsdl')
    const wsdl = wsdlPath && isWsdl ? await collectWsdlFiles(wsdlPath, text).catch(() => undefined) : undefined
    return validate(await runInWorker(text, input.format, wsdl))
  })
}
