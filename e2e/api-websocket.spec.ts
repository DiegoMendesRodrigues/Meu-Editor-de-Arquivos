// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { AddressInfo } from 'node:net'
import { WebSocketServer } from 'ws'
import { expect, test } from './fixtures'

let echo: WebSocketServer
let gql: WebSocketServer
const gqlSeen: string[] = []

test.beforeAll(async () => {
  echo = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  echo.on('connection', (sock) => sock.on('message', (data, isBinary) => sock.send(data, { binary: isBinary })))

  // Servidor graphql-transport-ws mínimo: ack, e dois `next` para cada subscribe.
  gql = new WebSocketServer({ port: 0, host: '127.0.0.1', handleProtocols: (protocols) => (protocols.has('graphql-transport-ws') ? 'graphql-transport-ws' : false) })
  gql.on('connection', (sock) => {
    sock.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as { type: string; id?: string; payload?: { query?: string } }
      gqlSeen.push(msg.type)
      if (msg.type === 'connection_init') sock.send(JSON.stringify({ type: 'connection_ack' }))
      if (msg.type === 'subscribe') {
        for (const n of [1, 2]) sock.send(JSON.stringify({ id: msg.id, type: 'next', payload: { data: { tick: `tique-${n}` } } }))
      }
    })
  })
  await Promise.all([new Promise((ok) => echo.once('listening', ok)), new Promise((ok) => gql.once('listening', ok))])
})

test.afterAll(() => {
  echo.close()
  gql.close()
})

const port = (s: WebSocketServer): number => (s.address() as AddressInfo).port

test.describe('Cliente de API: WebSocket', () => {
  test('conecta ao eco, envia, vê a mensagem de volta e salva a mensagem', async ({ page }) => {
    await page.getByRole('button', { name: 'Ferramentas' }).click()
    await page.getByRole('menuitem', { name: /WebSocket \(nova conexão\)/ }).click()
    await expect(page.getByTestId('api-ws-view')).toBeVisible()
    await expect(page.getByRole('tab', { selected: true }).first()).toContainText('.apiws')

    await page.getByTestId('ws-url').fill(`ws://127.0.0.1:${port(echo)}`)
    await page.getByTestId('ws-connect').click()
    await expect(page.getByTestId('ws-status')).toHaveAttribute('data-state', 'open')

    await page.getByTestId('ws-message').fill('olá, eco')
    await page.getByTestId('ws-message').press('Control+Enter')
    const log = page.getByTestId('ws-log')
    await expect(log.locator('[data-direction=out]')).toContainText('olá, eco')
    await expect(log.locator('[data-direction=in]')).toContainText('olá, eco')

    // Clicar numa mensagem mostra o conteúdo inteiro.
    await log.locator('[data-direction=in]').click()
    await expect(page.getByTestId('ws-detail')).toContainText('olá, eco')

    // Mensagem salva: aparece na lista e fica no JSON do documento.
    await page.getByTestId('ws-save-name').fill('Saudação')
    await page.getByTestId('ws-save-message').click()
    await expect(page.getByTestId('ws-saved-list')).toContainText('Saudação')
    await page.getByRole('button', { name: 'Enviar a mensagem Saudação' }).click()
    await expect(log.locator('[data-direction=in]')).toHaveCount(2)

    await page.getByTestId('ws-disconnect').click()
    await expect(page.getByTestId('ws-status')).toHaveAttribute('data-state', 'idle')
  })

  test('subscription GraphQL: Assinar recebe os eventos e Parar encerra', async ({ page }) => {
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await view.getByLabel('Método').selectOption('POST')
    await view.getByLabel('URL da requisição').fill(`http://127.0.0.1:${port(gql)}/graphql`)
    await view.getByRole('tab', { name: /^Corpo/ }).click()
    await view.getByLabel('Tipo do corpo').selectOption('graphql')

    await view.getByRole('group', { name: 'Query GraphQL' }).click()
    await page.keyboard.type('subscription OnTick { tick }')
    await expect(page.getByTestId('gql-subscription')).toBeVisible()

    await page.getByTestId('gql-subscribe').click()
    const events = page.getByTestId('gql-events')
    await expect(events.locator('li[data-kind=next]')).toHaveCount(2)
    await expect(events).toContainText('tique-1')
    await expect(page.getByTestId('gql-sub-status')).toHaveAttribute('data-state', 'active')

    await page.getByTestId('gql-unsubscribe').click()
    await expect(page.getByTestId('gql-sub-status')).toHaveAttribute('data-state', 'idle')
    await expect.poll(() => gqlSeen.includes('complete')).toBe(true)
    expect(gqlSeen.slice(0, 2)).toEqual(['connection_init', 'subscribe'])
  })
})
