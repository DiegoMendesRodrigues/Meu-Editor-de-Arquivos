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
  { level: 1, label: 'Título 1', className: 'text-xl font-semibold' },
  { level: 2, label: 'Título 2', className: 'text-lg font-semibold' },
  { level: 3, label: 'Título 3', className: 'text-base font-semibold' },
  { level: 4, label: 'Título 4', className: 'font-semibold' },
  { level: 5, label: 'Título 5', className: 'text-sm font-semibold' },
  { level: 6, label: 'Título 6', className: 'text-xs font-semibold' },
  { level: 0, label: 'Texto normal', className: '' }
]

function HeadingMenu({ disabled }: { disabled: boolean }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        disabled={disabled}
        title="Títulos"
        aria-label="Títulos"
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
              {h.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function Toolbar() {
  const doc = useActiveDocument()
  const hasPreview = canPreview(doc)
  const isMarkdown = doc?.language === 'markdown'
  const previewing = hasPreview && doc?.mode === 'preview'
  // A formatação só vale para Markdown em modo de edição.
  const formatOff = !isMarkdown || previewing

  return (
    <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-border bg-white px-2">
      <ToolButton icon={FilePlus} label="Novo (Ctrl+N)" onClick={cmd.newFile} />
      <ToolButton icon={FolderOpen} label="Abrir (Ctrl+O)" onClick={() => void cmd.openFile()} />
      <ToolButton icon={Save} label="Salvar (Ctrl+S)" onClick={() => void cmd.save()} />
      <Divider />
      <ToolButton icon={Undo2} label="Desfazer (Ctrl+Z)" onClick={cmd.undo} disabled={previewing} />
      <ToolButton icon={Redo2} label="Refazer (Ctrl+Y)" onClick={cmd.redo} disabled={previewing} />
      <Divider />
      <ToolButton icon={Search} label="Localizar (Ctrl+F)" onClick={cmd.find} disabled={previewing} />
      <ToolButton icon={Replace} label="Substituir (Ctrl+H)" onClick={cmd.replace} disabled={previewing} />

      {isMarkdown && (
        <>
          <Divider />
          <HeadingMenu disabled={formatOff} />
          <ToolButton icon={List} label="Lista com marcadores" onClick={md.bulletList} disabled={formatOff} />
          <ToolButton icon={ListOrdered} label="Lista numerada" onClick={md.numberedList} disabled={formatOff} />
          <ToolButton icon={ListIndentDecrease} label="Diminuir recuo (Shift+Tab)" onClick={md.outdent} disabled={formatOff} />
          <ToolButton icon={ListIndentIncrease} label="Aumentar recuo (Tab)" onClick={md.indent} disabled={formatOff} />
          <Divider />
          <ToolButton icon={Bold} label="Negrito (Ctrl+B)" onClick={md.bold} disabled={formatOff} />
          <ToolButton icon={Italic} label="Itálico (Ctrl+I)" onClick={md.italic} disabled={formatOff} />
          <ToolButton icon={Strikethrough} label="Tachado (Ctrl+Shift+X)" onClick={md.strikethrough} disabled={formatOff} />
          <ToolButton icon={Link} label="Link" onClick={md.link} disabled={formatOff} />
          <ToolButton icon={Table} label="Tabela" onClick={md.table} disabled={formatOff} />
          <ToolButton icon={RemoveFormatting} label="Remover formatação" onClick={md.removeFormatting} disabled={formatOff} />
        </>
      )}

      {doc?.language === 'json' && !previewing && (
        <>
          <Divider />
          <ToolButton icon={Braces} label="Formatar JSON (Shift+Alt+F)" onClick={cmd.formatDocument} />
        </>
      )}

      {hasPreview && (
        <>

          <button
            type="button"
            onClick={cmd.togglePreview}
            title="Alternar visualização (Ctrl+Shift+E)"
            className="ml-auto flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-zinc-700 hover:bg-zinc-100"
          >
            {previewing ? <Pencil size={14} /> : isMarkdown ? <Eye size={14} /> : <ListTree size={14} />}
            {previewing ? 'Editar texto' : isMarkdown ? 'Visualizar' : 'Ver em árvore'}
          </button>
        </>
      )}
    </div>
  )
}
