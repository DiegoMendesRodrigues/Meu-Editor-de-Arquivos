// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { expect, stubOpenDialog, stubSaveDialog, test } from './fixtures'

let server: Server
let base = ''

test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('X-Origem', 'servidor-real')
    res.end(JSON.stringify({ produto: 'caneta', caminho: req.url }))
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(() => {
  server.close()
})

test.describe('Cliente de API: servidor mock', () => {
  test('salva a resposta como exemplo e serve o exemplo pelo mock da coleção', async ({ app, page, workspace }) => {
    const colDir = join(workspace.dir, 'minha-colecao')
    mkdirSync(colDir)
    writeFileSync(
      join(colDir, 'collection.apicol'),
      JSON.stringify({ $schema: 'meu-editor/api-collection@1', id: 'c1', name: 'Minha coleção', auth: { type: 'none' }, variables: [], order: [] })
    )
    await stubOpenDialog(app, [workspace.dir])
    await page.getByRole('button', { name: 'Abrir pasta' }).click()

    // Envia a requisição ao servidor real e salva a requisição na coleção.
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await view.getByLabel('URL da requisição').fill(`${base}/produtos/42`)
    await page.getByTestId('api-send').click()
    await expect(page.getByTestId('api-status')).toContainText('200')

    const reqFile = join(colDir, 'produto.apireq')
    await stubSaveDialog(app, reqFile)
    await page.keyboard.press('Control+S')
    await expect.poll(() => existsSync(reqFile)).toBe(true)

    // Salvar como exemplo: grava o .apiresp em .respostas/<requisição>/ e lista na aba Corpo.
    await page.getByTestId('api-save-example').click()
    const exDir = join(colDir, '.respostas', 'produto')
    await expect.poll(() => (existsSync(exDir) ? readdirSync(exDir).length : 0)).toBe(1)
    expect(readdirSync(exDir)[0]).toMatch(/^\d{4}-\d{2}-\d{2}_\d{6}_200\.apiresp$/)
    await page.getByTestId('api-request-panel').getByRole('tab', { name: 'Corpo' }).click()
    await expect(view.getByTestId('api-examples')).toContainText('Exemplos: 1')

    // Regrava a requisição com request.examples.
    await page.keyboard.press('Control+S')
    await expect.poll(() => readFileSync(reqFile, 'utf8')).toContain('.respostas/produto/')

    // Mock da coleção pelo botão direito.
    const collection = page.getByTestId('api-collection')
    await collection.getByRole('button', { name: /Minha coleção/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Iniciar mock…' }).click()
    const dialog = page.getByTestId('mock-dialog')
    await expect(dialog.getByTestId('mock-routes').locator('tbody tr')).toHaveCount(1)
    await dialog.getByLabel('Porta').fill('0')
    await dialog.getByTestId('mock-start').click()
    const url = (await dialog.getByTestId('mock-url').textContent())!.trim()
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)

    // Chamada por fora: o corpo é o do exemplo (o mock não depende do servidor real).
    server.close()
    const res = await fetch(`${url}/produtos/42`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ produto: 'caneta', caminho: '/produtos/42' })
    const miss = await fetch(`${url}/outra`)
    expect(miss.status).toBe(404)

    // O registro mostra as chamadas.
    await expect(dialog.getByTestId('mock-log')).toContainText('/produtos/42')
    await expect(dialog.getByTestId('mock-log')).toContainText('/outra')
  })
})
