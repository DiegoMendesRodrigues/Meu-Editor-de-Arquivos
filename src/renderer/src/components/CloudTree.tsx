// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Arquivos e pastas da nuvem na barra lateral: abrir, criar pasta, excluir e arrastar entre pastas. */
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Cloud, FileText, Folder, FolderOpen, Trash2 } from 'lucide-react'
import type { CloudFileMeta } from '@shared/ipc'
import { copyDocumentToCloud, createCloudFolder, deleteCloudFile, deleteCloudFolder, moveCloudFile, openFromCloud } from '@/cloud'
import { useT } from '@/i18n'
import { useAccount } from '@/store/account'
import { buildCloudTree, isValidCloudName, joinPath, useCloud, type CloudFolderNode } from '@/store/cloud'
import { useDocuments } from '@/store/documents'

const DRAG_TYPE = 'application/x-cloud-file'
/** Documento aberto (do computador) arrastado da lista "Documentos abertos". */
export const DOC_DRAG_TYPE = 'application/x-editor-doc'

/** Recebe arquivos arrastados: destaca a pasta e move o arquivo ao soltar. */
function useDrop(folder: string, files: CloudFileMeta[]) {
  const [over, setOver] = useState(false)
  return {
    over,
    handlers: {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE) && !e.dataTransfer.types.includes(DOC_DRAG_TYPE)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DRAG_TYPE) ? 'move' : 'copy'
        setOver(true)
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        setOver(false)
        const docId = e.dataTransfer.getData(DOC_DRAG_TYPE)
        if (docId) {
          e.preventDefault()
          e.stopPropagation()
          const doc = useDocuments.getState().documents.find((d) => d.id === docId)
          if (doc) void copyDocumentToCloud(doc, folder)
          return
        }
        const id = e.dataTransfer.getData(DRAG_TYPE)
        if (!id) return
        e.preventDefault()
        e.stopPropagation()
        const file = files.find((f) => f.id === id)
        if (file) void moveCloudFile(file, folder)
      }
    }
  }
}

const rowButton = 'flex min-w-0 flex-1 items-center gap-1.5 truncate py-0.5 text-left'
const trashButton = 'mr-1 rounded p-0.5 text-zinc-500 opacity-0 hover:bg-zinc-300 group-hover:opacity-100 focus:opacity-100'

function FileRow({ file, depth, active }: { file: CloudFileMeta; depth: number; active: boolean }) {
  const t = useT()
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, file.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`group flex items-center hover:bg-zinc-200 ${active ? 'bg-zinc-200 font-medium' : ''}`}
    >
      <button type="button" title={file.path} onClick={() => void openFromCloud(file.id)} style={{ paddingLeft: depth * 12 + 8 }} className={rowButton}>
        <span className="w-3.5 shrink-0" />
        <FileText size={14} className="shrink-0 text-zinc-500" />
        <span className="truncate">{file.path.split('/').pop()}</span>
      </button>
      <button type="button" title={t('common.delete')} aria-label={`${t('common.delete')} ${file.path}`} onClick={() => void deleteCloudFile(file)} className={trashButton}>
        <Trash2 size={12} />
      </button>
    </div>
  )
}

interface NodeProps {
  node: CloudFolderNode
  depth: number
  files: CloudFileMeta[]
  activeCloudId?: string
}

function FolderRow({ node, depth, files, activeCloudId }: NodeProps) {
  const t = useT()
  const [open, setOpen] = useState(true)
  const target = useCloud((s) => s.targetFolder)
  const setTarget = useCloud((s) => s.setTargetFolder)
  const { over, handlers } = useDrop(node.path, files)
  const empty = node.folders.length === 0 && node.files.length === 0
  return (
    <div role="treeitem" aria-expanded={open} {...handlers}>
      <div className={`group flex items-center hover:bg-zinc-200 ${over ? 'bg-sky-100 ring-1 ring-sky-400' : target === node.path ? 'bg-zinc-200' : ''}`}>
        <button
          type="button"
          title={node.path}
          onClick={() => {
            setOpen((o) => !o)
            setTarget(node.path)
          }}
          style={{ paddingLeft: depth * 12 + 8 }}
          className={rowButton}
        >
          <ChevronRight size={14} className={`shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`} />
          {open ? <FolderOpen size={14} className="shrink-0 text-amber-600" /> : <Folder size={14} className="shrink-0 text-amber-600" />}
          <span className="truncate">{node.name}</span>
        </button>
        {empty && (
          <button type="button" title={t('cloud.deleteFolder')} aria-label={`${t('cloud.deleteFolder')} ${node.path}`} onClick={() => void deleteCloudFolder(node.path)} className={trashButton}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
      {open && <FolderChildren node={node} depth={depth + 1} files={files} activeCloudId={activeCloudId} />}
    </div>
  )
}

function FolderChildren({ node, depth, files, activeCloudId }: NodeProps) {
  return (
    <div role="group">
      {node.folders.map((f) => (
        <FolderRow key={f.path} node={f} depth={depth} files={files} activeCloudId={activeCloudId} />
      ))}
      {node.files.map((f) => (
        <FileRow key={f.id} file={f} depth={depth} active={f.id === activeCloudId} />
      ))}
    </div>
  )
}

/** Campo para o nome da nova pasta (criada dentro da pasta selecionada). */
export function NewCloudFolder({ onDone }: { onDone: () => void }) {
  const t = useT()
  const parent = useCloud((s) => s.targetFolder)
  const [name, setName] = useState('')
  const [error, setError] = useState(false)
  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!isValidCloudName(name)) return setError(true)
    if (await createCloudFolder(joinPath(parent, name.trim()))) onDone()
  }
  return (
    <form onSubmit={(e) => void submit(e)} className="px-3 pb-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onDone()
        }}
        onBlur={() => {
          if (!name.trim()) onDone()
        }}
        placeholder={parent ? t('cloud.newFolderIn', { path: parent }) : t('cloud.newFolderName')}
        aria-label={t('cloud.newFolderName')}
        className={`w-full rounded border bg-surface px-1.5 py-0.5 ${error ? 'border-red-500' : 'border-border'}`}
      />
      {error && <p className="text-[11px] text-red-700">{t('cloud.invalidName')}</p>}
    </form>
  )
}

export function CloudTree() {
  const t = useT()
  const userId = useAccount((s) => s.status.user?.id)
  const files = useCloud((s) => s.files)
  const folders = useCloud((s) => s.folders)
  const loading = useCloud((s) => s.loading)
  const error = useCloud((s) => s.error)
  const target = useCloud((s) => s.targetFolder)
  const setTarget = useCloud((s) => s.setTargetFolder)
  const activeCloudId = useDocuments((s) => s.documents.find((d) => d.id === s.activeId)?.cloud?.id)
  const tree = useMemo(() => buildCloudTree(files, folders), [files, folders])
  const root = useDrop('', files)

  useEffect(() => {
    if (userId) void useCloud.getState().load()
    else useCloud.getState().clear()
  }, [userId])

  return (
    <div role="tree" aria-label={t('sidebar.cloud')} {...root.handlers} className={`min-h-16 pb-2 ${root.over ? 'bg-sky-50' : ''}`}>
      <button
        type="button"
        onClick={() => setTarget('')}
        className={`flex w-full items-center gap-1.5 truncate px-2 py-0.5 text-left hover:bg-zinc-200 ${target === '' ? 'bg-zinc-200' : ''}`}
      >
        <Cloud size={14} className="shrink-0 text-sky-600" />
        <span className="truncate">{t('cloud.root')}</span>
      </button>
      {error && <p role="alert" className="px-3 text-red-600">{error}</p>}
      {loading && files.length === 0 && <p className="px-3 text-zinc-400">{t('cloud.loading')}</p>}
      {!loading && !error && files.length === 0 && folders.length === 0 && <p className="px-3 text-zinc-400">{t('cloud.emptySidebar')}</p>}
      <FolderChildren node={tree} depth={1} files={files} activeCloudId={activeCloudId} />
    </div>
  )
}
