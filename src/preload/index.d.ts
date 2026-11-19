// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { EditorApi } from '../shared/ipc'

declare global {
  interface Window {
    api: EditorApi
  }
}

export {}
