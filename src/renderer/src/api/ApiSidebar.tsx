// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Seções do Cliente de API na barra lateral: ambiente ativo, coleções e histórico. */
import { useEffect, useMemo, useState } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { ChevronRight, Cloud, Cookie, FilePlus, FileText, FolderPlus, Layers, Library, Play, Plus, RefreshCw, Settings, Server, Share, Trash2, X } from 'lucide-react'
import { useT } from '@/i18n'
import { useCloud, joinPath } from '@/store/cloud'
import { isDirty, useActiveDocument, useDocuments } from '@/store/documents'
import { cloudFolderKey, localFolderKey } from '@/store/folderColors'
import { useWorkspace } from '@/store/workspace'
import { isApiDocument, useApiStore } from '@/store/api'
import { newEnvironmentDocument } from '@/commands'
import { useSidebarDialog, type SidebarTarget } from '@/sidebarActions'
import { EntryMenu, FileIcon, FolderIcon, itemClass } from '@/components/SidebarMenus'
import { IconButton, Section } from '@/components/SidebarSection'
import { METHOD_CLASS } from './ApiRequestView'
import { COLLECTION_FILE, discoverDiskCollections, isCloudDir, joinDisk, readCollection, type CollectionTree } from './collections'
import { createFolderIn, createRequestIn, documentCollection, newCollectionFlow, openCollectionFile, openCollectionSettings } from './collectionActions'
import { EnvironmentSelect } from './EnvironmentSelect'
import { HistoryList } from './HistoryPanel'

const slash = (p: string): string => p.replace(/\\/g, '/')
const baseOf = (p: string): string => slash(p).split('/').filter(Boolean).pop() ?? p
const parentRel = (rel: string): string => rel.split('/').slice(0, -1).join('/')
const stripExt = (name: string): string => name.replace(/\.[^.]+$/, '')

/** Itens do menu do botão direito de uma coleção (completo) ou de uma pasta dela (só criar). */
function CollectionActions({ dir, root }: { dir: string; root?: string }) {
  const t = useT()
  const openDialog = useApiStore((s) => s.openDialog)
  const isFolder = root !== undefined
  return (
    <>
      <ContextMenu.Item onSelect={() => void createRequestIn(dir)} className={itemClass}>
        <FilePlus size={14} /> {t('apiClient.col.newRequest')}
      </ContextMenu.Item>
      <ContextMenu.Item onSelect={() => openDialog({ kind: 'newFolder', dir })} className={itemClass}>
        <FolderPlus size={14} /> {t('apiClient.col.newFolder')}
      </ContextMenu.Item>
      {!isFolder && (
        <>
          <ContextMenu.Separator className="my-1 h-px bg-zinc-200" />
          <ContextMenu.Item onSelect={() => openDialog({ kind: 'runner', dir })} className={itemClass}>
            <Play size={14} /> {t('apiClient.col.run')}
          </ContextMenu.Item>
          <ContextMenu.Item onSelect={() => openDialog({ kind: 'mock', dir })} className={itemClass}>
            <Server size={14} /> {t('apiClient.col.mock')}
          </ContextMenu.Item>
          <ContextMenu.Item onSelect={() => openDialog({ kind: 'export', dir })} className={itemClass}>
            <Share size={14} /> {t('apiClient.col.export')}
          </ContextMenu.Item>
          <ContextMenu.Item onSelect={() => void documentCollection(dir)} className={itemClass}>
            <FileText size={14} /> {t('apiClient.col.document')}
          </ContextMenu.Item>
          <ContextMenu.Item onSelect={() => openDialog({ kind: 'cookies' })} className={itemClass}>
            <Cookie size={14} /> {t('apiClient.col.cookies')}
          </ContextMenu.Item>
          <ContextMenu.Item onSelect={() => void openCollectionSettings(dir)} className={itemClass}>
            <Settings size={14} /> {t('apiClient.col.settings')}
          </ContextMenu.Item>
        </>
      )}
    </>
  )
}

interface Node {
  tree: CollectionTree
  cloud: boolean
}

function RequestRow({ node, path, label, method, depth }: { node: Node; path: string; label: string; method?: string; depth: number }) {
  const cloudId = useCloud((s) => (node.cloud ? s.files.find((f) => f.path === path)?.id : undefined))
  const activePath = useActiveDocument()
  const active = node.cloud ? !!cloudId && activePath?.cloud?.id === cloudId : activePath?.path === path
  const target: SidebarTarget = { source: node.cloud ? 'cloud' : 'local', kind: 'file', path, name: baseOf(path), ...(cloudId ? { cloudId } : {}) }
  return (
    <EntryMenu target={target}>
      <button
        type="button"
        title={path}
        onClick={() => void openCollectionFile(path)}
        style={{ paddingLeft: depth * 12 + 8 }}
        className={`flex w-full items-center gap-1.5 truncate py-0.5 pr-2 text-left hover:bg-zinc-200 ${active ? 'bg-zinc-200 font-medium' : ''}`}
      >
        <span className="w-3.5 shrink-0" />
        {method ? <span className={`w-9 shrink-0 text-[10px] font-bold ${METHOD_CLASS[method] ?? 'text-zinc-600'}`}>{method}</span> : <FileIcon name={baseOf(path)} />}
        <span className="truncate">{label}</span>
      </button>
    </EntryMenu>
  )
}

function FolderRow({ node, rel, depth }: { node: Node; rel: string; depth: number }) {
  const { tree, cloud } = node
  const [open, setOpen] = useState(false)
  const path = cloud ? joinPath(tree.dir, rel) : joinDisk(tree.dir, ...rel.split('/'))
  const target: SidebarTarget = { source: cloud ? 'cloud' : 'local', kind: 'folder', path, name: baseOf(rel) }
  return (
    <div role="treeitem" aria-expanded={open}>
      <EntryMenu target={target} extra={<CollectionActions dir={path} root={tree.dir} />}>
        <button type="button" title={path} onClick={() => setOpen((o) => !o)} style={{ paddingLeft: depth * 12 + 8 }} className="flex w-full items-center gap-1.5 truncate py-0.5 pr-2 text-left hover:bg-zinc-200">
          <ChevronRight size={14} className={`shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`} />
          <FolderIcon colorKey={cloud ? cloudFolderKey(path) : localFolderKey(path)} open={open} />
          <span className="truncate">{baseOf(rel)}</span>
        </button>
      </EntryMenu>
      {open && <Children node={node} rel={rel} depth={depth + 1} />}
    </div>
  )
}

/** Subpastas, requisições e ambientes de uma pasta da coleção. */
function Children({ node, rel, depth }: { node: Node; rel: string; depth: number }) {
  const { tree, cloud } = node
  const prefix = cloud ? (tree.dir ? `${tree.dir}/` : '') : `${slash(tree.dir).replace(/\/+$/, '')}/`
  const folders = (tree.folders ?? []).filter((f) => parentRel(f) === rel).sort((a, b) => a.localeCompare(b))
  const requests = tree.requests.filter((r) => r.folder === rel)
  const environments = tree.environments
    .map((p) => ({ path: p, rel: slash(p).slice(prefix.length) }))
    .filter((e) => parentRel(e.rel) === rel)
  return (
    <div role="group">
      {folders.map((f) => (
        <FolderRow key={f} node={node} rel={f} depth={depth} />
      ))}
      {requests.map((r) => (
        <RequestRow key={r.path} node={node} path={r.path} label={r.request.name || stripExt(baseOf(r.path))} method={r.request.method} depth={depth} />
      ))}
      {environments.map((e) => (
        <RequestRow key={e.path} node={node} path={e.path} label={stripExt(baseOf(e.path))} depth={depth} />
      ))}
    </div>
  )
}

function CollectionNode({ dir }: { dir: string }) {
  const t = useT()
  const cloud = isCloudDir(dir)
  const [tree, setTree] = useState<CollectionTree | null>(null)
  const [open, setOpen] = useState(true)
  const tick = useApiStore((s) => s.collectionsTick)
  const explorerVersion = useSidebarDialog((s) => s.explorerVersion)
  // Gravar uma requisição da coleção relê a árvore; na nuvem, a assinatura são os ids e versões dos arquivos.
  const cloudSig = useCloud((s) => (cloud ? s.files.filter((f) => !dir || f.path.startsWith(`${dir}/`)).map((f) => `${f.id}:${f.version}`).join(',') : ''))
  const saveSig = useDocuments((s) =>
    cloud ? '' : s.documents.filter((d) => d.path && isApiDocument(d) && !isDirty(d)).map((d) => `${d.path}:${d.savedContent.length}`).join(',')
  )

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      void readCollection(dir).then(
        (value) => !cancelled && setTree(value),
        () => undefined
      )
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [dir, tick, explorerVersion, cloudSig, saveSig])

  const name = tree?.collection?.name || baseOf(dir) || t('cloud.root')
  const target: SidebarTarget = { source: cloud ? 'cloud' : 'local', kind: 'folder', path: dir, name }
  const node = useMemo<Node | null>(() => (tree ? { tree, cloud } : null), [tree, cloud])
  return (
    <div role="treeitem" aria-expanded={open} data-testid="api-collection">
      <EntryMenu target={target} canRename={false} extra={<CollectionActions dir={dir} />}>
        <button type="button" title={dir || t('cloud.root')} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 truncate px-2 py-0.5 text-left hover:bg-zinc-200">
          <ChevronRight size={14} className={`shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`} />
          {cloud ? <Cloud size={14} className="shrink-0 text-sky-600" aria-label={t('sidebar.cloud')} /> : <Library size={14} className="shrink-0 text-accent" />}
          <span className="truncate font-medium">{name}</span>
        </button>
      </EntryMenu>
      {open && node && <Children node={node} rel="" depth={1} />}
    </div>
  )
}

function CollectionsList() {
  const t = useT()
  const folder = useWorkspace((s) => s.folder)
  const files = useCloud((s) => s.files)
  const userCloud = useCloud((s) => s.loading)
  const tick = useApiStore((s) => s.collectionsTick)
  const explorerVersion = useSidebarDialog((s) => s.explorerVersion)
  const [disk, setDisk] = useState<string[]>([])

  useEffect(() => {
    if (!folder) return setDisk([])
    let cancelled = false
    const timer = setTimeout(() => {
      void discoverDiskCollections(folder.path).then((dirs) => !cancelled && setDisk(dirs), () => undefined)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [folder, tick, explorerVersion])

  const cloudDirs = useMemo(() => {
    const out = new Set<string>()
    for (const f of files) if (baseOf(f.path) === COLLECTION_FILE) out.add(slash(f.path).split('/').slice(0, -1).join('/'))
    return [...out].sort()
  }, [files])
  const roots = [...(folder ? disk : []), ...cloudDirs]

  return (
    <div role="tree" aria-label={t('apiClient.col.section')}>
      {roots.length === 0 && <p className="px-3 text-zinc-400">{userCloud ? t('cloud.loading') : t('apiClient.col.empty')}</p>}
      {roots.map((dir) => (
        <CollectionNode key={`${isCloudDir(dir) ? 'cloud' : 'disk'}:${dir}`} dir={dir} />
      ))}
    </div>
  )
}

/**
 * As áreas do Cliente de API aparecem depois de Ferramentas → Cliente de API ou com uma aba de API ativa.
 * Abrir um arquivo de API (de qualquer jeito) liga as áreas.
 */
export function useApiSidebarVisible(): boolean {
  const sidebarOn = useApiStore((s) => s.sidebarOn)
  const apiActive = isApiDocument(useActiveDocument())
  useEffect(() => {
    if (apiActive && !useApiStore.getState().sidebarOn) useApiStore.getState().setSidebarOn(true)
  }, [apiActive])
  return sidebarOn
}

/** Ambiente ativo. */
export function ApiEnvironmentSection() {
  const t = useT()
  const setSidebarOn = useApiStore((s) => s.setSidebarOn)
  const doc = useActiveDocument()
  return (
    <Section
      id="apiEnv"
      title={t('apiClient.env.section')}
      alwaysShowActions
      actions={
        <>
          <IconButton icon={Plus} label={t('apiClient.env.new')} onClick={newEnvironmentDocument} />
          <IconButton icon={X} label={t('apiClient.sidebar.hide')} onClick={() => setSidebarOn(false)} />
        </>
      }
    >
      <div className="flex items-center gap-1.5 px-3">
        <Layers size={14} className="shrink-0 text-zinc-500" aria-hidden />
        <EnvironmentSelect doc={doc} />
      </div>
    </Section>
  )
}

/** Coleções (pastas com collection.apicol, no disco ou na nuvem). */
export function ApiCollectionsSection() {
  const t = useT()
  const bumpCollections = useApiStore((s) => s.bumpCollections)
  return (
    <Section
      id="apiCollections"
      title={t('apiClient.col.section')}
      alwaysShowActions
      actions={
        <>
          <IconButton icon={Plus} label={t('apiClient.col.new')} onClick={() => void newCollectionFlow()} />
          <IconButton icon={RefreshCw} label={t('sidebar.refresh')} onClick={bumpCollections} />
        </>
      }
    >
      <CollectionsList />
    </Section>
  )
}

/** Histórico de envios (e os cookies guardados). */
export function ApiHistorySection() {
  const t = useT()
  const bumpHistory = useApiStore((s) => s.bumpHistory)
  const openDialog = useApiStore((s) => s.openDialog)
  return (
    <Section
      id="apiHistory"
      title={t('apiClient.history.section')}
      alwaysShowActions
      actions={
        <>
          <IconButton icon={Cookie} label={t('apiClient.cookies.title')} onClick={() => openDialog({ kind: 'cookies' })} />
          <IconButton
            icon={Trash2}
            label={t('apiClient.history.clear')}
            onClick={() => {
              if (window.confirm(t('apiClient.history.confirmClear'))) void window.api.apiHistoryClear().then(bumpHistory, () => undefined)
            }}
          />
        </>
      }
    >
      <HistoryList />
    </Section>
  )
}
