// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFileSync } from 'node:fs'
import { expect, stubSaveDialog, test } from './fixtures'

test.describe('Cliente de API: ambientes', () => {
  test('ambiente com segredo: o .apienv salvo não tem o valor e o ambiente aparece no seletor', async ({ app, page, workspace }) => {
    const SEGREDO = 'segredo-ultra-123'

    // Ferramentas → Ambientes abre um ambiente novo no construtor.
    await page.getByRole('button', { name: 'Ferramentas' }).click()
    await page.getByRole('menuitem', { name: 'Testar requisições e APIs' }).click()
    await page.getByRole('menuitem', { name: /Ambientes de API/ }).click()
    await expect(page.getByTestId('api-environment')).toBeVisible()
    await expect(page.getByRole('tab', { selected: true })).toContainText('.apienv')

    await page.getByLabel('Nome', { exact: true }).fill('Homologação')
    await page.getByRole('button', { name: 'Adicionar variável' }).click()
    await page.getByLabel('Nome da variável 1').fill('baseUrl')
    await page.getByLabel('Valor da variável 1').fill('https://api.exemplo.com.br')
    await page.getByRole('button', { name: 'Adicionar variável' }).click()
    await page.getByLabel('Nome da variável 2').fill('token')
    await page.getByLabel('Variável 2 é secreta').check()
    await page.getByLabel('Valor da variável 2').fill(SEGREDO)
    await expect(page.getByTestId('secret-status')).toContainText('definido neste computador')

    await stubSaveDialog(app, workspace.file('homologacao.apienv'))
    await page.keyboard.press('Control+S')
    await expect(page.getByRole('tab', { selected: true })).toContainText('homologacao.apienv')
    await expect(page.getByRole('tab', { selected: true })).not.toContainText('●')

    const text = readFileSync(workspace.file('homologacao.apienv'), 'utf8')
    expect(text).not.toContain(SEGREDO)
    const saved = JSON.parse(text)
    expect(saved).toMatchObject({ $schema: 'meu-editor/api-environment@1', name: 'Homologação', production: false })
    expect(saved.variables).toEqual([
      { key: 'baseUrl', value: 'https://api.exemplo.com.br', secret: false },
      { key: 'token', secret: true }
    ])

    // O ambiente aberto aparece no seletor; escolhê-lo mostra o nome no rodapé da aba de API.
    await page.keyboard.press('Control+Shift+A')
    await expect(page.getByTestId('api-request')).toBeVisible()
    const select = page.getByTestId('api-env-select').first()
    await select.selectOption({ label: 'Homologação' })
    await expect(page.getByTestId('status-api-env')).toContainText('Ambiente: Homologação')
  })

  test('ambiente de produção mostra a faixa vermelha', async ({ page }) => {
    await page.getByRole('button', { name: 'Ferramentas' }).click()
    await page.getByRole('menuitem', { name: 'Testar requisições e APIs' }).click()
    await page.getByRole('menuitem', { name: /Ambientes de API/ }).click()
    await page.getByLabel('Ambiente de produção').check()
    await expect(page.getByTestId('env-production-band')).toBeVisible()
    await expect(page.getByTestId('env-production-band')).toContainText('PRODUÇÃO')
  })

  test('nomes de variável inválidos ou repetidos não vão para o arquivo', async ({ page }) => {
    await page.getByRole('button', { name: 'Ferramentas' }).click()
    await page.getByRole('menuitem', { name: 'Testar requisições e APIs' }).click()
    await page.getByRole('menuitem', { name: /Ambientes de API/ }).click()
    await page.getByRole('button', { name: 'Adicionar variável' }).click()
    await page.getByLabel('Nome da variável 1').fill('1 invalido')
    await expect(page.getByRole('alert').filter({ hasText: 'Nome inválido' })).toBeVisible()
    await expect(page.getByRole('tab', { selected: true })).not.toContainText('●')
    await page.getByLabel('Nome da variável 1').fill('valido')
    await expect(page.getByRole('tab', { selected: true })).toContainText('●')
  })
})
