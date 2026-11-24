// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ userData: '' }))
vi.mock('electron', () => ({ app: { getPath: () => h.userData } }))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))

import { serializeApiRequest, newApiRequest } from '@shared/api/schema'
import { collectionDirOf, collectionKeyOf, collectionScriptHashes, COLLECTION_FILE, isScriptTrusted, requestKeyOf, resetScriptTrustCache, scriptHash, trustHashes } from '../scriptTrust'
import { runInWorker } from './runner'
import type { ScriptInput, ScriptOutput, ScriptWorkerLike } from './types'

beforeEach(() => {
  h.userData = mkdtempSync(join(tmpdir(), 'apitrust-'))
  resetScriptTrustCache()
})

const withScripts = (name: string, pre: string, post = '') => {
  const r = newApiRequest()
  return serializeApiRequest({ ...r, name, scripts: { pre, post } })
}

describe('confiança em scripts', () => {
  it('sem script não há o que confiar', async () => {
    expect(await isScriptTrusted({ pre: '', post: '  ', keys: { request: ['x'] } })).toBe(true)
  })

  it('script novo não é confiado; depois de confiar é; se muda, cai', async () => {
    const keys = { request: ['C:\\proj\\a.apireq'] }
    expect(await isScriptTrusted({ pre: 'a()', post: '', keys })).toBe(false)
    await trustHashes(requestKeyOf('C:\\proj\\a.apireq'), [scriptHash('a()', '')])
    expect(await isScriptTrusted({ pre: 'a()', post: '', keys })).toBe(true)
    expect(await isScriptTrusted({ pre: 'a() ', post: '', keys })).toBe(false)
    expect(await isScriptTrusted({ pre: 'a()', post: 'b()', keys })).toBe(false)
    // O pre e o post não se confundem ao juntar (separador).
    expect(scriptHash('ab', 'c')).not.toBe(scriptHash('a', 'bc'))
  })

  it('a confiança persiste em disco (api-script-trust.json) e não mistura as chaves', async () => {
    await trustHashes(collectionKeyOf(join(h.userData, 'col')), [scriptHash('x', '')])
    resetScriptTrustCache()
    expect(await isScriptTrusted({ pre: 'x', post: '', keys: { dir: join(h.userData, 'col') } })).toBe(true)
    expect(await isScriptTrusted({ pre: 'x', post: '', keys: { dir: join(h.userData, 'outra') } })).toBe(false)
    expect(await isScriptTrusted({ pre: 'x', post: '', keys: { request: ['doc-9'] } })).toBe(false)
  })

  it('"confiar na coleção" lê os .apireq da pasta e substitui a lista', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apicol-'))
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, COLLECTION_FILE), '{}')
    writeFileSync(join(dir, 'a.apireq'), withScripts('a', "pm.test('x', () => {})"))
    writeFileSync(join(dir, 'sub', 'b.apireq'), withScripts('b', '', 'console.log(1)'))
    writeFileSync(join(dir, 'sub', 'c.apireq'), withScripts('c', ''))
    writeFileSync(join(dir, 'sub', 'ruim.apireq'), 'não é json')
    const hashes = await collectionScriptHashes(dir)
    expect(hashes.sort()).toEqual([scriptHash("pm.test('x', () => {})", ''), scriptHash('', 'console.log(1)')].sort())
    await trustHashes(collectionKeyOf(dir), ['0'.repeat(64)])
    await trustHashes(collectionKeyOf(dir), hashes, true)
    expect(await isScriptTrusted({ pre: "pm.test('x', () => {})", post: '', keys: { dir } })).toBe(true)
    // Um script alterado depois (no arquivo) não está na lista.
    expect(await isScriptTrusted({ pre: "pm.test('y', () => {})", post: '', keys: { dir } })).toBe(false)
    expect(collectionDirOf(join(dir, 'sub', 'b.apireq'))).toBe(dir)
    expect(collectionDirOf(join(tmpdir(), 'sem-colecao', 'a.apireq'))).toBeNull()
  })
})

describe('runInWorker', () => {
  const input = { phase: 'pre', code: '', cpuMs: 10, memoryBytes: 1, maxLogLines: 1, values: {}, secretNames: [], req: { method: 'GET', url: '', headers: [], body: '' } } as ScriptInput
  const ok: ScriptOutput = { ok: true, logs: [], tests: [], envSets: [], varSets: [], secretsRead: [] }

  const fake = (behavior: (w: { onMessage: (m: ScriptOutput) => void; onError: (e: Error) => void; onExit: () => void }) => void): { create: () => ScriptWorkerLike; terminated: () => boolean } => {
    let terminated = false
    return {
      terminated: () => terminated,
      create: () => {
        const handlers: { message?: (m: ScriptOutput) => void; error?: (e: Error) => void; exit?: () => void } = {}
        const w: ScriptWorkerLike = {
          postMessage: () => behavior({ onMessage: (m) => handlers.message?.(m), onError: (e) => handlers.error?.(e), onExit: () => handlers.exit?.() }),
          terminate: () => {
            terminated = true
          },
          on: ((event: 'message' | 'error' | 'exit', fn: never) => {
            handlers[event] = fn
          }) as ScriptWorkerLike['on']
        }
        return w
      }
    }
  }

  it('devolve o resultado da thread e a encerra', async () => {
    const f = fake((w) => w.onMessage(ok))
    expect(await runInWorker(f.create, input, 1000)).toEqual(ok)
    expect(f.terminated()).toBe(true)
  })

  it('a thread que não responde é encerrada pelo tempo de parede (scriptTimeout)', async () => {
    const f = fake(() => undefined)
    const out = await runInWorker(f.create, input, 50)
    expect(out.error).toBe('scriptTimeout')
    expect(f.terminated()).toBe(true)
  })

  it('erro de memória da thread vira scriptMemory; outros erros, scriptError', async () => {
    const mem = fake((w) => w.onError(Object.assign(new Error('x'), { code: 'ERR_WORKER_OUT_OF_MEMORY' })))
    expect((await runInWorker(mem.create, input, 1000)).error).toBe('scriptMemory')
    const other = fake((w) => w.onError(new Error('boom')))
    expect((await runInWorker(other.create, input, 1000)).error).toBe('scriptError')
    const exit = fake((w) => w.onExit())
    expect((await runInWorker(exit.create, input, 1000)).error).toBe('scriptError')
  })
})
