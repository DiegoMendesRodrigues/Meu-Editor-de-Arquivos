// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Arquivos e pastas da nuvem (para a barra lateral e o diálogo de salvar) e o local de armazenamento
 * em uso: com a conta conectada, abrir e salvar usam a nuvem; o ícone do rodapé alterna para o disco.
 */
import { create } from 'zustand'
import type { CloudFileMeta, CloudPlan } from '@shared/ipc'
import { errorMessage, useAccount } from './account'

export type StorageMode = 'local' | 'cloud'

interface CloudState {
  files: CloudFileMeta[]
  /** Pastas criadas pelo usuário (sem as implícitas dos caminhos dos arquivos). */
  folders: string[]
  loading: boolean
  error: string | null
  /** Com a conta conectada, usar a nuvem (padrão) ou o disco do computador. */
  preferCloud: boolean
  /** Espaço usado na nuvem, em bytes (arquivos + textos não salvos); null = desconhecido ou sem conta. */
  storageBytes: number | null
  /** Arquivos guardados na nuvem, como o servidor informa; null = desconhecido ou sem conta. */
  storedFiles: number | null
  /** Plano do usuário (nome e limites); null = desconhecido, sem conta ou servidor anterior. */
  plan: CloudPlan | null
  /** Busca no servidor o uso da nuvem (espaço, arquivos e plano). */
  refreshStorage(): Promise<void>
  /** Pasta sugerida para salvar (a última selecionada na barra lateral). */
  targetFolder: string
  setTargetFolder(path: string): void
  load(): Promise<void>
  setPreferCloud(value: boolean): void
  /** Atualiza (ou inclui) um arquivo na lista, sem ir ao servidor. */
  upsertFile(file: CloudFileMeta): void
  clear(): void
}

export const useCloud = create<CloudState>((set) => ({
  files: [],
  folders: [],
  loading: false,
  error: null,
  storageBytes: null,
  storedFiles: null,
  plan: null,
  refreshStorage: async () => {
    if (!useAccount.getState().status.user) return set({ storageBytes: null, storedFiles: null, plan: null })
    try {
      const usage = await window.api.cloudStorage()
      set({ storageBytes: usage.storageBytes, storedFiles: usage.storedFiles, plan: usage.plan })
    } catch {
      set({ storageBytes: null, storedFiles: null, plan: null }) // servidor fora do ar: o rodapé só mostra o ícone
    }
  },
  preferCloud: true,
  targetFolder: '',
  setTargetFolder: (targetFolder) => set({ targetFolder }),
  load: async () => {
    if (!useAccount.getState().status.user) return set({ files: [], folders: [], error: null })
    set({ loading: true })
    try {
      const [files, folders] = await Promise.all([window.api.cloudList(), window.api.cloudFolders()])
      set({ files, folders, error: null, loading: false })
      void useCloud.getState().refreshStorage()
    } catch (err) {
      set({ error: errorMessage(err), loading: false }) // sem o prefixo técnico do IPC
      void useAccount.getState().load() // a sessão pode ter expirado
    }
  },
  setPreferCloud: (preferCloud) => set({ preferCloud }),
  upsertFile: (file) =>
    set((s) => ({ files: [...s.files.filter((f) => f.id !== file.id), file].sort((a, b) => a.path.localeCompare(b.path)) })),
  clear: () => set({ files: [], folders: [], error: null, targetFolder: '', storageBytes: null, storedFiles: null, plan: null })
}))

// O servidor informa o novo uso a cada gravação, exclusão ou sincronização da área de trabalho.
globalThis.window?.api?.onCloudStorageChanged?.((usage) => {
  if (!useAccount.getState().status.user) return
  useCloud.setState(usage.storedFiles === null ? { storageBytes: usage.storageBytes } : usage)
})

/** Nível de alerta de um uso em relação ao limite do plano: laranja a partir de 90%, vermelho a partir de 100%. */
export type UsageLevel = 'ok' | 'warn' | 'full'
export function usageLevel(used: number, limit: number | null | undefined): UsageLevel {
  if (!limit || limit <= 0) return 'ok'
  if (used >= limit) return 'full'
  return used >= limit * 0.9 ? 'warn' : 'ok'
}

/** Espaço usado no formato do rodapé: megabytes (1 MB = 1024 × 1024 bytes) com duas casas decimais, como o tamanho do documento. */
export const formatStorage = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(2)} MB`

/** Local de armazenamento em uso agora. */
export const storageMode = (): StorageMode => (useAccount.getState().status.user && useCloud.getState().preferCloud ? 'cloud' : 'local')

/** O mesmo, para componentes (redesenha quando a conta ou a preferência mudam). */
export function useStorageMode(): StorageMode {
  const user = useAccount((s) => s.status.user)
  const preferCloud = useCloud((s) => s.preferCloud)
  return user && preferCloud ? 'cloud' : 'local'
}

// ---- Árvore de pastas (funções puras) ----

export interface CloudFolderNode {
  name: string
  /** Caminho da pasta ('' = raiz). */
  path: string
  folders: CloudFolderNode[]
  files: CloudFileMeta[]
}

export const baseName = (path: string): string => path.split('/').pop() ?? path
export const parentOf = (path: string): string => path.split('/').slice(0, -1).join('/')
export const joinPath = (folder: string, name: string): string => (folder ? `${folder}/${name}` : name)

/** Monta a árvore com as pastas criadas e as pastas que aparecem nos caminhos dos arquivos. */
export function buildCloudTree(files: CloudFileMeta[], folders: string[]): CloudFolderNode {
  const root: CloudFolderNode = { name: '', path: '', folders: [], files: [] }
  const index = new Map<string, CloudFolderNode>([['', root]])
  const ensure = (path: string): CloudFolderNode => {
    const found = index.get(path)
    if (found) return found
    const node: CloudFolderNode = { name: baseName(path), path, folders: [], files: [] }
    index.set(path, node)
    ensure(parentOf(path)).folders.push(node)
    return node
  }
  for (const folder of folders) ensure(folder)
  for (const file of files) ensure(parentOf(file.path)).files.push(file)
  const sort = (node: CloudFolderNode): void => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name))
    node.files.sort((a, b) => baseName(a.path).localeCompare(baseName(b.path)))
    node.folders.forEach(sort)
  }
  sort(root)
  return root
}

/** Todas as pastas (criadas e implícitas), em ordem, começando pela raiz (''). */
export function allFolders(files: CloudFileMeta[], folders: string[]): string[] {
  const out: string[] = []
  const walk = (node: CloudFolderNode): void => {
    out.push(node.path)
    node.folders.forEach(walk)
  }
  walk(buildCloudTree(files, folders))
  return out
}

/** Nome de pasta ou arquivo válido na nuvem: sem barras, sem "." nem "..". */
export const isValidCloudName = (name: string): boolean =>
  name.trim() !== '' && !/[\\/]/.test(name) && name.trim() !== '.' && name.trim() !== '..' && name.length <= 200
