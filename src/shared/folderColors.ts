// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Cores das pastas na barra lateral (doze cores vivas; a primeira é a padrão). */
export const FOLDER_COLORS = [
  { id: 'amber', hex: '#d97706' },
  { id: 'red', hex: '#ef4444' },
  { id: 'orange', hex: '#f97316' },
  { id: 'yellow', hex: '#eab308' },
  { id: 'lime', hex: '#84cc16' },
  { id: 'green', hex: '#22c55e' },
  { id: 'teal', hex: '#14b8a6' },
  { id: 'sky', hex: '#0ea5e9' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'violet', hex: '#8b5cf6' },
  { id: 'fuchsia', hex: '#d946ef' },
  { id: 'pink', hex: '#ec4899' }
] as const

export type FolderColor = (typeof FOLDER_COLORS)[number]['id']
export const FOLDER_COLOR_IDS = FOLDER_COLORS.map((c) => c.id) as [FolderColor, ...FolderColor[]]
export const DEFAULT_FOLDER_COLOR: FolderColor = 'amber'
/** Limite de pastas com cor guardadas na sessão. */
export const MAX_FOLDER_COLORS = 2000

export const folderColorHex = (id: FolderColor): string => FOLDER_COLORS.find((c) => c.id === id)?.hex ?? FOLDER_COLORS[0].hex
