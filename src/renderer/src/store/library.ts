import { create } from 'zustand'
import type { Macro, MacroStep, Snippet } from '@shared/ipc'

/** Snippets que vêm com o app (somente leitura). O corpo usa a sintaxe de snippets do Monaco. */
export const BUILTIN_SNIPPETS: Snippet[] = [
  { id: 'builtin-data', name: 'Data de hoje', prefix: 'data', body: '$CURRENT_DATE/$CURRENT_MONTH/$CURRENT_YEAR' },
  { id: 'builtin-hora', name: 'Hora atual', prefix: 'hora', body: '$CURRENT_HOUR:$CURRENT_MINUTE' },
  { id: 'builtin-codigo', name: 'Bloco de código (Markdown)', prefix: 'codigo', body: '```${1:linguagem}\n$0\n```' },
  { id: 'builtin-tarefa', name: 'Item de tarefa (Markdown)', prefix: 'tarefa', body: '- [ ] $0' },
  { id: 'builtin-tabela', name: 'Tabela (Markdown)', prefix: 'tabela', body: '| ${1:Coluna 1} | ${2:Coluna 2} |\n| --- | --- |\n| $0 |  |' },
  { id: 'builtin-link', name: 'Link (Markdown)', prefix: 'link', body: '[${1:texto}](${2:https://})$0' },
  { id: 'builtin-cabecalho', name: 'Cabeçalho de documento', prefix: 'cabecalho', body: '# ${1:Título}\n\nData: $CURRENT_DATE/$CURRENT_MONTH/$CURRENT_YEAR\n\n$0' }
]

interface LibraryState {
  loaded: boolean
  snippets: Snippet[]
  macros: Macro[]
  /** Gravação em andamento. */
  recording: boolean
  /** Passos da gravação atual ou da última concluída. */
  steps: MacroStep[]
  load(): Promise<void>
  saveSnippets(items: Snippet[]): Promise<void>
  saveMacros(items: Macro[]): Promise<void>
}

export const useLibrary = create<LibraryState>((set) => ({
  loaded: false,
  snippets: [],
  macros: [],
  recording: false,
  steps: [],
  async load() {
    try {
      const [snippets, macros] = await Promise.all([window.api.loadSnippets(), window.api.loadMacros()])
      set({ snippets, macros, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  async saveSnippets(items) {
    set({ snippets: items })
    await window.api.saveSnippets(items)
  },
  async saveMacros(items) {
    set({ macros: items })
    await window.api.saveMacros(items)
  }
}))

export const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
