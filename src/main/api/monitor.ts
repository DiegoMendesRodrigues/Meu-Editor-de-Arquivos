// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Monitores de coleção (fase 5): núcleo sem Electron (testável). Guarda a configuração e as últimas
 * execuções em um JSON, agenda com setTimeout em sequência (nunca duas execuções do mesmo monitor ao
 * mesmo tempo) e avisa só na passagem de ok para falha e na recuperação. Só roda com o app aberto.
 */
import { readFile, rename, writeFile } from 'node:fs/promises'
import { API_LIMITS } from '@shared/api/limits'
import { monitorSchema, type ApiMonitor, type ApiMonitorRun, type ApiMonitorSaveResult, type ApiMonitorState } from '@shared/api/protocol'

export type MonitorNotice = 'failed' | 'recovered'

type Stored = ApiMonitor & { runs: ApiMonitorRun[] }

export interface MonitorStore {
  load(): Promise<Stored[]>
  save(list: Stored[]): Promise<void>
}

export interface MonitorDeps {
  store: MonitorStore
  /** Executa a coleção uma vez e resume o resultado. */
  execute(monitor: ApiMonitor, signal: AbortSignal): Promise<Omit<ApiMonitorRun, 'at'>>
  /** O caminho está autorizado na sessão atual (diálogo ou pasta aberta)? */
  isAuthorized(path: string): Promise<boolean>
  /** Coleção da nuvem: há conta conectada e a pasta (e o ambiente, se houver) existe(m) na nuvem? */
  checkCloud(dir: string, environment?: string): Promise<'ok' | 'notSignedIn' | 'notFound'>
  /** O arquivo está dentro da pasta? */
  isInsideDir(dir: string, path: string): boolean
  notify(monitor: ApiMonitor, notice: MonitorNotice, run: ApiMonitorRun): void
  emit(state: ApiMonitorState): void
  log(monitorId: string, run: ApiMonitorRun): void
  now?: () => number
}

interface Entry {
  monitor: ApiMonitor
  runs: ApiMonitorRun[]
  running: boolean
  timer?: ReturnType<typeof setTimeout>
  nextAt?: number
  controller?: AbortController
}

const DELAY_AT_START_MS = 5_000

const isRun = (r: unknown): r is ApiMonitorRun => {
  const x = r as ApiMonitorRun
  return !!x && typeof x.at === 'string' && typeof x.ok === 'boolean' && [x.passed, x.failed, x.errors, x.totalMs, x.avgMs].every((n) => typeof n === 'number' && Number.isFinite(n))
}

/** Armazenamento em arquivo: gravação atômica (temporário e rename), em fila. */
export function createFileStore(path: string, onWarn: (msg: string) => void = () => {}): MonitorStore {
  let writing: Promise<void> = Promise.resolve()
  return {
    async load() {
      try {
        const data = JSON.parse(await readFile(path, 'utf8')) as { monitors?: unknown }
        const out: Stored[] = []
        if (Array.isArray(data.monitors)) {
          for (const raw of data.monitors.slice(0, API_LIMITS.monitors)) {
            const parsed = monitorSchema.safeParse(raw)
            if (!parsed.success) continue
            const rawRuns = (raw as { runs?: unknown }).runs
            const runs = Array.isArray(rawRuns) ? rawRuns.filter(isRun).slice(-API_LIMITS.monitorRuns) : []
            out.push({ ...parsed.data, runs })
          }
        }
        return out
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') onWarn('Cliente de API: monitores ilegíveis, começando vazio')
        return []
      }
    },
    save(list) {
      const text = JSON.stringify({ version: 1, monitors: list })
      writing = writing
        .then(async () => {
          const tmp = `${path}.tmp`
          await writeFile(tmp, text, 'utf8')
          await rename(tmp, path)
        })
        .catch(() => onWarn('Cliente de API: falha ao gravar os monitores'))
      return writing
    }
  }
}

export function createMonitorService(deps: MonitorDeps) {
  const now = deps.now ?? Date.now
  const entries = new Map<string, Entry>()
  let loaded: Promise<void> | null = null

  const ensureLoaded = (): Promise<void> =>
    (loaded ??= deps.store.load().then((list) => {
      for (const m of list) {
        const { runs, ...monitor } = m
        entries.set(monitor.id, { monitor, runs, running: false })
      }
    }))

  const stateOf = (e: Entry): ApiMonitorState => ({
    ...e.monitor,
    runs: [...e.runs],
    running: e.running,
    ...(e.nextAt !== undefined ? { nextAt: new Date(e.nextAt).toISOString() } : {})
  })

  const persist = (): Promise<void> => deps.store.save([...entries.values()].map((e) => ({ ...e.monitor, runs: e.runs })))

  const clearTimer = (e: Entry): void => {
    if (e.timer) clearTimeout(e.timer)
    e.timer = undefined
    e.nextAt = undefined
  }

  /** Agenda a próxima execução (ou a primeira, com `delayMs`). Nunca deixa dois temporizadores. */
  function schedule(e: Entry, delayMs?: number): void {
    clearTimer(e)
    if (!e.monitor.enabled) return
    const ms = delayMs ?? e.monitor.intervalMin * 60_000
    e.nextAt = now() + ms
    e.timer = setTimeout(() => void run(e), ms)
    e.timer.unref?.()
  }

  async function run(e: Entry): Promise<void> {
    if (e.running) return
    clearTimer(e)
    e.running = true
    const controller = new AbortController()
    e.controller = controller
    deps.emit(stateOf(e))
    const monitor = e.monitor
    let summary: Omit<ApiMonitorRun, 'at'>
    try {
      summary = await deps.execute(monitor, controller.signal)
    } catch {
      summary = { ok: false, passed: 0, failed: 0, errors: 1, totalMs: 0, avgMs: 0 }
    }
    e.controller = undefined
    e.running = false
    // Monitor excluído durante a execução: não guarda nem reagenda.
    if (controller.signal.aborted || entries.get(monitor.id) !== e) return
    const previous = e.runs[e.runs.length - 1]
    const result: ApiMonitorRun = { at: new Date(now()).toISOString(), ...summary }
    e.runs.push(result)
    if (e.runs.length > API_LIMITS.monitorRuns) e.runs.splice(0, e.runs.length - API_LIMITS.monitorRuns)
    deps.log(monitor.id, result)
    // Avisa na passagem ok -> falha (e na primeira execução, se falhou) e na recuperação.
    if (e.monitor.notifyOnFailure) {
      if (!result.ok && (!previous || previous.ok)) deps.notify(e.monitor, 'failed', result)
      else if (result.ok && previous && !previous.ok) deps.notify(e.monitor, 'recovered', result)
    }
    schedule(e)
    deps.emit(stateOf(e))
    await persist()
  }

  return {
    async list(): Promise<ApiMonitorState[]> {
      await ensureLoaded()
      return [...entries.values()].map(stateOf)
    },

    async save(input: unknown): Promise<ApiMonitorSaveResult> {
      await ensureLoaded()
      const parsed = monitorSchema.safeParse(input)
      if (!parsed.success) return { ok: false, code: 'invalid' }
      const monitor = parsed.data
      const existing = entries.get(monitor.id)
      if (!existing && entries.size >= API_LIMITS.monitors) return { ok: false, code: 'tooManyMonitors' }
      // Pasta já conferida ao salvar antes (mesmo monitor, mesma pasta): vale depois de reabrir o app.
      const sameDir = existing?.monitor.collectionDir === monitor.collectionDir && existing.monitor.location === monitor.location
      const envChanged = !!monitor.environment && (existing?.monitor.environment !== monitor.environment || !sameDir)
      if (envChanged && !/\.apienv$/i.test(monitor.environment!)) return { ok: false, code: 'invalid' }
      if (monitor.location === 'cloud') {
        // Nuvem: no lugar da autorização de disco, exige conta conectada e a pasta existente. Só relê o que mudou.
        if (!sameDir || envChanged) {
          const check = await deps.checkCloud(monitor.collectionDir, envChanged ? monitor.environment : undefined)
          if (check === 'notSignedIn') return { ok: false, code: 'notSignedIn' }
          if (check === 'notFound') return { ok: false, code: 'cloudNotFound' }
        }
      } else {
        if (!sameDir && !(await deps.isAuthorized(monitor.collectionDir))) return { ok: false, code: 'notAuthorized' }
        if (envChanged && !deps.isInsideDir(monitor.collectionDir, monitor.environment!) && !(await deps.isAuthorized(monitor.environment!))) return { ok: false, code: 'notAuthorized' }
      }
      let e = existing
      if (e) e.monitor = monitor
      else {
        e = { monitor, runs: [], running: false }
        entries.set(monitor.id, e)
      }
      // Reagenda só se o intervalo, o estado ou a existência mudaram; uma execução em curso segue sozinha.
      if (!e.running) schedule(e)
      await persist()
      const state = stateOf(e)
      deps.emit(state)
      return { ok: true, monitor: state }
    },

    async remove(id: string): Promise<void> {
      await ensureLoaded()
      const e = entries.get(id)
      if (!e) return
      clearTimer(e)
      e.controller?.abort()
      entries.delete(id)
      await persist()
    },

    async runNow(id: string): Promise<void> {
      await ensureLoaded()
      const e = entries.get(id)
      if (e) await run(e)
    },

    /** Ao abrir o app: os monitores habilitados voltam a rodar, com um pequeno atraso. */
    async start(delayMs = DELAY_AT_START_MS): Promise<void> {
      await ensureLoaded()
      for (const e of entries.values()) schedule(e, delayMs)
    },

    stop(): void {
      for (const e of entries.values()) {
        clearTimer(e)
        e.controller?.abort()
      }
    }
  }
}

export type MonitorService = ReturnType<typeof createMonitorService>
