// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import * as cmd from '@/commands'
import { languageLabel, languageMenu } from '@/editor/languages'
import { useT } from '@/i18n'
import { useActiveDocument } from '@/store/documents'
import { NEW_TYPES } from '@/newTypes'
import { useAccount } from '@/store/account'
import { useLibrary } from '@/store/library'
import { useView } from '@/store/view'
import { useWorkspace } from '@/store/workspace'

interface Item {
  label: string
  shortcut?: string
  action?: () => void
  checked?: boolean
}
type Entry = Item | 'separator'

function Menu({ title, items }: { title: string; items: Entry[] }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="rounded px-2.5 py-1 outline-none hover:bg-zinc-200 data-[state=open]:bg-zinc-200">
        {title}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={2}
          className="z-50 max-h-[75vh] min-w-60 overflow-y-auto rounded-md border border-border bg-white py-1 text-[13px] shadow-lg"
        >
          {items.map((item, i) =>
            item === 'separator' ? (
              <DropdownMenu.Separator key={i} className="my-1 h-px bg-zinc-200" />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={!item.action}
                onSelect={() => item.action?.()}
                className="flex cursor-default items-center gap-2 px-3 py-1.5 outline-none data-[disabled]:text-zinc-400 data-[highlighted]:bg-accent data-[highlighted]:text-white"
              >
                <span className="w-4">{item.checked && <Check size={14} />}</span>
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <span className="text-xs opacity-60">{item.shortcut}</span>}
              </DropdownMenu.Item>
            )
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Itens sem "action" aparecem desabilitados: estão previstos no roadmap. */
export function MenuBar() {
  const t = useT()
  const view = useView()
  const folderOpen = useWorkspace((s) => s.folder !== null)
  const doc = useActiveDocument()
  const recording = useLibrary((s) => s.recording)
  const account = useAccount((s) => s.status.user)
  const hasRecording = useLibrary((s) => s.steps.length > 0)
  const withDoc = (fn: () => void): (() => void) | undefined => (doc ? fn : undefined)

  const menus: { title: string; items: Entry[] }[] = [
    {
      title: t('menu.file'),
      items: [
        { label: t('menu.file.newMd'), shortcut: 'Ctrl+N', action: () => cmd.newFile() },
        ...NEW_TYPES.filter((type) => type.ext !== 'md').map((type) => ({ label: t('menu.file.newOfType', { label: type.nameKey ? t(type.nameKey) : type.name, ext: type.ext }), action: () => cmd.newFile(type.ext) })),
        { label: t('menu.file.open'), shortcut: 'Ctrl+O', action: () => void cmd.openFile() },
        { label: t('menu.file.openFolder'), shortcut: 'Ctrl+Shift+K', action: () => void cmd.openFolder() },
        { label: t('menu.file.closeFolder'), action: folderOpen ? cmd.closeFolder : undefined },
        'separator',
        { label: t('menu.file.save'), shortcut: 'Ctrl+S', action: () => void cmd.save() },
        { label: t('menu.file.saveAs'), shortcut: 'Ctrl+Shift+S', action: () => void cmd.saveAs() },
        { label: t('menu.file.saveAll'), action: () => void cmd.saveAll() },
        'separator',
        { label: t('menu.file.openCloud'), action: cmd.openCloudFiles },
        { label: t('menu.file.saveCloud'), action: withDoc(cmd.saveToCloudDialog) },
        'separator',
        { label: t('menu.file.print') },
        'separator',
        { label: t('menu.file.closeTab'), shortcut: 'Ctrl+W', action: () => void cmd.closeFile() },
        { label: t('menu.file.closeAllTabs'), action: () => void cmd.closeAll() },
        'separator',
        { label: t('menu.file.exit'), shortcut: 'Alt+F4', action: () => void cmd.requestQuit() }
      ]
    },
    {
      title: t('menu.edit'),
      items: [
        { label: t('menu.edit.undo'), shortcut: 'Ctrl+Z', action: cmd.undo },
        { label: t('menu.edit.redo'), shortcut: 'Ctrl+Y', action: cmd.redo },
        'separator',
        { label: t('menu.edit.selectAll'), shortcut: 'Ctrl+A', action: cmd.selectAll },
        { label: t('menu.edit.columnSelection'), shortcut: t('menu.edit.columnSelectionKeys'), action: cmd.toggleColumnSelection },
        'separator',
        { label: t('menu.edit.sortAsc'), action: cmd.sortLinesAsc },
        { label: t('menu.edit.sortDesc'), action: cmd.sortLinesDesc },
        { label: t('menu.edit.removeDuplicates'), action: cmd.removeDuplicateLines },
        { label: t('menu.edit.trimWhitespace'), action: cmd.trimWhitespace },
        'separator',
        { label: t('menu.edit.indentSpaces'), checked: view.insertSpaces, action: () => view.toggle('insertSpaces') },
        ...[2, 4, 8].map((n) => ({ label: t('menu.edit.tabSize', { n }), checked: view.tabSize === n, action: () => view.setTabSize(n) }))
      ]
    },
    {
      title: t('menu.search'),
      items: [
        { label: t('menu.search.find'), shortcut: 'Ctrl+F', action: cmd.find },
        { label: t('menu.search.replace'), shortcut: 'Ctrl+H', action: cmd.replace },
        { label: t('menu.search.findInFiles'), shortcut: 'Ctrl+Shift+F', action: () => cmd.openSearch() },
        'separator',
        { label: t('menu.search.goToLine'), shortcut: 'Ctrl+G', action: cmd.goToLine }
      ]
    },
    {
      title: t('menu.view'),
      items: [
        { label: t('menu.view.togglePreview'), shortcut: 'Ctrl+Shift+E', action: cmd.togglePreview },
        'separator',
        { label: t('menu.view.sidebar'), shortcut: 'Ctrl+Shift+B', checked: view.sidebarVisible, action: () => view.toggle('sidebarVisible') },
        { label: t('menu.view.bottomPanel'), checked: view.bottomPanelVisible, action: () => view.toggle('bottomPanelVisible') },
        'separator',
        { label: t('menu.view.wordWrap'), checked: view.wordWrap, action: () => view.toggle('wordWrap') },
        { label: t('menu.view.invisibles'), checked: view.showInvisibles, action: () => view.toggle('showInvisibles') },
        'separator',
        { label: t('menu.view.fontIncrease'), shortcut: 'Ctrl++', action: cmd.zoomIn },
        { label: t('menu.view.fontDecrease'), shortcut: 'Ctrl+-', action: cmd.zoomOut },
        { label: t('menu.view.fontReset'), shortcut: 'Ctrl+0', action: cmd.zoomReset },
        'separator',
        { label: t('menu.view.foldAll'), action: cmd.foldAll },
        { label: t('menu.view.unfoldAll'), action: cmd.unfoldAll }
      ]
    },
    {
      title: t('menu.encoding'),
      items: [
        { label: 'UTF-8', checked: doc?.encoding === 'UTF-8', action: withDoc(() => cmd.convertEncoding('UTF-8')) },
        { label: t('menu.encoding.utf8bom'), checked: doc?.encoding === 'UTF-8 BOM', action: withDoc(() => cmd.convertEncoding('UTF-8 BOM')) },
        'separator',
        { label: t('menu.encoding.crlf'), checked: doc?.eol === 'CRLF', action: withDoc(() => cmd.convertEol('CRLF')) },
        { label: t('menu.encoding.lf'), checked: doc?.eol === 'LF', action: withDoc(() => cmd.convertEol('LF')) }
      ]
    },
    {
      title: t('menu.language'),
      items: languageMenu(t).map((id) => ({
        label: languageLabel(id),
        checked: doc?.language === id,
        action: withDoc(() => cmd.setLanguage(id))
      }))
    },
    {
      title: t('menu.tools'),
      items: [
        { label: t('menu.tools.commandPalette'), shortcut: 'F1', action: cmd.commandPalette },
        'separator',
        { label: t('menu.tools.snippets'), action: cmd.openSnippets },
        { label: recording ? t('menu.tools.macroStop') : t('menu.tools.macroRecord'), shortcut: 'Ctrl+Shift+R', action: cmd.toggleMacroRecording },
        { label: t('menu.tools.macroRunLast'), shortcut: 'Ctrl+Shift+M', action: hasRecording && !recording ? cmd.playLastMacro : undefined },
        { label: t('menu.tools.macros'), action: cmd.openMacros },
        'separator',
        { label: t('menu.tools.compare') },
        { label: t('menu.tools.ai') }
      ]
    },
    {
      title: t('menu.account'),
      items: [
        account ? { label: t('menu.account.profile', { name: account.name }), action: cmd.openAccount } : { label: t('menu.account.signIn'), action: cmd.openAccount },
        { label: t('menu.account.cloudFiles'), action: cmd.openCloudFiles }
      ]
    },
    {
      title: t('menu.help'),
      items: [
        { label: t('menu.help.manual'), action: cmd.openManual },
        { label: t('menu.help.shortcuts'), action: cmd.openShortcuts },
        { label: t('menu.help.about'), action: cmd.openAbout },
        { label: t('menu.help.support') } // ainda não disponível
      ]
    }
  ]

  return (
    <nav className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border bg-chrome px-1">
      {menus.map((m) => (
        <Menu key={m.title} title={m.title} items={m.items} />
      ))}
    </nav>
  )
}
