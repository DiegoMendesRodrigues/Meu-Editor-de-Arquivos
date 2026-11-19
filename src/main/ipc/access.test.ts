import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertAuthorized, authorizeFile, authorizeRoot, isInside } from './access'

describe('controle de acesso', () => {
  const root = resolve('pasta-de-teste')

  it('reconhece caminhos dentro e fora da pasta', () => {
    expect(isInside(root, join(root, 'a', 'b.txt'))).toBe(true)
    expect(isInside(root, root)).toBe(true)
    expect(isInside(root, join(root, '..', 'fora.txt'))).toBe(false)
    expect(isInside(root, resolve('pasta-de-teste-2', 'x'))).toBe(false)
  })

  it('libera apenas arquivos e pastas autorizados', async () => {
    await expect(assertAuthorized(join(root, 'x.md'))).rejects.toThrow(/Acesso negado/)
    authorizeRoot(root)
    await expect(assertAuthorized(join(root, 'sub', 'x.md'))).resolves.toBe(join(root, 'sub', 'x.md'))
    await expect(assertAuthorized(join(root, '..', 'segredo.txt'))).rejects.toThrow()
    const avulso = resolve('avulso.txt')
    authorizeFile(avulso)
    await expect(assertAuthorized(avulso)).resolves.toBe(avulso)
  })
})
