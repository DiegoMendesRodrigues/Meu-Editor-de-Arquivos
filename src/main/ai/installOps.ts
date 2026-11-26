// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { app, type WebContents } from 'electron'
import log from 'electron-log/main'
import { aiModelNameSchema, type AiInstallInfo, type AiInstallProgress, type AiOpResult, type AiSettings } from '@shared/ai'
import { IpcChannels } from '@shared/ipc'
import {
  downloadFile,
  findOllama,
  resolveDownloadConfig,
  runInstall,
  runInstallerProcess,
  stageInstaller,
  startOllamaProcess,
  verifySignature,
  waitForServer,
  realDetectDeps
} from './install'
import { getStatus } from './ollama'
import { pullModel } from './pull'

/**
 * Operações longas do assistente (instalar o Ollama, baixar modelo, iniciar o servidor). Uma de cada tipo por vez;
 * só a janela que iniciou acompanha e cancela, e tudo é cancelado quando ela fecha ou recarrega.
 */

type Kind = 'install' | 'pull' | 'start'
interface Op {
  owner: WebContents
  controller: AbortController
}

const running = new Map<Kind, Op>()
const watched = new WeakSet<WebContents>()

const PING_TIMEOUTS = { connectMs: 1_500, idleMs: 1_500 }

function emit(owner: WebContents, progress: AiInstallProgress): void {
  if (!owner.isDestroyed()) owner.send(IpcChannels.aiInstallProgress, progress)
}

/** Cancela tudo o que a janela iniciou. */
export function cancelOwnedOps(owner: WebContents): void {
  for (const [kind, op] of running) {
    if (op.owner !== owner) continue
    running.delete(kind)
    op.controller.abort()
  }
}

function watchOwner(owner: WebContents): void {
  if (watched.has(owner)) return
  watched.add(owner)
  owner.once('destroyed', () => cancelOwnedOps(owner))
  owner.on('did-start-navigation', (details) => {
    if (details.isMainFrame && !details.isSameDocument) cancelOwnedOps(owner)
  })
}

/** Só quem iniciou cancela. */
export function cancelOp(owner: WebContents, kind: Kind): void {
  const op = running.get(kind)
  if (op && op.owner === owner) op.controller.abort()
}

function begin(owner: WebContents, kind: Kind): AbortController | null {
  if (running.has(kind)) return null
  watchOwner(owner)
  const controller = new AbortController()
  running.set(kind, { owner, controller })
  return controller
}

const end = (kind: Kind, controller: AbortController): void => {
  if (running.get(kind)?.controller === controller) running.delete(kind)
}

/** Limita os eventos de progresso a um a cada 100 ms (o último de cada etapa sempre sai pelo `done`). */
function throttled(fn: (a: number, b: number) => void): (a: number, b: number) => void {
  let last = 0
  return (a, b) => {
    const now = Date.now()
    if (now - last < 100 && a !== b) return
    last = now
    fn(a, b)
  }
}

const pingOf = (settings: AiSettings) => async (): Promise<boolean> => (await getStatus(settings, PING_TIMEOUTS)).ok

export async function getInstallInfo(settings: AiSettings): Promise<AiInstallInfo> {
  const platform = process.platform === 'win32' ? 'win32' : process.platform === 'linux' ? 'linux' : 'other'
  const [exe, status] = await Promise.all([findOllama(), getStatus(settings, PING_TIMEOUTS)])
  return { platform, installed: exe !== null, running: status.ok }
}

/** Inicia o Ollama já instalado e espera o servidor responder (até 30 s). */
export async function startServer(owner: WebContents, settings: AiSettings): Promise<AiOpResult> {
  const controller = begin(owner, 'start')
  if (!controller) return { ok: false, code: 'busy' }
  try {
    const deps = realDetectDeps()
    const exe = await findOllama(deps)
    if (!exe) return { ok: false, code: 'notInstalled' }
    if (await pingOf(settings)()) return { ok: true }
    log.info('IA: iniciando o Ollama')
    if (!(await startOllamaProcess(exe, deps.platform, deps.exists))) return { ok: false, code: 'startFailed' }
    const state = await waitForServer(pingOf(settings), { timeoutMs: 30_000, intervalMs: 500, signal: controller.signal })
    if (state === 'cancelled') return { ok: false, code: 'cancelled' }
    return state === 'up' ? { ok: true } : { ok: false, code: 'startFailed' }
  } finally {
    end('start', controller)
  }
}

/** Instala o Ollama no Windows: baixa o instalador oficial, confere a assinatura e abre a janela dele. */
export function startInstall(owner: WebContents, settings: AiSettings): AiOpResult {
  if (process.platform !== 'win32') return { ok: false, code: 'unsupportedPlatform' }
  const controller = begin(owner, 'install')
  if (!controller) return { ok: false, code: 'busy' }
  const dir = join(app.getPath('userData'), 'downloads')
  const dest = join(dir, 'OllamaSetup.exe')
  const deps = realDetectDeps()
  const send = (stage: AiInstallProgress['stage'], completed: number, total: number): void => emit(owner, { op: 'install', stage, completed, total, done: false })
  const sendDownload = throttled((c, t) => send('download', c, t))
  void runInstall({
    config: resolveDownloadConfig(app.isPackaged, process.env),
    dest,
    signal: controller.signal,
    progress: (stage, c, t) => (stage === 'download' ? sendDownload(c, t) : send(stage, c, t)),
    download: downloadFile,
    verify: (f) => verifySignature(f),
    stage: stageInstaller,
    runInstaller: (f, s) => runInstallerProcess(f, s),
    find: () => findOllama(deps),
    ping: pingOf(settings),
    start: async (exe) => startOllamaProcess(exe, deps.platform, deps.exists),
    remove: (f) => rm(f, { force: true }).catch(() => undefined),
    log: (m) => log.info(m)
  }).then((outcome) => {
    end('install', controller)
    if (!outcome.ok) log.warn(`IA: instalação terminou com ${outcome.code}`)
    emit(owner, { op: 'install', stage: 'waiting', completed: 0, total: 0, done: true, ...(outcome.ok ? {} : { code: outcome.code }) })
  })
  return { ok: true }
}

/** Baixa um modelo (POST /api/pull). O nome é validado aqui; o progresso chega por aiInstallProgress. */
export function startPull(owner: WebContents, rawName: unknown, settings: AiSettings): AiOpResult {
  const parsed = aiModelNameSchema.safeParse(rawName)
  if (!parsed.success) return { ok: false, code: 'modelNameInvalid' }
  const model = parsed.data
  const controller = begin(owner, 'pull')
  if (!controller) return { ok: false, code: 'busy' }
  log.info(`IA: baixando o modelo ${model}`)
  let lastStatus = ''
  const send = throttled((completed, total) => emit(owner, { op: 'pull', stage: 'pull', completed, total, status: lastStatus, model, done: false }))
  void pullModel(
    settings,
    model,
    (p) => {
      // Mudança de status sempre sai; os números de uma mesma camada são limitados no tempo.
      if (p.status !== lastStatus) {
        lastStatus = p.status
        emit(owner, { op: 'pull', stage: 'pull', completed: p.completed, total: p.total, status: p.status, model, done: false })
      } else send(p.completed, p.total)
    },
    controller.signal
  ).then((outcome) => {
    end('pull', controller)
    if (!outcome.ok && outcome.code !== 'cancelled') log.warn(`IA: download do modelo falhou (${outcome.code})`)
    emit(owner, { op: 'pull', stage: 'pull', completed: 0, total: 0, model, done: true, ...(outcome.ok ? {} : { code: outcome.code }) })
  })
  return { ok: true }
}
