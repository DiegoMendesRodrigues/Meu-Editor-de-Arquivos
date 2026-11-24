// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import { DEFAULT_FOLDER_COLOR, MAX_FOLDER_COLORS, type FolderColor } from '@shared/folderColors'

/**
 * Cor escolhida para cada pasta da barra lateral (guardada na sessão deste computador).
 * A chave diz de onde é a pasta: "local:<caminho no disco>" ou "cloud:<caminho na nuvem>".
 */
export const localFolderKey = (path: string): string => `local:${path}`
export const cloudFolderKey = (path: string): string => `cloud:${path}`

/** A chave é a da pasta ou de algo dentro dela? (o disco usa "\" ou "/"; a nuvem, "/") */
const insideKey = (root: string, key: string): boolean => key === root || key.startsWith(`${root}/`) || key.startsWith(`${root}\\`)

interface FolderColorsState {
  colors: Record<string, FolderColor>
  /** Cor da pasta (a padrão, se nunca foi escolhida). */
  colorOf(key: string): FolderColor
  set(key: string, color: FolderColor): void
  /** Pasta renomeada: ela e as subpastas mantêm as cores no novo caminho. */
  rename(oldKey: string, newKey: string): void
  setAll(colors: Record<string, FolderColor>): void
}

export const useFolderColors = create<FolderColorsState>((set, get) => ({
  colors: {},
  colorOf: (key) => get().colors[key] ?? DEFAULT_FOLDER_COLOR,
  set: (key, color) =>
    set((s) => {
      const colors = { ...s.colors }
      if (color === DEFAULT_FOLDER_COLOR) delete colors[key]
      else if (key in colors || Object.keys(colors).length < MAX_FOLDER_COLORS) colors[key] = color
      return { colors }
    }),
  rename: (oldKey, newKey) =>
    set((s) => {
      const colors: Record<string, FolderColor> = {}
      for (const [key, color] of Object.entries(s.colors)) {
        colors[insideKey(oldKey, key) ? newKey + key.slice(oldKey.length) : key] = color
      }
      return { colors }
    }),
  setAll: (colors) => set({ colors })
}))
