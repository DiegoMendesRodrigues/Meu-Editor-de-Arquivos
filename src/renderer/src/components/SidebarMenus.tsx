// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Ícones de arquivos e pastas da barra lateral, menu do botão direito e as janelas de renomear e de cor. */
import { useRef, useState } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import { Database, File, FileCode, FileTerminal, FileText, Folder, FolderOpen, Globe, Palette, Pencil, ScrollText, Trash2 } from 'lucide-react'
import { checkName } from '@shared/fileName'
import { FOLDER_COLORS, folderColorHex, type FolderColor } from '@shared/folderColors'
import { useT } from '@/i18n'
import { fileKind, type FileKind } from '@/fileKinds'
import { useFolderColors } from '@/store/folderColors'
import { folderColorKey, renameTarget, setFolderColor, useSidebarDialog, type SidebarTarget } from '@/sidebarActions'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from './Modal'

const KIND_ICON: Record<FileKind, { icon: typeof File; className: string }> = {
  document: { icon: FileText, className: 'text-zinc-500' },
  log: { icon: ScrollText, className: 'text-zinc-500' },
  code: { icon: FileCode, className: 'text-sky-600' },
  script: { icon: FileTerminal, className: 'text-emerald-600' },
  web: { icon: Globe, className: 'text-orange-600' },
  data: { icon: Database, className: 'text-violet-600' },
  other: { icon: File, className: 'text-zinc-400' }
}

/** Ícone do arquivo conforme o tipo (documento, log, programação, script, web, dados ou outro). */
export function FileIcon({ name }: { name: string }) {
  const kind = fileKind(name)
  const { icon: Icon, className } = KIND_ICON[kind]
  return <Icon size={14} data-kind={kind} aria-hidden className={`shrink-0 ${className}`} />
}

/** Ícone da pasta, na cor escolhida para ela. */
export function FolderIcon({ colorKey, open, size = 14 }: { colorKey: string; open?: boolean; size?: number }) {
  const color = useFolderColors((s) => s.colors[colorKey])
  const Icon = open ? FolderOpen : Folder
  return <Icon size={size} aria-hidden data-color={color ?? 'amber'} className="shrink-0" style={{ color: folderColorHex(color ?? 'amber') }} />
}

const contentClass = 'z-50 min-w-48 rounded-md border border-border bg-surface py-1 text-[13px] shadow-lg'
const itemClass =
  'flex cursor-default items-center gap-2 px-3 py-1.5 outline-none data-[disabled]:text-zinc-400 data-[highlighted]:bg-accent data-[highlighted]:text-white'

/**
 * Menu do botão direito de uma pasta ou arquivo. Pastas: renomear, cor e excluir (só vazia).
 * Arquivos: renomear. `canRename` falso para a pasta aberta no explorador (ela não é renomeada).
 */
export function EntryMenu({
  target,
  children,
  canRename = true,
  isEmpty,
  onDelete
}: {
  target: SidebarTarget
  children: React.ReactNode
  canRename?: boolean
  /** Pastas: diz se está vazia (pode ler o disco na hora). */
  isEmpty?: () => boolean | Promise<boolean>
  onDelete?: () => void
}) {
  const t = useT()
  const openDialog = useSidebarDialog((s) => s.open)
  const [empty, setEmpty] = useState(false)
  return (
    <ContextMenu.Root
      // Não modal: o menu abre janelas (Radix Dialog), e o modo modal deixaria a página sem cliques.
      modal={false}
      onOpenChange={(open) => {
        if (!open || !isEmpty) return
        setEmpty(false)
        void Promise.resolve(isEmpty()).then(setEmpty)
      }}
    >
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={contentClass} aria-label={target.name}>
          <ContextMenu.Item disabled={!canRename} onSelect={() => openDialog('rename', target)} className={itemClass}>
            <Pencil size={14} /> {t('sidebar.rename')}
          </ContextMenu.Item>
          {target.kind === 'folder' && (
            <>
              <ContextMenu.Item onSelect={() => openDialog('color', target)} className={itemClass}>
                <Palette size={14} /> {t('sidebar.folderColor')}
              </ContextMenu.Item>
              <ContextMenu.Separator className="my-1 h-px bg-zinc-200" />
              <ContextMenu.Item disabled={!canRename || !empty || !onDelete} onSelect={() => onDelete?.()} className={itemClass}>
                <Trash2 size={14} /> {t('common.delete')}
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function RenameDialog({ target, onClose }: { target: SidebarTarget; onClose: () => void }) {
  const t = useT()
  const [name, setName] = useState(target.name)
  const [busy, setBusy] = useState(false)
  const selected = useRef(false)
  const problem = checkName(name)
  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (problem || busy) return
    setBusy(true)
    const ok = await renameTarget(target, name)
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Modal title={t(target.kind === 'folder' ? 'rename.folderTitle' : 'rename.fileTitle')} onClose={onClose} size="sm">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t('rename.newName')}
          <input
            ref={(input) => {
              // Ao abrir: foco no campo e, num arquivo, o nome sem a extensão já selecionado.
              if (!input || selected.current) return
              selected.current = true
              const dot = target.kind === 'file' ? input.value.lastIndexOf('.') : -1
              input.focus()
              input.setSelectionRange(0, dot > 0 ? dot : input.value.length)
            }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={problem !== null && problem !== 'empty'}
            className={fieldClass}
          />
        </label>
        {problem && problem !== 'empty' && <p role="alert" className="text-xs text-red-700">{t(problem === 'tooLong' ? 'rename.tooLong' : 'rename.invalid')}</p>}
        <div className="flex justify-end gap-2">
          <button type="submit" disabled={problem !== null || busy} className={primaryButtonClass}>{t('rename.submit')}</button>
          <button type="button" onClick={onClose} className={buttonClass}>{t('common.cancel')}</button>
        </div>
      </form>
    </Modal>
  )
}

function ColorDialog({ target, onClose }: { target: SidebarTarget; onClose: () => void }) {
  const t = useT()
  const current = useFolderColors((s) => s.colorOf(folderColorKey(target)))
  const [color, setColor] = useState<FolderColor>(current)
  return (
    <Modal title={t('folderColor.title')} onClose={onClose} size="sm">
      <div role="radiogroup" aria-label={t('folderColor.title')} className="grid grid-cols-6 gap-2">
        {FOLDER_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={color === c.id}
            aria-label={t(`folderColor.${c.id}`)}
            title={t(`folderColor.${c.id}`)}
            onClick={() => setColor(c.id)}
            className={`flex items-center justify-center rounded-md border-2 p-2 hover:bg-zinc-100 ${color === c.id ? 'border-accent bg-zinc-100' : 'border-transparent'}`}
          >
            <Folder size={28} fill={c.hex} style={{ color: c.hex }} aria-hidden />
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setFolderColor(target, color)
            onClose()
          }}
          className={primaryButtonClass}
        >
          {t('folderColor.submit')}
        </button>
        <button type="button" onClick={onClose} className={buttonClass}>{t('common.cancel')}</button>
      </div>
    </Modal>
  )
}

/** Janelas abertas pelo menu do botão direito. */
export function SidebarDialogs() {
  const dialog = useSidebarDialog((s) => s.dialog)
  const target = useSidebarDialog((s) => s.target)
  const close = useSidebarDialog((s) => s.close)
  if (!target) return null
  if (dialog === 'rename') return <RenameDialog key={target.path} target={target} onClose={close} />
  if (dialog === 'color') return <ColorDialog key={target.path} target={target} onClose={close} />
  return null
}
