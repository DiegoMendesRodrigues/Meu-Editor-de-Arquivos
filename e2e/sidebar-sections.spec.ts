// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

/** Ids das áreas da barra lateral, na ordem da tela. */
const order = (page: Page): Promise<string[]> => page.locator('aside section[data-section]').evaluateAll((els) => els.map((el) => el.getAttribute('data-section') ?? ''))
const header = (page: Page, name: string) => page.locator('aside').getByRole('button', { name, exact: true })

test.describe('barra lateral: áreas recolhíveis e reordenáveis', () => {
  test('o triângulo fecha e abre a área, e o estado sobrevive ao recarregar', async ({ page }) => {
    const docs = header(page, 'Documentos abertos')
    await expect(docs).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#sidebar-section-openDocs')).toBeVisible()
    await docs.click()
    await expect(docs).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#sidebar-section-openDocs')).toBeHidden()

    await page.reload()
    await expect(header(page, 'Documentos abertos')).toHaveAttribute('aria-expanded', 'false')
    await header(page, 'Documentos abertos').click()
    await expect(page.locator('#sidebar-section-openDocs')).toBeVisible()
  })

  test('arrastar o nome muda a ordem, e Alt+↑/↓ também; a ordem fica guardada', async ({ page }) => {
    expect(await order(page)).toEqual(['openDocs', 'explorer', 'recent'])

    // Arrasta "Recentes" para cima de "Documentos abertos".
    await header(page, 'Recentes').dragTo(page.locator('section[data-section="openDocs"]'), { targetPosition: { x: 20, y: 2 } })
    expect(await order(page)).toEqual(['recent', 'openDocs', 'explorer'])

    // Pelo teclado: "Recentes" desce uma posição.
    await header(page, 'Recentes').focus()
    await page.keyboard.press('Alt+ArrowDown')
    expect(await order(page)).toEqual(['openDocs', 'recent', 'explorer'])

    await page.reload()
    await expect(header(page, 'Recentes')).toBeVisible()
    expect(await order(page)).toEqual(['openDocs', 'recent', 'explorer'])
  })

  test('o X remove a área, o menu Exibir reflete, marcar de novo a traz de volta e o estado sobrevive ao recarregar', async ({ page }) => {
    const abrirItem = async () => {
      await page.getByRole('button', { name: 'Exibir', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Áreas da barra lateral' }).hover()
      return page.getByRole('menuitem', { name: 'Exibir Documentos Abertos' })
    }
    await page.getByRole('button', { name: 'Remover a área Documentos abertos da barra lateral' }).click({ force: true })
    expect(await order(page)).toEqual(['explorer', 'recent'])

    let item = await abrirItem()
    await expect(item.locator('svg')).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.reload()
    await expect(header(page, 'Recentes')).toBeVisible()
    expect(await order(page)).toEqual(['explorer', 'recent'])

    item = await abrirItem()
    await item.click()
    expect(await order(page)).toEqual(['openDocs', 'explorer', 'recent'])
    item = await abrirItem()
    await expect(item.locator('svg')).toHaveCount(1)
  })
})
