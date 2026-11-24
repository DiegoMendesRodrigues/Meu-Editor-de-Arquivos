// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_LIMITS } from '@shared/api/limits'
import type { ApiMonitorInput, ApiMonitorRun, ApiMonitorState } from '@shared/api/protocol'
import { createFileStore, createMonitorService, type MonitorDeps, type MonitorNotice } from './monitor'
import { summarize } from './monitorRunner'

const ID = '11111111-1111-4111-8111-111111111111'
const input = (p: Partial<ApiMonitorInput> = {}): ApiMonitorInput => ({ id: ID, name: 'Saúde', collectionDir: '/colecao', intervalMin: 1, ...p })
const stored = (runs: ApiMonitorRun[] = []) => ({ id: ID, name: 'Saúde', collectionDir: '/colecao', intervalMin: 1, enabled: true, requests: [] as string[], notifyOnFailure: true, runs })
const OK: Omit<ApiMonitorRun, 'at'> = { ok: true, passed: 2, failed: 0, errors: 0, totalMs: 40, avgMs: 20 }
const BAD: Omit<ApiMonitorRun, 'at'> = { ok: false, passed: 1, failed: 1, errors: 0, totalMs: 50, avgMs: 25 }

function memoryStore(initial: Awaited<ReturnType<MonitorDeps['store']['load']>> = []) {
  let data = initial
  return { load: async () => data, save: async (l: typeof data) => void (data = JSON.parse(JSON.stringify(l))), get: () => data }
}

function setup(over: Partial<MonitorDeps> = {}, initial?: Parameters<typeof memoryStore>[0]) {
  const store = memoryStore(initial)
  const notices: MonitorNotice[] = []
  const events: ApiMonitorState[] = []
  const execute = vi.fn<MonitorDeps['execute']>(async () => OK)
  const svc = createMonitorService({
    store,
    execute,
    isAuthorized: async () => true,
    isInsideDir: () => true,
    notify: (_m, n) => void notices.push(n),
    emit: (s) => void events.push(s),
    log: () => {},
    ...over
  })
  return { svc, store, notices, events, execute }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('agendamento', () => {
  it('roda a cada intervalo, em sequência, e guarda as execuções', async () => {
    const { svc, execute } = setup()
    const saved = await svc.save(input())
    expect(saved.ok).toBe(true)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(execute).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(execute).toHaveBeenCalledTimes(2)
    const [m] = await svc.list()
    expect(m.runs).toHaveLength(2)
    expect(m.nextAt).toBeTruthy()
    svc.stop()
  })

  it('não sobrepõe execuções: executar agora durante uma execução é ignorado', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((ok) => (release = ok))
    const exec = vi.fn<MonitorDeps['execute']>(async () => (await gate, OK))
    const { svc } = setup({ execute: exec })
    await svc.save(input())
    const first = svc.runNow(ID)
    await svc.runNow(ID)
    await vi.advanceTimersByTimeAsync(10)
    expect(exec).toHaveBeenCalledTimes(1)
    release()
    await first
    expect(((await svc.list())[0].runs)).toHaveLength(1)
    svc.stop()
  })

  it('monitor desligado não agenda, mas executar agora funciona', async () => {
    const { svc, execute } = setup()
    await svc.save(input({ enabled: false }))
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(execute).not.toHaveBeenCalled()
    await svc.runNow(ID)
    expect(execute).toHaveBeenCalledTimes(1)
    expect((await svc.list())[0].nextAt).toBeUndefined()
  })

  it('excluir para o agendamento', async () => {
    const { svc, execute } = setup()
    await svc.save(input())
    await svc.remove(ID)
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(execute).not.toHaveBeenCalled()
    expect(await svc.list()).toEqual([])
  })

  it('ao abrir o app, os habilitados voltam a rodar depois de um pequeno atraso', async () => {
    const { svc, execute } = setup({}, [stored()])
    await svc.start(5_000)
    await vi.advanceTimersByTimeAsync(4_000)
    expect(execute).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_500)
    expect(execute).toHaveBeenCalledTimes(1)
    svc.stop()
  })
})

describe('notificação', () => {
  it('avisa na passagem de ok para falha e na recuperação, sem repetir', async () => {
    const results = [OK, BAD, BAD, BAD, OK, OK]
    let i = 0
    const { svc, notices } = setup({ execute: async () => results[i++] })
    await svc.save(input())
    for (let n = 0; n < results.length; n++) await svc.runNow(ID)
    expect(notices).toEqual(['failed', 'recovered'])
    svc.stop()
  })

  it('primeira execução com falha avisa; sem notifyOnFailure não avisa', async () => {
    const a = setup({ execute: async () => BAD })
    await a.svc.save(input())
    await a.svc.runNow(ID)
    expect(a.notices).toEqual(['failed'])
    const b = setup({ execute: async () => BAD })
    await b.svc.save(input({ notifyOnFailure: false }))
    await b.svc.runNow(ID)
    expect(b.notices).toEqual([])
    a.svc.stop()
    b.svc.stop()
  })

  it('depois de reabrir, a falha que continua não avisa de novo', async () => {
    const seed = stored([{ at: new Date().toISOString(), ...BAD }])
    const { svc, notices } = setup({ execute: async () => BAD }, [seed])
    await svc.runNow(ID)
    expect(notices).toEqual([])
    svc.stop()
  })
})

describe('salvar', () => {
  it('recusa pasta não autorizada, entrada inválida e passa do limite', async () => {
    const a = setup({ isAuthorized: async () => false })
    expect(await a.svc.save(input())).toEqual({ ok: false, code: 'notAuthorized' })
    expect(await a.svc.save(input({ intervalMin: 0 }))).toEqual({ ok: false, code: 'invalid' })
    const b = setup()
    for (let n = 0; n < API_LIMITS.monitors; n++) {
      expect((await b.svc.save(input({ id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` }))).ok).toBe(true)
    }
    expect(await b.svc.save(input())).toEqual({ ok: false, code: 'tooManyMonitors' })
    a.svc.stop()
    b.svc.stop()
  })

  it('o ambiente precisa ser .apienv dentro da pasta ou autorizado', async () => {
    const a = setup({ isInsideDir: () => false, isAuthorized: async (p) => p === '/colecao' })
    expect(await a.svc.save(input({ environment: '/outro/x.apienv' }))).toEqual({ ok: false, code: 'notAuthorized' })
    expect(await a.svc.save(input({ environment: '/colecao/x.txt' }))).toEqual({ ok: false, code: 'invalid' })
    a.svc.stop()
  })

  it('editar um monitor salvo continua valendo depois de reabrir (pasta já conferida)', async () => {
    const seed = stored()
    const { svc } = setup({ isAuthorized: async () => false }, [seed])
    const res = await svc.save(input({ name: 'Novo nome' }))
    expect(res.ok).toBe(true)
    expect(await svc.save(input({ collectionDir: '/outra' }))).toEqual({ ok: false, code: 'notAuthorized' })
    svc.stop()
  })

  it('descarta as execuções mais antigas', async () => {
    const { svc } = setup()
    await svc.save(input())
    for (let n = 0; n < API_LIMITS.monitorRuns + 5; n++) await svc.runNow(ID)
    expect((await svc.list())[0].runs).toHaveLength(API_LIMITS.monitorRuns)
    svc.stop()
  })

  it('emite o estado atualizado a cada mudança', async () => {
    const { svc, events } = setup()
    await svc.save(input())
    await svc.runNow(ID)
    expect(events.some((e) => e.running)).toBe(true)
    expect(events[events.length - 1].runs).toHaveLength(1)
    svc.stop()
  })
})

describe('persistência', () => {
  it('grava e relê só a configuração e as execuções', async () => {
    vi.useRealTimers()
    const dir = await mkdtemp(join(tmpdir(), 'monitor-'))
    try {
      const file = join(dir, 'api-monitors.json')
      const a = setup({ store: createFileStore(file) })
      await a.svc.save(input({ environment: '/colecao/dev.apienv' }))
      await a.svc.runNow(ID)
      a.svc.stop()
      const text = await readFile(file, 'utf8')
      expect(JSON.parse(text).monitors[0].runs).toHaveLength(1)
      const b = setup({ store: createFileStore(file) })
      const [m] = await b.svc.list()
      expect(m.name).toBe('Saúde')
      expect(m.environment).toBe('/colecao/dev.apienv')
      expect(m.runs).toHaveLength(1)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('arquivo corrompido começa vazio', async () => {
    vi.useRealTimers()
    const dir = await mkdtemp(join(tmpdir(), 'monitor-'))
    try {
      const { writeFile } = await import('node:fs/promises')
      const file = join(dir, 'm.json')
      await writeFile(file, '{ruim', 'utf8')
      expect(await createFileStore(file).load()).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('resumo da execução', () => {
  it('conta testes, erros e tempos', () => {
    const r = summarize([
      { timeMs: 10, tests: [{ passed: true }, { passed: false }] },
      { errorCode: 'timeout', tests: [] },
      { timeMs: 30, tests: [{ passed: true }] }
    ])
    expect(r).toEqual({ ok: false, passed: 2, failed: 1, errors: 1, totalMs: 40, avgMs: 20 })
    expect(summarize([{ timeMs: 5, tests: [{ passed: true }] }]).ok).toBe(true)
    expect(summarize([]).ok).toBe(false)
  })
})
