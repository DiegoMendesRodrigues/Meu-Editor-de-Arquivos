// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Captura as telas do site para as páginas do Assistente de IA e de Testar requisições e APIs, em cada idioma.
 *
 * Abre o aplicativo já compilado (npm run build) com o idioma do sistema trocado. Tudo é local: um Ollama falso,
 * uma API HTTP de exemplo e um servidor WebSocket de eco em 127.0.0.1. As imagens vão para
 * website/assets/img/screens/<idioma>/ (ai-*.png e api-*.png).
 *
 * Uso: npx tsx scripts/capture-site.mts [idioma ...] [--api] [--tools] [--syntax]
 *   (sem idiomas, gera os seis; sem opções, todas as telas; cada opção limita às telas dela)
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as createHttpServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, parse, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { WebSocketServer } from 'ws'
import { translate, type Locale, type MessageKey } from '../src/shared/i18n/index.ts'

const SYSTEM: Record<Locale, string> = { 'pt-BR': 'pt-BR', 'pt-PT': 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }

interface Texts {
  folder: string
  collection: string
  requests: [string, string]
  doc: { name: string; text: string }
  chatQuestion: string
  chatAnswer: string
  testsAnswer: string
  explainAnswer: string
  wsMessage: string
  env: string
}

const CODE = 'def order_total(items):\n    """Soma preço x quantidade dos itens."""\n    return sum(item["price"] * item["qty"] for item in items)\n\n\ndef apply_discount(total, percent):\n    return round(total * (1 - percent / 100), 2)\n'
const TESTS_CODE = '```python\nimport pytest\nfrom orders import order_total, apply_discount\n\n\ndef test_order_total():\n    items = [{"price": 10.0, "qty": 2}, {"price": 5.5, "qty": 1}]\n    assert order_total(items) == 25.5\n\n\ndef test_apply_discount():\n    assert apply_discount(200, 10) == 180.0\n```'

const TEXTS: Record<Locale, Texts> = {
  'pt-BR': {
    folder: 'projeto-loja',
    collection: 'API da loja',
    requests: ['Listar pedidos', 'Buscar cliente'],
    doc: { name: 'reuniao.md', text: '# Reunião de planejamento\n\n## Decisões\n\n- Lançar a versão 2.0 em março.\n- Ana cuida da nova tela de pedidos.\n- Revisar os testes da API antes da entrega.\n\n## Próximos passos\n\n1. Bruno prepara o ambiente de homologação.\n2. Carla escreve a documentação.\n' },
    chatQuestion: 'Liste as decisões e quem é responsável por cada próximo passo.',
    chatAnswer: '**Decisões**\n\n- Lançar a versão 2.0 em março.\n- A nova tela de pedidos fica com a Ana.\n- Os testes da API serão revisados antes da entrega.\n\n**Próximos passos**\n\n1. **Bruno**: preparar o ambiente de homologação.\n2. **Carla**: escrever a documentação.',
    testsAnswer: 'Aqui estão testes com pytest para as duas funções:\n\n' + TESTS_CODE + '\n\nRode com `pytest -q`.',
    explainAnswer: 'A requisição **GET /orders** respondeu **200 OK** em poucos milissegundos.\n\n- O corpo é uma lista com **3 pedidos**; cada um tem `id`, `customer`, `total` e `status`.\n- Dois pedidos estão `paid` e um está `pending`.\n- O cabeçalho `Content-Type` indica JSON.\n\nSugestão: confira se `total` é sempre maior que zero.',
    wsMessage: '{"type": "subscribe", "channel": "pedidos"}',
    env: 'Homologação'
  },
  'pt-PT': {
    folder: 'projeto-loja',
    collection: 'API da loja',
    requests: ['Listar encomendas', 'Obter cliente'],
    doc: { name: 'reuniao.md', text: '# Reunião de planeamento\n\n## Decisões\n\n- Lançar a versão 2.0 em março.\n- A Ana trata do novo ecrã de encomendas.\n- Rever os testes da API antes da entrega.\n\n## Próximos passos\n\n1. O Bruno prepara o ambiente de testes.\n2. A Carla escreve a documentação.\n' },
    chatQuestion: 'Liste as decisões e quem é responsável por cada próximo passo.',
    chatAnswer: '**Decisões**\n\n- Lançar a versão 2.0 em março.\n- O novo ecrã de encomendas fica com a Ana.\n- Os testes da API serão revistos antes da entrega.\n\n**Próximos passos**\n\n1. **Bruno**: preparar o ambiente de testes.\n2. **Carla**: escrever a documentação.',
    testsAnswer: 'Aqui estão testes com pytest para as duas funções:\n\n' + TESTS_CODE + '\n\nExecute com `pytest -q`.',
    explainAnswer: 'O pedido **GET /orders** respondeu **200 OK** em poucos milissegundos.\n\n- O corpo é uma lista com **3 encomendas**; cada uma tem `id`, `customer`, `total` e `status`.\n- Duas encomendas estão `paid` e uma está `pending`.\n- O cabeçalho `Content-Type` indica JSON.\n\nSugestão: confirme que `total` é sempre maior que zero.',
    wsMessage: '{"type": "subscribe", "channel": "encomendas"}',
    env: 'Testes'
  },
  en: {
    folder: 'store-project',
    collection: 'Store API',
    requests: ['List orders', 'Get customer'],
    doc: { name: 'meeting.md', text: '# Planning meeting\n\n## Decisions\n\n- Ship version 2.0 in March.\n- Ana owns the new orders screen.\n- Review the API tests before delivery.\n\n## Next steps\n\n1. Bruno sets up the staging environment.\n2. Carla writes the documentation.\n' },
    chatQuestion: 'List the decisions and who owns each next step.',
    chatAnswer: '**Decisions**\n\n- Ship version 2.0 in March.\n- Ana owns the new orders screen.\n- The API tests will be reviewed before delivery.\n\n**Next steps**\n\n1. **Bruno**: set up the staging environment.\n2. **Carla**: write the documentation.',
    testsAnswer: 'Here are pytest tests for both functions:\n\n' + TESTS_CODE + '\n\nRun them with `pytest -q`.',
    explainAnswer: 'The **GET /orders** request returned **200 OK** in a few milliseconds.\n\n- The body is a list of **3 orders**; each has `id`, `customer`, `total` and `status`.\n- Two orders are `paid` and one is `pending`.\n- The `Content-Type` header says JSON.\n\nTip: check that `total` is always greater than zero.',
    wsMessage: '{"type": "subscribe", "channel": "orders"}',
    env: 'Staging'
  },
  es: {
    folder: 'proyecto-tienda',
    collection: 'API de la tienda',
    requests: ['Listar pedidos', 'Obtener cliente'],
    doc: { name: 'reunion.md', text: '# Reunión de planificación\n\n## Decisiones\n\n- Lanzar la versión 2.0 en marzo.\n- Ana se encarga de la nueva pantalla de pedidos.\n- Revisar las pruebas de la API antes de la entrega.\n\n## Próximos pasos\n\n1. Bruno prepara el entorno de pruebas.\n2. Carla escribe la documentación.\n' },
    chatQuestion: 'Enumera las decisiones y quién se encarga de cada próximo paso.',
    chatAnswer: '**Decisiones**\n\n- Lanzar la versión 2.0 en marzo.\n- Ana se encarga de la nueva pantalla de pedidos.\n- Las pruebas de la API se revisarán antes de la entrega.\n\n**Próximos pasos**\n\n1. **Bruno**: preparar el entorno de pruebas.\n2. **Carla**: escribir la documentación.',
    testsAnswer: 'Aquí tienes pruebas con pytest para las dos funciones:\n\n' + TESTS_CODE + '\n\nEjecútalas con `pytest -q`.',
    explainAnswer: 'La solicitud **GET /orders** respondió **200 OK** en pocos milisegundos.\n\n- El cuerpo es una lista de **3 pedidos**; cada uno tiene `id`, `customer`, `total` y `status`.\n- Dos pedidos están `paid` y uno `pending`.\n- La cabecera `Content-Type` indica JSON.\n\nSugerencia: comprueba que `total` sea siempre mayor que cero.',
    wsMessage: '{"type": "subscribe", "channel": "pedidos"}',
    env: 'Pruebas'
  },
  fr: {
    folder: 'projet-boutique',
    collection: 'API de la boutique',
    requests: ['Lister les commandes', 'Obtenir un client'],
    doc: { name: 'reunion.md', text: '# Réunion de planification\n\n## Décisions\n\n- Sortir la version 2.0 en mars.\n- Ana s’occupe du nouvel écran des commandes.\n- Revoir les tests de l’API avant la livraison.\n\n## Prochaines étapes\n\n1. Bruno prépare l’environnement de recette.\n2. Carla rédige la documentation.\n' },
    chatQuestion: 'Liste les décisions et qui est responsable de chaque prochaine étape.',
    chatAnswer: '**Décisions**\n\n- Sortir la version 2.0 en mars.\n- Ana s’occupe du nouvel écran des commandes.\n- Les tests de l’API seront revus avant la livraison.\n\n**Prochaines étapes**\n\n1. **Bruno** : préparer l’environnement de recette.\n2. **Carla** : rédiger la documentation.',
    testsAnswer: 'Voici des tests pytest pour les deux fonctions :\n\n' + TESTS_CODE + '\n\nLancez-les avec `pytest -q`.',
    explainAnswer: 'La requête **GET /orders** a répondu **200 OK** en quelques millisecondes.\n\n- Le corps est une liste de **3 commandes** ; chacune a `id`, `customer`, `total` et `status`.\n- Deux commandes sont `paid` et une est `pending`.\n- L’en-tête `Content-Type` indique du JSON.\n\nConseil : vérifiez que `total` est toujours supérieur à zéro.',
    wsMessage: '{"type": "subscribe", "channel": "commandes"}',
    env: 'Recette'
  },
  de: {
    folder: 'shop-projekt',
    collection: 'Shop-API',
    requests: ['Bestellungen auflisten', 'Kunde abrufen'],
    doc: { name: 'besprechung.md', text: '# Planungsbesprechung\n\n## Entscheidungen\n\n- Version 2.0 im März veröffentlichen.\n- Ana übernimmt die neue Bestellansicht.\n- API-Tests vor der Auslieferung prüfen.\n\n## Nächste Schritte\n\n1. Bruno richtet die Testumgebung ein.\n2. Carla schreibt die Dokumentation.\n' },
    chatQuestion: 'Liste die Entscheidungen auf und wer für jeden nächsten Schritt zuständig ist.',
    chatAnswer: '**Entscheidungen**\n\n- Version 2.0 im März veröffentlichen.\n- Ana übernimmt die neue Bestellansicht.\n- Die API-Tests werden vor der Auslieferung geprüft.\n\n**Nächste Schritte**\n\n1. **Bruno**: Testumgebung einrichten.\n2. **Carla**: Dokumentation schreiben.',
    testsAnswer: 'Hier sind pytest-Tests für beide Funktionen:\n\n' + TESTS_CODE + '\n\nAusführen mit `pytest -q`.',
    explainAnswer: 'Die Anfrage **GET /orders** antwortete in wenigen Millisekunden mit **200 OK**.\n\n- Der Body ist eine Liste mit **3 Bestellungen**; jede hat `id`, `customer`, `total` und `status`.\n- Zwei Bestellungen sind `paid`, eine ist `pending`.\n- Der Header `Content-Type` zeigt JSON an.\n\nTipp: Prüfen Sie, ob `total` immer größer als null ist.',
    wsMessage: '{"type": "subscribe", "channel": "bestellungen"}',
    env: 'Test'
  }
}

const OUT = resolve('website/assets/img/screens')
const MENU = { file: 0, edit: 1, search: 2, view: 3, encoding: 4, language: 5, tools: 6, account: 7, help: 8 }
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ---- Servidores locais ----

/** Ollama falso: a resposta da próxima conversa é trocada a cada cena (state.answer). */
function startFakeOllama(state: { answer: string }): Promise<{ port: number; close(): void }> {
  const server = createHttpServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/version') return void res.end(JSON.stringify({ version: '0.9.0' }))
    if (req.url === '/api/tags') return void res.end(JSON.stringify({ models: [{ name: 'llama3.2:3b', size: 2019393189 }, { name: 'qwen2.5-coder:7b', size: 4683087332 }] }))
    if (req.url === '/api/chat') {
      req.resume()
      res.setHeader('Content-Type', 'application/x-ndjson')
      for (const piece of state.answer.match(/[\s\S]{1,24}/g) ?? []) res.write(JSON.stringify({ message: { role: 'assistant', content: piece }, done: false }) + '\n')
      return void res.end(JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }) + '\n')
    }
    res.statusCode = 404
    res.end('{}')
  })
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ port: (server.address() as AddressInfo).port, close: () => server.close() })))
}

const introspection = {
  data: {
    __schema: {
      queryType: { name: 'Query' },
      mutationType: null,
      subscriptionType: null,
      types: [
        { kind: 'OBJECT', name: 'Query', description: '', fields: [
          { name: 'order', description: '', args: [{ name: 'id', description: '', type: { kind: 'NON_NULL', name: null, ofType: { kind: 'SCALAR', name: 'ID', ofType: null } }, defaultValue: null }], type: { kind: 'OBJECT', name: 'Order', ofType: null }, isDeprecated: false },
          { name: 'orders', description: '', args: [], type: { kind: 'LIST', name: null, ofType: { kind: 'OBJECT', name: 'Order', ofType: null } }, isDeprecated: false }
        ], inputFields: null, interfaces: [], enumValues: null, possibleTypes: null },
        { kind: 'OBJECT', name: 'Order', description: 'Order', fields: [
          { name: 'id', description: '', args: [], type: { kind: 'SCALAR', name: 'ID', ofType: null }, isDeprecated: false },
          { name: 'customer', description: '', args: [], type: { kind: 'SCALAR', name: 'String', ofType: null }, isDeprecated: false },
          { name: 'total', description: '', args: [], type: { kind: 'SCALAR', name: 'Float', ofType: null }, isDeprecated: false },
          { name: 'status', description: '', args: [], type: { kind: 'SCALAR', name: 'String', ofType: null }, isDeprecated: false }
        ], inputFields: null, interfaces: [], enumValues: null, possibleTypes: null },
        { kind: 'SCALAR', name: 'ID', description: '', fields: null, inputFields: null, interfaces: null, enumValues: null, possibleTypes: null },
        { kind: 'SCALAR', name: 'String', description: '', fields: null, inputFields: null, interfaces: null, enumValues: null, possibleTypes: null },
        { kind: 'SCALAR', name: 'Float', description: '', fields: null, inputFields: null, interfaces: null, enumValues: null, possibleTypes: null }
      ],
      directives: []
    }
  }
}

const ORDERS = [
  { id: 1001, customer: 'Ana Souza', total: 249.9, status: 'paid' },
  { id: 1002, customer: 'Bruno Lima', total: 89.5, status: 'pending' },
  { id: 1003, customer: 'Carla Dias', total: 412.0, status: 'paid' }
]

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((ok) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')))
  })

/** API de exemplo: pedidos, cliente, GraphQL e token OAuth. */
function startSampleApi(): Promise<{ base: string; close(): void }> {
  const server = createHttpServer((req, res) => {
    void readBody(req).then(() => {
      const url = (req.url ?? '').split('?')[0]
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('X-Request-Id', 'b7f3c2a1')
      if (url === '/graphql') return res.end(JSON.stringify(introspection))
      if (url === '/token') return res.end(JSON.stringify({ access_token: 'demo-token', token_type: 'Bearer', expires_in: 3600 }))
      if (url.startsWith('/orders')) return res.end(JSON.stringify(ORDERS))
      if (url.startsWith('/customers')) return res.end(JSON.stringify({ id: 42, name: 'Ana Souza', email: 'ana@example.com', city: 'Recife', active: true, orders: [1001, 1003] }))
      res.end(JSON.stringify({ ok: true, path: url }))
    })
  })
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, close: () => server.close() })))
}

// ---- Aplicativo ----

async function stubOpen(app: ElectronApplication, paths: string[]): Promise<void> {
  await app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = (async () => ({ canceled: false, filePaths })) as typeof dialog.showOpenDialog
  }, paths)
}

async function stubMessageBox(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = (async () => ({ response: 1, checkboxChecked: false })) as typeof dialog.showMessageBox
  })
}

async function launch(locale: Locale, userData: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${userData}`, `--lang=${SYSTEM[locale]}`], colorScheme: 'light' })
  const page = await app.firstWindow()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1280, 800))
  await page.waitForSelector('[role=tab]')
  await sleep(500)
  return { app, page }
}

async function shot(page: Page, file: string, target?: Locator | { clip: { x: number; y: number; width: number; height: number } }): Promise<void> {
  mkdirSync(join(file, '..'), { recursive: true })
  await sleep(300)
  if (!target) await page.screenshot({ path: file })
  else if ('clip' in target) await page.screenshot({ path: file, clip: target.clip })
  else await target.screenshot({ path: file })
  console.log('  ', file.split(/[\\/]/).slice(-2).join('/'))
}

/** Fecha diálogos e o painel inferior, deixando a área do editor livre para a próxima cena. */
async function reset(page: Page, t: (k: MessageKey) => string): Promise<void> {
  for (let i = 0; i < 3 && (await page.getByRole('dialog').count()) > 0; i++) {
    await page.keyboard.press('Escape')
    await sleep(200)
  }
  const closePanel = page.getByRole('button', { name: t('bottom.close'), exact: true })
  if (await closePanel.isVisible()) await closePanel.click()
}

/** Abre Ferramentas → Testar requisições e APIs → item. */
async function apiMenu(page: Page, t: (k: MessageKey) => string, item: MessageKey): Promise<void> {
  await page.locator('nav button').nth(MENU.tools).click()
  await page.getByRole('menuitem', { name: t('menu.tools.apiSubmenu') }).click()
  await page.getByRole('menuitem', { name: t(item) }).click()
}

let uid = 0
const id = (): string => `site-demo-${++uid}`

function request(name: string, method: string, url: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ $schema: 'meu-editor/api-request@1', id: id(), name, method, url, params: [], headers: [], auth: { type: 'inherit' }, body: { type: 'none' }, tests: [], extract: [], examples: [], ...extra }, null, 2)
}

async function captureLocale(locale: Locale): Promise<void> {
  const tx = TEXTS[locale]
  const t = (key: MessageKey, params?: Record<string, string | number>): string => translate(locale, key, params)
  const img = (name: string): string => join(OUT, locale, `${name}.png`)

  // Pasta de exemplo na raiz do disco: o caminho aparece no app e não pode mostrar o usuário do computador.
  const work = join(parse(tmpdir()).root, 'Site', locale)
  rmSync(work, { recursive: true, force: true })
  const folder = join(work, tx.folder)
  const colDir = join(folder, 'api')
  mkdirSync(colDir, { recursive: true })
  const userData = join(work, 'dados')
  mkdirSync(userData, { recursive: true })

  const state = { answer: tx.chatAnswer }
  const ollama = await startFakeOllama(state)
  const sample = await startSampleApi()
  const ws = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  ws.on('connection', (sock) =>
    sock.on('message', (data) => {
      sock.send(JSON.stringify({ type: 'ack', received: JSON.parse(String(data)) }))
      sock.send(JSON.stringify({ type: 'order.created', order: ORDERS[1] }))
    })
  )
  await new Promise((ok) => ws.once('listening', ok))
  const wsUrl = `ws://127.0.0.1:${(ws.address() as AddressInfo).port}/events`

  writeFileSync(join(userData, 'ai-settings.json'), JSON.stringify({ host: `http://127.0.0.1:${ollama.port}`, model: 'llama3.2:3b', temperature: 0.7, allowRemote: false }))
  writeFileSync(join(folder, tx.doc.name), tx.doc.text)
  writeFileSync(join(folder, 'orders.py'), CODE)
  // Coleção com duas requisições (usada no executor e na barra lateral) e uma requisição com testes.
  writeFileSync(join(colDir, 'collection.apicol'), JSON.stringify({ $schema: 'meu-editor/api-collection@1', id: id(), name: tx.collection, auth: { type: 'none' }, variables: [{ key: 'baseUrl', value: sample.base }], order: [`${tx.requests[0]}.apireq`, `${tx.requests[1]}.apireq`] }, null, 2))
  const tests = [
    { target: 'status', op: 'eq', expected: 200, enabled: true },
    { target: 'time', op: 'lt', expected: 500, enabled: true },
    { target: 'header', name: 'Content-Type', op: 'contains', expected: 'json', enabled: true },
    { target: 'jsonPath', path: '$[0].status', op: 'eq', expected: 'paid', enabled: true }
  ]
  writeFileSync(join(colDir, `${tx.requests[0]}.apireq`), request(tx.requests[0], 'GET', '{{baseUrl}}/orders?status=all&page=1', { params: [{ key: 'status', value: 'all', enabled: true }, { key: 'page', value: '1', enabled: true }], tests }))
  writeFileSync(join(colDir, `${tx.requests[1]}.apireq`), request(tx.requests[1], 'GET', '{{baseUrl}}/customers/42', { tests: [{ target: 'status', op: 'eq', expected: 200, enabled: true }] }))
  const openApi = join(folder, 'openapi.json')
  writeFileSync(openApi, JSON.stringify({ openapi: '3.0.3', info: { title: tx.collection, version: '1.0.0' }, paths: {
    '/orders': { get: { responses: { 200: { description: 'OK', content: { 'application/json': { example: ORDERS } } } } }, post: { responses: { 201: { description: 'Created', content: { 'application/json': { example: ORDERS[0] } } } } } },
    '/orders/{id}': { get: { responses: { 200: { description: 'OK', content: { 'application/json': { example: ORDERS[0] } } } } } },
    '/customers/{id}': { get: { responses: { 200: { description: 'OK', content: { 'application/json': { example: { id: 42, name: 'Ana Souza' } } } } } } }
  } }, null, 2))

  console.log(`\n== ${locale} ==`)
  const { app, page } = await launch(locale, userData)
  try {
    await stubOpen(app, [folder])
    await page.keyboard.press('Control+Shift+K')
    await page.getByRole('tree').first().waitFor()

    // ================= Assistente de IA =================
    // 1) Conversa sobre a ata aberta.
    await stubOpen(app, [join(folder, tx.doc.name)])
    await page.keyboard.press('Control+O')
    await page.getByRole('tab').filter({ hasText: tx.doc.name }).first().waitFor()
    await page.keyboard.press('Control+Shift+I')
    const ai = page.getByTestId('ai-panel')
    await ai.getByTestId('ai-status').and(page.locator('[data-state=ok]')).waitFor()
    await ai.getByLabel(t('ai.input.label')).fill(tx.chatQuestion)
    await ai.getByTestId('ai-send').click()
    await ai.getByTestId('ai-assistant-message').filter({ hasText: tx.chatAnswer.split('\n').pop()!.replace(/\*\*/g, '').slice(-15) }).waitFor()
    await ai.getByTestId('ai-send').waitFor()
    await shot(page, img('ai-01-chat'))

    // 2) Ação rápida "Escrever testes" sobre a seleção de um arquivo Python: resposta com bloco de código.
    await ai.getByRole('button', { name: t('ai.newChat') }).click()
    await stubOpen(app, [join(folder, 'orders.py')])
    await page.keyboard.press('Control+O')
    await page.getByRole('tab').filter({ hasText: 'orders.py' }).first().waitFor()
    await page.locator('.monaco-editor').first().click()
    await page.keyboard.press('Control+A')
    state.answer = tx.testsAnswer
    await ai.getByTestId('ai-quick-tests').click()
    await ai.getByTestId('ai-code-block').waitFor()
    await ai.getByTestId('ai-send').waitFor()
    await shot(page, img('ai-02-quick-tests'))
    // Recorte só do painel (ações rápidas e bloco de código com os três botões).
    await shot(page, img('ai-03-panel'), ai)

    // 3) Configurações e modelos.
    await ai.getByRole('button', { name: t('ai.settings') }).click()
    await ai.getByTestId('ai-models-section').waitFor()
    await shot(page, img('ai-04-settings'), ai)
    await ai.getByRole('button', { name: t('ai.settings') }).click()

    // 4) Sem o Ollama: o painel mostra como instalar.
    await ai.getByRole('button', { name: t('ai.newChat') }).click()
    await page.evaluate(() => (window as unknown as { api: { aiSetSettings(s: object): Promise<unknown> } }).api.aiSetSettings({ host: 'http://127.0.0.1:9', model: '', temperature: 0.7, allowRemote: false }))
    await ai.getByRole('button', { name: t('ai.refresh') }).click()
    await ai.getByTestId('ai-install-help').waitFor()
    await shot(page, img('ai-05-install'), ai)
    await page.evaluate((host) => (window as unknown as { api: { aiSetSettings(s: object): Promise<unknown> } }).api.aiSetSettings({ host, model: 'llama3.2:3b', temperature: 0.7, allowRemote: false }), `http://127.0.0.1:${ollama.port}`)
    await ai.getByRole('button', { name: t('ai.refresh') }).click()
    await ai.getByTestId('ai-status').and(page.locator('[data-state=ok]')).waitFor()
    await ai.getByRole('button', { name: t('ai.newChat') }).click()
    await ai.getByRole('button', { name: t('ai.close') }).first().click()

    // ================= Testar requisições e APIs =================
    // 0) O submenu com todos os recursos.
    await page.locator('nav button').nth(MENU.tools).click()
    await page.getByRole('menuitem', { name: t('menu.tools.apiSubmenu') }).hover()
    await page.getByRole('menuitem', { name: t('menu.tools.apiClient') }).waitFor()
    await sleep(300)
    {
      const menus = page.getByRole('menu')
      let right = 0
      let bottom = 0
      for (let i = 0; i < (await menus.count()); i++) {
        const b = (await menus.nth(i).boundingBox())!
        right = Math.max(right, b.x + b.width)
        bottom = Math.max(bottom, b.y + b.height)
      }
      await shot(page, img('api-01-menu'), { clip: { x: 0, y: 0, width: Math.min(right + 24, 1280), height: Math.min(bottom + 16, 800) } })
    }
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await sleep(200)

    // 1) Coleção na barra lateral e requisição com testes enviada.
    for (const key of ['menu.view.showApiCollections', 'menu.view.showApiHistory'] as MessageKey[]) {
      await page.locator('nav button').nth(MENU.view).click()
      await page.getByRole('menuitem', { name: t('menu.view.sidebarAreas') }).hover()
      await page.getByRole('menuitem', { name: t(key), exact: true }).click()
      await sleep(200)
    }
    // Recentes e Documentos abertos recolhidos: sobra espaço para a coleção e o histórico.
    for (const section of ['recent', 'openDocs']) {
      const head = page.locator(`aside section[data-section="${section}"] > :first-child button[aria-expanded="true"]`)
      if ((await head.count()) > 0) await head.first().click()
    }
    const col = page.getByTestId('api-collection')
    await col.getByText(tx.collection).first().waitFor()
    if ((await col.getByText(tx.requests[0]).count()) === 0) await col.getByText(tx.collection).first().click()
    await col.getByText(tx.requests[0]).first().click()
    const view = page.getByTestId('api-request').last()
    await view.waitFor()
    await page.getByTestId('api-send').last().click()
    await page.getByTestId('api-status').last().filter({ hasText: '200' }).waitFor()
    await page.getByTestId('api-response').last().getByRole('treeitem').first().waitFor()
    await shot(page, img('api-02-request'))
    await view.getByRole('tab', { name: new RegExp('^' + t('apiClient.tab.tests')) }).first().click()
    const response = page.getByTestId('api-response').last()
    await response.getByRole('tab', { name: new RegExp('^' + t('apiClient.response.tab.tests')) }).click()
    await page.getByTestId('api-test-results').last().waitFor()
    await shot(page, img('api-03-tests'))

    // 2) Explicar com IA a resposta.
    state.answer = tx.explainAnswer
    await page.getByTestId('api-ai-explain').last().click()
    await page.getByTestId('ai-panel').getByTestId('ai-code-block').or(page.getByTestId('ai-assistant-message')).last().waitFor()
    await page.getByTestId('ai-panel').getByTestId('ai-send').waitFor()
    await shot(page, img('ai-06-api-explain'))
    await page.getByTestId('ai-panel').getByRole('button', { name: t('ai.newChat') }).click()
    await page.getByTestId('ai-panel').getByRole('button', { name: t('ai.close') }).first().click()

    // 3) Gerar código.
    await view.getByRole('button', { name: t('apiClient.code'), exact: true }).click()
    await page.getByTestId('codegen-code').waitFor()
    await shot(page, img('api-04-codegen'), page.getByRole('dialog'))
    await reset(page, t)

    // 4) Executor da coleção: relatório.
    await col.getByText(tx.collection).first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: t('apiClient.col.run') }).click()
    await page.getByRole('dialog').waitFor()
    await shot(page, img('api-05-runner'), page.getByRole('dialog'))
    await page.getByRole('dialog').getByRole('button', { name: t('apiClient.runner.start'), exact: true }).click()
    await page.getByRole('tab', { selected: true }).filter({ hasText: '.apirun' }).first().waitFor()
    await sleep(800)
    await shot(page, img('api-06-report'))

    // 5) Ambiente com variável secreta.
    await apiMenu(page, t, 'menu.tools.apiEnvironments')
    await page.getByTestId('api-environment').waitFor()
    await page.getByLabel(t('apiClient.env.name'), { exact: true }).fill(tx.env)
    await page.getByRole('button', { name: t('apiClient.env.add') }).click()
    await page.getByLabel(t('apiClient.env.keyN', { n: 1 })).fill('baseUrl')
    await page.getByLabel(t('apiClient.env.valueN', { n: 1 })).fill('https://api.example.com')
    await page.getByRole('button', { name: t('apiClient.env.add') }).click()
    await page.getByLabel(t('apiClient.env.keyN', { n: 2 })).fill('token')
    await page.getByLabel(t('apiClient.env.secretN', { n: 2 })).check()
    await page.getByLabel(t('apiClient.env.valueN', { n: 2 })).fill('valor-de-exemplo')
    await shot(page, img('api-07-environment'))

    // 6) Autorização OAuth 2.0 numa requisição nova.
    await page.keyboard.press('Control+Shift+A')
    let req = page.getByTestId('api-request').last()
    await req.waitFor()
    await req.getByLabel(t('apiClient.url'), { exact: true }).fill(`${sample.base}/orders`)
    await req.getByRole('tab', { name: new RegExp('^' + t('apiClient.tab.auth')) }).click()
    await req.locator('select:has(option[value="oauth2"])').selectOption('oauth2')
    await req.locator('select:has(option[value="clientCredentials"])').selectOption('clientCredentials')
    await req.getByLabel(t('apiClient.oauth.tokenUrl')).fill(`${sample.base}/token`)
    await req.getByLabel(t('apiClient.oauth.clientId'), { exact: true }).fill('loja-app')
    await shot(page, img('api-08-oauth'))

    // 7) GraphQL com o schema carregado e a documentação.
    await page.keyboard.press('Control+Shift+A')
    req = page.getByTestId('api-request').last()
    await req.waitFor()
    await req.getByLabel(t('apiClient.method')).selectOption('POST')
    await req.getByLabel(t('apiClient.url'), { exact: true }).fill(`${sample.base}/graphql`)
    await req.getByRole('tab', { name: new RegExp('^' + t('apiClient.tab.body')) }).click()
    await req.getByLabel(t('apiClient.body.type')).selectOption('graphql')
    await req.getByRole('group', { name: t('apiClient.graphql.queryLabel'), exact: true }).click()
    await page.keyboard.type('query Orders {\n  orders {\n    id\n    customer\n    total\n')
    await req.getByRole('button', { name: t('apiClient.graphql.loadSchema') }).click()
    const docs = req.getByRole('complementary', { name: t('apiClient.graphql.docs') })
    await docs.getByText('Query').first().waitFor()
    await docs.getByLabel(t('apiClient.graphql.searchTypes')).fill('Ord')
    await docs.getByRole('button', { name: /Order/ }).first().click()
    await sleep(300)
    await shot(page, img('api-09-graphql'))

    // 8) WebSocket.
    await apiMenu(page, t, 'menu.tools.apiWebSocket')
    await page.getByTestId('ws-url').last().fill(wsUrl)
    await page.getByTestId('ws-connect').last().click()
    await page.getByTestId('ws-message').last().fill(tx.wsMessage)
    await page.getByTestId('ws-message').last().press('Control+Enter')
    await page.getByTestId('ws-log').last().locator('[data-direction=in]').nth(1).waitFor()
    await page.getByTestId('ws-log').last().locator('[data-direction=in]').last().click()
    await shot(page, img('api-10-websocket'))
    await page.getByTestId('ws-disconnect').last().click()

    // 9) Importar (curl) com a prévia.
    await apiMenu(page, t, 'menu.tools.apiImport')
    await page.getByLabel(t('apiClient.import.paste')).fill(`curl -X POST '${sample.base.replace(/127\.0\.0\.1:\d+/, 'api.example.com')}/orders' -H 'Content-Type: application/json' -H 'Authorization: Bearer {{token}}' -d '{"customer":"Ana Souza","items":[{"sku":"A-10","qty":2}]}'`)
    await page.getByRole('button', { name: t('apiClient.import.analyze') }).click()
    await page.getByTestId('import-preview').waitFor()
    await shot(page, img('api-11-import'), page.getByRole('dialog'))
    await reset(page, t)

    // 10) Servidor mock a partir de um OpenAPI.
    await apiMenu(page, t, 'menu.tools.apiMock')
    const mock = page.getByTestId('mock-dialog')
    await mock.waitFor()
    await mock.getByLabel(t('apiClient.mock.fromOpenApi')).check().catch(() => undefined)
    await stubOpen(app, [openApi])
    await mock.getByRole('button', { name: t('apiClient.mock.pickOpenApi') }).click()
    await mock.getByTestId('mock-routes').locator('tbody tr').first().waitFor()
    await mock.getByLabel(t('apiClient.mock.port')).fill('0')
    await mock.getByTestId('mock-start').click()
    await mock.getByTestId('mock-url').waitFor()
    await shot(page, img('api-12-mock'), mock)
    await reset(page, t)
  } finally {
    await stubMessageBox(app).catch(() => undefined)
    await app.close().catch(() => undefined)
    ollama.close()
    sample.close()
    ws.close()
    rmSync(work, { recursive: true, force: true })
  }
}

// ================= Macros e terminal =================

interface ToolTexts {
  names: string[]
  macroName: string
  table: string
  commits: string[]
  script: { title: string; total: string; region: string[] }
}

const TOOL_TEXTS: Record<Locale, ToolTexts> = {
  'pt-BR': { names: ['Ana Souza', 'Bruno Lima', 'Carla Dias', 'Diego Rocha', 'Elisa Prado'], macroName: 'Gerar INSERT de clientes', table: 'clientes', commits: ['Cria a estrutura do projeto', 'Adiciona o relatório de vendas', 'Corrige o total por região', 'Atualiza a documentação'], script: { title: 'Vendas por região', total: 'Total', region: ['Norte', 'Nordeste', 'Sudeste', 'Sul'] } },
  'pt-PT': { names: ['Ana Sousa', 'Bruno Lima', 'Carla Dias', 'Diogo Rocha', 'Elisa Prado'], macroName: 'Gerar INSERT de clientes', table: 'clientes', commits: ['Cria a estrutura do projeto', 'Adiciona o relatório de vendas', 'Corrige o total por região', 'Atualiza a documentação'], script: { title: 'Vendas por região', total: 'Total', region: ['Norte', 'Centro', 'Lisboa', 'Algarve'] } },
  en: { names: ['Ana Smith', 'Bruno Lee', 'Carla Diaz', 'David Rock', 'Ellen Park'], macroName: 'Customer INSERT', table: 'customers', commits: ['Create project structure', 'Add sales report', 'Fix total per region', 'Update documentation'], script: { title: 'Sales by region', total: 'Total', region: ['North', 'South', 'East', 'West'] } },
  es: { names: ['Ana Gómez', 'Bruno Lima', 'Carla Díaz', 'Diego Rocha', 'Elisa Prado'], macroName: 'Generar INSERT de clientes', table: 'clientes', commits: ['Crea la estructura del proyecto', 'Añade el informe de ventas', 'Corrige el total por región', 'Actualiza la documentación'], script: { title: 'Ventas por región', total: 'Total', region: ['Norte', 'Sur', 'Este', 'Oeste'] } },
  fr: { names: ['Anne Martin', 'Bruno Petit', 'Claire Dubois', 'David Moreau', 'Élise Laurent'], macroName: 'INSERT des clients', table: 'clients', commits: ['Crée la structure du projet', 'Ajoute le rapport des ventes', 'Corrige le total par région', 'Met à jour la documentation'], script: { title: 'Ventes par région', total: 'Total', region: ['Nord', 'Sud', 'Est', 'Ouest'] } },
  de: { names: ['Anna Schmidt', 'Bruno Weber', 'Clara Fischer', 'David Wagner', 'Elena Becker'], macroName: 'Kunden-INSERT', table: 'kunden', commits: ['Projektstruktur anlegen', 'Umsatzbericht hinzufügen', 'Summe je Region korrigieren', 'Dokumentation aktualisieren'], script: { title: 'Umsatz nach Region', total: 'Summe', region: ['Nord', 'Süd', 'Ost', 'West'] } }
}

/** Digita no terminal ativo e espera a saída conter `until`. */
async function term(page: Page, command: string, until: string | RegExp): Promise<void> {
  await page.locator('[data-terminal]:not(.invisible) .xterm').first().click()
  await page.keyboard.type(command)
  await page.keyboard.press('Enter')
  await page.locator('[data-terminal]:not(.invisible) .xterm-rows').first().filter({ hasText: until }).waitFor({ timeout: 30000 })
  await sleep(600)
}

async function captureTools(locale: Locale): Promise<void> {
  const tx = TOOL_TEXTS[locale]
  const t = (key: MessageKey, params?: Record<string, string | number>): string => translate(locale, key, params)
  const img = (name: string): string => join(OUT, locale, `${name}.png`)
  const work = join(parse(tmpdir()).root, 'Site', locale)
  rmSync(work, { recursive: true, force: true })
  const folder = join(work, 'projeto')
  mkdirSync(folder, { recursive: true })
  const userData = join(work, 'dados')
  mkdirSync(userData, { recursive: true })

  // Arquivos de exemplo: lista de nomes (macro), script Node (terminal), log e repositório Git.
  writeFileSync(join(folder, `${tx.table}.txt`), tx.names.join('\n') + '\n')
  const sales = tx.script.region.map((r, i) => [r, [48210, 61377, 152904, 73560][i]])
  writeFileSync(join(folder, 'relatorio.js'), `// ${tx.script.title}\nconst vendas = ${JSON.stringify(Object.fromEntries(sales), null, 2)}\n\nconsole.log('${tx.script.title}')\nconsole.table(Object.entries(vendas).map(([regiao, valor]) => ({ regiao, valor })))\nconst total = Object.values(vendas).reduce((a, b) => a + b, 0)\nconsole.log('${tx.script.total}:', total.toLocaleString('${locale === 'pt-PT' ? 'pt-PT' : locale === 'en' ? 'en-US' : locale}'))\n`)
  const log: string[] = []
  const levels = ['INFO', 'INFO', 'WARN', 'INFO', 'ERROR', 'INFO', 'INFO', 'ERROR', 'INFO', 'WARN', 'INFO', 'ERROR']
  const msgs = { INFO: 'GET /api/orders 200 34ms', WARN: 'slow query: SELECT * FROM orders (812ms)', ERROR: 'POST /api/payments 502 upstream timeout' }
  for (let i = 0; i < 60; i++) {
    const lv = levels[i % levels.length] as keyof typeof msgs
    log.push(`2026-11-26 09:${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')} ${lv.padEnd(5)} ${msgs[lv]}`)
  }
  writeFileSync(join(folder, 'app.log'), log.join('\n') + '\n')
  writeFileSync(join(folder, 'README.md'), `# ${tx.script.title}\n`)
  const git = (args: string[]): void => {
    const r = spawnSync('git', ['-c', 'user.name=Demo', '-c', 'user.email=demo@example.com', ...args], { cwd: folder })
    if (r.status !== 0) throw new Error(String(r.stderr))
  }
  git(['init', '-q', '-b', 'main'])
  for (const msg of tx.commits) {
    writeFileSync(join(folder, 'CHANGELOG.md'), tx.commits.slice(0, tx.commits.indexOf(msg) + 1).map((m) => `- ${m}`).join('\n') + '\n')
    git(['add', '-A'])
    git(['commit', '-q', '-m', msg])
  }
  writeFileSync(join(folder, 'README.md'), `# ${tx.script.title}\n\nnode relatorio.js\n`)

  console.log(`\n== ${locale} (macros e terminal) ==`)
  const { app, page } = await launch(locale, userData)
  try {
    await stubOpen(app, [folder])
    await page.keyboard.press('Control+Shift+K')
    await page.getByRole('tree').first().waitFor()
    const open = async (name: string): Promise<void> => {
      await stubOpen(app, [join(folder, name)])
      // Pelo menu: com o terminal em foco, Ctrl+O iria para o shell.
      await page.locator('nav button').nth(MENU.file).click()
      await page.getByRole('menuitem', { name: new RegExp('^' + t('menu.file.open').replace(/[.]/g, '\.')) }).first().click()
      await page.getByRole('tab').filter({ hasText: name }).first().waitFor()
      await sleep(400)
    }

    // ---- Macros ----
    await open(`${tx.table}.txt`)
    await page.locator('.monaco-editor').first().click()
    await page.keyboard.press('Control+Home')
    // Menu Ferramentas com os três itens de macro.
    await page.locator('nav button').nth(MENU.tools).click()
    const toolsMenu = page.getByRole('menu')
    await toolsMenu.waitFor()
    const box = (await toolsMenu.boundingBox())!
    await shot(page, img('mac-01-menu'), { clip: { x: 0, y: 0, width: Math.min(box.x + box.width + 24, 1280), height: Math.min(box.y + box.height + 16, 800) } })
    await page.keyboard.press('Escape')
    await page.locator('.monaco-editor').first().click()
    await page.keyboard.press('Control+Home')
    // Grava: início da linha, prefixo, fim da linha, sufixo e desce para a próxima.
    await page.keyboard.press('Control+Shift+R')
    await page.keyboard.press('Home')
    await page.keyboard.type(`INSERT INTO ${tx.table} (nome) VALUES ('`)
    await page.keyboard.press('End')
    await page.keyboard.type("');")
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Home')
    await sleep(300)
    await shot(page, img('mac-02-recording'))
    await page.keyboard.press('Control+Shift+R')
    // Janela Macros: 4 repetições (uma por nome restante) e um nome para salvar.
    await page.locator('nav button').nth(MENU.tools).click()
    await page.getByRole('menuitem', { name: t('menu.tools.macros') }).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await dialog.getByLabel(t('macros.repetitions')).fill('4')
    await dialog.getByLabel(t('macros.nameLabel')).fill(tx.macroName)
    await shot(page, img('mac-03-dialog'), dialog)
    await dialog.getByRole('button', { name: t('macros.saveMacro') }).click()
    await sleep(300)
    await shot(page, img('mac-05-saved'), dialog)
    await dialog.getByRole('button', { name: t('common.run'), exact: true }).first().click()
    await dialog.waitFor({ state: 'hidden' }).catch(async () => {
      await page.keyboard.press('Escape')
    })
    await sleep(600)
    await shot(page, img('mac-04-result'))

    // ---- Terminal ----
    // 1) Git: histórico e alterações do projeto aberto.
    await open('README.md')
    await page.locator('nav button').nth(MENU.tools).click()
    await page.getByRole('menuitem', { name: t('menu.tools.openTerminal') }).click()
    await page.locator('[data-terminal] .xterm').first().waitFor()
    await sleep(2500)
    // Entra na pasta do projeto e limpa a tela (o prompt inicial mostra a pasta pessoal do computador).
    await term(page, `Set-Location '${folder}'; Clear-Host`, /projeto>/)
    await term(page, 'git log --oneline --graph', tx.commits[0])
    await term(page, 'git status --short', 'README.md')
    await shot(page, img('term-01-git'))

    // 2) Rodar o script que está aberto no editor.
    await open('relatorio.js')
    await term(page, 'Clear-Host; node relatorio.js', `${tx.script.total}:`)
    await shot(page, img('term-02-script'))

    // 3) Segundo terminal: filtrar erros no log aberto.
    await open('app.log')
    await page.locator('nav button').nth(MENU.tools).click()
    await page.getByRole('menuitem', { name: t('menu.tools.openTerminal') }).click()
    await page.getByRole('tab', { name: new RegExp(t('terminal.title', { n: 2 })) }).waitFor()
    await sleep(2500)
    await term(page, `Set-Location '${folder}'; Clear-Host`, /projeto>/)
    await term(page, "Select-String -Path app.log -Pattern 'ERROR' | Select-Object -Last 5 | ForEach-Object Line", 'upstream timeout')
    await term(page, "'ERROR: ' + (Select-String -Path app.log -Pattern 'ERROR').Count", /ERROR: \d+/)
    await shot(page, img('term-03-logs'))
  } finally {
    await stubMessageBox(app).catch(() => undefined)
    await app.close().catch(() => undefined)
    rmSync(work, { recursive: true, force: true })
  }
}

// ================= Realce de sintaxe =================

/** Exemplos reais por linguagem: nome do arquivo e código (o mesmo em todos os idiomas). */
const SAMPLES: [string, string][] = [
  ['estoque.c', `#include <stdio.h>
#include <stdlib.h>

#define MAX_ITENS 100

typedef struct {
    int id;
    char nome[40];
    double preco;
    int quantidade;
} Item;

/* Soma o valor total do estoque */
double valor_total(const Item *itens, size_t n) {
    double total = 0.0;
    for (size_t i = 0; i < n; i++) {
        total += itens[i].preco * itens[i].quantidade;
    }
    return total;
}

int main(void) {
    Item itens[] = {
        {1, "Teclado", 149.90, 12},
        {2, "Mouse", 79.50, 30},
        {3, "Monitor", 1299.00, 4},
    };
    size_t n = sizeof(itens) / sizeof(itens[0]);
    printf("Valor do estoque: R$ %.2f\\n", valor_total(itens, n));
    return EXIT_SUCCESS;
}
`],
  ['PedidoService.cs', `using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Loja.Pedidos;

public record Pedido(int Id, string Cliente, decimal Total, DateTime Data);

public class PedidoService
{
    private readonly List<Pedido> _pedidos = new();

    public void Adicionar(Pedido pedido)
    {
        if (pedido.Total <= 0)
            throw new ArgumentException("O total deve ser maior que zero.", nameof(pedido));
        _pedidos.Add(pedido);
    }

    // Pedidos do mês, do maior para o menor valor
    public IEnumerable<Pedido> DoMes(int ano, int mes) =>
        _pedidos.Where(p => p.Data.Year == ano && p.Data.Month == mes)
                .OrderByDescending(p => p.Total);

    public async Task<decimal> TotalAsync()
    {
        await Task.Delay(10);
        return _pedidos.Sum(p => p.Total);
    }
}
`],
  ['estilos.css', `/* Tema do painel administrativo */
:root {
  --cor-primaria: #6a35f2;
  --cor-texto: #1f1d33;
  --raio: 10px;
}

body {
  margin: 0;
  font-family: "Poppins", system-ui, sans-serif;
  color: var(--cor-texto);
  background: linear-gradient(180deg, #f4f1ff 0%, #ffffff 100%);
}

.cartao {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 24px;
  padding: 1.5rem;
  border-radius: var(--raio);
  box-shadow: 0 20px 50px rgba(38, 30, 95, 0.1);
}

.botao:hover,
.botao:focus-visible {
  background-color: var(--cor-primaria);
  transform: translateY(-2px);
  transition: transform 0.2s ease;
}

@media (max-width: 780px) {
  .cartao { grid-template-columns: 1fr; }
}
`],
  ['index.html', `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Painel de vendas</title>
  <link rel="stylesheet" href="estilos.css">
</head>
<body>
  <!-- Cabeçalho -->
  <header class="topo">
    <h1>Painel de vendas</h1>
    <nav>
      <a href="/pedidos" class="ativo">Pedidos</a>
      <a href="/clientes">Clientes</a>
    </nav>
  </header>

  <main id="conteudo">
    <form action="/pedidos" method="post">
      <label for="cliente">Cliente</label>
      <input id="cliente" name="cliente" required placeholder="Nome do cliente">
      <button type="submit" class="botao">Salvar</button>
    </form>
    <table>
      <tr><th>Pedido</th><th>Total</th></tr>
      <tr><td>#1001</td><td>R$ 249,90</td></tr>
    </table>
  </main>
  <script src="app.js" defer></script>
</body>
</html>
`],
  ['app.js', `// Carrega os pedidos da API e mostra o resumo
const API_URL = 'https://api.example.com/v1';

async function carregarPedidos(status = 'pago') {
  const resposta = await fetch(\`\${API_URL}/pedidos?status=\${status}\`, {
    headers: { Accept: 'application/json' },
  });
  if (!resposta.ok) {
    throw new Error(\`Falha ao carregar: \${resposta.status}\`);
  }
  return resposta.json();
}

const formatarMoeda = (valor) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

class Resumo {
  #pedidos = [];

  constructor(pedidos) {
    this.#pedidos = pedidos;
  }

  get total() {
    return this.#pedidos.reduce((soma, p) => soma + p.total, 0);
  }
}

carregarPedidos()
  .then((pedidos) => new Resumo(pedidos))
  .then((r) => console.log('Total:', formatarMoeda(r.total)))
  .catch(console.error);
`],
  ['config.json', `{
  "nome": "painel-de-vendas",
  "versao": "2.1.0",
  "ambiente": "producao",
  "servidor": {
    "host": "0.0.0.0",
    "porta": 8080,
    "https": true,
    "origensPermitidas": ["https://loja.example.com", "https://admin.example.com"]
  },
  "banco": {
    "tipo": "mysql",
    "host": "127.0.0.1",
    "porta": 3306,
    "nome": "loja",
    "pool": { "minimo": 2, "maximo": 10 }
  },
  "cache": {
    "ativo": true,
    "ttlSegundos": 300
  },
  "recursos": {
    "relatorios": true,
    "exportarCsv": true,
    "betaNovoCheckout": false
  },
  "responsavel": null
}
`],
  ['pedidos.php', `<?php
declare(strict_types=1);

namespace Loja\\Pedidos;

use PDO;
use InvalidArgumentException;

/** Repositório de pedidos com consultas parametrizadas. */
final class PedidoRepositorio
{
    public function __construct(private PDO $db) {}

    public function buscar(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT id, cliente, total FROM pedidos WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function salvar(string $cliente, float $total): int
    {
        if ($total <= 0) {
            throw new InvalidArgumentException("Total inválido: {$total}");
        }
        $stmt = $this->db->prepare('INSERT INTO pedidos (cliente, total) VALUES (?, ?)');
        $stmt->execute([$cliente, $total]);
        return (int) $this->db->lastInsertId();
    }
}

$repo = new PedidoRepositorio(new PDO('sqlite::memory:'));
echo match (true) {
    $repo instanceof PedidoRepositorio => "Pronto\\n",
    default => "Erro\\n",
};
`],
  ['relatorio.py', `"""Gera o relatório mensal de vendas a partir de um CSV."""
from __future__ import annotations

import csv
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Venda:
    regiao: str
    produto: str
    valor: float


def ler_vendas(caminho: Path) -> list[Venda]:
    with caminho.open(encoding="utf-8") as arquivo:
        return [Venda(l["regiao"], l["produto"], float(l["valor"])) for l in csv.DictReader(arquivo)]


def total_por_regiao(vendas: list[Venda]) -> dict[str, float]:
    totais: dict[str, float] = defaultdict(float)
    for venda in vendas:
        totais[venda.regiao] += venda.valor
    return dict(sorted(totais.items(), key=lambda item: item[1], reverse=True))


if __name__ == "__main__":
    vendas = ler_vendas(Path("vendas.csv"))
    for regiao, total in total_por_regiao(vendas).items():
        print(f"{regiao:<12} R$ {total:>12,.2f}")
`],
  ['vendas.sql', `-- Vendas por cliente no último trimestre
CREATE TABLE IF NOT EXISTS pedidos (
    id          INTEGER PRIMARY KEY,
    cliente_id  INTEGER NOT NULL REFERENCES clientes (id),
    total       DECIMAL(10, 2) NOT NULL CHECK (total > 0),
    status      VARCHAR(20) DEFAULT 'pendente',
    criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pedidos_cliente ON pedidos (cliente_id, criado_em);

WITH trimestre AS (
    SELECT cliente_id, SUM(total) AS valor, COUNT(*) AS qtd
    FROM pedidos
    WHERE status = 'pago'
      AND criado_em >= CURRENT_DATE - INTERVAL '90' DAY
    GROUP BY cliente_id
)
SELECT c.nome,
       t.qtd,
       t.valor,
       RANK() OVER (ORDER BY t.valor DESC) AS posicao
FROM trimestre t
JOIN clientes c ON c.id = t.cliente_id
WHERE t.valor > 1000
ORDER BY posicao
LIMIT 10;
`],
  ['nfe.xml', `<?xml version="1.0" encoding="UTF-8"?>
<!-- Pedido exportado para o sistema fiscal -->
<pedido xmlns="https://loja.example.com/schema/pedido" versao="2.0">
  <identificacao>
    <numero>1001</numero>
    <data>2026-11-26T10:30:00-03:00</data>
    <status>pago</status>
  </identificacao>
  <cliente tipo="PF">
    <nome>Ana Souza</nome>
    <email>ana@example.com</email>
    <endereco cidade="Recife" uf="PE" cep="50000-000"/>
  </cliente>
  <itens>
    <item sku="A-10" quantidade="2">
      <descricao>Teclado mecânico</descricao>
      <preco moeda="BRL">149.90</preco>
    </item>
    <item sku="B-22" quantidade="1">
      <descricao><![CDATA[Mouse sem fio & receptor USB]]></descricao>
      <preco moeda="BRL">79.50</preco>
    </item>
  </itens>
  <total moeda="BRL">379.30</total>
</pedido>
`]
]

async function captureSyntax(locale: Locale): Promise<void> {
  const t = (key: MessageKey): string => translate(locale, key)
  const work = join(parse(tmpdir()).root, 'Site', locale)
  rmSync(work, { recursive: true, force: true })
  const folder = join(work, 'exemplos')
  mkdirSync(folder, { recursive: true })
  const userData = join(work, 'dados')
  mkdirSync(userData, { recursive: true })
  for (const [name, code] of SAMPLES) writeFileSync(join(folder, name), code)

  console.log(`\n== ${locale} (realce de sintaxe) ==`)
  const { app, page } = await launch(locale, userData)
  try {
    for (const [name] of SAMPLES) {
      await stubOpen(app, [join(folder, name)])
      await page.locator('nav button').nth(MENU.file).click()
      await page.getByRole('menuitem', { name: new RegExp('^' + t('menu.file.open')) }).first().click()
      await page.getByRole('tab').filter({ hasText: name }).first().waitFor()
      // JSON abre em árvore: o realce aparece no modo de texto.
      if (name.endsWith('.json')) await page.getByRole('button', { name: t('toolbar.editText') }).first().click()
      await page.locator('.monaco-editor .view-lines').first().waitFor()
      await sleep(900)
      const ext = name.split('.').pop()!
      // Só a área do editor (abas e código), sem a barra lateral.
      const area = (await page.locator('.monaco-editor').first().boundingBox())!
      const tabs = (await page.getByRole('tab').filter({ hasText: name }).first().boundingBox())!
      await shot(page, join(OUT, locale, `syn-${ext}.png`), { clip: { x: area.x, y: tabs.y - 4, width: area.width, height: area.y + area.height - tabs.y + 4 } })
    }
  } finally {
    await stubMessageBox(app).catch(() => undefined)
    await app.close().catch(() => undefined)
    rmSync(work, { recursive: true, force: true })
  }
}

// Sem opções: tudo. --api (Assistente de IA e Cliente de API), --tools (macros e terminal), --syntax (realce).
const args = process.argv.slice(2)
const parts = ['--api', '--tools', '--syntax'].filter((f) => args.includes(f))
const run = (flag: string): boolean => parts.length === 0 || parts.includes(flag)
const wanted = args.filter((a) => !a.startsWith('--'))
for (const locale of Object.keys(TEXTS) as Locale[]) {
  if (wanted.length > 0 && !wanted.includes(locale)) continue
  if (run('--api')) await captureLocale(locale)
  if (run('--tools')) await captureTools(locale)
  if (run('--syntax')) await captureSyntax(locale)
}
console.log('\nTelas geradas em', OUT)
