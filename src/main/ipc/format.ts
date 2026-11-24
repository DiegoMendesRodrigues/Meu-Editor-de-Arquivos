// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import log from 'electron-log/main'
import { z } from 'zod'
import { FORMAT_MAX_CHARS, IpcChannels, type FormatResult } from '@shared/ipc'
import { tm } from '../i18n'
import { handle } from './secure'
import createFormatWorker from '../format/formatWorker?nodeWorker'

/** Tempo máximo de uma formatação. */
const TIMEOUT_MS = 30_000

const languageSchema = z.string().regex(/^[a-z0-9]{1,20}$/)
const extensionSchema = z.string().regex(/^[a-z0-9]{0,10}$/)
const textSchema = z.string().max(FORMAT_MAX_CHARS)

/** Formata numa thread própria, encerrada ao terminar ou ao passar do tempo limite. */
function formatInWorker(language: string, extension: string, text: string): Promise<FormatResult> {
  return new Promise((done, fail) => {
    const worker = createFormatWorker({})
    const finish = (): void => {
      clearTimeout(timer)
      void worker.terminate()
    }
    const timer = setTimeout(() => {
      finish()
      fail(new Error(tm('err.formatTimeout')))
    }, TIMEOUT_MS)
    worker.once('message', (msg: { ok: true; result: FormatResult } | { ok: false; message: string }) => {
      finish()
      if (msg.ok) return done(msg.result)
      log.warn(`Auto formatação (${language}) falhou: ${msg.message}`)
      done({ status: 'invalid' })
    })
    worker.once('error', (err: Error) => {
      finish()
      log.warn(`Auto formatação (${language}) falhou: ${err.message}`)
      done({ status: 'invalid' })
    })
    worker.postMessage({ language, extension, text })
  })
}

export function registerFormatHandlers(): void {
  handle(IpcChannels.formatCode, (_e, language: unknown, extension: unknown, text: unknown) =>
    formatInWorker(languageSchema.parse(language), extensionSchema.parse(extension), textSchema.parse(text))
  )
}
