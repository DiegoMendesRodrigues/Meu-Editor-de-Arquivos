import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, FileText, Folder, FolderOpen, FolderPlus, RefreshCw, Trash2, X } from 'lucide-react'
import type { FolderEntry } from '@shared/ipc'
import { closeFolder, openFolder, openPath } from '@/commands'
import { isDirty, useDocuments } from '@/store/documents'
import { useWorkspace } from '@/store/workspace'

function Section({
  title,
  actions,
  children
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-3">
      <div className="group flex items-center px-3 py-1">
        <h2 className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">{actions}</div>
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
      .catch(() => setError('Não foi possível ler a pasta.'))
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
          {children?.length === 0 && <p style={{ paddingLeft: (depth + 1) * 12 + 30 }} className="py-0.5 text-zinc-400">Pasta vazia</p>}
          {children?.map((child) => (
            <FolderNode key={child.path} entry={child} depth={depth + 1} activePath={activePath} reloadKey={reloadKey} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const documents = useDocuments((s) => s.documents)
  const activeId = useDocuments((s) => s.activeId)
  const setActive = useDocuments((s) => s.setActive)
  const folder = useWorkspace((s) => s.folder)
  const recentFiles = useWorkspace((s) => s.recentFiles)
  const clearRecent = useWorkspace((s) => s.clearRecent)
  const [reloadKey, setReloadKey] = useState(0)
  const activePath = documents.find((d) => d.id === activeId)?.path ?? null

  return (
    <aside className="h-full overflow-y-auto bg-chrome pt-2">
      <Section title="Documentos abertos">
        {documents.length === 0 && <p className="px-3 text-zinc-400">Nenhum documento aberto.</p>}
        <ul>
          {documents.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                title={d.path ?? d.name}
                onClick={() => setActive(d.id)}
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

      <Section
        title={folder ? `Explorador: ${folder.name}` : 'Explorador'}
        actions={
          folder ? (
            <>
              <IconButton icon={RefreshCw} label="Atualizar" onClick={() => setReloadKey((k) => k + 1)} />
              <IconButton icon={X} label="Fechar pasta" onClick={closeFolder} />
            </>
          ) : undefined
        }
      >
        {folder ? (
          <div role="tree" aria-label={`Arquivos de ${folder.name}`}>
            <FolderNode key={folder.path} entry={{ name: folder.name, path: folder.path, isDirectory: true }} depth={0} activePath={activePath} reloadKey={reloadKey} />
          </div>
        ) : (
          <div className="px-3">
            <button
              type="button"
              onClick={() => void openFolder()}
              className="flex items-center gap-1.5 rounded border border-border bg-white px-2.5 py-1 hover:bg-zinc-100"
            >
              <FolderPlus size={14} /> Abrir pasta
            </button>
          </div>
        )}
      </Section>

      <Section
        title="Recentes"
        actions={recentFiles.length > 0 ? <IconButton icon={Trash2} label="Limpar lista" onClick={() => void clearRecent()} /> : undefined}
      >
        {recentFiles.length === 0 && <p className="px-3 text-zinc-400">Nenhum arquivo recente.</p>}
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
    </aside>
  )
}
