// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { beforeEach, describe, expect, it } from 'vitest'
import type { CloudFileMeta } from '@shared/ipc'
import { allFolders, buildCloudTree, isValidCloudName, usageLevel } from './cloud'
import { useDocuments } from './documents'

const meta = (id: string, path: string): CloudFileMeta => ({ id, path, version: 1, size: 1, encoding: 'UTF-8', updatedAt: '2026-01-01T00:00:00Z' }) as CloudFileMeta

describe('árvore da nuvem', () => {
  it('junta pastas criadas e pastas dos caminhos, em ordem', () => {
    const tree = buildCloudTree([meta('1', 'b/x.md'), meta('2', 'raiz.md'), meta('3', 'a/sub/y.md')], ['vazia', 'a'])
    expect(tree.files.map((f) => f.path)).toEqual(['raiz.md'])
    expect(tree.folders.map((f) => f.path)).toEqual(['a', 'b', 'vazia'])
    expect(tree.folders[0].folders[0].files[0].path).toBe('a/sub/y.md')
    expect(allFolders([meta('3', 'a/sub/y.md')], ['z'])).toEqual(['', 'a', 'a/sub', 'z'])
  })

  it('valida nomes', () => {
    expect(isValidCloudName('notas.md')).toBe(true)
    expect(isValidCloudName('a/b')).toBe(false)
    expect(isValidCloudName('..')).toBe(false)
    expect(isValidCloudName('  ')).toBe(false)
  })
})

describe('documento salvo na nuvem', () => {
  beforeEach(() => useDocuments.setState({ documents: [], activeId: null, untitledCounter: 0 }))

  it('a aba passa a ter o nome do arquivo na nuvem e acompanha a mudança de pasta', () => {
    const s = useDocuments.getState()
    s.newDocument('txt')
    const id = useDocuments.getState().activeId!
    s.markCloudSaved(id, { id: 'c1', path: 'trabalho/ata.md', version: 1 }, '')
    let doc = useDocuments.getState().documents[0]
    expect(doc.name).toBe('ata.md')
    expect(doc.language).toBe('markdown')
    s.updateCloudPath('c1', 'arquivo/ata.md', 2)
    doc = useDocuments.getState().documents[0]
    expect(doc.cloud).toEqual({ id: 'c1', path: 'arquivo/ata.md', version: 2 })
  })
})

describe('alerta de uso do plano', () => {
  it('fica laranja a partir de 90% e vermelho a partir de 100%', () => {
    expect(usageLevel(89, 100)).toBe('ok')
    expect(usageLevel(90, 100)).toBe('warn')
    expect(usageLevel(99, 100)).toBe('warn')
    expect(usageLevel(100, 100)).toBe('full')
    expect(usageLevel(150, 100)).toBe('full')
    const mb = 1024 * 1024
    expect(usageLevel(4.5 * mb, 5 * mb)).toBe('warn')
  })

  it('sem plano conhecido não alerta', () => {
    expect(usageLevel(1000, null)).toBe('ok')
    expect(usageLevel(1000, 0)).toBe('ok')
  })
})
