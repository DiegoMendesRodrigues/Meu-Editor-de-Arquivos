// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Núcleo do sandbox (roda dentro da thread scriptWorker.ts e direto nos testes): QuickJS compilado para
 * WebAssembly com limites de memória, pilha e tempo de CPU. O script não tem require, process, fetch nem
 * arquivos: só a API do prelude, e do host apenas as funções de crypto e uuid (node:crypto).
 */
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { newQuickJSWASMModule, shouldInterruptAfterDeadline, Scope, type QuickJSContext, type QuickJSHandle, type QuickJSWASMModule } from 'quickjs-emscripten'
import type { ScriptLogLine, ScriptTestResult } from '@shared/api/protocol'
import { PRELUDE } from './prelude'
import type { ScriptErrorCode, ScriptInput, ScriptOutput } from './types'

const STACK_BYTES = 200 * 1024
/** Folga para o prelude montar a API e para a coleta final depois de um erro. */
const COLLECT_MS = 1000
const MAX_FIELD = 1_000_000

let modulePromise: Promise<QuickJSWASMModule> | null = null
const loadModule = (): Promise<QuickJSWASMModule> => (modulePromise ??= newQuickJSWASMModule())

const HMAC_ALGS = new Set(['sha1', 'sha256', 'sha512'])
const HASH_ALGS = new Set(['sha1', 'sha256', 'sha512', 'md5'])
const encodingOf = (e: string): 'hex' | 'base64' => (e === 'base64' ? 'base64' : 'hex')

const emptyOutput = (error?: ScriptErrorCode): ScriptOutput => ({ ok: !error, ...(error ? { error } : {}), logs: [], tests: [], envSets: [], varSets: [], secretsRead: [] })

const isString = (v: unknown): v is string => typeof v === 'string'

/** Confere o JSON devolvido pelo prelude (o script pode ter mexido nos protótipos). */
function sanitize(raw: unknown, input: ScriptInput): Pick<ScriptOutput, 'logs' | 'tests' | 'envSets' | 'varSets' | 'secretsRead' | 'req'> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
  const logs: ScriptLogLine[] = []
  for (const l of list(o.logs).slice(0, input.maxLogLines)) {
    const x = l as { level?: unknown; text?: unknown }
    if (x && isString(x.text) && (x.level === 'log' || x.level === 'info' || x.level === 'warn' || x.level === 'error')) logs.push({ level: x.level, text: x.text, phase: input.phase })
  }
  const tests: ScriptTestResult[] = []
  for (const t of list(o.tests).slice(0, 500)) {
    const x = t as { name?: unknown; passed?: unknown; error?: unknown }
    if (x && isString(x.name)) tests.push({ name: x.name, passed: x.passed === true, ...(isString(x.error) ? { error: x.error } : {}) })
  }
  const envSets: ScriptOutput['envSets'] = []
  for (const e of list(o.envSets).slice(0, 1000)) {
    const x = e as { name?: unknown; value?: unknown; secret?: unknown }
    if (x && isString(x.name) && isString(x.value)) envSets.push({ name: x.name, value: x.value, secret: x.secret === true })
  }
  const varSets: ScriptOutput['varSets'] = []
  for (const e of list(o.varSets).slice(0, 1000)) {
    const x = e as { name?: unknown; value?: unknown }
    if (x && isString(x.name) && isString(x.value)) varSets.push({ name: x.name, value: x.value })
  }
  const secretsRead = list(o.secretsRead).filter(isString).slice(0, 1000)
  let req: ScriptOutput['req']
  if (input.phase === 'pre' && o.req && typeof o.req === 'object') {
    const r = o.req as { method?: unknown; url?: unknown; headers?: unknown; body?: unknown }
    if (isString(r.method) && isString(r.url) && isString(r.body)) {
      const headers: [string, string][] = []
      for (const h of list(r.headers).slice(0, 500)) if (Array.isArray(h) && isString(h[0]) && isString(h[1])) headers.push([h[0].slice(0, MAX_FIELD), h[1].slice(0, MAX_FIELD)])
      req = { method: r.method.slice(0, 64), url: r.url.slice(0, MAX_FIELD), headers, body: r.body.slice(0, MAX_FIELD) }
    }
  }
  return { logs, tests, envSets, varSets, secretsRead, ...(req ? { req } : {}) }
}

/** Instala as funções do host (só crypto e uuid) no escopo global do sandbox. */
function installHost(ctx: QuickJSContext, scope: Scope): void {
  const str = (h: Parameters<QuickJSContext['getString']>[0]): string => ctx.getString(h)
  const def = (name: string, fn: (...args: string[]) => string): void => {
    const f = scope.manage(
      ctx.newFunction(name, (...handles) => {
        // Erro no host (algoritmo desconhecido, por exemplo) vira exceção dentro do script.
        return ctx.newString(fn(...handles.map(str)))
      })
    )
    ctx.setProp(ctx.global, name, f)
  }
  def('__hmac', (alg, key, data, e) => {
    if (!HMAC_ALGS.has(alg)) throw new Error('unsupported hmac algorithm')
    return createHmac(alg, key).update(data, 'utf8').digest(encodingOf(e))
  })
  def('__hash', (alg, data, e) => {
    if (!HASH_ALGS.has(alg)) throw new Error('unsupported hash algorithm')
    return createHash(alg).update(data, 'utf8').digest(encodingOf(e))
  })
  def('__uuid', () => randomUUID())
  def('__b64e', (data) => Buffer.from(data, 'utf8').toString('base64'))
  def('__b64d', (data) => Buffer.from(data, 'base64').toString('utf8'))
}

interface VmError {
  name?: string
  message?: string
  stack?: string
}

function lineOf(stack: string | undefined): number | undefined {
  const m = /script\.js:(\d+)/.exec(stack ?? '')
  return m ? Number(m[1]) : undefined
}

/**
 * Roda um script no sandbox e devolve console, testes, variáveis e a requisição final. Nunca lança:
 * erros e estouros viram `error` (scriptTimeout, scriptMemory ou scriptError) com a linha no console.
 */
export async function runScriptCore(input: ScriptInput): Promise<ScriptOutput> {
  let QuickJS: QuickJSWASMModule
  try {
    QuickJS = await loadModule()
  } catch {
    return emptyOutput('scriptError')
  }
  return Scope.withScope((scope) => {
    const runtime = scope.manage(QuickJS.newRuntime())
    runtime.setMemoryLimit(input.memoryBytes)
    runtime.setMaxStackSize(STACK_BYTES)
    let timedOut = false
    const arm = (ms: number): void => {
      const should = shouldInterruptAfterDeadline(Date.now() + ms)
      runtime.setInterruptHandler((rt) => {
        const stop = should(rt)
        if (stop) timedOut = true
        return stop
      })
    }
    const ctx = scope.manage(runtime.newContext())

    let collectFn: QuickJSHandle
    let error: ScriptErrorCode | undefined
    const extraLogs: ScriptLogLine[] = []
    const fail = (e: VmError): void => {
      const message = `${e.message ?? ''}`
      error = timedOut ? 'scriptTimeout' : /out of memory/i.test(message) ? 'scriptMemory' : 'scriptError'
      const line = lineOf(e.stack)
      const text = timedOut ? 'execution time limit exceeded' : error === 'scriptMemory' ? 'memory limit exceeded' : `${e.name ?? 'Error'}: ${message}`
      extraLogs.push({ level: 'error', text: `script${line ? `:${line}` : ''}: ${text}`.slice(0, 1000), phase: input.phase })
    }

    try {
      arm(COLLECT_MS + input.cpuMs)
      installHost(ctx, scope)
      const prelude = scope.manage(ctx.unwrapResult(ctx.evalCode(PRELUDE, 'prelude.js')))
      const state = {
        phase: input.phase,
        maxLogLines: input.maxLogLines,
        values: input.values,
        secretNames: input.secretNames,
        req: input.req,
        res: input.res ?? null
      }
      const stateHandle = scope.manage(ctx.newString(JSON.stringify(state)))
      collectFn = scope.manage(ctx.unwrapResult(ctx.callFunction(prelude, ctx.undefined, stateHandle)))
    } catch {
      return emptyOutput('scriptError')
    }

    // O tempo de CPU conta só a partir do script do usuário.
    arm(input.cpuMs)
    const run = ctx.evalCode(input.code, 'script.js')
    if (run.error) {
      fail(ctx.dump(scope.manage(run.error)) as VmError)
    } else {
      scope.manage(run.value)
      // Promessas (test assíncrono, async/await) avançam aqui.
      for (let guard = 0; guard < 1000; guard++) {
        const jobs = runtime.executePendingJobs()
        if (jobs.error) {
          fail(ctx.dump(scope.manage(jobs.error)) as VmError)
          break
        }
        if (jobs.value === 0) break
      }
    }

    // Coleta o que o script fez (mesmo depois de um erro), com um prazo curto próprio.
    arm(COLLECT_MS)
    let collected: ReturnType<typeof sanitize>
    try {
      const out = ctx.unwrapResult(ctx.callFunction(collectFn, ctx.undefined))
      const json = scope.manage(out)
      collected = sanitize(JSON.parse(ctx.getString(json)), input)
    } catch {
      collected = { logs: [], tests: [], envSets: [], varSets: [], secretsRead: [] }
      error ??= 'scriptError'
    }
    return {
      ok: !error,
      ...(error ? { error } : {}),
      ...collected,
      logs: [...collected.logs, ...extraLogs].slice(0, input.maxLogLines + 1)
    }
  })
}
