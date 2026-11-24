// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Ações do menu de contexto da barra lateral (botão direito em pastas e arquivos, do disco ou da nuvem):
 * renomear, mudar a cor da pasta e excluir pasta vazia.
 */
import { create } from 'zustand'
import { DEFAULT_FOLDER_COLOR, type FolderColor } from '@shared/folderColors'
import type { MessageKey } from '@shared/i18n'
import { t } from '@/i18n'
import { errorMessage, useAccount } from '@/store/account'
import { joinPath, parentOf, useCloud } from '@/store/cloud'
import { isInsidePath, useDocuments } from '@/store/documents'
import { cloudFolderKey, localFolderKey, useFolderColors } from '@/store/folderColors'
import { useWorkspace } from '@/store/workspace'

/** Pasta ou arquivo clicado com o botão direito. */
export interface SidebarTarget {
  source: 'local' | 'cloud'
  kind: 'file' | 'folder'
  /** Caminho no disco ou na nuvem. */
  path: string
  name: string
  /** Arquivo da nuvem. */
  cloudId?: string
}

export const folderColorKey = (target: SidebarTarget): string =>
  target.source === 'local' ? localFolderKey(target.path) : cloudFolderKey(target.path)

interface SidebarDialogState {
  dialog: 'rename' | 'color' | null
  target: SidebarTarget | null
  /** Muda a cada alteração no disco feita pela barra lateral, para o explorador ler as pastas de novo. */
  explorerVersion: number
  open(dialog: 'rename' | 'color', target: SidebarTarget): void
  close(): void
  reloadExplorer(): void
}

export const useSidebarDialog = create<SidebarDialogState>((set) => ({
  dialog: null,
  target: null,
  explorerVersion: 0,
  open: (dialog, target) => set({ dialog, target }),
  close: () => set({ dialog: null, target: null }),
  reloadExplorer: () => set((s) => ({ explorerVersion: s.explorerVersion + 1 }))
}))

const ipcMessage = (err: unknown): string =>
  err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)

function report(titleKey: MessageKey, message: string): void {
  window.alert(t(titleKey) + '\n\n' + message)
}

/**
 * Renomeia a pasta ou o arquivo. Abas abertas, recentes, cores e a pasta selecionada na nuvem
 * passam para o novo caminho. Devolve false (e avisa) se não deu certo.
 */
export async function renameTarget(target: SidebarTarget, newName: string): Promise<boolean> {
  const name = newName.trim()
  if (name === target.name) return true
  return target.source === 'local' ? renameLocal(target, name) : renameCloud(target, name)
}

async function renameLocal(target: SidebarTarget, name: string): Promise<boolean> {
  let newPath: string
  try {
    newPath = await window.api.renameEntry(target.path, name)
  } catch (err) {
    report('rename.error', ipcMessage(err))
    return false
  }
  useDocuments.getState().renameLocalPath(target.path, newPath)
  if (target.kind === 'folder') useFolderColors.getState().rename(localFolderKey(target.path), localFolderKey(newPath))
  void useWorkspace.getState().refreshRecent()
  useSidebarDialog.getState().reloadExplorer()
  return true
}

async function renameCloud(target: SidebarTarget, name: string): Promise<boolean> {
  const newPath = joinPath(parentOf(target.path), name)
  try {
    if (target.kind === 'file') {
      const moved = await window.api.cloudMove(target.cloudId!, newPath)
      useCloud.getState().upsertFile(moved)
      useDocuments.getState().updateCloudPath(moved.id, moved.path, moved.version)
      return true
    }
    await window.api.cloudRenameFolder(target.path, newPath)
  } catch (err) {
    report('rename.error', errorMessage(err))
    void useAccount.getState().load() // a sessão pode ter expirado
    return false
  }
  // Pasta: os arquivos dentro dela mudaram de caminho (e de versão); as abas abertas acompanham.
  await useCloud.getState().load()
  const files = new Map(useCloud.getState().files.map((f) => [f.id, f]))
  for (const d of useDocuments.getState().documents) {
    const f = d.cloud && isInsidePath(target.path, d.cloud.path) ? files.get(d.cloud.id) : undefined
    if (f) useDocuments.getState().updateCloudPath(f.id, f.path, f.version)
  }
  useFolderColors.getState().rename(cloudFolderKey(target.path), cloudFolderKey(newPath))
  const selected = useCloud.getState().targetFolder
  if (isInsidePath(target.path, selected)) useCloud.getState().setTargetFolder(newPath + selected.slice(target.path.length))
  return true
}

export function setFolderColor(target: SidebarTarget, color: FolderColor): void {
  useFolderColors.getState().set(folderColorKey(target), color)
}

/** A pasta está vazia? (a da nuvem já se sabe pela árvore; a do disco é lida na hora) */
export async function isLocalFolderEmpty(path: string): Promise<boolean> {
  try {
    return (await window.api.listFolder(path)).length === 0
  } catch {
    return false
  }
}

/** Exclui uma pasta vazia do disco, depois de confirmar. */
export async function deleteLocalFolder(target: SidebarTarget): Promise<void> {
  if (!window.confirm(t('sidebar.confirmDeleteFolder', { path: target.path }))) return
  try {
    await window.api.deleteEmptyFolder(target.path)
    useFolderColors.getState().set(localFolderKey(target.path), DEFAULT_FOLDER_COLOR)
  } catch (err) {
    report('sidebar.deleteFolderError', ipcMessage(err))
  }
  useSidebarDialog.getState().reloadExplorer()
}
