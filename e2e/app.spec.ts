import { readFileSync } from 'node:fs'
import { expect, stubOpenDialog, stubSaveDialog, test } from './fixtures'

type Api = { readFile(p: string): Promise<unknown>; saveFile(r: object): Promise<unknown> }

test.describe('edição e arquivos', () => {
  test('abre com um documento novo e marca alterações', async ({ page }) => {
    await expect(page.getByRole('tab', { selected: true })).toContainText('Sem título 1.md')
    await page.locator('.monaco-editor').click()
    await page.keyboard.type('olá mundo')
    await expect(page.getByRole('tab', { selected: true })).toContainText('●')
  })

  test('salva um documento novo no disco', async ({ app, page, workspace }) => {
    await stubSaveDialog(app, workspace.file('novo.md'))
    await page.locator('.monaco-editor').click()
    await page.keyboard.type('conteúdo salvo')
    await page.keyboard.press('Control+S')
    await expect(page.getByRole('tab', { selected: true })).toContainText('novo.md')
    await expect(page.getByRole('tab', { selected: true })).not.toContainText('●')
    expect(readFileSync(workspace.file('novo.md'), 'utf8')).toContain('conteúdo salvo')
  })
})

test.describe('visualizações', () => {
  test('Markdown abre formatado e alterna para o texto', async ({ app, page, workspace }) => {
    await stubOpenDialog(app, [workspace.file('leia-me.md')])
    await page.keyboard.press('Control+O')
    await expect(page.getByRole('heading', { name: 'Título do documento' })).toBeVisible()
    await expect(page.locator('article strong')).toHaveText('negrito')
    await page.getByRole('button', { name: 'Editar texto' }).first().click()
    await expect(page.locator('.monaco-editor')).toBeVisible()
    await expect(page.locator('.view-lines')).toContainText('# Título do documento')
  })

  test('JSON abre em árvore', async ({ app, page, workspace }) => {
    await stubOpenDialog(app, [workspace.file('dados.json')])
    await page.keyboard.press('Control+O')
    const tree = page.getByRole('tree')
    await expect(tree).toContainText('Ana')
    await expect(tree).toContainText('Recife')
  })

  test('JSON inválido mostra o erro com posição', async ({ app, page, workspace }) => {
    await stubOpenDialog(app, [workspace.file('quebrado.json')])
    await page.keyboard.press('Control+O')
    await expect(page.getByText(/linha 1/i).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Editar e ir até o erro/ })).toBeVisible()
  })
})

test.describe('pasta e busca', () => {
  test('abre uma pasta, pesquisa nos arquivos e substitui', async ({ app, page, workspace }) => {
    await stubOpenDialog(app, [workspace.dir])
    await page.keyboard.press('Control+Shift+K')
    await expect(page.getByRole('tree').first()).toContainText('notas.txt')

    await page.keyboard.press('Control+Shift+F')
    await page.getByLabel('Texto a localizar').fill('laranja')
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'ocorrência' })).toContainText('3 ocorrência(s) em 2 arquivo(s)')

    page.on('dialog', (d) => void d.accept())
    await page.getByLabel('Texto de substituição').fill('banana')
    await page.getByRole('button', { name: 'Substituir tudo' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'substituição' })).toContainText('3 substituição(ões) em 2 arquivo(s)')
    expect(readFileSync(workspace.file('notas.txt'), 'utf8')).toBe('primeira banana\nsegunda banana\n')
    expect(readFileSync(workspace.file('src/a.ts'), 'utf8')).toBe('const banana = 1\n')
  })
})

test.describe('segurança', () => {
  test('o renderer não tem Node.js e só expõe a API do preload', async ({ page }) => {
    const info = await page.evaluate(() => {
      const w = window as unknown as { require?: unknown; process?: unknown; api: object }
      return { require: typeof w.require, process: typeof w.process, api: Object.keys(w.api).sort() }
    })
    expect(info.require).toBe('undefined')
    expect(info.process).toBe('undefined')
    expect(info.api).toContain('readFile')
    expect(info.api).not.toContain('writeFile') // sem gravação arbitrária
  })

  test('ler ou gravar fora do que o usuário abriu é recusado', async ({ page, workspace }) => {
    const result = await page.evaluate(async (target) => {
      const api = (window as unknown as { api: Api }).api
      const read = await api.readFile(target).then(() => 'lido', (e: Error) => e.message)
      const write = await api.saveFile({ path: target, content: 'x', encoding: 'UTF-8' }).then(() => 'gravado', (e: Error) => e.message)
      return { read, write }
    }, workspace.file('notas.txt'))
    expect(result.read).toContain('Acesso negado')
    expect(result.write).toContain('não autorizado')
  })

  test('a página não navega para outro endereço', async ({ page }) => {
    const before = page.url()
    await page.evaluate(() => {
      location.href = 'https://example.com/'
    })
    await page.waitForTimeout(500)
    expect(page.url()).toBe(before)
  })
})
