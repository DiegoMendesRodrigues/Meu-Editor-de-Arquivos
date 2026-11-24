// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { beforeEach, describe, expect, it } from 'vitest'
import { checkName } from '@shared/fileName'
import { fileKind } from './fileKinds'
import { useFolderColors } from './store/folderColors'
import { useDocuments } from './store/documents'

describe('nome ao renomear', () => {
  it('aceita nomes comuns, com espaços e acentos', () => {
    expect(checkName('relatório final.md')).toBeNull()
    expect(checkName('  pasta  ')).toBeNull() // espaços nas pontas são removidos
    expect(checkName('.gitignore')).toBeNull()
  })

  it('recusa vazio, separadores, caracteres proibidos e nomes reservados', () => {
    expect(checkName('   ')).toBe('empty')
    for (const bad of ['a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a|b', '.', '..', 'nome.', 'CON', 'nul.txt', 'com1']) {
      expect(checkName(bad), bad).toBe('invalid')
    }
    expect(checkName('x'.repeat(256))).toBe('tooLong')
  })
})

describe('ícone pelo tipo do arquivo', () => {
  it('segue as seções do botão "+"', () => {
    expect(['leia.md', 'a.markdown', 'notas.txt', 'artigo.tex'].map(fileKind)).toEqual(['document', 'document', 'document', 'document'])
    expect(fileKind('app.log')).toBe('log')
    expect(['Listar produtos.apireq', 'Homologação.apienv', 'x.APIRESP'].map(fileKind)).toEqual(['api', 'api', 'api'])
    expect(['main.py', 'x.C', 'App.tsx', 'lib.rs'].map(fileKind)).toEqual(['code', 'code', 'code', 'code'])
    expect(['run.ps1', 'build.sh', 'go.bat', 'init.lua'].map(fileKind)).toEqual(['script', 'script', 'script', 'script'])
    expect(['index.html', 'site.css', 'dados.json', 'pom.xml'].map(fileKind)).toEqual(['web', 'web', 'web', 'web'])
    expect(['a.csv', 'b.sql', 'c.yml', 'd.toml', 'e.ini', 'f.conf'].map(fileKind)).toEqual(['data', 'data', 'data', 'data', 'data', 'data'])
  })

  it('outros tipos e arquivos sem extensão usam o ícone genérico', () => {
    expect(['foto.png', 'Makefile', '.gitignore', 'arquivo.'].map(fileKind)).toEqual(['other', 'other', 'other', 'other'])
  })
})

describe('cor das pastas', () => {
  beforeEach(() => useFolderColors.getState().setAll({}))

  it('a cor padrão não fica guardada', () => {
    const s = useFolderColors.getState()
    s.set('local:C:\\p', 'red')
    expect(useFolderColors.getState().colorOf('local:C:\\p')).toBe('red')
    s.set('local:C:\\p', 'amber')
    expect(useFolderColors.getState().colors).toEqual({})
    expect(useFolderColors.getState().colorOf('local:C:\\outra')).toBe('amber')
  })

  it('ao renomear, a pasta e as subpastas mantêm as cores (e as parecidas não mudam)', () => {
    useFolderColors.getState().setAll({ 'cloud:docs': 'blue', 'cloud:docs/sub': 'pink', 'cloud:docs2': 'red', 'local:C:\\docs': 'lime' })
    useFolderColors.getState().rename('cloud:docs', 'cloud:textos')
    expect(useFolderColors.getState().colors).toEqual({ 'cloud:textos': 'blue', 'cloud:textos/sub': 'pink', 'cloud:docs2': 'red', 'local:C:\\docs': 'lime' })
    useFolderColors.getState().rename('local:C:\\docs', 'local:C:\\papeis')
    expect(useFolderColors.getState().colors['local:C:\\papeis']).toBe('lime')
  })
})

describe('abas de arquivos renomeados no disco', () => {
  it('o arquivo renomeado muda nome, caminho e linguagem; os de dentro da pasta mudam o caminho', () => {
    const docs = useDocuments.getState()
    docs.replaceDocuments(
      [
        { path: 'C:\\p\\a.txt', name: 'a.txt', content: '', savedContent: '', language: 'plaintext', encoding: 'UTF-8', eol: 'LF', mode: 'edit' },
        { path: 'C:\\p\\sub\\b.md', name: 'b.md', content: '', savedContent: '', language: 'markdown', encoding: 'UTF-8', eol: 'LF', mode: 'preview' },
        { path: 'C:\\p\\subpasta.md', name: 'subpasta.md', content: '', savedContent: '', language: 'markdown', encoding: 'UTF-8', eol: 'LF', mode: 'preview' }
      ],
      null
    )
    useDocuments.getState().renameLocalPath('C:\\p\\a.txt', 'C:\\p\\a.py')
    useDocuments.getState().renameLocalPath('C:\\p\\sub', 'C:\\p\\outra')
    const [a, b, c] = useDocuments.getState().documents
    expect(a).toMatchObject({ path: 'C:\\p\\a.py', name: 'a.py', language: 'python', mode: 'edit' })
    expect(b).toMatchObject({ path: 'C:\\p\\outra\\b.md', name: 'b.md' })
    expect(c.path).toBe('C:\\p\\subpasta.md')
  })
})
