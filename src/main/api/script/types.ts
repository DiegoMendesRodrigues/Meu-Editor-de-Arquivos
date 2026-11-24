// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Contrato entre o Main e a thread do sandbox QuickJS (tudo serializável). */
import type { ScriptLogLine, ScriptTestResult } from '@shared/api/protocol'

export type ScriptPhase = 'pre' | 'post'
export type ScriptErrorCode = 'scriptTimeout' | 'scriptMemory' | 'scriptError'

export interface ScriptRequestView {
  method: string
  url: string
  headers: [string, string][]
  body: string
}

export interface ScriptResponseView {
  status: number
  statusText: string
  headers: [string, string][]
  body: string
  responseTime: number
}

export interface ScriptInput {
  phase: ScriptPhase
  code: string
  /** Tempo de CPU do script (o laço infinito é interrompido aqui). */
  cpuMs: number
  memoryBytes: number
  maxLogLines: number
  /** Variáveis visíveis (escopos já combinados) e quais delas são segredos. */
  values: Record<string, string>
  secretNames: string[]
  req: ScriptRequestView
  res?: ScriptResponseView
}

export interface ScriptOutput {
  ok: boolean
  error?: ScriptErrorCode
  logs: ScriptLogLine[]
  tests: ScriptTestResult[]
  envSets: { name: string; value: string; secret: boolean }[]
  varSets: { name: string; value: string }[]
  /** Segredos que o script leu com env.get (viram "usados" para a confirmação de host e a máscara). */
  secretsRead: string[]
  /** Requisição no fim do script "antes". */
  req?: ScriptRequestView
}

/** O mínimo que o runner usa de um worker_thread. */
export interface ScriptWorkerLike {
  postMessage(msg: ScriptInput): void
  terminate(): Promise<number> | void
  on(event: 'message', fn: (msg: ScriptOutput) => void): unknown
  on(event: 'error', fn: (err: Error) => void): unknown
  on(event: 'exit', fn: (code: number) => void): unknown
}
