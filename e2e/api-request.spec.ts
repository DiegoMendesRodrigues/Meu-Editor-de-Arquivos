// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from './fixtures'

let server: Server
let base = ''

test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ id: 7, nome: 'Ana', itens: [1, 2, 3], caminho: req.url }))
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(() => {
  server.close()
})

test.describe('Cliente de API: requisição e resposta', () => {
  test('envia, mostra status, tempo, árvore, testes e salva a resposta', async ({ page }) => {
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await expect(view).toBeVisible()

    await view.getByLabel('URL da requisição').fill(`${base}/itens?pagina=2`)
    // A query da URL aparece na tabela de params.
    await expect(view.getByRole('table', { name: 'Parâmetros da query' }).getByLabel('Chave 1')).toHaveValue('pagina')

    // Duas asserções: o status 200 (passa) e o status 999 (reprova).
    await view.getByRole('tab', { name: /^Testes/ }).first().click()
    await view.getByRole('button', { name: 'Adicionar asserção' }).click()
    await view.getByRole('button', { name: 'Adicionar asserção' }).click()
    await view.getByLabel('Esperado 2').fill('999')

    await page.getByTestId('api-send').click()
    await expect(page.getByTestId('api-status')).toContainText('200')
    await expect(page.getByTestId('api-time')).toHaveText(/\d+(\.\d+)? m?s/)

    // Árvore JSON (padrão para JSON).
    const response = page.getByTestId('api-response')
    await expect(response.getByRole('treeitem').first()).toBeVisible()
    await expect(response.getByText('Ana')).toBeVisible()

    // Testes: um aprovado e um reprovado.
    await response.getByRole('tab', { name: /^Testes/ }).click()
    const results = page.getByTestId('api-test-results').locator('li')
    await expect(results).toHaveCount(2)
    await expect(results.locator('[data-passed=true]').or(page.locator('li[data-passed=true]'))).toHaveCount(1)
    await expect(page.locator('li[data-passed=false]')).toHaveCount(1)

    // Salvar a resposta abre um documento .apiresp só para leitura.
    await page.getByRole('button', { name: 'Salvar resposta (.apiresp)' }).click()
    await expect(page.locator('[role=tablist]').first().getByRole('tab', { selected: true })).toContainText('.apiresp')
    await expect(page.getByTestId('api-saved-response')).toBeVisible()
    await expect(page.getByTestId('api-status')).toContainText('200')
  })

  test('Ctrl+Enter envia a requisição', async ({ page }) => {
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await view.getByLabel('URL da requisição').fill(`${base}/atalho`)
    await view.getByLabel('URL da requisição').press('Control+Enter')
    await expect(page.getByTestId('api-status')).toContainText('200')
  })
})
