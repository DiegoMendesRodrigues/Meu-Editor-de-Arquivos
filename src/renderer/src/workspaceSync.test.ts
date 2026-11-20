// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import type { EditorDocument } from '@/store/documents'
import { mergeWorkspace, toEntry, type SyncEntry } from './workspaceSync'

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
const baseOf = (...docs: EditorDocument[]) => new Map<string, SyncEntry>(docs.map((d) => [d.syncId!, toEntry(d)]))
const contents = (r: ReturnType<typeof mergeWorkspace>) => r.documents.map((d) => `${d.syncId ?? d.path}:${d.content}`)

describe('área de trabalho sincronizada', () => {
  it('recebe o texto que mudou no outro computador', () => {
    const a = doc('a', 'velho')
    const r = mergeWorkspace([a], [toEntry(doc('a', 'novo'))], baseOf(a))
    expect(contents(r)).toEqual(['a:novo'])
    expect(r.needsPush).toBe(false)
  })

  it('mantém e envia o que mudou aqui', () => {
    const a = doc('a', 'editado aqui')
    const r = mergeWorkspace([a], [toEntry(doc('a', 'velho'))], baseOf(doc('a', 'velho')))
    expect(contents(r)).toEqual(['a:editado aqui'])
    expect(r.needsPush).toBe(true)
  })

  it('abre abas novas de lá, fecha as fechadas lá e mantém os arquivos do disco', () => {
    const a = doc('a', 'x')
    const disk = doc('d', 'disco', { path: 'C:/notas.md', syncId: 'd' })
    const r = mergeWorkspace([disk, a], [toEntry(doc('b', 'nova'))], baseOf(a))
    expect(contents(r)).toEqual(['d:disco', 'b:nova'])
    expect(r.needsPush).toBe(false)
  })

  it('aba fechada aqui não volta e a nuvem é atualizada', () => {
    const a = doc('a', 'x')
    const r = mergeWorkspace([], [toEntry(a)], baseOf(a))
    expect(r.documents).toEqual([])
    expect(r.needsPush).toBe(true)
  })
})
