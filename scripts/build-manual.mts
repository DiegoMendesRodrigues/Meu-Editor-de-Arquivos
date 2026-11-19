// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Gera o manual do usuário em HTML, um por idioma, a partir de docs/manual/src/<idioma>.md.
 *
 * - {{chave}} vira o texto exato que aparece na tela do aplicativo naquele idioma (menus, botões...),
 *   para o manual nunca divergir da interface;
 * - {{shortcuts}} vira as tabelas de atalhos;
 * - confere se todas as imagens existem e se os seis manuais têm a mesma estrutura.
 *
 * Uso: npx tsx scripts/build-manual.mts      (antes, as telas: npx tsx scripts/capture-manual.mts)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Marked } from 'marked'
import { shortcutGroups } from '../src/renderer/src/shortcuts.ts'
import { LOCALES, translate, type Locale, type MessageKey } from '../src/shared/i18n/index.ts'

const ROOT = resolve('docs/manual')
const VERSION = (JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }).version

const TOC_TITLE: Record<Locale, string> = {
  'pt-BR': 'Neste manual',
  en: 'In this manual',
  de: 'In diesem Handbuch',
  es: 'En este manual',
  fr: 'Dans ce manuel',
  'pt-PT': 'Neste manual'
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** O marked devolve texto com entidades (&#39;, &amp;...); o sumário precisa do texto puro. */
const decodeEntities = (s: string): string =>
  s.replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n))).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const CSS = `
:root{--ink:#1f2933;--muted:#5b6770;--line:#d9e0e6;--accent:#1e7be0;--bg:#fff;--soft:#f3f6f9}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 "Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif}
.layout{display:flex;gap:40px;max-width:1180px;margin:0 auto;padding:24px 24px 80px}
nav.toc{position:sticky;top:16px;align-self:flex-start;width:260px;flex:none;max-height:calc(100vh - 32px);overflow:auto;font-size:14px}
nav.toc h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
nav.toc ol{list-style:none;margin:0;padding:0}nav.toc li{margin:0}
nav.toc a{display:block;padding:5px 10px;border-left:3px solid transparent;color:var(--ink);text-decoration:none;border-radius:0 6px 6px 0}
nav.toc a:hover{background:var(--soft);border-left-color:var(--accent)}
main{min-width:0;flex:1;max-width:860px}
h1{font-size:2rem;line-height:1.25;margin:.2em 0 .1em}
main>p:first-of-type{color:var(--muted);margin-top:0}
h2{font-size:1.45rem;margin:2.2em 0 .6em;padding-top:.6em;border-top:1px solid var(--line)}
h3{font-size:1.05rem;margin:1.4em 0 .4em}
p,li{max-width:70ch}li{margin:.3em 0}
a{color:var(--accent)}
code{background:var(--soft);border:1px solid var(--line);border-radius:4px;padding:.05em .35em;font:.92em Consolas,"Cascadia Mono",monospace}
.ui{font-weight:600;color:#0f4c92;background:#e8f1fc;border-radius:4px;padding:0 .3em}
blockquote{margin:1em 0;padding:.2em 1em;border-left:4px solid var(--accent);background:var(--soft);color:var(--muted)}
figure{margin:1.2em 0 1.6em}
figure img{display:block;max-width:100%;height:auto;border:1px solid var(--line);border-radius:8px;box-shadow:0 2px 10px rgba(15,40,70,.12)}
figcaption{margin-top:.5em;font-size:.88rem;color:var(--muted)}
table{border-collapse:collapse;width:100%;margin:.6em 0 1.2em;font-size:.95rem}
th,td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--soft)}
kbd{font:.88em Consolas,"Cascadia Mono",monospace;background:#fff;border:1px solid #b9c4cd;border-bottom-width:2px;border-radius:5px;padding:.05em .45em;white-space:nowrap}
td:first-child{white-space:nowrap}
strong{font-weight:650}
@media (max-width:900px){.layout{display:block}nav.toc{position:static;width:auto;max-height:none;margin-bottom:24px}}
@media print{nav.toc{display:none}.layout{display:block;padding:0}figure{break-inside:avoid}h2{break-after:avoid}}
`

function shortcutsHtml(locale: Locale): string {
  const t = (key: MessageKey, params?: Record<string, string | number>): string => translate(locale, key, params)
  return shortcutGroups(t)
    .map((group) => {
      const rows = group.items
        .map((item) => `<tr><td>${item.keys.split(' / ').map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join(' / ')}</td><td>${escapeHtml(item.action)}</td></tr>`)
        .join('')
      return `<h3>${escapeHtml(group.title)}</h3><table><tbody>${rows}</tbody></table>`
    })
    .join('\n')
}

/** Substitui {{chave}} pelo texto da interface; devolve o texto e as chaves que não existem. */
function fillPlaceholders(markdown: string, locale: Locale): { text: string; missing: string[] } {
  const missing: string[] = []
  const text = markdown.replace(/\{\{([\w.]+)\}\}/g, (_all, key: string) => {
    if (key === 'shortcuts') return `\n\n<!--SHORTCUTS-->\n\n`
    if (key === 'version') return VERSION
    const label = translate(locale, key as MessageKey)
    if (label === key) {
      missing.push(key)
      return key
    }
    // "Abrir..." no menu é "Abrir" no texto corrido
    return `<span class="ui">${escapeHtml(label.replace(/(\.\.\.|…)$/, ''))}</span>`
  })
  return { text, missing }
}

const problems: string[] = []
const structure = new Map<Locale, { headings: number; images: string[] }>()

for (const { code: locale } of LOCALES) {
  const file = join(ROOT, 'src', `${locale}.md`)
  if (!existsSync(file)) {
    problems.push(`${locale}: falta ${file}`)
    continue
  }
  const { text, missing } = fillPlaceholders(readFileSync(file, 'utf8'), locale)
  for (const key of missing) problems.push(`${locale}: chave inexistente {{${key}}}`)

  const images: string[] = []
  const headings: { id: string; text: string }[] = []
  const marked = new Marked({ gfm: true })
  marked.use({
    renderer: {
      image({ href, text: alt }) {
        images.push(href)
        if (!existsSync(join(ROOT, locale, href))) problems.push(`${locale}: imagem ausente ${href}`)
        return `<figure><img src="${escapeHtml(href)}" alt="${escapeHtml(alt)}"><figcaption>${escapeHtml(alt)}</figcaption></figure>`
      },
      paragraph({ tokens }) {
        const inner = this.parser.parseInline(tokens)
        // uma imagem sozinha no parágrafo vira <figure> (não pode ficar dentro de <p>)
        return inner.startsWith('<figure') ? inner : `<p>${inner}</p>\n`
      },
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens)
        const plain = decodeEntities(inner.replace(/<[^>]+>/g, ''))
        if (depth === 2) {
          const id = slug(plain)
          headings.push({ id, text: plain })
          return `<h2 id="${id}">${inner}</h2>\n`
        }
        return `<h${depth}>${inner}</h${depth}>\n`
      }
    }
  })

  let body = await marked.parse(text)
  body = body.replace('<!--SHORTCUTS-->', shortcutsHtml(locale))

  const title = /^# (.+)$/m.exec(text)?.[1] ?? 'Meu Editor de Arquivos'
  const toc = headings.map((h) => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`).join('')

  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'">
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="layout">
<nav class="toc" aria-label="${escapeHtml(TOC_TITLE[locale])}">
<h2>${escapeHtml(TOC_TITLE[locale])}</h2>
<ol>${toc}</ol>
</nav>
<main>
${body}
</main>
</div>
</body>
</html>
`
  writeFileSync(join(ROOT, locale, 'index.html'), html, 'utf8')
  structure.set(locale, { headings: headings.length, images })
  console.log(`${locale}: ${headings.length} seções, ${images.length} imagens`)
}

// Os seis manuais precisam ter a mesma estrutura: mesmas seções e as mesmas telas, na mesma ordem.
const reference = structure.get('pt-BR')
if (reference) {
  for (const [locale, s] of structure) {
    if (s.headings !== reference.headings) problems.push(`${locale}: ${s.headings} seções (pt-BR tem ${reference.headings})`)
    if (s.images.join('|') !== reference.images.join('|')) problems.push(`${locale}: imagens diferentes das do pt-BR`)
  }
}

if (problems.length > 0) {
  console.error('\nProblemas encontrados:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('\nManuais gerados em', ROOT)
