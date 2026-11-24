// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, stubOpenDialog, test } from './fixtures'

let server: Server
let base = ''
let hits = 0
let lastHeader: string | undefined

test.beforeAll(async () => {
  server = createServer((req, res) => {
    hits++
    lastHeader = req.headers['x-assinatura'] as string | undefined
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ id: 7, caminho: req.url }))
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(() => {
  server.close()
})

test.describe('Cliente de API: scripts em sandbox', () => {
  test('o script "antes" põe um cabeçalho; o "depois" aprova um teste e escreve no console', async ({ page }) => {
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await view.getByLabel('URL da requisição').fill(`${base}/itens`)
    await view.getByRole('tab', { name: /^Testes/ }).first().click()

    // O Monaco não fecha aspas nem colchetes sozinho nestes editores.
    await page.getByTestId('api-script-pre').locator('.monaco-editor').click()
    await page.keyboard.type("req.headers['X-Assinatura'] = crypto.sha256(req.url)")
    await page.getByTestId('api-script-post').locator('.monaco-editor').click()
    await page.keyboard.type("pm.test('status 200', function () { pm.response.to.have.status(200) }); console.log('olá do script')")
    // O que o próprio usuário escreve já nasce confiado (registro com atraso de 500 ms).
    await page.waitForTimeout(1200)
    await expect(page.getByTestId('api-script-banner')).toHaveCount(0)

    await page.getByTestId('api-send').click()
    await expect(page.getByTestId('api-status')).toContainText('200')
    expect(lastHeader).toMatch(/^[0-9a-f]{64}$/)

    const response = page.getByTestId('api-response')
    await response.getByRole('tab', { name: /^Testes/ }).click()
    await expect(response.getByTestId('api-script-test')).toHaveCount(1)
    await expect(response.locator('[data-testid=api-script-test][data-passed=true]')).toContainText('status 200')
    await expect(response.getByTestId('api-script-console')).toContainText('olá do script')
  })

  test('scripts de um .apireq que veio de fora só rodam depois de confiar', async ({ app, page, workspace }) => {
    const file = workspace.file('externo.apireq')
    writeFileSync(
      file,
      JSON.stringify({
        $schema: 'meu-editor/api-request@1',
        id: 'r-externo',
        name: 'Externo',
        method: 'GET',
        url: `${base}/externo`,
        scripts: {
          pre: "console.log('pre rodou')",
          post: "pm.test('veio 200', function () { pm.response.to.have.status(200) })"
        }
      })
    )
    await stubOpenDialog(app, [file])
    await page.keyboard.press('Control+O')
    const view = page.getByTestId('api-request')
    await expect(view).toBeVisible()

    // A faixa aparece e o envio é bloqueado: nada chega ao servidor.
    const banner = page.getByTestId('api-script-banner')
    await expect(banner).toContainText('ainda não foram confiados')
    const before = hits
    await page.getByTestId('api-send').click()
    await expect(page.getByTestId('api-error')).toContainText('ainda não foram confiados')
    expect(hits).toBe(before)

    // "Ver scripts" abre a aba Testes com os dois editores.
    await banner.getByRole('button', { name: 'Ver scripts' }).click()
    await expect(page.getByTestId('api-script-pre')).toBeVisible()
    await expect(page.getByTestId('api-script-pre')).toContainText("console.log('pre rodou')")

    // Confiar nesta requisição (fora de coleção) libera o envio.
    await banner.getByRole('button', { name: 'Confiar nesta requisição' }).click()
    await expect(banner).toHaveCount(0)
    await page.getByTestId('api-send').click()
    await expect(page.getByTestId('api-status')).toContainText('200')
    expect(hits).toBe(before + 1)
    const response = page.getByTestId('api-response')
    await response.getByRole('tab', { name: /^Testes/ }).click()
    await expect(response.locator('[data-testid=api-script-test][data-passed=true]')).toContainText('veio 200')
    await expect(response.getByTestId('api-script-console')).toContainText('pre rodou')
  })
})
