// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Documentação de uma coleção em Markdown: endpoints, parâmetros, cabeçalhos, corpo de exemplo e tabela
 * de testes. Gera só texto (roda no Renderer). Nada sensível sai: Authorization e cabeçalhos parecidos
 * ficam mascarados, a autorização mostra só o tipo, e variáveis secretas aparecem sem valor.
 */
import type { CollectionTree } from './collectionTypes'
import { MASK } from './protocol'
import type { Assertion } from './schema'

export const DOC_LABEL_KEYS = [
  'title',
  'index',
  'variables',
  'variable',
  'value',
  'secret',
  'description',
  'url',
  'auth',
  'params',
  'headers',
  'name',
  'body',
  'bodyExample',
  'tests',
  'target',
  'condition',
  'expected',
  'extractions',
  'extractFrom',
  'extractTo',
  'noRequests',
  'root'
] as const
export type DocLabels = Record<(typeof DOC_LABEL_KEYS)[number], string>

export const DEFAULT_DOC_LABELS: DocLabels = {
  title: 'Documentação da API',
  index: 'Índice',
  variables: 'Variáveis da coleção',
  variable: 'Variável',
  value: 'Valor',
  secret: 'secreta',
  description: 'Descrição',
  url: 'URL',
  auth: 'Autorização',
  params: 'Parâmetros',
  headers: 'Cabeçalhos',
  name: 'Nome',
  body: 'Corpo',
  bodyExample: 'Exemplo de corpo',
  tests: 'Testes',
  target: 'Alvo',
  condition: 'Condição',
  expected: 'Esperado',
  extractions: 'Extrações',
  extractFrom: 'Origem',
  extractTo: 'Variável',
  noRequests: 'Nenhuma requisição na coleção.',
  root: 'Raiz'
}

/** Cabeçalhos cujo valor nunca aparece na documentação. */
const SENSITIVE_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie)$|token|secret|api[-_]?key|password|passwd/i

const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
const code = (s: string): string => (s === '' ? '' : `\`${s.replace(/`/g, "'").replace(/\r?\n/g, ' ')}\``)

function table(head: string[], rows: string[][]): string[] {
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`), '']
}

const expectedText = (e: Assertion['expected']): string => {
  if (e === undefined) return ''
  if (Array.isArray(e)) return e.join(', ')
  return String(e)
}

function describeTarget(a: Assertion): string {
  const extra = a.target === 'header' || a.target === 'cookie' ? a.name : a.path
  return extra ? `${a.target} ${extra}` : a.target
}

/** Âncora no estilo do GitHub: minúsculas, sem pontuação, espaços viram hífen. */
const anchor = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')

export function generateCollectionMarkdown(tree: CollectionTree, labels: Partial<DocLabels> = {}): string {
  const l = { ...DEFAULT_DOC_LABELS, ...labels }
  const col = tree.collection
  const fallbackName = tree.dir.split(/[\\/]/).filter(Boolean).pop() ?? l.title
  const out: string[] = [`# ${col?.name || fallbackName}`, '']
  if (col?.description) out.push(col.description.trim(), '')

  const vars = col?.variables ?? []
  if (vars.length) {
    out.push(`## ${l.variables}`, '')
    out.push(
      ...table(
        [l.variable, l.value, l.description],
        vars.map((v) => [code(v.key), v.secret ? `*${esc(l.secret)}*` : code(esc(v.value ?? '')), esc(v.description ?? '')])
      )
    )
  }

  if (tree.requests.length === 0) {
    out.push(l.noRequests, '')
    return `${out.join('\n')}\n`
  }

  // Agrupa por pasta, na ordem em que as requisições chegam.
  const groups = new Map<string, typeof tree.requests>()
  for (const r of tree.requests) {
    const list = groups.get(r.folder)
    if (list) list.push(r)
    else groups.set(r.folder, [r])
  }

  out.push(`## ${l.index}`, '')
  for (const [folder, list] of groups) {
    if (folder) out.push(`- ${folder}`)
    for (const r of list) {
      const title = `${r.request.method} ${r.request.name || r.request.url || r.path}`
      out.push(`${folder ? '  ' : ''}- [${esc(title)}](#${anchor(title)})`)
    }
  }
  out.push('')

  for (const [folder, list] of groups) {
    out.push(`## ${folder || l.root}`, '')
    for (const { request: req } of list) {
      out.push(`### ${req.method} ${req.name || req.url || ''}`.trimEnd(), '')
      if (req.description) out.push(req.description.trim(), '')
      out.push(`**${l.url}:** ${code(req.url)}`, '')
      if (req.auth.type !== 'none') out.push(`**${l.auth}:** ${code(req.auth.type)}`, '')

      const params = req.params.filter((p) => p.enabled && p.key)
      if (params.length) {
        out.push(`**${l.params}**`, '')
        out.push(...table([l.name, l.value, l.description], params.map((p) => [code(p.key), code(SENSITIVE_HEADER.test(p.key) ? MASK : esc(p.value)), esc(p.description ?? '')])))
      }

      const headers = req.headers.filter((h) => h.enabled && h.key)
      if (headers.length) {
        out.push(`**${l.headers}**`, '')
        out.push(
          ...table(
            [l.name, l.value, l.description],
            headers.map((h) => [code(h.key), code(SENSITIVE_HEADER.test(h.key) ? MASK : esc(h.value)), esc(h.description ?? '')])
          )
        )
      }

      const b = req.body
      let example: { lang: string; text: string } | null = null
      if (b.type === 'raw' && b.text.trim()) example = { lang: b.language === 'text' ? '' : b.language, text: b.text }
      else if (b.type === 'graphql' && b.query.trim()) example = { lang: 'graphql', text: b.variables.trim() ? `${b.query}\n\n# variables\n${b.variables}` : b.query }
      else if (b.type === 'soap' && b.envelope.trim()) example = { lang: 'xml', text: b.envelope }
      else if (b.type === 'urlencoded') {
        const f = b.fields.filter((x) => x.enabled && x.key)
        if (f.length) example = { lang: '', text: f.map((x) => `${x.key}=${x.value}`).join('\n') }
      } else if (b.type === 'multipart') {
        const p = b.parts.filter((x) => x.enabled && x.key)
        if (p.length) example = { lang: '', text: p.map((x) => (x.kind === 'file' ? `${x.key}=@file` : `${x.key}=${x.value}`)).join('\n') }
      }
      if (example) {
        // Cerca maior que qualquer sequência de crases do corpo.
        const longest = Math.max(2, ...(example.text.match(/`+/g) ?? []).map((m) => m.length))
        const fence = '`'.repeat(longest + 1)
        out.push(`**${l.bodyExample}** (${b.type})`, '', `${fence}${example.lang}`, example.text.replace(/\s+$/, ''), fence, '')
      }

      const tests = req.tests.filter((t) => t.enabled)
      if (tests.length) {
        out.push(`**${l.tests}**`, '')
        out.push(...table([l.target, l.condition, l.expected], tests.map((t) => [esc(describeTarget(t)), esc(t.op), code(esc(expectedText(t.expected)))])))
      }

      const extracts = req.extract.filter((x) => x.enabled)
      if (extracts.length) {
        out.push(`**${l.extractions}**`, '')
        out.push(...table([l.extractFrom, l.extractTo], extracts.map((x) => [esc(`${x.from} ${x.path}`.trim()), code(x.to)])))
      }
    }
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n')}\n`
}
