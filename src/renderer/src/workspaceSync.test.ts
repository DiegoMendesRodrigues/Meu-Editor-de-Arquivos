// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import type { EditorDocument } from '@/store/documents'
import { cloudTextsNeeded, mergeWorkspace, parseWorkspace, toEntry, type CloudTexts, type MergeOptions, type SyncEntry } from './workspaceSync'

const doc = (syncId: string, content: string, extra: Partial<EditorDocument> = {}): EditorDocument => ({
  id: `doc-${syncId}`,
  path: null,
  name: `${syncId}.md`,
  content,
  savedContent: '',
  language: 'markdown',
  encoding: 'UTF-8',
  eol: 'LF',
  mode: 'edit',
  syncId,
  ...extra
})
/** Arquivo da nuvem aberto, com o texto salvo e o atual. */
const cloudDoc = (syncId: string, saved: string, content = saved, version = 1): EditorDocument =>
  doc(syncId, content, { savedContent: saved, cloud: { id: `f-${syncId}`, path: `/${syncId}.md`, version } })
const baseOf = (...docs: EditorDocument[]) => new Map<string, SyncEntry>(docs.map((d) => [d.syncId!, toEntry(d)]))
const contents = (r: ReturnType<typeof mergeWorkspace>) => r.documents.map((d) => `${d.syncId ?? d.path}:${d.content}`)
let seq = 0
const opts = (texts: CloudTexts = new Map()): MergeOptions => ({ texts, conflictName: (n) => `${n} (conflito)`, newSyncId: () => `c${++seq}` })
const merge = (local: EditorDocument[], remote: SyncEntry[], base: Map<string, SyncEntry>, texts?: CloudTexts) =>
  mergeWorkspace(local, remote, base, opts(texts))

describe('área de trabalho sincronizada', () => {
  it('recebe o texto que mudou no outro computador', () => {
    const a = doc('a', 'velho')
    const r = merge([a], [toEntry(doc('a', 'novo'))], baseOf(a))
    expect(contents(r)).toEqual(['a:novo'])
    expect(r.needsPush).toBe(false)
  })

  it('mantém e envia o que mudou aqui', () => {
    const a = doc('a', 'editado aqui')
    const r = merge([a], [toEntry(doc('a', 'velho'))], baseOf(doc('a', 'velho')))
    expect(contents(r)).toEqual(['a:editado aqui'])
    expect(r.needsPush).toBe(true)
    expect(r.conflicts).toEqual([])
  })

  it('abre abas novas de lá, fecha as fechadas lá e mantém os arquivos do disco', () => {
    const a = doc('a', 'x')
    const disk = doc('d', 'disco', { path: 'C:/notas.md', syncId: 'd' })
    const r = merge([disk, a], [toEntry(doc('b', 'nova'))], baseOf(a))
    expect(contents(r)).toEqual(['d:disco', 'b:nova'])
    expect(r.needsPush).toBe(false)
  })

  it('aba fechada aqui não volta e a nuvem é atualizada', () => {
    const a = doc('a', 'x')
    const r = merge([], [toEntry(a)], baseOf(a))
    expect(r.documents).toEqual([])
    expect(r.needsPush).toBe(true)
  })

  it('texto mudado nos dois computadores: fica o daqui e o de lá abre numa aba de conflito', () => {
    const before = doc('a', 'original')
    const r = merge([doc('a', 'versão daqui')], [toEntry(doc('a', 'versão de lá'))], baseOf(before))
    expect(contents(r)).toEqual(['a:versão daqui', `c${seq}:versão de lá`])
    expect(r.documents[1]).toMatchObject({ name: 'a.md (conflito)', path: null, savedContent: '', mode: 'edit' })
    expect(r.documents[1]).not.toHaveProperty('cloud')
    expect(r.conflicts).toEqual(['a.md (conflito)'])
    expect(r.needsPush).toBe(true)
  })

  it('o mesmo texto nos dois computadores não gera conflito', () => {
    const r = merge([doc('a', 'igual', { mode: 'preview' })], [toEntry(doc('a', 'igual'))], baseOf(doc('a', 'original')))
    expect(r.conflicts).toEqual([])
    expect(r.documents).toHaveLength(1)
  })
})

describe('arquivos da nuvem sem cópias do texto', () => {
  it('arquivo sem alterações guarda só a referência', () => {
    const e = toEntry(cloudDoc('a', 'texto salvo'))
    expect(e.content).toBeUndefined()
    expect(e).not.toHaveProperty('savedContent')
    expect(e.cloud).toEqual({ id: 'f-a', path: '/a.md', version: 1 })
  })

  it('arquivo com alterações guarda só o texto atual', () => {
    const e = toEntry(cloudDoc('a', 'salvo', 'editado'))
    expect(e.content).toBe('editado')
    expect(e).not.toHaveProperty('savedContent')
  })

  it('aba nova de lá sem alterações abre com o texto do arquivo', () => {
    const texts: CloudTexts = new Map([['f-b', { content: 'do arquivo', version: 3 }]])
    const r = merge([], [toEntry(cloudDoc('b', 'x', 'x', 3))], new Map(), texts)
    expect(r.documents[0]).toMatchObject({ content: 'do arquivo', savedContent: 'do arquivo', cloud: { id: 'f-b', version: 3 } })
  })

  it('aba nova de lá com alterações abre com o texto não salvo e o salvo do arquivo', () => {
    const texts: CloudTexts = new Map([['f-b', { content: 'salvo', version: 2 }]])
    const r = merge([], [toEntry(cloudDoc('b', 'salvo', 'não salvo', 2))], new Map(), texts)
    expect(r.documents[0]).toMatchObject({ content: 'não salvo', savedContent: 'salvo', cloud: { version: 2 } })
  })

  it('arquivo excluído da nuvem (sem texto) não abre uma aba vazia', () => {
    const r = merge([], [toEntry(cloudDoc('b', 'x'))], new Map())
    expect(r.documents).toEqual([])
  })

  it('arquivo salvo lá recebe a versão nova sem perder nada', () => {
    const mine = cloudDoc('a', 'v1', 'v1', 1)
    const texts: CloudTexts = new Map([['f-a', { content: 'v2', version: 2 }]])
    const r = merge([mine], [toEntry(cloudDoc('a', 'v2', 'v2', 2))], baseOf(mine), texts)
    expect(r.documents[0]).toMatchObject({ content: 'v2', savedContent: 'v2', cloud: { version: 2 } })
  })

  it('só baixa os arquivos que nenhuma aba daqui tem na versão certa', () => {
    const local = [cloudDoc('a', 'v1', 'v1', 1)]
    const known: CloudTexts = new Map([['f-a', { content: 'v1', version: 1 }]])
    const remote = [toEntry(cloudDoc('a', 'v1', 'v1', 1)), toEntry(cloudDoc('b', 'x')), toEntry(cloudDoc('c', 'v2', 'v2', 2))]
    remote[2].cloud!.id = 'f-a'
    expect(cloudTextsNeeded(local, remote, known).sort()).toEqual(['f-a', 'f-b'])
  })
})

describe('formato da área de trabalho', () => {
  it('converte o formato 1, tirando o texto repetido dos arquivos sem alterações', () => {
    const common = { name: 'a.md', language: 'markdown', mode: 'edit', encoding: 'UTF-8', eol: 'LF' }
    const json = JSON.stringify({
      version: 1,
      activeSyncId: 'a',
      documents: [
        { ...common, syncId: 'a', content: 'igual', savedContent: 'igual', cloud: { id: 'f', path: '/a.md', version: 1 } },
        { ...common, syncId: 'b', content: 'editado', savedContent: 'salvo', cloud: { id: 'g', path: '/b.md', version: 1 } },
        { ...common, syncId: 'c', content: 'sem título', savedContent: '' }
      ]
    })
    const w = parseWorkspace(json)
    expect(w.version).toBe(2)
    expect(w.activeSyncId).toBe('a')
    expect(w.documents.map((e) => e.content)).toEqual([undefined, 'editado', 'sem título'])
    expect(w.documents.every((e) => !('savedContent' in e))).toBe(true)
  })

  it('dados inválidos viram uma área de trabalho vazia', () => {
    expect(parseWorkspace('{x').documents).toEqual([])
    expect(parseWorkspace(null).documents).toEqual([])
  })
})
