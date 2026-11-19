import { beforeEach, describe, expect, it } from 'vitest'
import { isDirty, useDocuments } from './documents'

const file = { path: '/p/a.md', name: 'a.md', content: 'um\ndois\n', encoding: 'UTF-8' as const, eol: 'LF' as const, size: 8 }

describe('conversões do documento', () => {
  beforeEach(() => useDocuments.setState({ documents: [], activeId: null, untitledCounter: 0 }))
  const doc = () => useDocuments.getState().documents[0]

  it('converter quebra de linha altera o texto e marca como alterado', () => {
    useDocuments.getState().addOpenedFiles([file])
    expect(isDirty(doc())).toBe(false)
    useDocuments.getState().setEol(doc().id, 'CRLF')
    expect(doc().content).toBe('um\r\ndois\r\n')
    expect(doc().eol).toBe('CRLF')
    expect(isDirty(doc())).toBe(true)
    useDocuments.getState().setEol(doc().id, 'LF')
    expect(isDirty(doc())).toBe(false)
  })

  it('converter codificação marca como alterado até salvar', () => {
    useDocuments.getState().addOpenedFiles([file])
    useDocuments.getState().setEncoding(doc().id, 'UTF-8 BOM')
    expect(isDirty(doc())).toBe(true)
    useDocuments.getState().markSaved(doc().id, { path: '/p/a.md', name: 'a.md', size: 11 }, doc().content)
    expect(isDirty(doc())).toBe(false)
  })

  it('trocar para linguagem sem visualização leva ao modo de edição', () => {
    useDocuments.getState().addOpenedFiles([file])
    expect(doc().mode).toBe('preview')
    useDocuments.getState().setLanguage(doc().id, 'python')
    expect(doc()).toMatchObject({ language: 'python', mode: 'edit' })
  })
})
