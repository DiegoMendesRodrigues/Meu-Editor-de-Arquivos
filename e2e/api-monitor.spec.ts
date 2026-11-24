// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { expect, stubOpenDialog, test } from './fixtures'

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
})
