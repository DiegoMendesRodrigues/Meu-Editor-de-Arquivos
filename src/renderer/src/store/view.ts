// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { Theme } from '@shared/ipc'

/** Preferências de exibição e de edição (guardadas na sessão). */
export interface ViewValues {
  sidebarVisible: boolean
  bottomPanelVisible: boolean
  wordWrap: boolean
  showInvisibles: boolean
  /** Tab insere espaços (true) ou o caractere de tabulação (false). */
  insertSpaces: boolean
  fontSize: number
  tabSize: number
  /** Tema escolhido pelo usuário; null = segue o sistema operacional. */
  theme: Theme | null
}

export type ViewKey = {
  [K in keyof ViewValues]: ViewValues[K] extends boolean ? K : never
}[keyof ViewValues]

interface ViewState extends ViewValues {
  /** Documento em tela inteira (sem menus, barras e painéis). Não fica guardado na sessão. */
  fullScreen: boolean
  setFullScreen(on: boolean): void
  toggle(key: ViewKey): void
  setAll(values: Partial<ViewValues>): void
  /** Altera o tamanho da fonte (limitado a 8–40). */
  zoomFont(delta: number): void
  resetFont(): void
  setTabSize(size: number): void
  setTheme(theme: Theme | null): void
}

export const DEFAULT_FONT_SIZE = 14
const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

export const useView = create<ViewState>((set) => ({
  sidebarVisible: true,
  bottomPanelVisible: false,
  wordWrap: false,
  showInvisibles: false,
  insertSpaces: true,
  fontSize: DEFAULT_FONT_SIZE,
  tabSize: 4,
  theme: null,
  fullScreen: false,
  setFullScreen: (on) => set({ fullScreen: on }),
  toggle: (key) => set((s) => ({ [key]: !s[key] })),
  setAll: (values) => set(values),
  zoomFont: (delta) => set((s) => ({ fontSize: clamp(s.fontSize + delta, 8, 40) })),
  resetFont: () => set({ fontSize: DEFAULT_FONT_SIZE }),
  setTabSize: (size) => set({ tabSize: clamp(size, 1, 16) }),
  setTheme: (theme) => set({ theme })
}))
