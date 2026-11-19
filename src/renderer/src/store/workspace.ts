// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { FolderInfo } from '@shared/ipc'

interface WorkspaceState {
  /** Pasta aberta no explorador (null quando nenhuma). */
  folder: FolderInfo | null
  recentFiles: string[]
  setFolder(folder: FolderInfo | null): void
  refreshRecent(): Promise<void>
  clearRecent(): Promise<void>
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  folder: null,
  recentFiles: [],
  setFolder: (folder) => set({ folder }),
  refreshRecent: async () => set({ recentFiles: await window.api.getRecentFiles() }),
  clearRecent: async () => {
    await window.api.clearRecentFiles()
    set({ recentFiles: [] })
  }
}))
