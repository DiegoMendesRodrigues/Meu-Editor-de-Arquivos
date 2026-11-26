// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Captura as telas do manual do usuário em cada idioma.
 *
 * Abre o aplicativo já compilado (npm run build) com o idioma do sistema trocado, usa arquivos de exemplo no
 * idioma correspondente e salva as imagens em docs/manual/<idioma>/img.
 *
 * Uso: npx tsx scripts/capture-manual.mts [idioma ...]     (sem argumentos, gera os seis idiomas)
 */
import { type ChildProcess, spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, parse, resolve } from 'node:path'
import { _electron as electron, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { translate, type Locale, type MessageKey } from '../src/shared/i18n/index.ts'

interface Demo {
  /** Idioma do sistema passado ao Chromium. */
  system: string
  folder: string
  md: { name: string; text: (editLabel: string) => string }
  json: { name: string; data: unknown }
  badJson: { name: string; text: string }
  txt: { name: string; text: string }
  term: string
  replacement: string
  cloudPath: string
  cloudText: string
  user: { email: string; name: string; password: string }
  scratch: string
  /** Frase com uma palavra errada, para a tela do corretor ortográfico. */
  typo: { text: string; word: string }
}

const DEMOS: Record<Locale, Demo> = {
  'pt-BR': {
    system: 'pt-BR',
    folder: 'meus-documentos',
    md: {
      name: 'bem-vindo.md',
      text: (edit) => `# Bem-vindo ao Meu Editor de Arquivos\n\nEste é um **documento de exemplo** em Markdown.\n\n## Lista de tarefas\n\n- [x] Abrir uma pasta\n- [ ] Revisar a ata da reunião\n- [ ] Enviar o relatório\n\n> Dica: clique em **${edit}** para alterar este documento.\n`
    },
    json: { name: 'cliente.json', data: { nome: 'Ana Souza', cidade: 'Recife', ativo: true, pedidos: [{ id: 1, total: 120.5 }, { id: 2, total: 89.9 }] } },
    badJson: { name: 'com-erro.json', text: '{\n  "nome": "Ana Souza",\n  "cidade": "Recife",\n}\n' },
    txt: { name: 'notas.txt', text: 'Segunda: reunião com a equipe\nTerça: preparar a reunião de resultados\nQuarta: enviar a ata da reunião\n' },
    term: 'reunião',
    replacement: 'encontro',
    cloudPath: 'trabalho/ata-da-reuniao.md',
    cloudText: '# Ata da reunião\n\nParticipantes: Ana e Bruno.\n',
    user: { email: 'ana.souza@exemplo.com', name: 'Ana Souza', password: 'minha-senha-segura-1' },
    scratch: 'Rascunho: ideias para a apresentação.\n\tPrimeiro tópico   \n\tSegundo tópico',
    typo: { text: 'Reunião com o clinete na sexta.', word: 'clinete' }
  },
  en: {
    system: 'en-US',
    folder: 'my-documents',
    md: {
      name: 'welcome.md',
      text: (edit) => `# Welcome to Meu Editor de Arquivos\n\nThis is a **sample document** in Markdown.\n\n## Task list\n\n- [x] Open a folder\n- [ ] Review the meeting minutes\n- [ ] Send the report\n\n> Tip: click **${edit}** to change this document.\n`
    },
    json: { name: 'customer.json', data: { name: 'Anna Smith', city: 'Boston', active: true, orders: [{ id: 1, total: 120.5 }, { id: 2, total: 89.9 }] } },
    badJson: { name: 'with-error.json', text: '{\n  "name": "Anna Smith",\n  "city": "Boston",\n}\n' },
    txt: { name: 'notes.txt', text: 'Monday: meeting with the team\nTuesday: prepare the results meeting\nWednesday: send the meeting minutes\n' },
    term: 'meeting',
    replacement: 'session',
    cloudPath: 'work/meeting-minutes.md',
    cloudText: '# Meeting minutes\n\nAttendees: Anna and Brian.\n',
    user: { email: 'anna.smith@example.com', name: 'Anna Smith', password: 'my-secure-password-1' },
    scratch: 'Draft: ideas for the presentation.\n\tFirst topic   \n\tSecond topic',
    typo: { text: 'Meeting with the cliant on Friday.', word: 'cliant' }
  },
  de: {
    system: 'de-DE',
    folder: 'meine-dokumente',
    md: {
      name: 'willkommen.md',
      text: (edit) => `# Willkommen bei Meu Editor de Arquivos\n\nDies ist ein **Beispieldokument** in Markdown.\n\n## Aufgabenliste\n\n- [x] Einen Ordner öffnen\n- [ ] Das Besprechungsprotokoll prüfen\n- [ ] Den Bericht senden\n\n> Tipp: Klicken Sie auf **${edit}**, um dieses Dokument zu ändern.\n`
    },
    json: { name: 'kunde.json', data: { name: 'Anna Schmidt', stadt: 'Hamburg', aktiv: true, bestellungen: [{ id: 1, summe: 120.5 }, { id: 2, summe: 89.9 }] } },
    badJson: { name: 'mit-fehler.json', text: '{\n  "name": "Anna Schmidt",\n  "stadt": "Hamburg",\n}\n' },
    txt: { name: 'notizen.txt', text: 'Montag: Besprechung mit dem Team\nDienstag: die Ergebnisbesprechung vorbereiten\nMittwoch: das Protokoll der Besprechung senden\n' },
    term: 'Besprechung',
    replacement: 'Sitzung',
    cloudPath: 'arbeit/besprechungsprotokoll.md',
    cloudText: '# Besprechungsprotokoll\n\nTeilnehmer: Anna und Bernd.\n',
    user: { email: 'anna.schmidt@beispiel.de', name: 'Anna Schmidt', password: 'mein-sicheres-passwort-1' },
    scratch: 'Entwurf: Ideen für die Präsentation.\n\tErstes Thema   \n\tZweites Thema',
    typo: { text: 'Besprechung mit dem Kundne am Freitag.', word: 'Kundne' }
  },
  es: {
    system: 'es-ES',
    folder: 'mis-documentos',
    md: {
      name: 'bienvenida.md',
      text: (edit) => `# Bienvenido a Meu Editor de Arquivos\n\nEste es un **documento de ejemplo** en Markdown.\n\n## Lista de tareas\n\n- [x] Abrir una carpeta\n- [ ] Revisar el acta de la reunión\n- [ ] Enviar el informe\n\n> Consejo: haz clic en **${edit}** para cambiar este documento.\n`
    },
    json: { name: 'cliente.json', data: { nombre: 'Ana García', ciudad: 'Sevilla', activo: true, pedidos: [{ id: 1, total: 120.5 }, { id: 2, total: 89.9 }] } },
    badJson: { name: 'con-error.json', text: '{\n  "nombre": "Ana García",\n  "ciudad": "Sevilla",\n}\n' },
    txt: { name: 'notas.txt', text: 'Lunes: reunión con el equipo\nMartes: preparar la reunión de resultados\nMiércoles: enviar el acta de la reunión\n' },
    term: 'reunión',
    replacement: 'encuentro',
    cloudPath: 'trabajo/acta-de-la-reunion.md',
    cloudText: '# Acta de la reunión\n\nAsistentes: Ana y Bruno.\n',
    user: { email: 'ana.garcia@ejemplo.es', name: 'Ana García', password: 'mi-contrasena-segura-1' },
    scratch: 'Borrador: ideas para la presentación.\n\tPrimer tema   \n\tSegundo tema',
    typo: { text: 'Reunión con el clinete el viernes.', word: 'clinete' }
  },
  fr: {
    system: 'fr-FR',
    folder: 'mes-documents',
    md: {
      name: 'bienvenue.md',
      text: (edit) => `# Bienvenue dans Meu Editor de Arquivos\n\nVoici un **document d'exemple** en Markdown.\n\n## Liste de tâches\n\n- [x] Ouvrir un dossier\n- [ ] Relire le compte rendu de la réunion\n- [ ] Envoyer le rapport\n\n> Astuce : cliquez sur **${edit}** pour modifier ce document.\n`
    },
    json: { name: 'client.json', data: { nom: 'Anne Martin', ville: 'Lyon', actif: true, commandes: [{ id: 1, total: 120.5 }, { id: 2, total: 89.9 }] } },
    badJson: { name: 'avec-erreur.json', text: '{\n  "nom": "Anne Martin",\n  "ville": "Lyon",\n}\n' },
    txt: { name: 'notes.txt', text: "Lundi : réunion avec l'équipe\nMardi : préparer la réunion de résultats\nMercredi : envoyer le compte rendu de la réunion\n" },
    term: 'réunion',
    replacement: 'rencontre',
    cloudPath: 'travail/compte-rendu-reunion.md',
    cloudText: '# Compte rendu de la réunion\n\nParticipants : Anne et Bruno.\n',
    user: { email: 'anne.martin@exemple.fr', name: 'Anne Martin', password: 'mon-mot-de-passe-sur-1' },
    scratch: "Brouillon : idées pour la présentation.\n\tPremier sujet   \n\tDeuxième sujet",
    typo: { text: 'Réunion avec le cliant vendredi.', word: 'cliant' }
  },
  'pt-PT': {
    system: 'pt-PT',
    folder: 'os-meus-documentos',
    md: {
      name: 'bem-vindo.md',
      text: (edit) => `# Bem-vindo ao Meu Editor de Arquivos\n\nEste é um **documento de exemplo** em Markdown.\n\n## Lista de tarefas\n\n- [x] Abrir uma pasta\n- [ ] Rever a ata da reunião\n- [ ] Enviar o relatório\n\n> Dica: clique em **${edit}** para alterar este documento.\n`
    },
    json: { name: 'cliente.json', data: { nome: 'Ana Pereira', cidade: 'Coimbra', ativo: true, encomendas: [{ id: 1, total: 120.5 }, { id: 2, total: 89.9 }] } },
    badJson: { name: 'com-erro.json', text: '{\n  "nome": "Ana Pereira",\n  "cidade": "Coimbra",\n}\n' },
    txt: { name: 'notas.txt', text: 'Segunda: reunião com a equipa\nTerça: preparar a reunião de resultados\nQuarta: enviar a ata da reunião\n' },
    term: 'reunião',
    replacement: 'encontro',
    cloudPath: 'trabalho/ata-da-reuniao.md',
    cloudText: '# Ata da reunião\n\nParticipantes: Ana e Bruno.\n',
    user: { email: 'ana.pereira@exemplo.pt', name: 'Ana Pereira', password: 'a-minha-palavra-passe-1' },
    scratch: 'Rascunho: ideias para a apresentação.\n\tPrimeiro tópico   \n\tSegundo tópico',
    typo: { text: 'Reunião com o clinete na sexta-feira.', word: 'clinete' }
  }
}

/** Conversa de exemplo do Assistente de IA (respondida por um Ollama falso local) e arquivos extras na nuvem. */
const EXTRAS: Record<Locale, { question: string; answer: string; cloud: { path: string; text: string }[] }> = {
  'pt-BR': {
    question: 'Resuma este documento em três tópicos.',
    answer: 'Resumo do documento:\n\n1. **Boas-vindas** ao Meu Editor de Arquivos, com um exemplo em Markdown.\n2. **Lista de tarefas**: a pasta já foi aberta; faltam revisar a ata e enviar o relatório.\n3. **Dica**: o botão de edição troca para o texto Markdown.',
    cloud: [{ path: 'trabalho/relatorio-mensal.md', text: '# Relatório mensal\n\nVendas: +12%.\n' }, { path: 'pessoal/lista-de-compras.txt', text: 'Café\nPão\nFrutas\n' }, { path: 'projetos/api/config.json', text: '{\n  "ambiente": "homologação"\n}\n' }]
  },
  'pt-PT': {
    question: 'Resuma este documento em três tópicos.',
    answer: 'Resumo do documento:\n\n1. **Boas-vindas** ao Meu Editor de Arquivos, com um exemplo em Markdown.\n2. **Lista de tarefas**: a pasta já foi aberta; falta rever a ata e enviar o relatório.\n3. **Dica**: o botão de edição muda para o texto Markdown.',
    cloud: [{ path: 'trabalho/relatorio-mensal.md', text: '# Relatório mensal\n\nVendas: +12%.\n' }, { path: 'pessoal/lista-de-compras.txt', text: 'Café\nPão\nFruta\n' }, { path: 'projetos/api/config.json', text: '{\n  "ambiente": "testes"\n}\n' }]
  },
  en: {
    question: 'Summarize this document in three points.',
    answer: 'Document summary:\n\n1. **Welcome** to Meu Editor de Arquivos, with a Markdown sample.\n2. **Task list**: the folder is open; reviewing the minutes and sending the report are pending.\n3. **Tip**: the edit button switches to the Markdown text.',
    cloud: [{ path: 'work/monthly-report.md', text: '# Monthly report\n\nSales: +12%.\n' }, { path: 'personal/shopping-list.txt', text: 'Coffee\nBread\nFruit\n' }, { path: 'projects/api/config.json', text: '{\n  "environment": "staging"\n}\n' }]
  },
  es: {
    question: 'Resume este documento en tres puntos.',
    answer: 'Resumen del documento:\n\n1. **Bienvenida** a Meu Editor de Arquivos, con un ejemplo en Markdown.\n2. **Lista de tareas**: la carpeta ya está abierta; faltan revisar el acta y enviar el informe.\n3. **Consejo**: el botón de edición cambia al texto Markdown.',
    cloud: [{ path: 'trabajo/informe-mensual.md', text: '# Informe mensual\n\nVentas: +12%.\n' }, { path: 'personal/lista-de-compras.txt', text: 'Café\nPan\nFruta\n' }, { path: 'proyectos/api/config.json', text: '{\n  "entorno": "pruebas"\n}\n' }]
  },
  fr: {
    question: 'Résume ce document en trois points.',
    answer: 'Résumé du document :\n\n1. **Bienvenue** dans Meu Editor de Arquivos, avec un exemple en Markdown.\n2. **Liste de tâches** : le dossier est ouvert ; il reste à relire le compte rendu et à envoyer le rapport.\n3. **Astuce** : le bouton de modification passe au texte Markdown.',
    cloud: [{ path: 'travail/rapport-mensuel.md', text: '# Rapport mensuel\n\nVentes : +12 %.\n' }, { path: 'personnel/liste-de-courses.txt', text: 'Café\nPain\nFruits\n' }, { path: 'projets/api/config.json', text: '{\n  "environnement": "recette"\n}\n' }]
  },
  de: {
    question: 'Fasse dieses Dokument in drei Punkten zusammen.',
    answer: 'Zusammenfassung:\n\n1. **Willkommen** bei Meu Editor de Arquivos, mit einem Markdown-Beispiel.\n2. **Aufgabenliste**: Der Ordner ist geöffnet; Protokoll prüfen und Bericht senden stehen noch aus.\n3. **Tipp**: Die Bearbeiten-Schaltfläche wechselt zum Markdown-Text.',
    cloud: [{ path: 'arbeit/monatsbericht.md', text: '# Monatsbericht\n\nUmsatz: +12 %.\n' }, { path: 'privat/einkaufsliste.txt', text: 'Kaffee\nBrot\nObst\n' }, { path: 'projekte/api/config.json', text: '{\n  "umgebung": "test"\n}\n' }]
  }
}

/** Ollama falso em 127.0.0.1: versão, um modelo e a resposta da conversa em streaming (NDJSON). */
function startFakeOllama(answer: string): Promise<{ port: number; close(): void }> {
  const server = createHttpServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/api/version') return void res.end(JSON.stringify({ version: '0.9.0' }))
    if (req.url === '/api/tags') return void res.end(JSON.stringify({ models: [{ name: 'llama3.2' }] }))
    if (req.url === '/api/chat') {
      req.resume()
      res.setHeader('Content-Type', 'application/x-ndjson')
      for (const piece of answer.match(/[\s\S]{1,24}/g) ?? []) res.write(JSON.stringify({ message: { role: 'assistant', content: piece }, done: false }) + '\n')
      return void res.end(JSON.stringify({ message: { role: 'assistant', content: '' }, done: true }) + '\n')
    }
    res.statusCode = 404
    res.end('{}')
  })
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ port: (server.address() as { port: number }).port, close: () => server.close() })))
}

const OUT = resolve('docs/manual')
let API_PORT = 0
const MENU = { file: 0, edit: 1, search: 2, view: 3, encoding: 4, language: 5, tools: 6, account: 7, help: 8 }

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Servidor de teste em memória (a API do projeto), usado para mostrar as telas de conta e nuvem. */
async function freePort(): Promise<number> {
  return new Promise((done) => {
    const probe = createServer()
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => done(port))
    })
  })
}

async function startApi(): Promise<ChildProcess> {
  API_PORT = await freePort() // porta nova a cada execução: nunca reaproveita um servidor antigo
  const child = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: resolve('server'),
    env: { ...process.env, PORT: String(API_PORT), DATABASE_URL: '' },
    shell: true,
    stdio: 'ignore'
  })
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${API_PORT}/v1/health`)).ok) return child
    } catch {
      /* ainda subindo */
    }
    await sleep(500)
  }
  throw new Error('A API de teste não subiu.')
}

function stopApi(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill()
}

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
  const app = await electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${userData}`, `--lang=${DEMOS[locale].system}`], colorScheme: 'light' }) // telas no tema claro, qualquer que seja o do sistema
  const page = await app.firstWindow()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1120, 720))
  await page.waitForSelector('[role=tab]')
  await sleep(500)
  return { app, page }
}

async function shot(page: Page, file: string, target?: Locator | { clip: { x: number; y: number; width: number; height: number } }): Promise<void> {
  mkdirSync(join(file, '..'), { recursive: true })
  await sleep(250)
  if (!target) await page.screenshot({ path: file })
  else if ('clip' in target) await page.screenshot({ path: file, clip: target.clip })
  else await target.screenshot({ path: file })
}

async function openMenu(page: Page, index: number): Promise<Locator> {
  await page.locator('nav button').nth(index).click()
  const menu = page.getByRole('menu')
  await menu.waitFor()
  return menu
}

/** Captura de um menu aberto: a barra de menus e a lista, num recorte só. */
async function shotMenu(page: Page, file: string, index: number): Promise<void> {
  const menu = await openMenu(page, index)
  const box = (await menu.boundingBox())!
  await shot(page, file, { clip: { x: 0, y: 0, width: Math.min(box.x + box.width + 24, 1100), height: Math.min(box.y + box.height + 16, 700) } })
  await page.keyboard.press('Escape')
  await sleep(150)
}

async function shotDialog(page: Page, file: string): Promise<void> {
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await shot(page, file, dialog)
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
}

async function captureLocale(locale: Locale): Promise<void> {
  const demo = DEMOS[locale]
  const t = (key: MessageKey, params?: Record<string, string | number>): string => translate(locale, key, params)
  const img = (name: string): string => join(OUT, locale, 'img', `${name}.png`)

  // A pasta de exemplo fica na raiz do disco (ex.: C:/Manual/de): o caminho aparece na lista de recentes
  // e não pode mostrar o nome do usuário do computador onde as telas foram geradas.
  const work = join(parse(tmpdir()).root, 'Manual', locale)
  rmSync(work, { recursive: true, force: true })
  const folder = join(work, demo.folder)
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, demo.md.name), demo.md.text(t('toolbar.editText')))
  writeFileSync(join(folder, demo.json.name), JSON.stringify(demo.json.data, null, 2))
  writeFileSync(join(folder, demo.badJson.name), demo.badJson.text)
  writeFileSync(join(folder, demo.txt.name), demo.txt.text)
  const userData = join(work, 'dados')
  const extras = EXTRAS[locale]
  const ollama = await startFakeOllama(extras.answer)
  mkdirSync(userData, { recursive: true })
  writeFileSync(join(userData, 'ai-settings.json'), JSON.stringify({ host: `http://127.0.0.1:${ollama.port}`, model: 'llama3.2', temperature: 0.7, allowRemote: false }))

  console.log(`\n== ${locale} ==`)
  let { app, page } = await launch(locale, userData)
  const api = await startApi()
  const sample = createHttpServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ id: 42, name: 'Ana Souza', city: 'Recife', active: true, orders: [{ id: 1, total: 120.5 }, { id: 2, total: 89.9 }] }))
  })
  await new Promise<void>((done) => sample.listen(0, '127.0.0.1', done))
  try {
    // --- Visão geral: pasta aberta e um documento Markdown formatado
    await stubOpen(app, [folder])
    await page.keyboard.press('Control+Shift+K')
    await page.getByRole('tree').first().waitFor()
    await stubOpen(app, [join(folder, demo.md.name)])
    await page.keyboard.press('Control+O')
    await page.waitForSelector('.ProseMirror')
    await shot(page, img('s01-main'))

    // --- Botão Novo e a seta
    await page.getByRole('button', { name: t('toolbar.newTypeChoose') }).click()
    await page.getByRole('menu').waitFor()
    await shot(page, img('s02-new-menu'), { clip: { x: 0, y: 0, width: 520, height: 260 } })
    await page.keyboard.press('Escape')

    // --- Markdown em modo de edição (barra de formatação)
    await page.getByRole('button', { name: t('toolbar.editText') }).first().click()
    await page.locator('.monaco-editor').waitFor()
    await shot(page, img('s03-markdown-edit'))
    await page.getByRole('button', { name: new RegExp(`^${t('toolbar.preview')}$`) }).click()
    await page.waitForSelector('.ProseMirror')

    // --- JSON em árvore e JSON com erro
    await stubOpen(app, [join(folder, demo.json.name)])
    await page.keyboard.press('Control+O')
    await page.getByRole('tree').last().waitFor()
    await page.getByRole('tree').last().getByText(Object.keys(demo.json.data as object)[0]).first().click()
    await shot(page, img('s04-json-tree'))
    await stubOpen(app, [join(folder, demo.badJson.name)])
    await page.keyboard.press('Control+O')
    await page.getByRole('button', { name: t('json.editGoToError') }).waitFor()
    await shot(page, img('s05-json-error'))

    // --- Busca em arquivos (com o documento Markdown ativo ao fundo)
    await page.getByRole('tab', { name: new RegExp(demo.md.name.replace('.', '[.]')) }).click()
    await page.keyboard.press('Control+Shift+F')
    await page.getByLabel(t('search.queryLabel')).fill(demo.term)
    await page.locator('form button[type=submit]').click() // (o nome do botão pode ser igual ao do menu Pesquisar)
    await page.getByRole('status').filter({ hasText: /\d/ }).first().waitFor()
    await page.getByLabel(t('search.replaceLabel')).fill(demo.replacement)
    await shot(page, img('s06-search'))
    await page.keyboard.press('Control+Shift+B')
    await page.keyboard.press('Control+Shift+B')

    // --- Menus
    await shotMenu(page, img('s07-menu-file'), MENU.file)
    await shotMenu(page, img('s09-menu-encoding'), MENU.encoding)
    await shotMenu(page, img('s10-menu-language'), MENU.language)
    await shotMenu(page, img('s19-menu-help'), MENU.help)

    // --- Bandeiras dos idiomas
    await shot(page, img('s08-flags'), { clip: { x: 640, y: 40, width: 480, height: 50 } })

    // --- Caracteres invisíveis num documento de texto
    await page.getByRole('button', { name: t('toolbar.newTypeChoose') }).click()
    await page.getByRole('menuitem', { name: new RegExp(`^\\.txt`) }).click()
    await page.locator('.monaco-editor').click()
    await page.keyboard.insertText(demo.scratch)
    await page.locator('nav button').nth(MENU.view).click()
    await page.getByRole('menuitem', { name: t('menu.view.invisibles') }).click()
    await sleep(400)
    await shot(page, img('s11-invisibles'), { clip: { x: 300, y: 85, width: 820, height: 200 } })
    await page.locator('nav button').nth(MENU.view).click()
    await page.getByRole('menuitem', { name: t('menu.view.invisibles') }).click()

    // --- Corretor ortográfico: palavra sublinhada e as sugestões (Ctrl+.)
    await page.locator('.monaco-editor').click()
    await page.keyboard.press('Control+A')
    await page.keyboard.insertText(demo.typo.text)
    await page.locator('.monaco-editor .squiggly-info').first().waitFor()
    await page.keyboard.press('Control+Home')
    for (let i = 0; i <= demo.typo.text.indexOf(demo.typo.word); i++) await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Control+.')
    await page.locator('.action-widget').first().waitFor()
    await sleep(300)
    await shot(page, img('s11a-spelling'), { clip: { x: 300, y: 85, width: 820, height: 300 } })
    await page.keyboard.press('Escape')

    // --- Snippets
    await page.locator('nav button').nth(MENU.tools).click()
    await page.getByRole('menuitem', { name: t('menu.tools.snippets') }).click()
    await page.getByRole('dialog').getByRole('button').nth(1).click()
    await shotDialog(page, img('s12-snippets'))

    // --- Macros: grava uma sequência e abre a janela
    await page.locator('.monaco-editor').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.press('Control+Shift+R')
    await page.keyboard.type('OK')
    await page.keyboard.press('Control+Shift+R')
    await page.locator('nav button').nth(MENU.tools).click()
    await page.getByRole('menuitem', { name: t('menu.tools.macros') }).click()
    await shotDialog(page, img('s13-macros'))

    // --- Menu Editar com o submenu "Converter letras para" aberto
    await openMenu(page, MENU.edit)
    await page.getByRole('menuitem', { name: t('menu.edit.case') }).hover()
    const caseMenu = page.getByRole('menu', { name: t('menu.edit.case') })
    await caseMenu.waitFor()
    await sleep(200)
    const editBox = (await page.getByRole('menu', { name: t('menu.edit'), exact: true }).boundingBox())!
    const caseBox = (await caseMenu.boundingBox())!
    await shot(page, img('s20-menu-edit'), {
      clip: { x: 0, y: 0, width: Math.min(caseBox.x + caseBox.width + 24, 1100), height: Math.min(Math.max(editBox.y + editBox.height, caseBox.y + caseBox.height) + 16, 700) }
    })
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await sleep(150)

    // --- MD5 e SHA: janela "Gerar SHA-256" com um texto
    await page.locator('nav button').nth(MENU.tools).click()
    await page.getByRole('menuitem', { name: 'SHA-256' }).hover()
    await page.getByRole('menuitem', { name: t('menu.tools.hashGenerate'), exact: true }).click()
    await page.getByRole('dialog').locator('textarea').first().fill('Meu Editor de Arquivos')
    await sleep(300)
    await shotDialog(page, img('s21-hash'))

    // --- Modo escuro: a janela inteira, e depois volta ao claro
    await page.locator('nav button').nth(MENU.view).click()
    await page.getByRole('menuitem', { name: t('menu.view.toggleTheme') }).click()
    await sleep(500)
    await shot(page, img('s22-dark-mode'))
    await page.locator('nav button').nth(MENU.view).click()
    await page.getByRole('menuitem', { name: t('menu.view.toggleTheme') }).click()
    await sleep(300)

    // --- Atalhos e Sobre
    await page.locator('nav button').nth(MENU.help).click()
    await page.getByRole('menuitem', { name: t('menu.help.shortcuts') }).click()
    await shotDialog(page, img('s14-shortcuts'))
    await page.locator('nav button').nth(MENU.help).click()
    await page.getByRole('menuitem', { name: t('menu.help.about') }).click()
    await shotDialog(page, img('s15-about'))

    // --- Cliente de API: requisição enviada a um servidor HTTP local (respostas fixas, sem internet) e um ambiente
    // O painel inferior (da captura da busca) cobriria a resposta.
    const closePanel = page.getByRole('button', { name: t('bottom.close'), exact: true })
    if (await closePanel.isVisible()) await closePanel.click()
    await page.keyboard.press('Control+Shift+A')
    const apiView = page.getByTestId('api-request')
    await apiView.waitFor()
    await apiView.getByLabel(t('apiClient.url'), { exact: true }).fill(`http://127.0.0.1:${(sample.address() as { port: number }).port}/customers/42`)
    await page.getByTestId('api-send').click()
    await page.getByTestId('api-status').filter({ hasText: '200' }).waitFor()
    await page.getByTestId('api-response').getByRole('treeitem').first().waitFor()
    await shot(page, img('s23-api-request'))
    await page.locator('nav button').nth(MENU.tools).click()
    await page.getByRole('menuitem', { name: t('menu.tools.apiSubmenu') }).click()
    await page.getByRole('menuitem', { name: t('menu.tools.apiEnvironments') }).click()
    await page.getByTestId('api-environment').waitFor()
    await page.getByLabel(t('apiClient.env.name'), { exact: true }).fill(locale.startsWith('pt') ? 'Homologação' : 'Staging')
    await page.getByRole('button', { name: t('apiClient.env.add') }).click()
    await page.getByLabel(t('apiClient.env.keyN', { n: 1 })).fill('baseUrl')
    await page.getByLabel(t('apiClient.env.valueN', { n: 1 })).fill('https://api.example.com')
    await page.getByRole('button', { name: t('apiClient.env.add') }).click()
    await page.getByLabel(t('apiClient.env.keyN', { n: 2 })).fill('token')
    await page.getByLabel(t('apiClient.env.secretN', { n: 2 })).check()
    await page.getByLabel(t('apiClient.env.valueN', { n: 2 })).fill('valor-de-exemplo')
    await shot(page, img('s24-api-environment'))

    // --- Assistente de IA (Ollama falso local): pergunta sobre o documento Markdown aberto
    await page.getByRole('tab').filter({ hasText: demo.md.name }).first().click()
    await page.keyboard.press('Control+Shift+I')
    const aiPanel = page.getByTestId('ai-panel')
    await aiPanel.getByTestId('ai-status').and(page.locator('[data-state=ok]')).waitFor()
    await aiPanel.getByLabel(t('ai.input.label')).fill(extras.question)
    await aiPanel.getByTestId('ai-send').click()
    await aiPanel.getByTestId('ai-assistant-message').filter({ hasText: extras.answer.split('\n').pop()!.replace(/\*\*/g, '').slice(-20) }).waitFor()
    await aiPanel.getByTestId('ai-send').waitFor()
    await shot(page, img('s25-ai-assistant'))
    await aiPanel.getByRole('button', { name: t('ai.close') }).first().click()

    // --- Conta e nuvem (API de teste em memória)
    // Primeiro acesso: o aplicativo pede o endereço do servidor; depois mostra a tela de entrada.
    await page.locator('nav button').nth(MENU.account).click()
    await page.getByRole('menuitem', { name: t('menu.account.signIn') }).click()
    await page.getByRole('dialog').getByLabel(t('account.serverUrl'), { exact: true }).fill(`http://localhost:${API_PORT}`)
    await shot(page, img('s16a-account-server'), page.getByRole('dialog'))
    await page.getByRole('dialog').getByRole('button', { name: t('account.submit.server') }).click()
    await page.getByRole('button', { name: t('account.link.register') }).waitFor()
    await shot(page, img('s16-account-login'), page.getByRole('dialog'))
    // A conta é criada no site (o aplicativo só entra): a conta de demonstração é criada direto na API de teste.
    await fetch(`http://127.0.0.1:${API_PORT}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: demo.user.email, name: demo.user.name, password: demo.user.password })
    })
    await page.getByRole('dialog').getByLabel(t('account.email'), { exact: true }).fill(demo.user.email)
    await page.getByRole('dialog').getByLabel(t('account.password'), { exact: true }).fill(demo.user.password)
    await page.getByRole('dialog').getByRole('button', { name: t('account.submit.login') }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.evaluate(
      async ({ path, text }) => {
        const api = (window as unknown as { api: { cloudSave(r: object): Promise<unknown> } }).api
        await api.cloudSave({ path, content: text, encoding: 'UTF-8', baseVersion: null, force: false })
      },
      { path: demo.cloudPath, text: demo.cloudText }
    )
    await page.locator('nav button').nth(MENU.file).click()
    await page.getByRole('menuitem', { name: t('menu.file.openCloud') }).click()
    await page.getByRole('tree', { name: t('cloud.list') }).getByRole('treeitem').first().waitFor()
    await shotDialog(page, img('s17-cloud-open'))
    await page.locator('nav button').nth(MENU.account).click()
    await page.getByRole('menuitem', { name: new RegExp(demo.user.name) }).click()
    await shotDialog(page, img('s18-account-profile'))

    // --- Arquivos na nuvem: pastas na barra lateral, documento da nuvem aberto e o espaço usado no rodapé
    await page.evaluate(async (files) => {
      const api = (window as unknown as { api: { cloudSave(r: object): Promise<unknown> } }).api
      for (const f of files) await api.cloudSave({ path: f.path, content: f.text, encoding: 'UTF-8', baseVersion: null, force: false })
    }, [
      // O primeiro arquivo ganha volume (o espaço usado aparece em MB); um script Python e uma requisição de API
      // completam a variedade de ícones.
      { ...extras.cloud[0], text: extras.cloud[0].text + 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n'.repeat(6000) },
      ...extras.cloud.slice(1),
      { path: `${extras.cloud[2].path.split('/')[0]}/main.py`, text: 'print("Meu Editor de Arquivos")\n' },
      { path: `${extras.cloud[2].path.split('/').slice(0, -1).join('/')}/clientes.apireq`, text: '{}\n' }
    ])
    await page.locator('nav button').nth(MENU.file).click()
    await page.getByRole('menuitem', { name: t('menu.file.openCloud') }).click()
    const cloudTree = page.getByRole('dialog').getByTestId('cloud-open-tree')
    const cloudFile = cloudTree.getByRole('button', { name: new RegExp('^' + demo.cloudPath.split('/').pop()!.replace('.', '\\.')) })
    // Janela "Abrir da nuvem" com o resumo, o plano e todas as pastas abertas (usada no site).
    for (let i = 0; i < 10; i++) {
      const closed = cloudTree.locator('[role=treeitem][aria-expanded="false"]')
      if ((await closed.count()) === 0) break
      await closed.first().locator('> div').first().click()
    }
    await cloudFile.waitFor()
    await shot(page, img('s27-cloud-open-tree'), page.getByRole('dialog'))
    await cloudFile.dblclick()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    await page.getByTestId('cloud-usage').waitFor()
    // Só a área da nuvem aberta na barra lateral, com as pastas expandidas.
    const openHeads = page.locator('aside section[data-section]:not([data-section="cloud"]) > :first-child button[aria-expanded="true"]')
    for (let i = 0; i < 10 && (await openHeads.count()) > 0; i++) await openHeads.first().click()
    const cloudSection = page.locator('aside section[data-section="cloud"]')
    for (const f of [...extras.cloud.map((c) => c.path), demo.cloudPath]) {
      const name = f.split('/')[0]
      const folderRow = cloudSection.getByRole('treeitem', { name, exact: true }).first()
      if ((await folderRow.count()) > 0 && (await folderRow.getAttribute('aria-expanded')) === 'false') await cloudSection.getByRole('button', { name, exact: true }).first().click()
    }
    await shot(page, img('s26-cloud-files'))

  } finally {
    await stubMessageBox(app).catch(() => undefined)
    await app.close().catch(() => undefined)
    stopApi(api)
    sample.close()
    ollama.close()
    rmSync(work, { recursive: true, force: true })
  }
}

const wanted = process.argv.slice(2)
const all = Object.keys(DEMOS) as Locale[]
for (const locale of all) {
  if (wanted.length === 0 || wanted.includes(locale)) await captureLocale(locale)
}
console.log('\nTelas geradas em', OUT)
