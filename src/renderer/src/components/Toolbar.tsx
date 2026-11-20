// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Bold,
  Braces,
  ListTree,
  ChevronDown,
  Eye,
  FilePlus,
  FolderOpen,
  Heading,
  Italic,
  Link,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Pencil,
  Redo2,
  RemoveFormatting,
  Replace,
  Save,
  Search,
  Strikethrough,
  Table,
  Undo2,
  type LucideIcon
} from 'lucide-react'
import * as cmd from '@/commands'
import { LOCALES } from '@shared/i18n'
import { applyLocale, useLocale, useT } from '@/i18n'
import { NEW_TYPES } from '@/newTypes'
import { Flag } from './Flags'
import * as md from '@/markdown/editorFormatting'
import { canPreview, useActiveDocument } from '@/store/documents'

function ToolButton({
  icon: Icon,
  label,
  onClick,
  disabled
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      // Evita tirar o foco (e a seleção) do editor ao clicar no botão.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded p-1.5 text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 disabled:pointer-events-none disabled:text-zinc-300"
    >
      <Icon size={17} strokeWidth={1.75} />
    </button>
  )
}

const Divider = () => <div className="mx-1 h-5 w-px bg-zinc-300" />

const HEADINGS = [
  { level: 1, className: 'text-xl font-semibold' },
  { level: 2, className: 'text-lg font-semibold' },
  { level: 3, className: 'text-base font-semibold' },
  { level: 4, className: 'font-semibold' },
  { level: 5, className: 'text-sm font-semibold' },
  { level: 6, className: 'text-xs font-semibold' },
  { level: 0, className: '' }
]

/** Botão "Novo" (Markdown) com seta para escolher o tipo do documento. */
function NewMenu() {
  const t = useT()
  return (
    <div className="flex items-center">
      <ToolButton icon={FilePlus} label={`${t('toolbar.new')} (Ctrl+N)`} onClick={() => cmd.newFile()} />
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger
          title={t('toolbar.newOtherType')}
          aria-label={t('toolbar.newTypeChoose')}
          className="-ml-1 flex items-center rounded p-1 text-zinc-700 outline-none hover:bg-zinc-200 data-[state=open]:bg-zinc-200"
        >
          <ChevronDown size={12} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={2}
            className="z-50 min-w-44 rounded-md border border-border bg-white py-1 shadow-lg"
          >
            {NEW_TYPES.map((type) => (
              <DropdownMenu.Item
                key={type.ext}
                onSelect={() => cmd.newFile(type.ext)}
                className="cursor-default px-3 py-1.5 text-[13px] outline-none data-[highlighted]:bg-accent data-[highlighted]:text-white"
              >
                {`.${type.ext} (${type.nameKey ? t(type.nameKey) : type.name})`}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}

function HeadingMenu({ disabled }: { disabled: boolean }) {
  const t = useT()
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        disabled={disabled}
        title={t('toolbar.headings')}
        aria-label={t('toolbar.headings')}
        onMouseDown={(e) => e.preventDefault()}
        className="flex items-center rounded p-1.5 text-zinc-700 outline-none hover:bg-zinc-200 disabled:pointer-events-none disabled:text-zinc-300 data-[state=open]:bg-zinc-200"
      >
        <Heading size={17} strokeWidth={1.75} />
        <ChevronDown size={12} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={2}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-50 min-w-44 rounded-md border border-border bg-white py-1 shadow-lg"
        >
          {HEADINGS.map((h) => (
            <DropdownMenu.Item
              key={h.level}
              onSelect={() => md.heading(h.level)}
              className={`cursor-default px-3 py-1.5 outline-none data-[highlighted]:bg-accent data-[highlighted]:text-white ${h.className}`}
            >
              {h.level === 0 ? t('toolbar.normalText') : t('toolbar.heading', { n: h.level })}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Bandeiras dos idiomas disponíveis: clicar em uma troca o idioma do aplicativo. */
function LanguageSwitcher() {
  const t = useT()
  const current = useLocale((s) => s.locale)
  return (
    <div role="group" aria-label={t('toolbar.language')} className="flex items-center gap-1">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          title={l.name}
          aria-label={l.name}
          aria-pressed={current === l.code}
          onClick={() => applyLocale(l.code)}
          className={`rounded p-1 hover:bg-zinc-200 ${current === l.code ? 'bg-blue-100 ring-1 ring-accent' : 'opacity-80'}`}
        >
          <Flag locale={l.code} />
        </button>
      ))}
    </div>
  )
}

export function Toolbar() {
  const t = useT()
  const doc = useActiveDocument()
  const hasPreview = canPreview(doc)
  const isMarkdown = doc?.language === 'markdown'
  const previewing = hasPreview && doc?.mode === 'preview'
  // A formatação vale para Markdown, tanto no texto quanto na visualização (que também é editável).
  const formatOff = !isMarkdown
  // Desfazer/refazer: no JSON em árvore não há o que desfazer; no Markdown formatado, sim.
  const historyOff = previewing && !isMarkdown

  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border bg-white px-2">
      <NewMenu />
      <ToolButton icon={FolderOpen} label={`${t('toolbar.open')} (Ctrl+O)`} onClick={() => void cmd.openFile()} />
      <ToolButton icon={Save} label={`${t('toolbar.save')} (Ctrl+S)`} onClick={() => void cmd.save()} />
      <Divider />
      <ToolButton icon={Undo2} label={`${t('toolbar.undo')} (Ctrl+Z)`} onClick={cmd.undo} disabled={historyOff} />
      <ToolButton icon={Redo2} label={`${t('toolbar.redo')} (Ctrl+Y)`} onClick={cmd.redo} disabled={historyOff} />
      <Divider />
      <ToolButton icon={Search} label={`${t('toolbar.find')} (Ctrl+F)`} onClick={cmd.find} disabled={previewing} />
      <ToolButton icon={Replace} label={`${t('toolbar.replace')} (Ctrl+H)`} onClick={cmd.replace} disabled={previewing} />

      {isMarkdown && (
        <>
          <Divider />
          <HeadingMenu disabled={formatOff} />
          <ToolButton icon={List} label={t('toolbar.bulletList')} onClick={md.bulletList} disabled={formatOff} />
          <ToolButton icon={ListOrdered} label={t('toolbar.numberedList')} onClick={md.numberedList} disabled={formatOff} />
          <ToolButton icon={ListIndentDecrease} label={`${t('toolbar.outdent')} (Shift+Tab)`} onClick={md.outdent} disabled={formatOff} />
          <ToolButton icon={ListIndentIncrease} label={`${t('toolbar.indent')} (Tab)`} onClick={md.indent} disabled={formatOff} />
          <Divider />
          <ToolButton icon={Bold} label={`${t('toolbar.bold')} (Ctrl+B)`} onClick={md.bold} disabled={formatOff} />
          <ToolButton icon={Italic} label={`${t('toolbar.italic')} (Ctrl+I)`} onClick={md.italic} disabled={formatOff} />
          <ToolButton icon={Strikethrough} label={`${t('toolbar.strike')} (Ctrl+Shift+X)`} onClick={md.strikethrough} disabled={formatOff} />
          <ToolButton icon={Link} label={t('toolbar.link')} onClick={md.link} disabled={formatOff} />
          <ToolButton icon={Table} label={t('toolbar.table')} onClick={md.table} disabled={formatOff} />
          <ToolButton icon={RemoveFormatting} label={t('toolbar.clearFormat')} onClick={md.removeFormatting} disabled={formatOff} />
        </>
      )}

      {doc?.language === 'json' && !previewing && (
        <>
          <Divider />
          <ToolButton icon={Braces} label={`${t('toolbar.formatJson')} (Shift+Alt+F)`} onClick={cmd.formatDocument} />
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        {hasPreview && (
          <button
            type="button"
            onClick={cmd.togglePreview}
            title={`${t('toolbar.togglePreview')} (Ctrl+Shift+E)`}
            className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            {previewing ? <Pencil size={14} /> : isMarkdown ? <Eye size={14} /> : <ListTree size={14} />}
            {previewing ? t('toolbar.editText') : isMarkdown ? t('toolbar.preview') : t('toolbar.tree')}
          </button>
        )}
      </div>
    </div>
  )
}
