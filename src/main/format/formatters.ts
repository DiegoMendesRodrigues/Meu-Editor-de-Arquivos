// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Auto formatação no padrão de cada linguagem, sem internet: Prettier (web, Markdown, YAML, PHP, XML),
 * clang-format (C, C++, C#, Java), Ruff (Python, padrão PEP 8/Black), gofmt (Go), lua_fmt (Lua),
 * shfmt (Shell) e sql-formatter (SQL). Os formatadores são carregados só quando usados.
 * Roda na thread de formatação (formatWorker.ts), nunca direto no processo principal.
 */
import type { Plugin } from 'prettier'
import type { FormatResult } from '@shared/ipc'
import { guessPythonIndentation } from './pythonIndent'

type Formatter = (text: string, extension: string) => Promise<string>

/** Prettier com o analisador da linguagem (os plugins de PHP e XML vêm à parte). */
function prettier(parser: string, plugin?: 'php' | 'xml'): Formatter {
  return async (text, extension) => {
    const { format } = await import('prettier')
    const mod: unknown = plugin === 'php' ? await import('@prettier/plugin-php') : plugin === 'xml' ? await import('@prettier/plugin-xml') : null
    const plugins = mod ? [((mod as { default?: Plugin }).default ?? mod) as Plugin] : []
    // TSX/JSX precisam do nome do arquivo para o analisador aceitar as tags.
    const filepath = extension === 'tsx' || extension === 'jsx' ? `documento.${extension}` : undefined
    return format(text, { parser, filepath, plugins, ...(plugin === 'xml' ? { xmlWhitespaceSensitivity: 'ignore' } : {}) })
  }
}

/** clang-format: o nome do arquivo escolhe a linguagem; o estilo segue a convenção mais usada de cada uma. */
function clang(filename: string, style: string): Formatter {
  return async (text) => (await import('@wasm-fmt/clang-format')).format(text, filename, style)
}

const FORMATTERS: Record<string, Formatter> = {
  javascript: prettier('babel'),
  typescript: prettier('typescript'),
  json: prettier('json'),
  css: prettier('css'),
  scss: prettier('scss'),
  less: prettier('less'),
  html: prettier('html'),
  markdown: prettier('markdown'),
  yaml: prettier('yaml'),
  php: prettier('php', 'php'),
  xml: prettier('xml', 'xml'),
  c: clang('main.c', 'LLVM'),
  cpp: clang('main.cpp', 'LLVM'),
  java: clang('main.java', 'Google'),
  csharp: clang('main.cs', 'Microsoft'),
  // Aspas como o autor escreveu (o resto segue o padrão PEP 8/Black).
  python: async (text) => (await import('@wasm-fmt/ruff_fmt')).format(text, null, { quote_style: 'preserve' }),
  go: async (text) => (await import('@wasm-fmt/gofmt')).format(text),
  lua: async (text) => (await import('@wasm-fmt/lua_fmt')).format(text),
  shell: async (text) => (await import('@wasm-fmt/shfmt')).format(text, 'script.sh'),
  sql: async (text) => (await import('sql-formatter')).format(text, { language: 'sql', keywordCase: 'upper' })
}

/** Linha do erro, quando o formatador informa: Prettier (loc.start.line) ou Ruff ("byte range 18..20"). */
export function errorLine(err: unknown, text: string): number | undefined {
  const loc = (err as { loc?: { start?: { line?: unknown } } } | null)?.loc?.start?.line
  if (typeof loc === 'number') return loc
  const range = /byte range (\d+)\.\./.exec(String(err))
  if (!range) return undefined
  // O Ruff conta bytes UTF-8 desde o início do texto.
  const before = Buffer.from(text, 'utf8').subarray(0, Number(range[1])).toString('utf8')
  return before.split('\n').length
}

/**
 * Formata o texto; erro do formatador (código com erro de sintaxe, por exemplo) vira 'invalid'.
 * No Python, se o código for recusado, tenta de novo com a indentação deduzida (pythonIndent.ts).
 */
export async function formatSource(language: string, extension: string, text: string): Promise<FormatResult> {
  const formatter = FORMATTERS[language]
  if (!formatter) return { status: 'unsupported' }
  try {
    return { status: 'ok', text: await formatter(text, extension) }
  } catch (err) {
    if (language === 'python') {
      const guessed = guessPythonIndentation(text)
      if (guessed !== text) {
        try {
          return { status: 'ok', text: await formatter(guessed, extension), guessedIndent: true }
        } catch {
          // Nem com a indentação deduzida: informa o erro do código original.
        }
      }
    }
    return { status: 'invalid', line: errorLine(err, text) }
  }
}
