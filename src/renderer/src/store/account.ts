// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { AccountStatus } from '@shared/ipc'

interface AccountState {
  status: AccountStatus
  load(): Promise<void>
  set(status: AccountStatus): void
}

export const useAccount = create<AccountState>((set) => ({
  status: { serverUrl: null, user: null, rememberSession: false },
  load: async () => {
    try {
      set({ status: await window.api.accountStatus() })
    } catch {
      /* mantém o estado atual */
    }
  },
  set: (status) => set({ status })
}))

/** Remove o prefixo técnico que o Electron coloca nos erros de IPC. */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)
