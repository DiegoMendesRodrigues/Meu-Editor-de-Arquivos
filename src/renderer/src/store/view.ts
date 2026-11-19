import { create } from 'zustand'

/** Preferências de exibição da interface (persistência local virá numa etapa seguinte). */
interface ViewState {
  sidebarVisible: boolean
  bottomPanelVisible: boolean
  minimap: boolean
  wordWrap: boolean
  showInvisibles: boolean
  toggle(key: 'sidebarVisible' | 'bottomPanelVisible' | 'minimap' | 'wordWrap' | 'showInvisibles'): void
}

export const useView = create<ViewState>((set) => ({
  sidebarVisible: true,
  bottomPanelVisible: false,
  minimap: true,
  wordWrap: false,
  showInvisibles: false,
  toggle: (key) => set((s) => ({ [key]: !s[key] }))
}))
