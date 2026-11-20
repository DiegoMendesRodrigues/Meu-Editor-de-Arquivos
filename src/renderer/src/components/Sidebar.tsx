// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, FileText, Folder, FolderOpen, FolderPlus, RefreshCw, Trash2, X } from 'lucide-react'
import type { FolderEntry } from '@shared/ipc'
import { closeFolder, openFolder, openPath } from '@/commands'
import { useT } from '@/i18n'
import { isDirty, useDocuments } from '@/store/documents'
import { useWorkspace } from '@/store/workspace'
import { useCloud, useStorageMode } from '@/store/cloud'
import { CloudTree, DOC_DRAG_TYPE, NewCloudFolder } from './CloudTree'

function Section({
  title,
  actions,
  alwaysShowActions = false,
  children
}: {
  title: string
  actions?: React.ReactNode
  /** Mostra os botões do título o tempo todo (e não só ao passar o mouse). */
  alwaysShowActions?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="mb-3">
      <div className="group flex items-center px-3 py-1">
        <h2 className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        <div className={`flex gap-0.5 ${alwaysShowActions ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>{actions}</div>
      </div>
      {children}
    </section>
  )
}

function IconButton({ icon: Icon, label, onClick }: { icon: typeof X; label: string; onClick: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="rounded p-0.5 text-zinc-500 hover:bg-zinc-300">
      <Icon size={13} />
    </button>
  )
}

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path
const parentDir = (path: string): string => path.split(/[\\/]/).slice(0, -1).join('/')

/** Um nível do explorador; as subpastas só são lidas quando abertas. */
function FolderNode({ entry, depth, activePath, reloadKey }: { entry: FolderEntry; depth: number; activePath: string | null; reloadKey: number }) {
  const t = useT()
  const [open, setOpen] = useState(depth === 0)
  const [children, setChildren] = useState<FolderEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    window.api
      .listFolder(entry.path)
      .then((list) => {
        setChildren(list)
        setError(null)
      })
      .catch(() => setError(t('sidebar.cannotRead')))
  }, [entry.path])

  useEffect(() => {
    if (open) load()
  }, [open, load, reloadKey])

  const pad = { paddingLeft: depth * 12 + 8 }

  if (!entry.isDirectory) {
    return (
      <button
        type="button"
        title={entry.path}
        onClick={() => void openPath(entry.path)}
        style={pad}
        className={`flex w-full items-center gap-1.5 truncate py-0.5 pr-2 text-left hover:bg-zinc-200 ${
          activePath === entry.path ? 'bg-zinc-200 font-medium' : ''
        }`}
      >
        <span className="w-3.5 shrink-0" />
        <FileText size={14} className="shrink-0 text-zinc-500" />
        <span className="truncate">{entry.name}</span>
      </button>
    )
  }

  return (
    <div role="treeitem" aria-expanded={open}>
      <button
        type="button"
        title={entry.path}
        onClick={() => setOpen((o) => !o)}
        style={pad}
        className="flex w-full items-center gap-1.5 truncate py-0.5 pr-2 text-left hover:bg-zinc-200"
      >
        <ChevronRight size={14} className={`shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`} />
        {open ? <FolderOpen size={14} className="shrink-0 text-amber-600" /> : <Folder size={14} className="shrink-0 text-amber-600" />}
        <span className="truncate">{entry.name}</span>
      </button>
      {open && (
        <div role="group">
          {error && <p style={{ paddingLeft: (depth + 1) * 12 + 8 }} className="py-0.5 text-red-600">{error}</p>}
          {children?.length === 0 && <p style={{ paddingLeft: (depth + 1) * 12 + 30 }} className="py-0.5 text-zinc-400">{t('sidebar.emptyFolder')}</p>}
          {children?.map((child) => (
            <FolderNode key={child.path} entry={child} depth={depth + 1} activePath={activePath} reloadKey={reloadKey} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const t = useT()
  const documents = useDocuments((s) => s.documents)
  const activeId = useDocuments((s) => s.activeId)
  const setActive = useDocuments((s) => s.setActive)
  const folder = useWorkspace((s) => s.folder)
  const recentFiles = useWorkspace((s) => s.recentFiles)
  const clearRecent = useWorkspace((s) => s.clearRecent)
  const [reloadKey, setReloadKey] = useState(0)
  const [newFolder, setNewFolder] = useState(false)
  const mode = useStorageMode()
  const activePath = documents.find((d) => d.id === activeId)?.path ?? null

  return (
    <aside className="h-full overflow-y-auto bg-chrome pt-2">
      <Section title={t('sidebar.openDocs')}>
        {documents.length === 0 && <p className="px-3 text-zinc-400">{t('sidebar.noOpenDocs')}</p>}
        <ul>
          {documents.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                title={d.path ?? d.name}
                onClick={() => setActive(d.id)}
                // Com a nuvem em uso, o documento pode ser arrastado para uma pasta da nuvem (envia uma cópia).
                draggable={mode === 'cloud' && !d.cloud}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DOC_DRAG_TYPE, d.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className={`flex w-full items-center gap-2 truncate px-3 py-1 text-left hover:bg-zinc-200 ${
                  d.id === activeId ? 'bg-zinc-200 font-medium' : ''
                }`}
              >
                <FileText size={14} className="shrink-0 text-zinc-500" />
                <span className={`truncate ${d.missingOnDisk ? 'text-red-600 line-through' : ''}`}>{d.name}</span>
                {isDirty(d) && <span className="ml-auto text-accent">●</span>}
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {mode === 'cloud' ? (
        <Section
          title={t('sidebar.cloud')}
          alwaysShowActions
          actions={
            <>
              <IconButton icon={FolderPlus} label={t('cloud.newFolder')} onClick={() => setNewFolder(true)} />
              <IconButton icon={RefreshCw} label={t('sidebar.refresh')} onClick={() => void useCloud.getState().load()} />
            </>
          }
        >
          {newFolder && <NewCloudFolder onDone={() => setNewFolder(false)} />}
          <CloudTree />
        </Section>
      ) : (
      <>
      <Section
        title={folder ? t('sidebar.explorerWithFolder', { name: folder.name }) : t('sidebar.explorer')}
        actions={
          folder ? (
            <>
              <IconButton icon={RefreshCw} label={t('sidebar.refresh')} onClick={() => setReloadKey((k) => k + 1)} />
              <IconButton icon={X} label={t('sidebar.closeFolder')} onClick={closeFolder} />
            </>
          ) : undefined
        }
      >
        {folder ? (
          <div role="tree" aria-label={t('sidebar.filesOf', { name: folder.name })}>
            <FolderNode key={folder.path} entry={{ name: folder.name, path: folder.path, isDirectory: true }} depth={0} activePath={activePath} reloadKey={reloadKey} />
          </div>
        ) : (
          <div className="px-3">
            <button
              type="button"
              onClick={() => void openFolder()}
              className="flex items-center gap-1.5 rounded border border-border bg-white px-2.5 py-1 hover:bg-zinc-100"
            >
              <FolderPlus size={14} /> {t('sidebar.openFolder')}
            </button>
          </div>
        )}
      </Section>

      <Section
        title={t('sidebar.recent')}
        actions={recentFiles.length > 0 ? <IconButton icon={Trash2} label={t('sidebar.clearList')} onClick={() => void clearRecent()} /> : undefined}
      >
        {recentFiles.length === 0 && <p className="px-3 text-zinc-400">{t('sidebar.noRecent')}</p>}
        <ul>
          {recentFiles.map((path) => (
            <li key={path}>
              <button
                type="button"
                title={path}
                onClick={() => void openPath(path)}
                className="flex w-full flex-col items-start px-3 py-0.5 text-left hover:bg-zinc-200"
              >
                <span className="w-full truncate">{fileName(path)}</span>
                <span className="w-full truncate text-[11px] text-zinc-400">{parentDir(path)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
      </>
      )}
    </aside>
  )
}
