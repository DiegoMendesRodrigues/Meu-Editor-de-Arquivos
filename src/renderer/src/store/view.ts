import { create } from 'zustand'

/** Preferências de exibição da interface (guardadas na sessão). */
interface ViewState {
  sidebarVisible: boolean
  bottomPanelVisible: boolean
  minimap: boolean
  wordWrap: boolean
  showInvisibles: boolean
  toggle(key: ViewKey): void
  setAll(values: Record<ViewKey, boolean>): void
}

export type ViewKey = 'sidebarVisible' | 'bottomPanelVisible' | 'minimap' | 'wordWrap' | 'showInvisibles'

export const useView = create<ViewState>((set) => ({
  sidebarVisible: true,
  bottomPanelVisible: false,
  minimap: true,
  wordWrap: false,
  showInvisibles: false,
  toggle: (key) => set((s) => ({ [key]: !s[key] })),
  setAll: (values) => set(values)
}))
