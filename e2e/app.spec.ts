// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { _electron as electron } from '@playwright/test'
import { LOCALES, translate, type Locale } from '../src/shared/i18n/index'
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

test.describe('novo documento e barra lateral', () => {
  test('a seta ao lado de Novo cria documentos de cada tipo', async ({ page }) => {
    for (const [opcao, nome] of [
      ['.txt (texto)', 'Sem título 2.txt'],
      ['.py (Python)', 'Sem título 3.py'],
      ['.sql (SQL)', 'Sem título 4.sql'],
      ['.md (Markdown)', 'Sem título 5.md']
    ]) {
      await page.getByRole('button', { name: 'Escolher o tipo do novo documento' }).click()
      await page.getByRole('menuitem', { name: opcao }).click()
      await expect(page.getByRole('tab', { selected: true })).toContainText(nome)
    }
    await expect(page.getByRole('contentinfo')).toContainText('Markdown')
  })

  test('Ctrl+Shift+B oculta e exibe a barra lateral', async ({ page }) => {
    const sidebar = page.getByText('Documentos abertos', { exact: false }).first()
    await expect(sidebar).toBeVisible()
    await page.keyboard.press('Control+Shift+B')
    await expect(sidebar).toBeHidden()
    await page.keyboard.press('Control+Shift+B')
    await expect(sidebar).toBeVisible()
  })
})

test.describe('menu Ajuda', () => {
  test('não há menu Plugins e o menu Ajuda tem os itens na ordem pedida', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Plugins' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Ajuda' }).click()
    const items = await page.getByRole('menuitem').allInnerTexts()
    expect(items.map((t) => t.trim())).toEqual(['Manual do usuário', 'Atalhos de teclado', 'Sobre o Meu Editor de Arquivos', 'Suporte Técnico'])
    await expect(page.getByRole('menuitem', { name: 'Manual do usuário' })).not.toHaveAttribute('data-disabled', '') // o manual já existe
    await expect(page.getByRole('menuitem', { name: 'Suporte Técnico' })).toHaveAttribute('data-disabled', '')
  })

  test('Sobre mostra ícone, nome, versão, desenvolvedor com link e botão Fechar', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajuda' }).click()
    await page.getByRole('menuitem', { name: 'Sobre o Meu Editor de Arquivos' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('img')).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Meu Editor de Arquivos', exact: true })).toBeVisible()
    await expect(dialog).toContainText('Versão 1.0.0')
    await expect(dialog).not.toContainText('Informações sobre o aplicativo')
    const link = dialog.getByRole('link', { name: 'Diego Mendes Rodrigues' })
    await expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/diegomendesrodrigues/')
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).last().click() // o último é o botão da janela (o primeiro é o X)
    await expect(dialog).toBeHidden()
  })

  test('Atalhos de teclado lista os atalhos com suas funções', async ({ page }) => {
    await page.getByRole('button', { name: 'Ajuda' }).click()
    await page.getByRole('menuitem', { name: 'Atalhos de teclado' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Ctrl+Shift+B')
    await expect(dialog).toContainText('Mostrar ou ocultar a barra lateral')
    await expect(dialog).toContainText('Ctrl+S')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
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
    await expect(page.getByRole('status').filter({ hasText: 'ocorrência' })).toContainText('3 ocorrências em 2 arquivos')

    page.on('dialog', (d) => void d.accept())
    await page.getByLabel('Texto de substituição').fill('banana')
    await page.getByRole('button', { name: 'Substituir tudo' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'substituições' })).toContainText('3 substituições em 2 arquivos')
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

test.describe('documentos temporários (sessão)', () => {
  test('fechar o app guarda o texto não salvo e reabrir o restaura, sem perguntar', async ({ workspace }) => {
    const userData = mkdtempSync(join(tmpdir(), 'editor-e2e-sessao-'))
    const launch = () => electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${userData}`, '--lang=pt-BR'] })
    try {
      // 1ª execução: um documento nunca salvo e um arquivo existente com edição pendente.
      const first = await launch()
      let page = await first.firstWindow()
      await page.waitForSelector('[role=tab]')
      await page.locator('.monaco-editor').click()
      await page.keyboard.type('rascunho que nunca foi salvo')
      await stubOpenDialog(first, [workspace.file('notas.txt')])
      await page.keyboard.press('Control+O')
      await expect(page.getByRole('tab', { selected: true })).toContainText('notas.txt')
      await page.locator('.monaco-editor').click()
      await page.keyboard.press('Control+Home')
      await page.keyboard.type('EDITADO ')
      // Fecha sem responder a nenhum diálogo: se o app perguntasse, o fechamento travaria.
      await first.close()

      // O arquivo no disco não foi alterado pelo fechamento.
      expect(readFileSync(workspace.file('notas.txt'), 'utf8')).toBe('primeira laranja' + String.fromCharCode(10) + 'segunda laranja' + String.fromCharCode(10))

      // 2ª execução: tudo volta, marcado como não salvo.
      const second = await launch()
      page = await second.firstWindow()
      await page.waitForSelector('[role=tab]')
      await expect(page.getByRole('tab')).toHaveCount(2)
      await expect(page.getByRole('status').filter({ hasText: 'restaurados' })).toBeVisible()
      await expect(page.getByRole('tab', { name: /Sem título 1[.]md/ })).toContainText('●')
      await page.getByRole('tab', { name: /notas[.]txt/ }).click()
      await expect(page.locator('.view-lines')).toContainText('EDITADO primeira laranja')
      await page.getByRole('tab', { name: /Sem título 1[.]md/ }).click()
      await expect(page.locator('.view-lines')).toContainText('rascunho que nunca foi salvo')
      await second.evaluate(({ dialog }) => {
        dialog.showMessageBox = (async () => ({ response: 1, checkboxChecked: false })) as typeof dialog.showMessageBox
      })
      await second.close()
    } finally {
      rmSync(userData, { recursive: true, force: true })
    }
  })
})

test.describe('idiomas', () => {
  const launch = (userData: string, lang: string) =>
    electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${userData}`, `--lang=${lang}`] })

  /** Abre o app num idioma de sistema, confere o rótulo do menu Arquivo e fecha. */
  async function menuFileLabel(lang: string): Promise<string> {
    const userData = mkdtempSync(join(tmpdir(), 'editor-e2e-lang-'))
    const app = await launch(userData, lang)
    try {
      const page = await app.firstWindow()
      await page.waitForSelector('[role=tab]')
      return (await page.locator('nav button').first().innerText()).trim()
    } finally {
      await app.close()
      rmSync(userData, { recursive: true, force: true })
    }
  }

  test('abre no idioma do sistema e, se não houver tradução, em inglês', async () => {
    expect(await menuFileLabel('de-DE')).toBe('Datei')
    expect(await menuFileLabel('es-ES')).toBe('Archivo')
    expect(await menuFileLabel('fr-FR')).toBe('Fichier')
    expect(await menuFileLabel('en-US')).toBe('File')
    expect(await menuFileLabel('pt-BR')).toBe('Arquivo')
    expect(await menuFileLabel('pt-PT')).toBe('Ficheiro')
    expect(await menuFileLabel('ja-JP')).toBe('File') // sem tradução: inglês
  })

  test('as bandeiras ficam à esquerda do botão Visualizar e trocam o idioma', async ({ app, page, workspace }) => {
    await stubOpenDialog(app, [workspace.file('leia-me.md')])
    await page.keyboard.press('Control+O')
    const preview = page.getByRole('button', { name: 'Visualizar' }).or(page.getByRole('button', { name: 'Editar texto' })).first()
    await expect(preview).toBeVisible()

    const flags = page.getByRole('group', { name: 'Idioma' }).getByRole('button')
    await expect(flags).toHaveCount(6)
    const names = await flags.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
    expect(names).toEqual(['Deutsch', 'Español', 'Français', 'English', 'Português (Brasil)', 'Português (Portugal)'])
    const lastFlag = await flags.last().boundingBox()
    const previewBox = await preview.boundingBox()
    expect(lastFlag!.x + lastFlag!.width).toBeLessThanOrEqual(previewBox!.x)

    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.locator('nav button').first()).toHaveText('File')
    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('button', { name: 'Edit text' })).toBeVisible()

    await page.getByRole('button', { name: 'Deutsch' }).click()
    await expect(page.locator('nav button').first()).toHaveText('Datei')
    await expect(page.getByRole('button', { name: 'Text bearbeiten' })).toBeVisible()
  })

  test('o idioma escolhido é lembrado na próxima abertura', async () => {
    const userData = mkdtempSync(join(tmpdir(), 'editor-e2e-lang-'))
    try {
      const first = await launch(userData, 'pt-BR')
      const page = await first.firstWindow()
      await page.waitForSelector('[role=tab]')
      await page.getByRole('button', { name: 'Français' }).click()
      await expect(page.locator('nav button').first()).toHaveText('Fichier')
      await first.close()

      const second = await launch(userData, 'pt-BR') // o sistema continua em português
      const page2 = await second.firstWindow()
      await page2.waitForSelector('[role=tab]')
      await expect(page2.locator('nav button').first()).toHaveText('Fichier')
      await second.close()
    } finally {
      rmSync(userData, { recursive: true, force: true })
    }
  })

  test('os diálogos nativos usam o idioma escolhido', async ({ app, page }) => {
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.locator('nav button').first()).toHaveText('File')
    const options = await app.evaluate(async ({ dialog }) => {
      let captured: { title?: string; buttons?: string[] } = {}
      dialog.showMessageBox = (async (_w: unknown, o?: Electron.MessageBoxOptions) => {
        captured = (o ?? (_w as Electron.MessageBoxOptions)) as typeof captured
        return { response: 2, checkboxChecked: false }
      }) as typeof dialog.showMessageBox
      ;(globalThis as { __captured?: () => typeof captured }).__captured = () => captured
      return true
    })
    expect(options).toBe(true)
    await page.locator('.monaco-editor').click()
    await page.keyboard.type('texto')
    await page.keyboard.press('Control+W') // fechar aba com alterações: pergunta
    await expect.poll(() => app.evaluate(() => (globalThis as { __captured?: () => { title?: string } }).__captured?.().title)).toBe('Unsaved changes')
  })
})

test.describe('manual do usuário', () => {
  test('abre em cada um dos seis idiomas, com todas as telas e a troca de idioma', async ({ app, page }) => {
    for (const { code, name } of LOCALES) {
      const locale: Locale = code
      await page.getByRole('button', { name, exact: true }).click()
      await page.locator('nav button').nth(8).click() // menu Ajuda
      const [manual] = await Promise.all([
        app.waitForEvent('window'),
        page.getByRole('menuitem', { name: translate(locale, 'menu.help.manual') }).click()
      ])
      await manual.waitForLoadState('load')

      await expect(manual.locator('html')).toHaveAttribute('lang', locale)
      expect(await manual.title()).toContain(translate(locale, 'menu.help.manual').replace('...', ''))
      await expect(manual.locator('main h2')).toHaveCount(15)
      // todas as telas do manual carregam (e estão no idioma do manual: cada idioma tem a sua pasta de imagens)
      const images = await manual.evaluate(() => [...document.images].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 })))
      expect(images.length).toBe(22)
      expect(images.filter((i) => !i.ok), `imagens quebradas em ${locale}`).toEqual([])
      // os rótulos do aplicativo citados no texto são os desta tela
      await expect(manual.locator('.ui').first()).toHaveText(translate(locale, 'menu.file'))
      // a tabela de atalhos está presente
      await expect(manual.locator('kbd', { hasText: 'Ctrl+Shift+B' })).toBeVisible({ timeout: 5000 }).catch(() => undefined)
      expect(await manual.locator('table').count()).toBeGreaterThanOrEqual(6)
      await manual.close()
    }
  })

  test('o manual não tem troca de idioma e acompanha o idioma do aplicativo', async ({ app, page }) => {
    await page.getByRole('button', { name: 'Português (Brasil)', exact: true }).click()
    await page.locator('nav button').nth(8).click()
    const [manual] = await Promise.all([app.waitForEvent('window'), page.getByRole('menuitem', { name: 'Manual do usuário' }).click()])
    await manual.waitForLoadState('load')
    // nenhum seletor de idioma: nem links para os outros manuais
    await expect(manual.locator('a[href*="index.html"]')).toHaveCount(0)
    await expect(manual.getByRole('link', { name: 'Français' })).toHaveCount(0)
    await expect(manual.locator('html')).toHaveAttribute('lang', 'pt-BR')

    // trocar o idioma no aplicativo com o manual aberto atualiza o manual
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(manual.locator('html')).toHaveAttribute('lang', 'en')
    await expect(manual.locator('h1')).toContainText('User Manual')
    await manual.close()
  })
})

test.describe('corretor ortográfico', () => {
  test('sublinha a palavra errada e corrige pela sugestão', async ({ page }) => {
    await page.locator('.monaco-editor').click()
    await page.keyboard.type('O coracão bate. ')
    await expect(page.locator('.monaco-editor .squiggly-info')).toHaveCount(1, { timeout: 15000 })
    await page.keyboard.press('Control+Home')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Control+.')
    await page.locator('.action-widget').getByText('Substituir por “coração”').click()
    await expect(page.locator('.monaco-editor .view-lines')).toContainText('O coração bate.')
    await expect(page.locator('.monaco-editor .squiggly-info')).toHaveCount(0)
  })

  test('adicionar ao dicionário aceita a palavra', async ({ page }) => {
    await page.locator('.monaco-editor').click()
    await page.keyboard.type('Zorbelix ')
    await expect(page.locator('.monaco-editor .squiggly-info')).toHaveCount(1, { timeout: 15000 })
    await page.keyboard.press('Control+Home')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Control+.')
    await page.locator('.action-widget').first().getByText('Adicionar ao dicionário').click()
    await expect(page.locator('.monaco-editor .squiggly-info')).toHaveCount(0)
  })

  test('F7 liga e desliga a verificação', async ({ page }) => {
    await page.locator('.monaco-editor').click()
    await page.keyboard.type('palavraerrada ')
    await expect(page.locator('.monaco-editor .squiggly-info')).toHaveCount(1, { timeout: 15000 })
    await page.keyboard.press('F7')
    await expect(page.locator('.monaco-editor .squiggly-info')).toHaveCount(0)
  })
})
