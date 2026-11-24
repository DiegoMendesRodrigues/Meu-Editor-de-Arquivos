// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { HashAlgorithm } from '@shared/ipc'

export type DialogName = 'snippets' | 'macros' | 'account' | 'cloudOpen' | 'cloudSave' | 'shortcuts' | 'about' | 'update' | 'hash'

interface DialogsState {
  open: DialogName | null
  /** Algoritmo da janela "Gerar MD5/SHA". */
  hashAlgorithm: HashAlgorithm
  show(name: DialogName): void
  showHash(algorithm: HashAlgorithm): void
  close(): void
}

export const useDialogs = create<DialogsState>((set) => ({
  open: null,
  hashAlgorithm: 'MD5',
  show: (name) => set({ open: name }),
  showHash: (algorithm) => set({ open: 'hash', hashAlgorithm: algorithm }),
  close: () => set({ open: null })
}))
