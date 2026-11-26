// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { translate } from '../src/shared/i18n/index'
import { expect, stubOpenDialog, test } from './fixtures'

const pt = (key: Parameters<typeof translate>[1]): string => translate('pt-BR', key)

/** Sobe a API de teste em memória (a mesma do servidor do projeto) e cria uma conta nela. */
async function signInToTestApi(page: import('@playwright/test').Page): Promise<{ close(): Promise<void> }> {
  const { buildApp } = await import('../server/src/app')
  const { createMemoryStore } = await import('../server/src/db/memory')
  const api = buildApp({ store: createMemoryStore(), mailer: { async sendPasswordReset() {} } })
  const address = await api.listen({ port: 0, host: '127.0.0.1' })
  await page.getByRole('button', { name: pt('menu.account'), exact: true }).click()
  await page.getByRole('menuitem', { name: pt('menu.account.signIn') }).click()
  await page.getByLabel(pt('account.serverUrl'), { exact: true }).fill(address.replace('127.0.0.1', 'localhost'))
  await page.getByRole('dialog').getByRole('button', { name: pt('account.submit.server') }).click()
  // O aplicativo não cria contas (isso é feito no site): a conta de teste é criada direto na API.
  await fetch(`${address}/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ana@exemplo.com', name: 'Ana', password: 'uma-senha-forte-123' })
  })
  await page.getByLabel(pt('account.email'), { exact: true }).fill('ana@exemplo.com')
  await page.getByLabel(pt('account.password'), { exact: true }).fill('uma-senha-forte-123')
  await page.getByRole('dialog').getByRole('button', { name: pt('account.submit.login') }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  return { close: () => api.close() }
}

let server: Server
let base = ''
let status = 200

test.beforeAll(async () => {
  server = createServer((_req, res) => {
    res.statusCode = status
    res.end('{}')
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(() => {
  server.close()
})

test.describe('Cliente de API: monitores', () => {
  test('cria um monitor, executa agora e mostra ok e depois falha', async ({ app, page, workspace }) => {
    const colDir = join(workspace.dir, 'monitorada')
    mkdirSync(colDir)
    writeFileSync(join(colDir, 'collection.apicol'), JSON.stringify({ $schema: 'meu-editor/api-collection@1', id: 'c1', name: 'Monitorada', auth: { type: 'none' }, variables: [], order: [] }))
    writeFileSync(
      join(colDir, 'saude.apireq'),
      JSON.stringify({ $schema: 'meu-editor/api-request@1', id: 'r1', name: 'Saúde', method: 'GET', url: `${base}/saude`, tests: [{ target: 'status', op: 'eq', expected: 200 }] })
    )
    await stubOpenDialog(app, [workspace.dir])
    await page.getByRole('button', { name: 'Abrir pasta' }).click()
    await page.keyboard.press('Control+Shift+A')

    const collection = page.getByTestId('api-collection')
    await collection.getByRole('button', { name: /Monitorada/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Monitorar…' }).click()
    const dialog = page.getByTestId('monitor-dialog')
    await expect(dialog).toContainText('Os monitores só rodam com o aplicativo aberto.')
    await dialog.getByRole('button', { name: 'Salvar monitor' }).click()

    const item = dialog.getByTestId('monitor-item')
    await expect(item).toHaveCount(1)
    await item.getByRole('button', { name: /Executar agora/ }).click()
    await expect(dialog.getByTestId('monitor-run')).toHaveCount(1)
    await expect(item.getByTestId('monitor-status')).toContainText('Ok')

    status = 500
    await item.getByRole('button', { name: /Executar agora/ }).click()
    await expect(dialog.getByTestId('monitor-run')).toHaveCount(2)
    await expect(item.getByTestId('monitor-status')).toContainText('Falha')
    await expect(dialog.getByTestId('monitor-run').first()).toContainText('Falha')
  })

  test('monitora uma coleção da nuvem lida pelo Main', async ({ page }) => {
    const cloudApi = await signInToTestApi(page)
    try {
      status = 200
      await page.evaluate(
        async ({ url }) => {
          const w = window as unknown as { api: { cloudSave(r: object): Promise<unknown> } }
          const save = (path: string, content: unknown): Promise<unknown> =>
            w.api.cloudSave({ path, content: JSON.stringify(content), encoding: 'UTF-8', baseVersion: null, force: false })
          await save('nuvem/collection.apicol', { $schema: 'meu-editor/api-collection@1', id: 'c2', name: 'Na nuvem', auth: { type: 'none' }, variables: [], order: [] })
          await save('nuvem/saude.apireq', { $schema: 'meu-editor/api-request@1', id: 'r2', name: 'Saúde', method: 'GET', url: `${url}/saude`, tests: [{ target: 'status', op: 'eq', expected: 200 }] })
        },
        { url: base }
      )
      await page.getByRole('button', { name: pt('sidebar.refresh') }).click()
      await page.keyboard.press('Control+Shift+A')
      const collection = page.getByTestId('api-collection').filter({ hasText: 'Na nuvem' })
      await collection.getByRole('button', { name: /Na nuvem/ }).click({ button: 'right' })
      await page.getByRole('menuitem', { name: 'Monitorar…' }).click()
      const dialog = page.getByTestId('monitor-dialog')
      await dialog.getByRole('button', { name: 'Salvar monitor' }).click()

      const item = dialog.getByTestId('monitor-item')
      await expect(item).toHaveCount(1)
      await item.getByRole('button', { name: /Executar agora/ }).click()
      await expect(dialog.getByTestId('monitor-run')).toHaveCount(1)
      await expect(item.getByTestId('monitor-status')).toContainText('Ok')
    } finally {
      await cloudApi.close()
    }
  })
})
