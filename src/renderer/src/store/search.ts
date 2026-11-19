import { create } from 'zustand'
import type { SearchResponse } from '@shared/ipc'
import { isDirty, useDocuments } from './documents'
import { useWorkspace } from './workspace'

type Field = 'query' | 'replacement' | 'include'
type Flag = 'caseSensitive' | 'wholeWord' | 'regex'

interface SearchState {
  query: string
  replacement: string
  include: string
  caseSensitive: boolean
  wholeWord: boolean
  regex: boolean
  status: 'idle' | 'searching' | 'done' | 'error'
  response: SearchResponse | null
  /** Consulta que gerou `response` (a substituição usa esta, não o que está digitado agora). */
  searched: { query: string; caseSensitive: boolean; wholeWord: boolean; regex: boolean; include: string; folder: string } | null
  error: string | null
  notice: string | null
  /** Arquivos desmarcados: não recebem a substituição. */
  excluded: Record<string, true>
  focusTick: number
  setField(field: Field, value: string): void
  toggleFlag(flag: Flag): void
  toggleFile(path: string): void
  focusQuery(): void
  run(): Promise<void>
  replaceAll(): Promise<void>
}

let requestId = 0

const clean = (err: unknown): string =>
  err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)

export const useSearch = create<SearchState>((set, get) => ({
  query: '',
  replacement: '',
  include: '',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  status: 'idle',
  response: null,
  searched: null,
  error: null,
  notice: null,
  excluded: {},
  focusTick: 0,

  setField: (field, value) => set({ [field]: value } as Pick<SearchState, Field>),
  toggleFlag: (flag) => set((s) => ({ [flag]: !s[flag] }) as Pick<SearchState, Flag>),
  toggleFile: (path) =>
    set((s) => {
      const excluded = { ...s.excluded }
      if (excluded[path]) delete excluded[path]
      else excluded[path] = true
      return { excluded }
    }),
  focusQuery: () => set((s) => ({ focusTick: s.focusTick + 1 })),

  async run() {
    const s = get()
    const folder = useWorkspace.getState().folder
    if (!folder) return set({ status: 'error', error: 'Abra uma pasta para pesquisar em arquivos.', response: null })
    if (s.query === '') return set({ status: 'idle', response: null, error: null, notice: null })
    const req = { folder: folder.path, include: s.include, query: s.query, caseSensitive: s.caseSensitive, wholeWord: s.wholeWord, regex: s.regex }
    const id = ++requestId
    set({ status: 'searching', error: null, notice: null })
    try {
      const response = await window.api.searchFolder(req)
      // Ignora resposta velha se outra busca foi disparada enquanto esta rodava.
      if (id !== requestId) return
      set({ status: 'done', response, searched: req, excluded: {} })
    } catch (err) {
      if (id === requestId) set({ status: 'error', error: clean(err), response: null })
    }
  },

  async replaceAll() {
    const { response, searched, replacement, excluded, regex } = get()
    if (!response || !searched) return
    const chosen = response.files.filter((f) => !excluded[f.path])
    // Arquivos abertos com alterações não salvas não são tocados, para não perder o trabalho do usuário.
    const dirtyPaths = new Set(
      useDocuments
        .getState()
        .documents.filter((d) => d.path && isDirty(d))
        .map((d) => d.path as string)
    )
    const targets = chosen.filter((f) => !dirtyPaths.has(f.path))
    const skipped = chosen.length - targets.length
    const count = targets.reduce((n, f) => n + f.matches.length, 0)
    if (targets.length === 0) return set({ notice: 'Nenhum arquivo para substituir (marque arquivos sem alterações não salvas).' })

    const msg =
      `Substituir ${count} ocorrência(s) em ${targets.length} arquivo(s) por "${replacement}"?\n\n` +
      'As alterações serão gravadas direto nos arquivos e não poderão ser desfeitas pelo editor.' +
      (skipped > 0 ? `\n\n${skipped} arquivo(s) abertos com alterações não salvas serão ignorados.` : '')
    if (!window.confirm(msg)) return

    try {
      const res = await window.api.replaceInFiles({ ...searched, replacement, regex, paths: targets.map((f) => f.path) })
      await get().run()
      const parts = [`${res.replacements} substituição(ões) em ${res.filesChanged} arquivo(s).`]
      if (skipped > 0) parts.push(`${skipped} ignorado(s) por terem alterações não salvas.`)
      if (res.errors.length > 0) parts.push(`Erros: ${res.errors.join('; ')}`)
      set({ notice: parts.join(' ') })
    } catch (err) {
      set({ notice: null, error: clean(err), status: 'error' })
    }
  }
}))
