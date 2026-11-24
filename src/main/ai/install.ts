// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { execFile, spawn as nodeSpawn } from 'node:child_process'
import { stat, statfs, mkdir, open, rm } from 'node:fs/promises'
import { dirname, posix, win32 } from 'node:path'
import type { AiErrorCode } from '@shared/ai'

/**
 * Instalação do Ollama. Tudo aqui é injetável (sistema de arquivos, rede, PowerShell, spawn) para os testes
 * rodarem sem instalar nada. Nenhum caminho de executável nem URL vem do Renderer.
 */

/** URL oficial do instalador para Windows. */
export const OFFICIAL_INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe'

/**
 * Hosts permitidos nos redirecionamentos. Em 2026-11: ollama.com responde 307 para
 * github.com/ollama/ollama/releases/latest/download/..., que vai (302) para github.com/.../releases/download/vX/...
 * e depois (302) para release-assets.githubusercontent.com (o arquivo). objects.githubusercontent.com é o
 * host anterior do GitHub para o mesmo fim e fica na lista por compatibilidade.
 */
export const ALLOWED_DOWNLOAD_HOSTS: readonly string[] = ['ollama.com', 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com']

/** Tamanho máximo aceito (o instalador tem cerca de 2 GB). */
export const MAX_INSTALLER_BYTES = 3 * 1024 ** 3
const MAX_REDIRECTS = 5
const LOOPBACK = new Set(['127.0.0.1', 'localhost'])

/** Nome da variável de ambiente de teste que troca a URL do download (ignorada no app empacotado). */
export const TEST_URL_ENV = 'MEA_TEST_OLLAMA_URL'

export interface DownloadConfig {
  url: string
  allowHttp: boolean
  allowedHosts: readonly string[]
}

/** No app empacotado a URL é sempre a oficial; só em desenvolvimento a variável de teste (loopback) a substitui. */
export function resolveDownloadConfig(isPackaged: boolean, env: NodeJS.ProcessEnv): DownloadConfig {
  const official: DownloadConfig = { url: OFFICIAL_INSTALLER_URL, allowHttp: false, allowedHosts: ALLOWED_DOWNLOAD_HOSTS }
  const override = env[TEST_URL_ENV]
  if (isPackaged || !override) return official
  try {
    const url = new URL(override)
    if (!LOOPBACK.has(url.hostname) || (url.protocol !== 'http:' && url.protocol !== 'https:')) return official
    return { url: url.href, allowHttp: true, allowedHosts: [url.hostname] }
  } catch {
    return official
  }
}

// ---------------------------------------------------------------- detecção

export interface DetectDeps {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  exists(path: string): Promise<boolean>
}

export const realDetectDeps = (): DetectDeps => ({
  platform: process.platform,
  env: process.env,
  exists: async (p) => {
    try {
      return (await stat(p)).isFile()
    } catch {
      return false
    }
  }
})

/** Caminho do executável do Ollama, ou null. Windows: %LOCALAPPDATA%\Programs\Ollama; Linux: PATH, /usr/local/bin, /usr/bin. */
export async function findOllama(deps: DetectDeps = realDetectDeps()): Promise<string | null> {
  const candidates: string[] = []
  if (deps.platform === 'win32') {
    const local = deps.env['LOCALAPPDATA']
    if (local) candidates.push(win32.join(local, 'Programs', 'Ollama', 'ollama.exe'))
  } else if (deps.platform === 'linux') {
    const dirs = [...(deps.env['PATH'] ?? '').split(':'), '/usr/local/bin', '/usr/bin']
    for (const d of dirs) if (d.startsWith('/')) candidates.push(posix.join(d, 'ollama'))
  }
  for (const c of new Set(candidates)) if (await deps.exists(c)) return c
  return null
}

// ---------------------------------------------------------------- iniciar o servidor

export interface SpawnLike {
  once(event: 'spawn' | 'error', listener: () => void): unknown
  unref(): void
}
export type SpawnFn = (file: string, args: string[], options: { detached: true; stdio: 'ignore'; windowsHide: true; shell: false }) => SpawnLike

/** Inicia o Ollama destacado, sem shell. No Windows, prefere o "ollama app.exe" (bandeja) ao lado do executável. */
export async function startOllamaProcess(
  exe: string,
  platform: NodeJS.Platform,
  exists: (p: string) => Promise<boolean>,
  spawnFn: SpawnFn = nodeSpawn as unknown as SpawnFn
): Promise<boolean> {
  let file = exe
  let args = ['serve']
  if (platform === 'win32') {
    const tray = win32.join(win32.dirname(exe), 'ollama app.exe')
    if (await exists(tray)) {
      file = tray
      args = []
    }
  }
  return new Promise<boolean>((resolve) => {
    try {
      const child = spawnFn(file, args, { detached: true, stdio: 'ignore', windowsHide: true, shell: false })
      child.once('error', () => resolve(false))
      child.once('spawn', () => {
        child.unref()
        resolve(true)
      })
    } catch {
      resolve(false)
    }
  })
}

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done(): void {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done, { once: true })
  })

/** Espera o servidor responder. */
export async function waitForServer(ping: () => Promise<boolean>, opts: { timeoutMs: number; intervalMs: number; signal?: AbortSignal }): Promise<'up' | 'timeout' | 'cancelled'> {
  const end = Date.now() + opts.timeoutMs
  for (;;) {
    if (opts.signal?.aborted) return 'cancelled'
    if (await ping()) return 'up'
    if (Date.now() >= end) return 'timeout'
    await sleep(opts.intervalMs, opts.signal)
  }
}

// ---------------------------------------------------------------- download

export interface DownloadOptions {
  url: string
  dest: string
  allowedHosts: readonly string[]
  allowHttp: boolean
  maxBytes: number
  onProgress(completed: number, total: number): void
  signal: AbortSignal
  /** Espaço livre (bytes) na pasta de destino. */
  freeBytes?(dir: string): Promise<number>
  connectMs?: number
  idleMs?: number
}

export type DownloadOutcome = { ok: true; bytes: number } | { ok: false; code: AiErrorCode }

async function defaultFreeBytes(dir: string): Promise<number> {
  const s = await statfs(dir)
  return Number(s.bavail) * Number(s.bsize)
}

/** A URL é aceitável? https (ou http só em teste) e host da lista fixa. */
export function isAllowedUrl(url: URL, allowedHosts: readonly string[], allowHttp: boolean): boolean {
  if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) return false
  if (url.username !== '' || url.password !== '') return false
  return allowedHosts.includes(url.hostname.toLowerCase())
}

/** Baixa o arquivo seguindo redirecionamentos só para hosts permitidos. Em qualquer falha, apaga o arquivo parcial. */
export async function downloadFile(o: DownloadOptions): Promise<DownloadOutcome> {
  const outcome = await downloadInner(o)
  if (!outcome.ok) await rm(o.dest, { force: true }).catch(() => undefined)
  return outcome
}

async function downloadInner(o: DownloadOptions): Promise<DownloadOutcome> {
  const controller = new AbortController()
  const onAbort = (): void => controller.abort()
  if (o.signal.aborted) return { ok: false, code: 'cancelled' }
  o.signal.addEventListener('abort', onAbort, { once: true })
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const arm = (ms: number): void => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, ms)
  }
  const fail = (code: AiErrorCode): DownloadOutcome => ({ ok: false, code: o.signal.aborted ? 'cancelled' : timedOut ? 'downloadFailed' : code })
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    let current: URL
    try {
      current = new URL(o.url)
    } catch {
      return { ok: false, code: 'downloadFailed' }
    }
    let res: Response | undefined
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowedUrl(current, o.allowedHosts, o.allowHttp)) return { ok: false, code: 'downloadFailed' }
      arm(o.connectMs ?? 15_000)
      res = await fetch(current, { redirect: 'manual', signal: controller.signal })
      const location = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel().catch(() => undefined)
        try {
          current = new URL(location, current)
        } catch {
          return { ok: false, code: 'downloadFailed' }
        }
        res = undefined
        continue
      }
      break
    }
    if (!res || res.status !== 200 || !res.body) return { ok: false, code: 'downloadFailed' }

    const total = Number(res.headers.get('content-length') ?? 0)
    if (!Number.isFinite(total) || total < 0 || total > o.maxBytes) {
      await res.body.cancel().catch(() => undefined)
      return { ok: false, code: 'downloadFailed' }
    }
    const dir = dirname(o.dest)
    await mkdir(dir, { recursive: true })
    const needed = total > 0 ? Math.ceil(total * 1.1) + 100 * 1024 ** 2 : 2 * 1024 ** 3
    try {
      if ((await (o.freeBytes ?? defaultFreeBytes)(dir)) < needed) {
        await res.body.cancel().catch(() => undefined)
        return { ok: false, code: 'diskFull' }
      }
    } catch {
      // Sem como medir o espaço: segue (a gravação falha por si se faltar).
    }

    // Apaga o que já existir no caminho fixo (arquivo ou atalho) e cria um novo de forma exclusiva.
    await rm(o.dest, { force: true })
    handle = await open(o.dest, 'wx')
    const reader = res.body.getReader()
    let bytes = 0
    o.onProgress(0, total)
    for (;;) {
      arm(o.idleMs ?? 30_000)
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > o.maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, code: 'downloadFailed' }
      }
      await handle.write(value)
      o.onProgress(bytes, total)
    }
    await handle.close()
    handle = undefined
    if (total > 0 && bytes !== total) return { ok: false, code: 'downloadFailed' }
    return { ok: true, bytes }
  } catch {
    return fail('downloadFailed')
  } finally {
    clearTimeout(timer)
    o.signal.removeEventListener('abort', onAbort)
    await handle?.close().catch(() => undefined)
  }
}

// ---------------------------------------------------------------- assinatura

export interface SignatureInfo {
  status: string
  subject: string
}
export type SignatureRunner = (file: string) => Promise<SignatureInfo>

/** Script fixo: o caminho do arquivo vai pela variável de ambiente, nunca dentro do texto do comando. */
const SIGNATURE_SCRIPT =
  '$s = Get-AuthenticodeSignature -LiteralPath $env:MEA_SETUP_PATH; ' +
  '$subject = if ($s.SignerCertificate) { [string]$s.SignerCertificate.Subject } else { "" }; ' +
  '[pscustomobject]@{ Status = [string]$s.Status; Subject = $subject } | ConvertTo-Json -Compress'

/** Consulta o Authenticode pelo PowerShell (execFile, sem shell, argumentos fixos). */
export const powershellSignature: SignatureRunner = (file) =>
  new Promise((resolve, reject) => {
    const root = process.env['SystemRoot'] ?? 'C:\\Windows'
    const exe = win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    execFile(
      exe,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SIGNATURE_SCRIPT],
      { timeout: 60_000, windowsHide: true, maxBuffer: 1024 * 1024, env: { ...process.env, MEA_SETUP_PATH: file } },
      (err, stdout) => {
        if (err) return reject(err)
        try {
          const parsed = JSON.parse(stdout.toString().trim()) as Record<string, unknown>
          resolve({ status: String(parsed['Status'] ?? ''), subject: String(parsed['Subject'] ?? '') })
        } catch (e) {
          reject(e)
        }
      }
    )
  })

/** Assinatura válida (Status = Valid) e assinante contendo "Ollama". Qualquer falha na consulta conta como inválida. */
export async function verifySignature(file: string, run: SignatureRunner = powershellSignature): Promise<boolean> {
  try {
    const info = await run(file)
    return info.status === 'Valid' && info.subject.includes('Ollama')
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- instalador

/** Executa o instalador (ele mostra a própria janela) e espera o processo terminar. Cancelar só para de esperar. */
export function runInstallerProcess(file: string, signal: AbortSignal, spawnFn: typeof nodeSpawn = nodeSpawn): Promise<'ok' | 'failed' | 'cancelled'> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve('cancelled')
    let settled = false
    const finish = (r: 'ok' | 'failed' | 'cancelled'): void => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', onAbort)
      resolve(r)
    }
    const onAbort = (): void => finish('cancelled')
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      const child = spawnFn(file, [], { stdio: 'ignore', shell: false })
      child.once('error', () => finish('failed'))
      child.once('exit', (code) => finish(code === 0 ? 'ok' : 'failed'))
    } catch {
      finish('failed')
    }
  })
}

// ---------------------------------------------------------------- fluxo completo

export interface InstallDeps {
  config: DownloadConfig
  dest: string
  signal: AbortSignal
  progress(stage: 'download' | 'verify' | 'installer' | 'waiting', completed: number, total: number): void
  download(o: DownloadOptions): Promise<DownloadOutcome>
  verify(file: string): Promise<boolean>
  runInstaller(file: string, signal: AbortSignal): Promise<'ok' | 'failed' | 'cancelled'>
  /** Procura o executável instalado. */
  find(): Promise<string | null>
  /** O servidor responde? */
  ping(): Promise<boolean>
  start(exe: string): Promise<boolean>
  remove(file: string): Promise<void>
  log(message: string): void
  waitMs?: { find: number; server: number; interval: number; initial: number }
}

/** Baixa, confere a assinatura, abre o instalador e, no fim, garante que o servidor esteja respondendo. */
export async function runInstall(d: InstallDeps): Promise<{ ok: true } | { ok: false; code: AiErrorCode }> {
  const wait = d.waitMs ?? { find: 15_000, server: 60_000, interval: 1_000, initial: 8_000 }
  const cancelled = (): { ok: false; code: AiErrorCode } => ({ ok: false, code: 'cancelled' })
  try {
    d.log('IA: baixando o instalador do Ollama')
    const dl = await d.download({
      url: d.config.url,
      dest: d.dest,
      allowedHosts: d.config.allowedHosts,
      allowHttp: d.config.allowHttp,
      maxBytes: MAX_INSTALLER_BYTES,
      signal: d.signal,
      onProgress: (c, t) => d.progress('download', c, t)
    })
    if (!dl.ok) {
      d.log(`IA: download falhou (${dl.code})`)
      return dl
    }
    d.log(`IA: instalador baixado (${dl.bytes} bytes)`)
    if (d.signal.aborted) return cancelled()

    d.progress('verify', 0, 0)
    if (!(await d.verify(d.dest))) {
      d.log('IA: assinatura do instalador inválida; arquivo apagado')
      return { ok: false, code: 'signatureInvalid' }
    }
    if (d.signal.aborted) return cancelled()

    d.progress('installer', 0, 0)
    d.log('IA: abrindo o instalador do Ollama')
    const ran = await d.runInstaller(d.dest, d.signal)
    if (ran === 'cancelled') return cancelled()
    if (ran === 'failed') {
      d.log('IA: o instalador terminou sem sucesso')
      return { ok: false, code: 'installerFailed' }
    }

    d.progress('waiting', 0, 0)
    const findEnd = Date.now() + wait.find
    let exe = await d.find()
    while (!exe && Date.now() < findEnd && !d.signal.aborted) {
      await sleep(wait.interval, d.signal)
      exe = await d.find()
    }
    if (d.signal.aborted) return cancelled()
    if (!exe) return { ok: false, code: 'notInstalled' }
    // O instalador costuma abrir o Ollama sozinho; se não, inicia.
    let state = await waitForServer(d.ping, { timeoutMs: wait.initial, intervalMs: wait.interval, signal: d.signal })
    if (state === 'timeout') {
      if (!(await d.start(exe))) return { ok: false, code: 'startFailed' }
      state = await waitForServer(d.ping, { timeoutMs: wait.server, intervalMs: wait.interval, signal: d.signal })
    }
    if (state === 'cancelled') return cancelled()
    return state === 'up' ? { ok: true } : { ok: false, code: 'startFailed' }
  } finally {
    await d.remove(d.dest)
  }
}
