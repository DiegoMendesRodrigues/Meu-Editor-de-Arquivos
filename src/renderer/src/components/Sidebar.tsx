// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronRight, FolderPlus, RefreshCw, Trash2, X } from 'lucide-react'
import type { FolderEntry } from '@shared/ipc'
import { closeFolder, openFolder, openPath } from '@/commands'
import { useT } from '@/i18n'
import { isDirty, useDocuments } from '@/store/documents'
import { useWorkspace } from '@/store/workspace'
import { useCloud, useStorageMode } from '@/store/cloud'
import { localFolderKey } from '@/store/folderColors'
import { deleteLocalFolder, isLocalFolderEmpty, useSidebarDialog, type SidebarTarget } from '@/sidebarActions'
import { CloudTree, DOC_DRAG_TYPE, NewCloudFolder } from './CloudTree'
import { EntryMenu, FileIcon, FolderIcon, SidebarDialogs } from './SidebarMenus'
import { IconButton, Section, VisibleSectionsContext } from './SidebarSection'
import { ApiCollectionsSection, ApiEnvironmentSection, ApiHistorySection, useApiSidebarVisible } from '@/api/ApiSidebar'
import { useSidebarLayout, type SidebarSectionId } from '@/store/sidebarLayout'

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path
const parentDir = (path: string): string => path.split(/[\\/]/).slice(0, -1).join('/')

/** Um nível do explorador; as subpastas só são lidas quando abertas. */
function FolderNode({ entry, depth, activePath, reloadKey }: { entry: FolderEntry; depth: number; activePath: string | null; reloadKey: number }) {
  const t = useT()
  const [open, setOpen] = useState(depth === 0)
  const [children, setChildren] = useState<FolderEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const explorerVersion = useSidebarDialog((s) => s.explorerVersion)
  const target: SidebarTarget = { source: 'local', kind: entry.isDirectory ? 'folder' : 'file', path: entry.path, name: entry.name }

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
  }, [open, load, reloadKey, explorerVersion])

  const pad = { paddingLeft: depth * 12 + 8 }

  if (!entry.isDirectory) {
    return (
      <EntryMenu target={target}>
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
        <FileIcon name={entry.name} />
        <span className="truncate">{entry.name}</span>
      </button>
      </EntryMenu>
    )
  }

  return (
    <div role="treeitem" aria-expanded={open}>
      <EntryMenu
        target={target}
        // A pasta aberta no explorador não é renomeada nem excluída (feche e abra outra).
        canRename={depth > 0}
        isEmpty={() => isLocalFolderEmpty(entry.path)}
        onDelete={() => void deleteLocalFolder(target)}
      >
      <button
        type="button"
        title={entry.path}
        onClick={() => setOpen((o) => !o)}
        style={pad}
        className="flex w-full items-center gap-1.5 truncate py-0.5 pr-2 text-left hover:bg-zinc-200"
      >
        <ChevronRight size={14} className={`shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`} />
        <FolderIcon colorKey={localFolderKey(entry.path)} open={open} />
        <span className="truncate">{entry.name}</span>
      </button>
      </EntryMenu>
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
  const apiVisible = useApiSidebarVisible()
  const order = useSidebarLayout((s) => s.order)

  // Cada área visível agora; a ordem vem do usuário (arrastar o título), guardada neste computador.
  const sections: Partial<Record<SidebarSectionId, React.ReactNode>> = {
    openDocs: (
        <Section id="openDocs" title={t('sidebar.openDocs')}>
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
                  <FileIcon name={d.name} />
                  <span className={`truncate ${d.missingOnDisk ? 'text-red-600 line-through' : ''}`}>{d.name}</span>
                  {isDirty(d) && <span className="ml-auto text-accent">●</span>}
                </button>
              </li>
            ))}
          </ul>
        </Section>
    ),
    ...(apiVisible ? { apiEnv: <ApiEnvironmentSection />, apiCollections: <ApiCollectionsSection />, apiHistory: <ApiHistorySection /> } : {}),
    ...(mode === 'cloud'
      ? {
          cloud: (
            <Section
              id="cloud"
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
          )
        }
      : {
          explorer: (
            <Section
              id="explorer"
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
                    className="flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 hover:bg-zinc-100"
                  >
                    <FolderPlus size={14} /> {t('sidebar.openFolder')}
                  </button>
                </div>
              )}
            </Section>
          ),
          recent: (
            <Section
              id="recent"
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
          )
        })
  }
  const visible = order.filter((id) => sections[id] !== undefined)

  return (
    <aside className="h-full overflow-y-auto bg-chrome pt-2">
      <SidebarDialogs />
      <VisibleSectionsContext.Provider value={visible}>
        {visible.map((id) => (
          <Fragment key={id}>{sections[id]}</Fragment>
        ))}
      </VisibleSectionsContext.Provider>
    </aside>
  )
}
