import { create } from 'zustand'

export type DialogName = 'snippets' | 'macros'

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
