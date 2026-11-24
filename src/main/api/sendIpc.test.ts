// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => h.dir },
  BrowserWindow: { fromWebContents: () => null },
  dialog: {}
}))
vi.mock('electron-log/main', () => ({ default: { info: () => undefined, warn: () => undefined } }))
vi.mock('../ipc/secure', () => ({ handle: () => undefined }))
vi.mock('../ipc/access', async () => {
  const actual = await vi.importActual<typeof import('../ipc/access')>('../ipc/access')
  return actual
})
vi.mock('../i18n', () => ({ tm: (k: string) => k }))
vi.mock('./engine', () => ({ executeRequest: async () => ({ ok: false, runId: 'x', code: 'unknown' }) }))

import { MASK } from '@shared/api/protocol'
import { apiRequestSchema } from '@shared/api/schema'
import { authorizeRoot } from '../ipc/access'
import { addHistory, clearHistory, listHistory, maskRequestForHistory, resetHistoryCache } from './history'
import { safeSegments, writeCollectionFiles } from './sendIpc'

beforeAll(() => {
  h.dir = mkdtempSync(join(tmpdir(), 'apiud-'))
})

describe('safeSegments', () => {
  it('aceita caminhos relativos comuns', () => {
    expect(safeSegments('pasta/sub/req.apireq')).toEqual(['pasta', 'sub', 'req.apireq'])
  })
  it('recusa .., absolutos e nomes inválidos', () => {
    for (const bad of ['../x', 'a/../../x', '/etc/x', 'C:\\x', '\\\\srv\\x', 'a//b', 'a/CON.txt', 'a/b?.json', 'a/b.', '']) {
      expect(() => safeSegments(bad), bad).toThrow()
    }
  })
})

describe('writeCollectionFiles', () => {
  it('grava só em pasta autorizada, cria subpastas e não sobrescreve', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apicol-'))
    await expect(writeCollectionFiles({ dir, files: [{ relativePath: 'a.json', content: '1' }] })).rejects.toThrow()
    authorizeRoot(dir)
    const first = await writeCollectionFiles({ dir, files: [{ relativePath: 'sub/a.json', content: '1' }] })
    const second = await writeCollectionFiles({ dir, files: [{ relativePath: 'sub/a.json', content: '2' }] })
    expect(first[0]).toBe(join(dir, 'sub', 'a.json'))
    expect(second[0]).toBe(join(dir, 'sub', 'a (2).json'))
    expect(readFileSync(first[0]!, 'utf8')).toBe('1')
    await expect(writeCollectionFiles({ dir, files: [{ relativePath: '../fora.json', content: 'x' }] })).rejects.toThrow()
    expect(existsSync(join(dir, '..', 'fora.json'))).toBe(false)
  })
})

describe('writeCollectionFiles e links simbólicos', () => {
  it('recusa criar pastas através de um link que sai da pasta autorizada', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'apicol-'))
    const fora = mkdtempSync(join(tmpdir(), 'apifora-'))
    try {
      symlinkSync(fora, join(dir, 'link'), 'junction')
    } catch {
      return // sem permissão para criar links neste ambiente
    }
    authorizeRoot(dir)
    await expect(writeCollectionFiles({ dir, files: [{ relativePath: 'link/novo/a.json', content: 'x' }] })).rejects.toThrow()
    expect(existsSync(join(fora, 'novo'))).toBe(false)
    mkdirSync(join(dir, 'ok'))
    await expect(writeCollectionFiles({ dir, files: [{ relativePath: 'ok/n/a.json', content: 'x' }] })).resolves.toHaveLength(1)
  })
})

describe('histórico', () => {
  it('mascara senha na URL, params e cabeçalhos sensíveis literais, mantendo {{referências}}', () => {
    const r = apiRequestSchema.parse({
      $schema: 'meu-editor/api-request@1',
      id: 'r2',
      url: 'https://user:pw123@api.exemplo.com.br/x?token=abc&page=2&api_key={{k}}&senha=zz#f',
      params: [{ key: 'access_token', value: 'lit' }, { key: 'q', value: 'ok' }, { key: 'secret', value: '{{s}}' }],
      headers: [{ key: 'X-Auth-Token', value: 'lit' }, { key: 'Accept', value: 'a' }]
    })
    const m = maskRequestForHistory(r)
    expect(m.url).toBe(`https://user:${MASK}@api.exemplo.com.br/x?token=${MASK}&page=2&api_key={{k}}&senha=${MASK}#f`)
    expect(m.params.map((x) => x.value)).toEqual([MASK, 'ok', '{{s}}'])
    expect(m.headers.map((x) => x.value)).toEqual([MASK, 'a'])
  })

  const request = apiRequestSchema.parse({
    $schema: 'meu-editor/api-request@1',
    id: 'r1',
    url: 'https://api.exemplo.com.br/{{rota}}',
    headers: [{ key: 'Authorization', value: 'Bearer abc' }, { key: 'X-Api-Key', value: '{{chave}}' }, { key: 'Accept', value: 'a' }],
    auth: { type: 'bearer', token: 'literal', prefix: 'Bearer' }
  })

  it('grava URL modelo, mascara valores sensíveis e limita a 200 (mais novo primeiro)', async () => {
    resetHistoryCache()
    await clearHistory()
    await addHistory({ request, status: 200, timeMs: 12 })
    const [e] = await listHistory()
    expect(e!.url).toBe('https://api.exemplo.com.br/{{rota}}')
    expect(e!.request.headers.map((x) => x.value)).toEqual([MASK, '{{chave}}', 'a'])
    expect(e!.request.auth).toMatchObject({ token: MASK })
    for (let i = 0; i < 205; i++) await addHistory({ request: { ...request, url: `http://127.0.0.1/${i}` } })
    const list = await listHistory()
    expect(list).toHaveLength(200)
    expect(list[0]!.url).toBe('http://127.0.0.1/204')
    // persistiu: um cache novo lê do arquivo
    resetHistoryCache()
    expect(await listHistory()).toHaveLength(200)
  })
})
