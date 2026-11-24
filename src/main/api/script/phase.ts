// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Uma fase de script ("antes" ou "depois") dentro do envio: tira a foto das variáveis, roda o sandbox e
 * aplica o que o script fez (segredos no cofre, variáveis temporárias, extrações de origem script).
 * Fica separado do engine.ts para o engine continuar legível.
 */
import { API_LIMITS } from '@shared/api/limits'
import type { ExtractionResult, ScriptLogLine, ScriptTestResult } from '@shared/api/protocol'
import { VARIABLE_NAME_RE } from '@shared/api/variables'
import type { Resolver } from '../resolve'
import { secretVault } from '../vault'
import { runScript } from './index'
import { createScriptSender } from './netSend'
import type { ScriptErrorCode, ScriptPhase, ScriptRequestView, ScriptResponseView } from './types'

export interface PhaseResult {
  logs: ScriptLogLine[]
  tests: ScriptTestResult[]
  /** env.set comuns, no formato das extrações (o Renderer grava no ambiente como faz com as extrações). */
  extracted: ExtractionResult[]
  error?: ScriptErrorCode
  /** Requisição ao fim do script "antes". */
  req?: ScriptRequestView
}

const MAX_EXTRACTED = 200

export async function runScriptPhase(opts: { phase: ScriptPhase; code: string; r: Resolver; req: ScriptRequestView; res?: ScriptResponseView; signal?: AbortSignal }): Promise<PhaseResult> {
  const { r } = opts
  const snap = r.snapshot()
  const out = await runScript({
    phase: opts.phase,
    code: opts.code,
    cpuMs: API_LIMITS.scriptCpuMs,
    memoryBytes: API_LIMITS.scriptMemoryBytes,
    maxLogLines: API_LIMITS.scriptConsoleLines,
    values: snap.values,
    secretNames: snap.secretNames,
    req: opts.req,
    res: opts.res
  }, createScriptSender(r, opts.signal))

  // Segredo que o script leu passa a ser "usado": o host precisa estar confirmado e o valor é mascarado.
  const secretNames = new Set(snap.secretNames)
  for (const name of out.secretsRead) if (secretNames.has(name)) r.lookup(name)

  const extracted: ExtractionResult[] = []
  for (const v of out.varSets) if (VARIABLE_NAME_RE.test(v.name) && v.name !== '__proto__' && v.value.length <= API_LIMITS.valueChars) r.setTemporary(v.name, v.value)
  // Valor "comum" que carrega um segredo conhecido (env.set('x', env.get('token'))) é tratado como segredo.
  const knownSecrets = snap.secretNames.map((n) => snap.values[n]).filter((v): v is string => typeof v === 'string' && v.length > 0)
  for (const e0 of out.envSets.slice(0, MAX_EXTRACTED)) {
    const e = e0.secret || !knownSecrets.some((sv) => e0.value.includes(sv)) ? e0 : { ...e0, secret: true }
    if (!VARIABLE_NAME_RE.test(e.name) || e.name === '__proto__') continue
    if (e.secret) {
      let ok = true
      try {
        if (e.value.length > API_LIMITS.secretChars) throw new Error('grande')
        await secretVault.set(r.scope, e.name, e.value)
      } catch {
        ok = false
      }
      if (ok) {
        r.addSecret(e.value)
        r.setTemporary(e.name, e.value)
      }
      extracted.push({ to: e.name, secret: true, ok })
    } else {
      const ok = e.value.length <= API_LIMITS.valueChars
      if (ok) r.setTemporary(e.name, e.value)
      extracted.push({ to: e.name, secret: false, ok, ...(ok ? { value: e.value } : {}) })
    }
  }
  return { logs: out.logs, tests: out.tests, extracted, ...(out.error ? { error: out.error } : {}), ...(out.req ? { req: out.req } : {}) }
}
