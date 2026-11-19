// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { Macro, MacroStep, Snippet } from '@shared/ipc'
import { t } from '@/i18n'

/**
 * Snippets que vêm com o app (somente leitura), no idioma atual. O corpo usa a sintaxe de snippets do Monaco.
 * Os atalhos (prefixos) são os mesmos em todos os idiomas.
 */
export function builtinSnippets(): Snippet[] {
  const nl = String.fromCharCode(10)
  const ticks = '```'
  return [
    { id: 'builtin-data', name: t('snippets.builtin.date'), prefix: 'data', body: '$CURRENT_DATE/$CURRENT_MONTH/$CURRENT_YEAR' },
    { id: 'builtin-hora', name: t('snippets.builtin.time'), prefix: 'hora', body: '$CURRENT_HOUR:$CURRENT_MINUTE' },
    { id: 'builtin-codigo', name: t('snippets.builtin.code'), prefix: 'codigo', body: ticks + '${1:' + t('snippets.ph.language') + '}' + nl + '$0' + nl + ticks },
    { id: 'builtin-tarefa', name: t('snippets.builtin.task'), prefix: 'tarefa', body: '- [ ] $0' },
    {
      id: 'builtin-tabela',
      name: t('snippets.builtin.table'),
      prefix: 'tabela',
      body: '| ${1:' + t('snippets.ph.column1') + '} | ${2:' + t('snippets.ph.column2') + '} |' + nl + '| --- | --- |' + nl + '| $0 |  |'
    },
    { id: 'builtin-link', name: t('snippets.builtin.link'), prefix: 'link', body: '[${1:' + t('snippets.ph.text') + '}](${2:https://})$0' },
    {
      id: 'builtin-cabecalho',
      name: t('snippets.builtin.header'),
      prefix: 'cabecalho',
      body: '# ${1:' + t('snippets.ph.title') + '}' + nl + nl + t('snippets.ph.date') + ': $CURRENT_DATE/$CURRENT_MONTH/$CURRENT_YEAR' + nl + nl + '$0'
    }
  ]
}

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
