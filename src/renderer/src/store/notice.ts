// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'

/** Aviso curto na barra de status (ex.: "MD5 copiado para a área de transferência"). */
interface NoticeState {
  message: string | null
  show(message: string): void
}

let timer: ReturnType<typeof setTimeout> | undefined

export const useNotice = create<NoticeState>((set) => ({
  message: null,
  show: (message) => {
    clearTimeout(timer)
    set({ message })
    timer = setTimeout(() => set({ message: null }), 4000)
  }
}))
