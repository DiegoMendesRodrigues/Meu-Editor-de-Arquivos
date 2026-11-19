// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type * as Monaco from 'monaco-editor'
import type { Snippet } from '@shared/ipc'
import { builtinSnippets, useLibrary } from '@/store/library'
import { getActiveEditor } from './editorRef'

export const allSnippets = (): Snippet[] => [...builtinSnippets(), ...useLibrary.getState().snippets]

/** Sugere os snippets (do app e do usuário) no autocompletar de qualquer linguagem. */
export function registerSnippetCompletion(monaco: typeof Monaco): void {
  monaco.languages.registerCompletionItemProvider('*', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      }
      return {
        suggestions: allSnippets().map((s) => ({
          label: s.prefix,
          detail: s.name,
          documentation: { value: '```\n' + s.body + '\n```' },
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: s.body,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range
        }))
      }
    }
  })
}

/** Insere o snippet na posição do cursor do editor ativo; devolve false se não houver editor. */
export function insertSnippet(body: string): boolean {
  const ed = getActiveEditor()
  if (!ed) return false
  ed.focus()
  const controller = ed.getContribution('snippetController2') as { insert(template: string): void } | null
  controller?.insert(body)
  return controller !== null
}
