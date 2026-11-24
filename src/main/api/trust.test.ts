// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({ app: { getPath: () => h.dir } }))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))

import { isHostTrusted, resetTrustCache, trustHost } from './trust'

beforeEach(() => {
  h.dir = mkdtempSync(join(tmpdir(), 'apitrust-'))
  resetTrustCache()
})

describe('hosts confiáveis', () => {
  it('começa vazio e confirma por escopo', async () => {
    expect(await isHostTrusted(['e1'], 'api.exemplo.com.br')).toBe(false)
    await trustHost(['e1'], 'API.exemplo.com.br')
    expect(await isHostTrusted(['e1'], 'api.exemplo.com.br')).toBe(true)
    expect(await isHostTrusted(['e1', 'globals'], 'api.exemplo.com.br')).toBe(false)
    expect(await isHostTrusted(['e2'], 'api.exemplo.com.br')).toBe(false)
  })

  it('persiste em disco e relê', async () => {
    await trustHost(['e1', 'globals'], '127.0.0.1:8080')
    expect(JSON.parse(readFileSync(join(h.dir, 'api-trust.json'), 'utf8')).scopes.globals).toEqual(['127.0.0.1:8080'])
    resetTrustCache()
    expect(await isHostTrusted(['e1', 'globals'], '127.0.0.1:8080')).toBe(true)
  })

  it('gravações em fila não perdem confirmações', async () => {
    await Promise.all([trustHost(['e1'], 'a.exemplo.com.br'), trustHost(['e1'], 'b.exemplo.com.br'), trustHost(['e1'], 'c.exemplo.com.br')])
    resetTrustCache()
    for (const x of ['a', 'b', 'c']) expect(await isHostTrusted(['e1'], `${x}.exemplo.com.br`)).toBe(true)
  })
})
