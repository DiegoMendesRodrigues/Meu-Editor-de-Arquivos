// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { setMainLocale } from '../i18n'
import { assertAuthorized, assertAuthorizedForMain, authorizeFile, authorizeMainOnlyFile, authorizeRoot, isInside } from './access'

// A mensagem de acesso negado é conferida em português do Brasil.
setMainLocale('pt-BR')

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

  it('recusa gravação em arquivo novo dentro de link simbólico que aponta para fora', async () => {
    const base = mkdtempSync(join(tmpdir(), 'mea-acc-'))
    const dentro = join(base, 'raiz')
    const fora = join(base, 'fora')
    mkdirSync(dentro)
    mkdirSync(fora)
    try {
      symlinkSync(fora, join(dentro, 'link'), process.platform === 'win32' ? 'junction' : 'dir')
      symlinkSync(join(fora, 'nao-existe.txt'), join(dentro, 'pendente.txt'), 'file')
    } catch {
      return // sem permissão para criar links (Windows sem modo desenvolvedor)
    }
    writeFileSync(join(fora, 'x.txt'), 'x')
    authorizeRoot(dentro)
    await expect(assertAuthorized(join(dentro, 'link', 'novo.txt'))).rejects.toThrow()
    await expect(assertAuthorized(join(dentro, 'link', 'x.txt'))).rejects.toThrow()
    await expect(assertAuthorized(join(dentro, 'pendente.txt'))).rejects.toThrow()
    await expect(assertAuthorized(join(dentro, 'novo.txt'))).resolves.toBe(join(dentro, 'novo.txt'))
  })

  it.runIf(process.platform === 'win32')('recusa fluxos alternativos de dados no Windows', async () => {
    authorizeRoot(root)
    await expect(assertAuthorized(join(root, 'a.txt:stream'))).rejects.toThrow()
  })
})

describe('arquivos só do Main (chaves e certificados)', () => {
  it('o Main lê; a verificação do Renderer (assertAuthorized) recusa', async () => {
    setMainLocale('pt-BR')
    const dir = mkdtempSync(join(tmpdir(), 'mea-chave-'))
    const key = join(dir, 'cliente.key')
    writeFileSync(key, 'segredo')
    authorizeMainOnlyFile(key)
    expect(await assertAuthorizedForMain(key)).toBe(resolve(key))
    await expect(assertAuthorized(key)).rejects.toThrow()
  })
})
