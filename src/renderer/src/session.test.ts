import { beforeEach, describe, expect, it } from 'vitest'
import { snapshot } from './session'
import { useDocuments } from './store/documents'
import { useWorkspace } from './store/workspace'

const file = (path: string, content: string) => ({
  path,
  name: path.split('/').pop()!,
  content,
  encoding: 'UTF-8' as const,
  eol: 'LF' as const,
  size: content.length
})

describe('sessão', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: [], activeId: null, untitledCounter: 0 })
    useWorkspace.setState({ folder: { path: '/projeto', name: 'projeto' } })
  })

  it('guarda texto não salvo apenas no backup automático', () => {
    const s = useDocuments.getState()
    s.addOpenedFiles([file('/projeto/a.md', 'original')])
    const id = useDocuments.getState().activeId!
    s.updateContent(id, 'editado')

    const backup = snapshot(true)
    expect(backup.documents).toEqual([expect.objectContaining({ path: '/projeto/a.md', unsavedContent: 'editado' })])
    expect(backup.folder).toBe('/projeto')
    expect(backup.activeIndex).toBe(0)

    const final = snapshot(false)
    expect(final.documents[0].unsavedContent).toBeUndefined()
  })

  it('não guarda conteúdo de arquivos sem alterações', () => {
    useDocuments.getState().addOpenedFiles([file('/projeto/b.json', '{}')])
    expect(snapshot(true).documents[0]).not.toHaveProperty('unsavedContent')
  })

  it('mantém documentos sem título só quando têm texto e é backup', () => {
    const s = useDocuments.getState()
    s.newDocument() // vazio: descartado
    s.newDocument()
    s.updateContent(useDocuments.getState().activeId!, 'rascunho')

    const backup = snapshot(true)
    expect(backup.documents).toHaveLength(1)
    expect(backup.documents[0]).toMatchObject({ path: null, name: 'Sem título 2.md', unsavedContent: 'rascunho' })
    expect(snapshot(false).documents).toHaveLength(0)
  })

  it('restaura a numeração de documentos sem título', () => {
    const base = { content: 'x', savedContent: '', language: 'markdown', encoding: 'UTF-8' as const, eol: 'LF' as const, mode: 'edit' as const }
    useDocuments.getState().restore([{ ...base, path: null, name: 'Sem título 4.md' }], 0)
    useDocuments.getState().newDocument()
    expect(useDocuments.getState().documents.map((d) => d.name)).toEqual(['Sem título 4.md', 'Sem título 5.md'])
  })
})
