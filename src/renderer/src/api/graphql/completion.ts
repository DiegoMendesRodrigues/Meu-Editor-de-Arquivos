// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type * as Monaco from 'monaco-editor'
import { getCompletions, type GqlCompletionKind } from '@shared/api/graphql'
import { getGraphqlModel } from './schemaStore'

type MonacoApi = typeof Monaco

/** Os modelos do editor de query têm este prefixo; o resto do caminho é o id do documento. */
export const GRAPHQL_MODEL_PREFIX = 'inmemory://api-graphql/'
export const graphqlModelPath = (docId: string): string => `${GRAPHQL_MODEL_PREFIX}${docId}.graphql`
const docIdOf = (uri: string): string | null =>
  uri.startsWith(GRAPHQL_MODEL_PREFIX) ? uri.slice(GRAPHQL_MODEL_PREFIX.length).replace(/\.graphql$/, '') : null

/** Há várias abas: o provedor é registrado uma vez e descartado quando a última aba GraphQL sai. */
let refs = 0
let registration: Monaco.IDisposable | null = null

const KIND = (m: MonacoApi, k: GqlCompletionKind): Monaco.languages.CompletionItemKind => {
  switch (k) {
    case 'field':
      return m.languages.CompletionItemKind.Field
    case 'argument':
      return m.languages.CompletionItemKind.Property
    case 'type':
      return m.languages.CompletionItemKind.Class
    case 'enum':
      return m.languages.CompletionItemKind.EnumMember
    default:
      return m.languages.CompletionItemKind.Keyword
  }
}

/** Garante a linguagem 'graphql' (o Monaco costuma trazer; senão, um realce básico por monarch). */
export function ensureGraphqlLanguage(monaco: MonacoApi): void {
  if (monaco.languages.getLanguages().some((l) => l.id === 'graphql')) return
  monaco.languages.register({ id: 'graphql' })
  monaco.languages.setMonarchTokensProvider('graphql', {
    keywords: ['query', 'mutation', 'subscription', 'fragment', 'on', 'type', 'input', 'enum', 'interface', 'union', 'scalar', 'schema', 'extend', 'directive', 'implements', 'true', 'false', 'null'],
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/"""/, { token: 'string', next: '@blockString' }],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/\$[_A-Za-z][_0-9A-Za-z]*/, 'variable'],
        [/@[_A-Za-z][_0-9A-Za-z]*/, 'annotation'],
        [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
        [/[_A-Za-z][_0-9A-Za-z]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
        [/[{}()[\]:=!|&]/, 'delimiter'],
        [/\.\.\./, 'delimiter']
      ],
      blockString: [
        [/[^"]+/, 'string'],
        [/"""/, { token: 'string', next: '@pop' }],
        [/"/, 'string']
      ]
    }
  })
  monaco.languages.setLanguageConfiguration('graphql', {
    comments: { lineComment: '#' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' }
    ],
    surroundingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }]
  })
}

/** Registra o autocompletar (contado por referências). Devolve a função que libera a referência. */
export function acquireGraphqlCompletion(monaco: MonacoApi): () => void {
  ensureGraphqlLanguage(monaco)
  if (refs === 0) {
    registration = monaco.languages.registerCompletionItemProvider('graphql', {
      triggerCharacters: ['{', '(', ' ', ':', '.', '\n'],
      provideCompletionItems(model, position) {
        const docId = docIdOf(model.uri.toString())
        const schema = docId ? getGraphqlModel(docId) : null
        // Sem schema carregado não há o que sugerir (e as palavras-chave de topo só atrapalhariam).
        if (!schema) return { suggestions: [] }
        const word = model.getWordUntilPosition(position)
        const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
        const items = getCompletions(schema, model.getValue(), model.getOffsetAt(position))
        return {
          suggestions: items.map((it, i) => ({
            label: it.label,
            kind: KIND(monaco, it.kind),
            detail: it.detail,
            documentation: it.documentation,
            insertText: it.insertText ?? it.label,
            insertTextRules: it.insertText ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            range,
            sortText: String(i).padStart(4, '0')
          }))
        }
      }
    })
  }
  refs++
  let released = false
  return () => {
    if (released) return
    released = true
    refs--
    if (refs === 0) {
      registration?.dispose()
      registration = null
    }
  }
}
