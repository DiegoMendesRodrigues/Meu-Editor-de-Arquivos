// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron, test as base, type ElectronApplication, type Page } from '@playwright/test'

interface Workspace {
  /** Pasta temporária com arquivos de exemplo. */
  dir: string
  file(rel: string): string
}

interface Fixtures {
  workspace: Workspace
  app: ElectronApplication
  page: Page
}

/** Abre o app com dados de usuário isolados; os diálogos nativos são trocados por respostas pré-definidas. */
export const test = base.extend<Fixtures>({
  workspace: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'editor-e2e-'))
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'leia-me.md'), '# Título do documento\n\nUm parágrafo com **negrito**.\n\n- item 1\n- item 2\n')
    writeFileSync(join(dir, 'dados.json'), JSON.stringify({ nome: 'Ana', itens: [1, 2, 3], endereco: { cidade: 'Recife' } }, null, 2))
    writeFileSync(join(dir, 'quebrado.json'), '{ "a": 1, }')
    writeFileSync(join(dir, 'src', 'a.ts'), 'const laranja = 1\n')
    writeFileSync(join(dir, 'notas.txt'), 'primeira laranja\nsegunda laranja\n')
    await use({ dir, file: (rel) => join(dir, rel) })
    rmSync(dir, { recursive: true, force: true })
  },

  app: async ({ workspace: _workspace }, use) => {
    const userData = mkdtempSync(join(tmpdir(), 'editor-e2e-data-'))
    const app = await electron.launch({
      args: [resolve('out/main/index.js'), `--user-data-dir=${userData}`, '--lang=pt-BR'],
      colorScheme: 'light' // o app segue o tema do sistema; os testes partem sempre do claro
    })
    await use(app)
    // Se o teste deixou texto não salvo, o app pergunta ao fechar: responde "Não salvar".
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = (async () => ({ response: 1, checkboxChecked: false })) as typeof dialog.showMessageBox
    })
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  },

  page: async ({ app }, use) => {
    const page = await app.firstWindow()
    await page.waitForSelector('[role=tab]') // documento inicial carregado
    await use(page)
  }
})

/** Faz o diálogo "Abrir arquivos" / "Abrir pasta" devolver os caminhos indicados. */
export async function stubOpenDialog(app: ElectronApplication, paths: string[]): Promise<void> {
  await app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths })) as typeof dialog.showOpenDialog
  }, paths)
}

export async function stubSaveDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as typeof dialog.showSaveDialog
  }, filePath)
}

export { expect } from '@playwright/test'
