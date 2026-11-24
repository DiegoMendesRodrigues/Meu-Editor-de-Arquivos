// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { writeFileSync } from 'node:fs'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { expect, stubOpenDialog, test } from './fixtures'

const PROTO = `
syntax = "proto3";
package teste.exemplo;
message Pedido { string texto = 1; int64 numero = 2; }
message Resposta { string texto = 1; int64 contagem = 2; }
service Eco {
  rpc Unario(Pedido) returns (Resposta);
  rpc Servidor(Pedido) returns (stream Resposta);
}
`

let server: grpc.Server
let port = 0

test.beforeAll(async () => {
  // O .proto do servidor fica numa pasta temporária própria; o do teste vai para a workspace.
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = mkdtempSync(join(tmpdir(), 'grpc-e2e-srv-'))
  const file = join(dir, 'eco.proto')
  writeFileSync(file, PROTO)
  const def = protoLoader.loadSync(file, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true })
  server = new grpc.Server()
  server.addService(def['teste.exemplo.Eco'] as grpc.ServiceDefinition, {
    Unario: (call: grpc.ServerUnaryCall<{ texto: string }, unknown>, cb: grpc.sendUnaryData<unknown>) => cb(null, { texto: `eco ${call.request.texto}`, contagem: '1' }),
    Servidor: (call: grpc.ServerWritableStream<{ texto: string }, unknown>) => {
      for (let i = 1; i <= 2; i++) call.write({ texto: `tique ${i}`, contagem: String(i) })
      call.end()
    }
  })
  port = await new Promise<number>((ok, fail) => server.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (e, p) => (e ? fail(e) : ok(p))))
})

test.afterAll(() => server.forceShutdown())

test.describe('Cliente de API: gRPC', () => {
  test('carrega os serviços pelo .proto e invoca uma chamada unária e outra de streaming', async ({ app, page, workspace }) => {
    writeFileSync(workspace.file('eco.proto'), PROTO)
    await page.getByRole('button', { name: 'Ferramentas' }).click()
    await page.getByRole('menuitem', { name: /gRPC \(nova chamada\)/ }).click()
    await expect(page.getByTestId('api-grpc-view')).toBeVisible()
    await expect(page.getByRole('tab', { selected: true }).first()).toContainText('.apigrpc')

    await page.getByTestId('grpc-address').fill(`127.0.0.1:${port}`)
    await page.getByTestId('grpc-source').selectOption('proto')
    await stubOpenDialog(app, [workspace.file('eco.proto')])
    await page.getByTestId('grpc-pick-proto').click()
    await expect(page.getByTestId('grpc-proto-files')).toContainText('eco.proto')

    // Os serviços carregam sozinhos com .proto; o primeiro método (unário) vem selecionado.
    await expect(page.getByTestId('grpc-service')).toHaveValue('teste.exemplo.Eco')
    await expect(page.getByTestId('grpc-method')).toHaveValue('Unario')
    await expect(page.getByTestId('grpc-kind')).toHaveAttribute('data-kind', 'unary')

    await page.getByTestId('grpc-invoke').click()
    const log = page.getByTestId('grpc-log')
    await expect(log.locator('[data-type=message][data-direction=in]')).toContainText('eco')
    await expect(log.locator('[data-type=status]')).toContainText('OK (0)')
    await expect(page.getByTestId('grpc-status')).toHaveAttribute('data-state', 'idle')

    // Streaming do servidor: duas mensagens e o status.
    await page.getByTestId('grpc-method').selectOption('Servidor')
    await expect(page.getByTestId('grpc-kind')).toHaveAttribute('data-kind', 'server')
    await page.getByTestId('grpc-clear').click()
    await page.getByTestId('grpc-invoke').click()
    await expect(log.locator('[data-type=message][data-direction=in]')).toHaveCount(2)
    await expect(log.locator('[data-type=status]')).toContainText('OK (0)')

    // A seleção fica gravada no JSON do documento.
    await page.getByRole('button', { name: 'Editar texto' }).click()
    await expect(page.locator('.monaco-editor').first()).toContainText('teste.exemplo.Eco')
  })
})
