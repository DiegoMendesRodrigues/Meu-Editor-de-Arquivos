// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'

export type DialogName = 'snippets' | 'macros' | 'account' | 'cloudOpen' | 'cloudSave' | 'shortcuts' | 'about'

interface DialogsState {
  open: DialogName | null
  show(name: DialogName): void
  close(): void
}

export const useDialogs = create<DialogsState>((set) => ({
  open: null,
  show: (name) => set({ open: name }),
  close: () => set({ open: null })
}))
