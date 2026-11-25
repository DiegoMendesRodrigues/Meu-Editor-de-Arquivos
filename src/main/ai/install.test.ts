// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { EventEmitter } from 'node:events'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  ALLOWED_DOWNLOAD_HOSTS,
  downloadFile,
  findOllama,
  isAllowedUrl,
  OFFICIAL_INSTALLER_URL,
  resolveDownloadConfig,
  runInstall,
  startOllamaProcess,
  TEST_URL_ENV,
  verifySignature,
  waitForServer,
  type DownloadOptions,
  type InstallDeps,
  type SpawnFn
} from './install'

let server: Server
let port = 0
let dir = ''
const PAYLOAD = Buffer.alloc(200_000, 7)

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'install-test-'))
  server = createServer((req, res) => {
    const url = req.url ?? ''
    if (url === '/ok') {
      res.setHeader('Content-Length', PAYLOAD.length)
      return void res.end(PAYLOAD)
    }
    // Redireciona para outro nome de host (localhost) da mesma máquina.
    if (url === '/redir') {
      res.statusCode = 302
      res.setHeader('Location', `http://localhost:${port}/ok`)
      return void res.end()
    }
    if (url === '/loop') {
      res.statusCode = 302
      res.setHeader('Location', '/loop')
      return void res.end()
    }
    if (url === '/stream') {
      // Sem Content-Length: manda 10 pedaços de 100 KB.
      let n = 0
      const timer = setInterval(() => {
        res.write(Buffer.alloc(100_000, 1))
        if (++n === 10) {
          clearInterval(timer)
          res.end()
        }
      }, 5)
      res.on('close', () => clearInterval(timer))
      return
    }
    if (url === '/slow') {
      res.setHeader('Content-Length', 10_000_000)
      const timer = setInterval(() => res.write(Buffer.alloc(50_000, 2)), 10)
      res.on('close', () => clearInterval(timer))
      return
    }
    if (url === '/short') {
      res.setHeader('Content-Length', 1000)
      res.write(Buffer.alloc(10))
      return void setTimeout(() => res.destroy(), 20)
    }
    res.statusCode = 404
    res.end()
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  port = (server.address() as AddressInfo).port
})

afterAll(() => {
  server.closeAllConnections()
  server.close()
  rmSync(dir, { recursive: true, force: true })
})

const opts = (path: string, over: Partial<DownloadOptions> = {}): DownloadOptions => ({
  url: `http://127.0.0.1:${port}${path}`,
  dest: join(dir, 'Setup.exe'),
  allowedHosts: ['127.0.0.1'],
  allowHttp: true,
  maxBytes: 5_000_000,
  onProgress: () => undefined,
  signal: new AbortController().signal,
  freeBytes: async () => 1e12,
  ...over
})

describe('detecção do Ollama', () => {
  it('Windows: acha %LOCALAPPDATA%\\Programs\\Ollama\\ollama.exe e devolve null sem ele', async () => {
    const exe = 'C:\\Users\\ana\\AppData\\Local\\Programs\\Ollama\\ollama.exe'
    const env = { LOCALAPPDATA: 'C:\\Users\\ana\\AppData\\Local' }
    expect(await findOllama({ platform: 'win32', env, exists: async (p) => p === exe })).toBe(exe)
    expect(await findOllama({ platform: 'win32', env, exists: async () => false })).toBeNull()
    expect(await findOllama({ platform: 'win32', env: {}, exists: async () => true })).toBeNull()
  })

  it('Linux: procura só em /usr/local/bin e /usr/bin, ignorando o PATH', async () => {
    const seen: string[] = []
    const found = await findOllama({
      platform: 'linux',
      env: { PATH: 'bin:/opt/x:/usr/bin' },
      exists: async (p) => {
        seen.push(p)
        return p === '/usr/bin/ollama'
      }
    })
    expect(found).toBe('/usr/bin/ollama')
    expect(seen).toEqual(['/usr/local/bin/ollama', '/usr/bin/ollama'])
    expect(await findOllama({ platform: 'linux', env: { PATH: '/usr/local/bin' }, exists: async (p) => p === '/usr/local/bin/ollama' })).toBe('/usr/local/bin/ollama')
  })

  it('outras plataformas não encontram nada', async () => {
    expect(await findOllama({ platform: 'darwin', env: {}, exists: async () => true })).toBeNull()
  })
})

describe('URL do download', () => {
  it('empacotado, ignora a variável de teste e usa sempre a oficial', () => {
    const c = resolveDownloadConfig(true, { [TEST_URL_ENV]: 'http://127.0.0.1:9/x.exe' })
    expect(c.url).toBe(OFFICIAL_INSTALLER_URL)
    expect(c.allowHttp).toBe(false)
    expect(c.allowedHosts).toEqual(ALLOWED_DOWNLOAD_HOSTS)
  })

  it('em desenvolvimento, só troca por um endereço de loopback', () => {
    const c = resolveDownloadConfig(false, { [TEST_URL_ENV]: 'http://127.0.0.1:9/x.exe' })
    expect(c).toEqual({ url: 'http://127.0.0.1:9/x.exe', allowHttp: true, allowedHosts: ['127.0.0.1'] })
    expect(resolveDownloadConfig(false, { [TEST_URL_ENV]: 'http://exemplo.com.br/x.exe' }).url).toBe(OFFICIAL_INSTALLER_URL)
    expect(resolveDownloadConfig(false, {}).url).toBe(OFFICIAL_INSTALLER_URL)
  })

  it('github.com só vale para as releases do Ollama', () => {
    const ok = (u: string): boolean => isAllowedUrl(new URL(u), ALLOWED_DOWNLOAD_HOSTS, false)
    expect(ok('https://github.com/ollama/ollama/releases/download/v1/OllamaSetup.exe')).toBe(true)
    expect(ok('https://github.com/outro/repo/releases/download/v1/x.exe')).toBe(false)
    expect(ok('https://ollama.com/download/OllamaSetup.exe')).toBe(true)
  })

  it('a lista de hosts é a combinada', () => {
    expect([...ALLOWED_DOWNLOAD_HOSTS]).toEqual(['ollama.com', 'github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'])
  })
})

describe('download', () => {
  it('baixa, informa o progresso e grava o arquivo', async () => {
    const progress: [number, number][] = []
    const out = await downloadFile(opts('/ok', { onProgress: (c, t) => progress.push([c, t]) }))
    expect(out).toEqual({ ok: true, bytes: PAYLOAD.length })
    expect(existsSync(join(dir, 'Setup.exe'))).toBe(true)
    expect(progress.at(-1)).toEqual([PAYLOAD.length, PAYLOAD.length])
  })

  it('segue redirecionamento para host permitido', async () => {
    const out = await downloadFile(opts('/redir', { allowedHosts: ['127.0.0.1', 'localhost'] }))
    expect(out.ok).toBe(true)
  })

  it('recusa redirecionamento para host fora da lista e apaga o arquivo', async () => {
    const out = await downloadFile(opts('/redir'))
    expect(out).toEqual({ ok: false, code: 'downloadFailed' })
    expect(existsSync(join(dir, 'Setup.exe'))).toBe(false)
  })

  it('recusa http quando só https é permitido e URL com credenciais', async () => {
    expect(await downloadFile(opts('/ok', { allowHttp: false }))).toEqual({ ok: false, code: 'downloadFailed' })
    expect(await downloadFile(opts('/ok', { url: `http://u:p@127.0.0.1:${port}/ok` }))).toEqual({ ok: false, code: 'downloadFailed' })
  })

  it('limita os redirecionamentos', async () => {
    expect(await downloadFile(opts('/loop'))).toEqual({ ok: false, code: 'downloadFailed' })
  })

  it('recusa arquivo maior que o limite (por Content-Length e sem ele)', async () => {
    expect(await downloadFile(opts('/ok', { maxBytes: 1000 }))).toEqual({ ok: false, code: 'downloadFailed' })
    const out = await downloadFile(opts('/stream', { maxBytes: 300_000 }))
    expect(out).toEqual({ ok: false, code: 'downloadFailed' })
    expect(existsSync(join(dir, 'Setup.exe'))).toBe(false)
  })

  it('falha se o arquivo vier incompleto e se o status não for 200', async () => {
    expect(await downloadFile(opts('/short'))).toEqual({ ok: false, code: 'downloadFailed' })
    expect(await downloadFile(opts('/nada'))).toEqual({ ok: false, code: 'downloadFailed' })
  })

  it('recusa quando falta espaço em disco', async () => {
    expect(await downloadFile(opts('/ok', { freeBytes: async () => 1000 }))).toEqual({ ok: false, code: 'diskFull' })
  })

  it('cancela no meio do download e apaga o parcial', async () => {
    const controller = new AbortController()
    const out = await downloadFile(opts('/slow', { signal: controller.signal, maxBytes: 50_000_000, onProgress: (c) => c > 100_000 && controller.abort() }))
    expect(out).toEqual({ ok: false, code: 'cancelled' })
    expect(existsSync(join(dir, 'Setup.exe'))).toBe(false)
  })

  it('já cancelado, nem começa', async () => {
    const controller = new AbortController()
    controller.abort()
    expect(await downloadFile(opts('/ok', { signal: controller.signal }))).toEqual({ ok: false, code: 'cancelled' })
  })
})

describe('assinatura digital (simulada)', () => {
  it('aceita só Status Valid com CN e O iguais a Ollama Inc.', async () => {
    expect(await verifySignature('x.exe', async () => ({ status: 'Valid', subject: 'CN="Ollama Inc.", O="Ollama Inc."' }))).toBe(true)
    expect(await verifySignature('x.exe', async () => ({ status: 'Valid', subject: 'CN=Outra Empresa' }))).toBe(false)
    expect(await verifySignature('x.exe', async () => ({ status: 'Valid', subject: 'CN=Ollama Inc. Falso, O=Ollama Inc.' }))).toBe(false)
    expect(await verifySignature('x.exe', async () => ({ status: 'Valid', subject: 'CN=Outro, O=Outro, OU=Ollama Inc.' }))).toBe(false)
    expect(await verifySignature('x.exe', async () => ({ status: 'Valid', subject: 'CN=Ollama Inc., O=Ollama Inc., L=Palo Alto' }))).toBe(true)
    expect(await verifySignature('x.exe', async () => ({ status: 'NotSigned', subject: '' }))).toBe(false)
    expect(await verifySignature('x.exe', async () => ({ status: 'HashMismatch', subject: 'CN=Ollama Inc.' }))).toBe(false)
  })

  it('falha na consulta conta como inválida', async () => {
    expect(
      await verifySignature('x.exe', async () => {
        throw new Error('powershell caiu')
      })
    ).toBe(false)
  })
})

describe('iniciar o Ollama', () => {
  const fakeSpawn = (calls: { file: string; args: string[]; options: unknown }[], fail = false): SpawnFn => (file, args, options) => {
    calls.push({ file, args, options })
    const child = Object.assign(new EventEmitter(), { unref: vi.fn() })
    setImmediate(() => child.emit(fail ? 'error' : 'spawn'))
    return child as never
  }

  it('Windows: abre o "ollama app.exe" ao lado do executável, destacado e sem shell', async () => {
    const calls: { file: string; args: string[]; options: unknown }[] = []
    const exe = 'C:\\L\\Programs\\Ollama\\ollama.exe'
    expect(await startOllamaProcess(exe, 'win32', async (p) => p.endsWith('ollama app.exe'), fakeSpawn(calls))).toBe(true)
    expect(calls[0]).toEqual({ file: 'C:\\L\\Programs\\Ollama\\ollama app.exe', args: [], options: { detached: true, stdio: 'ignore', windowsHide: true, shell: false } })
  })

  it('Windows sem o app da bandeja e Linux: ollama serve', async () => {
    const calls: { file: string; args: string[]; options: unknown }[] = []
    await startOllamaProcess('C:\\L\\Ollama\\ollama.exe', 'win32', async () => false, fakeSpawn(calls))
    await startOllamaProcess('/usr/bin/ollama', 'linux', async () => true, fakeSpawn(calls))
    expect(calls.map((c) => [c.file, c.args])).toEqual([
      ['C:\\L\\Ollama\\ollama.exe', ['serve']],
      ['/usr/bin/ollama', ['serve']]
    ])
  })

  it('devolve false se o processo não abre', async () => {
    expect(await startOllamaProcess('/usr/bin/ollama', 'linux', async () => true, fakeSpawn([], true))).toBe(false)
  })

  it('espera o servidor responder, com tempo limite e cancelamento', async () => {
    let n = 0
    expect(await waitForServer(async () => ++n >= 3, { timeoutMs: 2000, intervalMs: 5 })).toBe('up')
    expect(await waitForServer(async () => false, { timeoutMs: 30, intervalMs: 5 })).toBe('timeout')
    const c = new AbortController()
    c.abort()
    expect(await waitForServer(async () => false, { timeoutMs: 1000, intervalMs: 5, signal: c.signal })).toBe('cancelled')
  })
})

describe('fluxo de instalação', () => {
  const base = (over: Partial<InstallDeps> = {}): { deps: InstallDeps; removed: string[]; ran: string[]; stages: string[] } => {
    const removed: string[] = []
    const ran: string[] = []
    const stages: string[] = []
    const deps: InstallDeps = {
      config: { url: 'https://ollama.com/download/OllamaSetup.exe', allowHttp: false, allowedHosts: ALLOWED_DOWNLOAD_HOSTS },
      dest: 'C:\\ud\\downloads\\OllamaSetup.exe',
      signal: new AbortController().signal,
      progress: (s) => stages.push(s),
      download: async (o) => (o.onProgress(10, 10), { ok: true, bytes: 10 }),
      verify: async () => true,
      runInstaller: async (f) => (ran.push(f), 'ok' as const),
      find: async () => 'C:\\L\\Ollama\\ollama.exe',
      ping: async () => true,
      start: async () => true,
      remove: async (f) => void removed.push(f),
      log: () => undefined,
      waitMs: { find: 50, server: 100, interval: 5, initial: 20 },
      ...over
    }
    return { deps, removed, ran, stages }
  }

  it('baixa, confere, executa, espera o servidor e apaga o instalador', async () => {
    const { deps, removed, ran, stages } = base()
    expect(await runInstall(deps)).toEqual({ ok: true })
    expect(ran).toEqual([deps.dest])
    expect(removed).toEqual([deps.dest])
    expect(stages).toEqual(['download', 'verify', 'installer', 'waiting'])
  })

  it('assinatura inválida: não executa nada, apaga o arquivo e devolve signatureInvalid', async () => {
    const { deps, removed, ran } = base({ verify: async () => false })
    expect(await runInstall(deps)).toEqual({ ok: false, code: 'signatureInvalid' })
    expect(ran).toEqual([])
    expect(removed).toEqual([deps.dest])
  })

  it('falha do download e do instalador viram códigos', async () => {
    expect(await runInstall(base({ download: async () => ({ ok: false, code: 'diskFull' }) }).deps)).toEqual({ ok: false, code: 'diskFull' })
    expect(await runInstall(base({ runInstaller: async () => 'failed' }).deps)).toEqual({ ok: false, code: 'installerFailed' })
  })

  it('não achando o executável depois do instalador, devolve notInstalled', async () => {
    expect(await runInstall(base({ find: async () => null }).deps)).toEqual({ ok: false, code: 'notInstalled' })
  })

  it('se o servidor não sobe sozinho, inicia o Ollama e espera', async () => {
    let started = false
    const { deps } = base({ ping: async () => started, start: async () => ((started = true), true), waitMs: { find: 50, server: 500, interval: 5, initial: 20 } })
    // O ping só passa a responder depois do start.
    expect(await runInstall(deps)).toEqual({ ok: true })
    expect(started).toBe(true)
  })

  it('cancelar durante o instalador devolve cancelled e ainda apaga o arquivo', async () => {
    const c = new AbortController()
    const { deps, removed } = base({ signal: c.signal, runInstaller: async () => (c.abort(), 'cancelled' as const) })
    expect(await runInstall(deps)).toEqual({ ok: false, code: 'cancelled' })
    expect(removed).toEqual([deps.dest])
  })
})
