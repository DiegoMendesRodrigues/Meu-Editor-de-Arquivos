// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'

/** Terminais abertos no painel abaixo do documento (não voltam na próxima abertura do app). */
export interface TerminalTab {
  /** Número dado pelo Main ao abrir o shell. */
  id: number
  /** Número mostrado na aba ("Terminal 1", "Terminal 2"...). */
  number: number
}

interface TerminalsState {
  tabs: TerminalTab[]
  activeId: number | null
  add(id: number): void
  remove(id: number): void
  setActive(id: number): void
}

export const useTerminals = create<TerminalsState>((set) => ({
  tabs: [],
  activeId: null,
  add: (id) =>
    set((s) => {
      // O número é o menor livre, como nas abas de documentos sem título.
      const used = new Set(s.tabs.map((t) => t.number))
      let number = 1
      while (used.has(number)) number++
      return { tabs: [...s.tabs, { id, number }], activeId: id }
    }),
  remove: (id) =>
    set((s) => {
      const index = s.tabs.findIndex((t) => t.id === id)
      if (index < 0) return s
      const tabs = s.tabs.filter((t) => t.id !== id)
      const activeId = s.activeId === id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null) : s.activeId
      return { tabs, activeId }
    }),
  setActive: (id) => set({ activeId: id })
}))
