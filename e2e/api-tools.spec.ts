// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import type { ElectronApplication, Page } from '@playwright/test'
import { expect, stubOpenDialog, stubSaveDialog, test } from './fixtures'

interface Seen {
  method: string
  url: string
  authorization?: string
  body: string
}

const TOKEN = 'tok-fake-9f3a1c'
let server: Server
let base = ''
let seen: Seen[] = []

/** Schema GraphQL mínimo: um tipo de consulta e um tipo próprio. */
const introspection = {
  data: {
    __schema: {
      queryType: { name: 'Query' },
      mutationType: null,
      subscriptionType: null,
      types: [
        {
          kind: 'OBJECT',
          name: 'Query',
          description: '',
          fields: [{ name: 'pessoa', description: '', args: [], type: { kind: 'OBJECT', name: 'Pessoa', ofType: null }, isDeprecated: false }],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null
        },
        {
          kind: 'OBJECT',
          name: 'Pessoa',
          description: 'Uma pessoa fictícia',
          fields: [{ name: 'nome', description: '', args: [], type: { kind: 'SCALAR', name: 'String', ofType: null }, isDeprecated: false }],
          inputFields: null,
          interfaces: [],
          enumValues: null,
          possibleTypes: null
        },
        { kind: 'SCALAR', name: 'String', description: '', fields: null, inputFields: null, interfaces: null, enumValues: null, possibleTypes: null }
      ],
      directives: []
    }
  }
}

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((ok) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')))
  })

test.beforeAll(async () => {
  server = createServer((req, res) => {
    void readBody(req).then((body) => {
      const url = req.url ?? ''
      seen.push({ method: req.method ?? '', url, authorization: req.headers.authorization, body })
      res.setHeader('Content-Type', 'application/json')
      if (url === '/graphql') return res.end(JSON.stringify(introspection))
      if (url === '/token') return res.end(JSON.stringify({ access_token: TOKEN, token_type: 'Bearer', expires_in: 3600 }))
      res.end(JSON.stringify({ ok: true, caminho: url }))
    })
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(() => {
  server.close()
})

test.beforeEach(() => {
  seen = []
})

async function openImport(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ferramentas' }).click()
  await page.getByRole('menuitem', { name: 'Testar requisições e APIs' }).click()
  await page.getByRole('menuitem', { name: /Importar requisições/ }).click()
}

/** Abre a pasta indicada no explorador. */
async function openFolder(app: ElectronApplication, page: Page, dir: string): Promise<void> {
  await stubOpenDialog(app, [dir])
  await page.getByRole('button', { name: 'Abrir pasta' }).click()
}

/** Postman v2.1 mínimo, com duas requisições e uma variável de URL vinda do CSV. */
const postman = (): string =>
  JSON.stringify({
    info: { name: 'Coleção de teste', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [
      { name: 'Buscar usuário', request: { method: 'GET', url: `${base}/usuario/{{id}}` } },
      { name: 'Buscar pedido', request: { method: 'GET', url: `${base}/pedido/{{id}}` } }
    ]
  })

test.describe('Cliente de API: ferramentas', () => {
  test('importa um curl e abre em aba com método e URL', async ({ page }) => {
    await openImport(page)
    const curl = `curl -X POST '${base}/clientes' -H 'Content-Type: application/json' -d '{"nome":"Ana"}'`
    await page.getByLabel(/Cole o texto/).fill(curl)
    await page.getByRole('button', { name: 'Analisar' }).click()
    await expect(page.getByTestId('import-preview')).toContainText('POST')
    await page.getByRole('button', { name: 'Abrir em abas' }).click()

    const view = page.getByTestId('api-request')
    await expect(view).toBeVisible()
    await expect(view.getByLabel('URL da requisição')).toHaveValue(`${base}/clientes`)
    await expect(view.getByLabel('Método')).toHaveValue('POST')
    await view.getByRole('tab', { name: /^Cabeçalhos/ }).click()
    await expect(view.getByLabel('Chave 1')).toHaveValue('Content-Type')
  })

  test('importa como coleção, executa com CSV e exporta o JUnit', async ({ app, page, workspace }) => {
    const colDir = join(workspace.dir, 'minha-colecao')
    mkdirSync(colDir)
    writeFileSync(workspace.file('ids.csv'), 'id\n11\n22\n')
    await openFolder(app, page, workspace.dir)

    // Importar como coleção: a pasta de destino vem do diálogo de pasta.
    await openImport(page)
    await page.getByLabel(/Cole o texto/).fill(postman())
    await page.getByRole('button', { name: 'Analisar' }).click()
    await expect(page.getByTestId('import-preview').locator('li')).toHaveCount(2)
    await stubOpenDialog(app, [colDir])
    await page.getByRole('button', { name: 'Importar como coleção...' }).click()
    await expect(page.getByText(/[0-9]+ arquivos gravados/)).toBeVisible()
    await page.keyboard.press('Escape')

    const files = readdirSync(colDir)
    expect(files).toContain('collection.apicol')
    expect(files.filter((f) => f.endsWith('.apireq')).sort()).toEqual(['Buscar pedido.apireq', 'Buscar usuário.apireq'])
    expect(JSON.parse(readFileSync(join(colDir, 'collection.apicol'), 'utf8'))).toMatchObject({ name: 'Coleção de teste' })

    // A coleção aparece na barra lateral.
    const collection = page.getByTestId('api-collection')
    await expect(collection).toContainText('Coleção de teste')
    await expect(collection).toContainText('Buscar usuário')

    // Executor com o CSV: uma iteração por linha.
    await collection.getByRole('button', { name: /Coleção de teste/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Executar…' }).click()
    await stubOpenDialog(app, [workspace.file('ids.csv')])
    await page.getByRole('button', { name: 'Escolher arquivo…' }).click()
    await expect(page.getByText(/ids\.csv: 2 linhas, 1 colunas/)).toBeVisible()
    await page.getByRole('button', { name: 'Executar', exact: true }).click()

    // Relatório .apirun: 2 linhas x 2 requisições = 4, todas aprovadas.
    await expect(page.getByRole('tab', { selected: true })).toContainText('.apirun')
    const card = (label: string) => page.locator('div.rounded.border', { has: page.getByText(label, { exact: true }) }).first()
    await expect(card('Total')).toContainText('4')
    await expect(card('Aprovadas')).toContainText('4')
    await expect(card('Falhas')).toContainText('0')
    const paths = seen.map((s) => s.url).sort()
    expect(paths).toEqual(['/pedido/11', '/pedido/22', '/usuario/11', '/usuario/22'])

    // JUnit pelo diálogo de salvar trocado.
    const xml = workspace.file('relatorio.xml')
    await stubSaveDialog(app, xml)
    await page.getByRole('button', { name: 'JUnit' }).click()
    await expect.poll(() => existsSync(xml)).toBe(true)
    const text = readFileSync(xml, 'utf8')
    expect(text).toContain('<testsuite')
    expect(text).toContain('Buscar usuário')
  })

  test('gera código curl pelo botão da barra da requisição', async ({ page }) => {
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await view.getByLabel('URL da requisição').fill(`${base}/gerar`)
    await view.getByRole('button', { name: 'Código' }).click()
    await expect(page.getByTestId('codegen-code')).toContainText('curl')
    await expect(page.getByTestId('codegen-code')).toContainText('/gerar')
  })

  test('GraphQL: carrega o schema e o explorador mostra o tipo', async ({ page }) => {
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await view.getByLabel('Método').selectOption('POST')
    await view.getByLabel('URL da requisição').fill(`${base}/graphql`)
    await view.getByRole('tab', { name: /^Corpo/ }).click()
    await view.getByLabel('Tipo do corpo').selectOption('graphql')
    await view.getByRole('button', { name: 'Carregar schema' }).click()
    await expect(view.getByText(/Schema carregado: 3 tipos/)).toBeVisible()
    // O explorador de documentação abre sozinho com o schema.
    const docs = view.getByRole('complementary', { name: 'Documentação' })
    await expect(docs.getByText('Query').first()).toBeVisible()
    // Buscar o tipo próprio e abri-lo mostra a descrição e o campo.
    await docs.getByLabel('Buscar tipos').fill('Pess')
    await docs.getByRole('button', { name: /Pessoa/ }).first().click()
    await expect(docs.getByText('Uma pessoa fictícia')).toBeVisible()
    await expect(docs.getByText('nome').first()).toBeVisible()
    expect(seen.some((s) => s.url === '/graphql' && s.body.includes('__schema'))).toBe(true)
  })

  test('OAuth 2.0 Client Credentials: o servidor recebe o Bearer e o token não vai ao arquivo', async ({ app, page, workspace }) => {
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await view.getByLabel('URL da requisição').fill(`${base}/protegido`)
    await view.getByRole('tab', { name: /^Autorização/ }).click()
    await view.locator('select:has(option[value="oauth2"])').selectOption('oauth2')
    await view.locator('select:has(option[value="clientCredentials"])').selectOption('clientCredentials')
    await view.getByLabel('URL do token').fill(`${base}/token`)
    await view.getByLabel('Client ID').fill('cliente-fake')
    await view.getByLabel('Client secret').fill('segredo-fake')

    await page.getByTestId('api-send').click()
    // Primeiro envio com segredos do cofre para o host: o app pede a confirmação do destino.
    await page.getByRole('button', { name: 'Enviar mesmo assim' }).click()
    await expect(page.getByTestId('api-status')).toContainText('200')
    const protegido = seen.find((s) => s.url === '/protegido')
    expect(protegido?.authorization).toBe(`Bearer ${TOKEN}`)
    expect(seen.some((s) => s.url === '/token')).toBe(true)

    // O token fica no cofre: o .apireq salvo não o contém.
    const file = workspace.file('protegido.apireq')
    await stubSaveDialog(app, file)
    await page.keyboard.press('Control+S')
    await expect(page.locator('[role=tablist]').first().getByRole('tab', { selected: true })).toContainText('protegido.apireq')
    expect(readFileSync(file, 'utf8')).not.toContain(TOKEN)
  })
})
