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
  const app = await electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${userData}`, `--lang=${DEMOS[locale].system}`] })
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

  console.log(`\n== ${locale} ==`)
  let { app, page } = await launch(locale, userData)
  const api = await startApi()
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

    // --- Atalhos e Sobre
    await page.locator('nav button').nth(MENU.help).click()
    await page.getByRole('menuitem', { name: t('menu.help.shortcuts') }).click()
    await shotDialog(page, img('s14-shortcuts'))
    await page.locator('nav button').nth(MENU.help).click()
    await page.getByRole('menuitem', { name: t('menu.help.about') }).click()
    await shotDialog(page, img('s15-about'))

    // --- Conta e nuvem (API de teste em memória)
    // Primeiro acesso: o aplicativo pede o endereço do servidor; depois mostra a tela de entrada.
    await page.locator('nav button').nth(MENU.account).click()
    await page.getByRole('menuitem', { name: t('menu.account.signIn') }).click()
    await page.getByLabel(t('account.serverUrl'), { exact: true }).fill(`http://localhost:${API_PORT}`)
    await shot(page, img('s16a-account-server'), page.getByRole('dialog'))
    await page.getByRole('dialog').getByRole('button', { name: t('account.submit.server') }).click()
    await page.getByRole('button', { name: t('account.link.register') }).waitFor()
    await shot(page, img('s16-account-login'), page.getByRole('dialog'))
    await page.getByRole('button', { name: t('account.link.register') }).click()
    await page.getByLabel(t('account.email'), { exact: true }).fill(demo.user.email)
    await page.getByLabel(t('account.name'), { exact: true }).fill(demo.user.name)
    await page.getByLabel(t('account.newPassword'), { exact: true }).fill(demo.user.password)
    await page.getByLabel(t('account.repeat'), { exact: true }).fill(demo.user.password)
    await page.getByRole('dialog').getByRole('button', { name: t('account.submit.register') }).click()
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
    await page.getByRole('list', { name: t('cloud.list') }).waitFor()
    await shotDialog(page, img('s17-cloud-open'))
    await page.locator('nav button').nth(MENU.account).click()
    await page.getByRole('menuitem', { name: new RegExp(demo.user.name) }).click()
    await shotDialog(page, img('s18-account-profile'))

  } finally {
    await stubMessageBox(app).catch(() => undefined)
    await app.close().catch(() => undefined)
    stopApi(api)
    rmSync(work, { recursive: true, force: true })
  }
}

const wanted = process.argv.slice(2)
const all = Object.keys(DEMOS) as Locale[]
for (const locale of all) {
  if (wanted.length === 0 || wanted.includes(locale)) await captureLocale(locale)
}
console.log('\nTelas geradas em', OUT)
