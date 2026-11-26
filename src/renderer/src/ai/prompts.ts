// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { Locale } from '@shared/i18n'

/**
 * Textos enviados ao modelo. Ficam em inglês (os modelos locais seguem melhor) e pedem a resposta no
 * idioma da interface. Aqui só entra o que já foi mascarado ou escolhido pelo usuário.
 */

/** Limites do que as ações rápidas enviam: modelos locais têm contexto pequeno. */
export const QUICK_CONTEXT_CHARS = 12_000
export const API_BODY_CHARS = 4_000

export const QUICK_ACTIONS = ['explain', 'improve', 'fix', 'summarize', 'translate', 'document', 'tests'] as const
export type QuickAction = (typeof QUICK_ACTIONS)[number]

const LANGUAGE_NAMES: Record<Locale, string> = {
  'pt-BR': 'Brazilian Portuguese',
  'pt-PT': 'European Portuguese',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German'
}

export const languageName = (locale: Locale): string => LANGUAGE_NAMES[locale]

export const systemPrompt = (locale: Locale): string =>
  `You are an assistant built into a text and code editor. Answer in ${languageName(locale)}, concisely and accurately. ` +
  'Put code and file content in fenced code blocks that carry the language name. Do not invent facts about the content you were given.'

/** Cerca de código mais longa que qualquer sequência de crases do texto. */
export function fenced(text: string, lang = ''): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((m) => m.length))
  const fence = '`'.repeat(Math.max(3, longest + 1))
  return `${fence}${lang}\n${text}\n${fence}`
}

export interface DocContext {
  name: string
  language: string
  scope: 'selection' | 'document'
  text: string
  /** O texto foi cortado em QUICK_CONTEXT_CHARS. */
  truncated: boolean
}

/** Corta o texto no limite e diz se cortou. */
export function limitText(text: string, max: number): { text: string; truncated: boolean } {
  return text.length > max ? { text: text.slice(0, max), truncated: true } : { text, truncated: false }
}

const INSTRUCTIONS: Record<QuickAction, (subject: string, uiLanguage: string) => string> = {
  explain: (s) => `Explain what ${s} does or says, step by step, in simple terms.`,
  improve: (s) => `Improve the writing of ${s}: clarity, grammar and style, keeping the meaning and the format. Return the improved text in a code block, then list the main changes briefly.`,
  fix: (s) => `Find and fix errors in ${s} (bugs, syntax, spelling or grammar, as applicable). Return the corrected version in a code block, then list what you changed and why.`,
  summarize: (s) => `Summarize ${s} in a few short bullet points.`,
  translate: (s, lang) => `Translate ${s} into ${lang}. Keep the format and do not translate code, identifiers or technical names. Return only the translation in a code block.`,
  document: (s) => `Write comments and documentation for ${s} in the conventions of its language (docstrings, JSDoc or similar). Return the documented code in a code block.`,
  tests: (s) => `Write unit tests for ${s}, using the most common test framework of its language. Return the tests in a code block and mention any assumption.`
}

/** Pedido de uma ação rápida sobre a seleção ou o documento (com o nome e a linguagem no contexto). */
export function buildQuickPrompt(action: QuickAction, ctx: DocContext, locale: Locale): string {
  const subject = ctx.scope === 'selection' ? 'the selected excerpt below' : 'the document below'
  const head = `${INSTRUCTIONS[action](subject, languageName(locale))}\n\nFile: ${ctx.name || 'untitled'}\nLanguage: ${ctx.language || 'plain text'}\nContent:`
  const tail = ctx.truncated ? `\n\n(The content was cut to the first ${QUICK_CONTEXT_CHARS} characters.)` : ''
  return `${head}\n${fenced(ctx.text, ctx.language === 'plaintext' ? '' : ctx.language)}${tail}`
}

/* ------------------------------------------------------------------ Cliente de API */

export interface ApiExchange {
  /** A requisição enviada: URL e cabeçalhos já mascarados pelo Main. */
  request: { method: string; url: string; headers: { key: string; value: string }[] }
  status: number
  statusText: string
  responseHeaders: { key: string; value: string }[]
  contentType: string
  bodyText: string
  bodyTruncated: boolean
  binary: boolean
}

const SENSITIVE_HEADERS = /^(set-cookie|cookie|authorization|proxy-authorization|x-api-key)$/i

const headerLines = (headers: { key: string; value: string }[]): string =>
  headers
    .filter((h) => !SENSITIVE_HEADERS.test(h.key))
    .slice(0, 40)
    .map((h) => `${h.key}: ${h.value.slice(0, 200)}`)
    .join('\n') || '(none)'

function exchangeText(x: ApiExchange): string {
  const { text, truncated } = limitText(x.bodyText, API_BODY_CHARS)
  const body = x.binary ? '(binary body, not shown)' : text === '' ? '(empty)' : fenced(text, /json/i.test(x.contentType) ? 'json' : '')
  const cut = truncated || x.bodyTruncated ? '\n(The body was cut; it is not complete.)' : ''
  return [
    `Request: ${x.request.method} ${x.request.url}`,
    `Request headers (secret values are masked):\n${headerLines(x.request.headers)}`,
    `Response: ${x.status} ${x.statusText}`,
    `Response headers:\n${headerLines(x.responseHeaders)}`,
    `Response body (${x.contentType || 'unknown type'}):\n${body}${cut}`
  ].join('\n\n')
}

export function buildApiExplainPrompt(x: ApiExchange): string {
  return `Explain this HTTP exchange: what the request asks for, what the response means (status, headers and body), and any problem or improvement you notice.\n\n${exchangeText(x)}`
}

/** Pede asserções no formato do app (campo "tests" do .apireq), num único bloco JSON. */
export function buildApiTestsPrompt(x: ApiExchange): string {
  return (
    'Suggest automated tests (assertions) for this HTTP exchange, in the exact JSON format below. ' +
    'Answer with ONE json code block holding an array, then one short sentence per assertion explaining it.\n\n' +
    'Format of each assertion: {"target": "status|time|size|header|cookie|body|jsonPath|xPath|jsonSchema", "path": "(jsonPath or xPath expression, only for those targets)", ' +
    '"name": "(header or cookie name, only for those targets)", "op": "eq|neq|contains|notContains|startsWith|matches|gt|gte|lt|lte|exists|notExists|isType|lengthEq|lengthGt|lengthLt|in|matchesSchema", ' +
    '"expected": "(string, number, boolean, null or array)", "enabled": true}\n' +
    'Example: [{"target":"status","op":"eq","expected":200,"enabled":true},{"target":"jsonPath","path":"$.id","op":"exists","enabled":true},{"target":"time","op":"lt","expected":2000,"enabled":true}]\n' +
    'Use only values you can see in the exchange. Prefer stable checks (status, content type, field presence, types) over exact values that change.\n\n' +
    exchangeText(x)
  )
}

/** Documentação de uma coleção: parte do Markdown que o app já gera. */
export function buildCollectionDocPrompt(markdown: string, locale: Locale): string {
  const { text, truncated } = limitText(markdown, QUICK_CONTEXT_CHARS)
  return (
    `Below is the reference of an API collection generated from its requests. Write clear user documentation in ${languageName(locale)}, in Markdown: ` +
    'an overview, how to authenticate (only what appears below), and a short description of each endpoint with a usage example. Do not invent endpoints or fields.\n\n' +
    fenced(text, 'markdown') +
    (truncated ? `\n\n(The reference was cut to the first ${QUICK_CONTEXT_CHARS} characters.)` : '')
  )
}
