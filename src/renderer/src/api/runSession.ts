// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Execuções em andamento do executor de coleção: recebe o andamento do Main e mantém o documento
 * .apirun atualizado. O relatório fica na memória daqui e vai para o documento no máximo a cada 250 ms
 * (reescrever o JSON inteiro a cada item seria quadrático em execuções grandes).
 */
import type { ApiRunInput, ApiRunProgress } from '@shared/api/protocol'
import { newRunReport, serializeApiRun, summarizeItems, withItems, type ApiRunReport } from '@shared/api/reports'
import { useDocuments } from '@/store/documents'

interface Session {
  docId: string
  report: ApiRunReport
  timer: ReturnType<typeof setTimeout> | null
}

const sessions = new Map<string, Session>()
let unsubscribe: (() => void) | null = null

/** A execução ainda está viva neste processo (depois de recarregar o app, um relatório "em execução" está interrompido). */
export const isRunActive = (runId: string | null | undefined): boolean => !!runId && sessions.has(runId)

function flush(s: Session): void {
  if (s.timer) clearTimeout(s.timer)
  s.timer = null
  useDocuments.getState().updateContent(s.docId, serializeApiRun(s.report))
}

function onProgress(p: ApiRunProgress): void {
  const s = sessions.get(p.runId)
  if (!s) return
  if (p.item) s.report = withItems(s.report, [p.item])
  if (p.finished) {
    const stopped = !p.cancelled && s.report.options.stopOnFailure && p.done < p.total
    s.report = {
      ...s.report,
      runId: null,
      status: p.cancelled ? 'cancelled' : stopped ? 'stopped' : 'finished',
      finishedAt: new Date().toISOString(),
      summary: summarizeItems(s.report.items)
    }
    flush(s)
    sessions.delete(p.runId)
    if (sessions.size === 0) {
      unsubscribe?.()
      unsubscribe = null
    }
    return
  }
  s.timer ??= setTimeout(() => flush(s), 250)
}

export interface StartRunOptions {
  /** Nome da coleção, no relatório. */
  collectionName: string
  /** Nome do documento .apirun (sem a extensão). */
  docName: string
  environmentName: string | null
  input: ApiRunInput & { runId: string }
  expected: number
  dataRows: number
}

/**
 * Abre o documento do relatório e inicia a execução no Main. Se o Main recusar, o documento é fechado
 * e o erro sobe para quem chamou.
 */
export async function startRun(o: StartRunOptions): Promise<string> {
  const report = newRunReport({
    name: o.collectionName,
    startedAt: new Date().toISOString(),
    environment: o.environmentName,
    runId: o.input.runId,
    expected: o.expected,
    options: {
      iterations: o.input.iterations ?? 1,
      delayMs: o.input.delayMs ?? 0,
      stopOnFailure: o.input.stopOnFailure ?? false,
      dataRows: o.dataRows,
      requests: o.input.items.length
    }
  })
  const docId = useDocuments.getState().newDocumentWithContent(`${o.docName}.apirun`, serializeApiRun(report))
  sessions.set(o.input.runId, { docId, report, timer: null })
  unsubscribe ??= window.api.onApiRunProgress(onProgress)
  try {
    await window.api.apiRunStart(o.input)
  } catch (err) {
    const s = sessions.get(o.input.runId)
    if (s?.timer) clearTimeout(s.timer)
    sessions.delete(o.input.runId)
    useDocuments.getState().closeDocument(docId)
    if (sessions.size === 0) {
      unsubscribe?.()
      unsubscribe = null
    }
    throw err
  }
  return docId
}
