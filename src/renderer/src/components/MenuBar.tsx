// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronRight } from 'lucide-react'
import * as cmd from '@/commands'
import { languageLabel, languageMenu } from '@/editor/languages'
import { useT } from '@/i18n'
import { useActiveDocument } from '@/store/documents'
import { MENU_NEW_TYPES } from '@/newTypes'
import { useAccount } from '@/store/account'
import { useLibrary } from '@/store/library'
import { useView } from '@/store/view'
import { useSpelling } from '@/store/spelling'
import { HIDEABLE_SECTIONS, useSidebarLayout, type SidebarSectionId } from '@/store/sidebarLayout'
import { LOCALES } from '@shared/i18n'
import { HASH_ALGORITHMS } from '@shared/ipc'
import { useWorkspace } from '@/store/workspace'

interface Item {
  label: string
  shortcut?: string
  action?: () => void
  checked?: boolean
}
/** Item que abre um submenu. */
interface SubMenu {
  label: string
  items: Entry[]
}
type Entry = Item | SubMenu | 'separator'

/** Texto do item de cada área no menu Exibir → Áreas da barra lateral. */
const SECTION_MENU_KEYS = {
  openDocs: 'menu.view.showOpenDocs',
  cloud: 'menu.view.showCloud',
  apiEnv: 'menu.view.showApiEnv',
  apiCollections: 'menu.view.showApiCollections',
  apiHistory: 'menu.view.showApiHistory'
} as const satisfies Partial<Record<SidebarSectionId, string>>

const contentClass = 'z-50 max-h-[75vh] min-w-60 overflow-y-auto rounded-md border border-border bg-surface py-1 text-[13px] shadow-lg'
const itemClass =
  'flex cursor-default items-center gap-2 px-3 py-1.5 outline-none data-[disabled]:text-zinc-400 data-[highlighted]:bg-accent data-[highlighted]:text-white'

function Entries({ items }: { items: Entry[] }) {
  return (
    <>
      {items.map((item, i) =>
        item === 'separator' ? (
          <DropdownMenu.Separator key={i} className="my-1 h-px bg-zinc-200" />
        ) : 'items' in item ? (
          <DropdownMenu.Sub key={item.label}>
            <DropdownMenu.SubTrigger className={`${itemClass} data-[state=open]:bg-zinc-200`}>
              <span className="w-4" />
              <span className="flex-1">{item.label}</span>
              <ChevronRight size={14} className="opacity-60" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent sideOffset={2} alignOffset={-4} className={contentClass}>
                <Entries items={item.items} />
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        ) : (
          <DropdownMenu.Item key={item.label} disabled={!item.action} onSelect={() => item.action?.()} className={itemClass}>
            <span className="w-4">{item.checked && <Check size={14} />}</span>
            <span className="flex-1">{item.label}</span>
            {item.shortcut && <span className="text-xs opacity-60">{item.shortcut}</span>}
          </DropdownMenu.Item>
        )
      )}
    </>
  )
}

function Menu({ title, items }: { title: string; items: Entry[] }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="rounded px-2.5 py-1 outline-none hover:bg-zinc-200 data-[state=open]:bg-zinc-200">
        {title}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={2} className={contentClass}>
          <Entries items={items} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Itens sem "action" aparecem desabilitados: estão previstos no roadmap. */
export function MenuBar() {
  const t = useT()
  const view = useView()
  const spelling = useSpelling()
  const hiddenSections = useSidebarLayout((s) => s.hidden)
  const toggleSectionHidden = useSidebarLayout((s) => s.toggleHidden)
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
        ...MENU_NEW_TYPES.map((type) => ({ label: t('menu.file.newOfType', { label: type.nameKey ? t(type.nameKey) : type.name, ext: type.ext }), action: () => cmd.newFile(type.ext) })),
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
        ...[2, 4, 8].map((n) => ({ label: t('menu.edit.tabSize', { n }), checked: view.tabSize === n, action: () => view.setTabSize(n) })),
        'separator',
        {
          label: t('menu.edit.eol'),
          items: [
            { label: t('menu.edit.eolWindows'), checked: doc?.eol === 'CRLF', action: withDoc(() => cmd.convertEol('CRLF')) },
            { label: t('menu.edit.eolUnix'), checked: doc?.eol === 'LF', action: withDoc(() => cmd.convertEol('LF')) },
            { label: t('menu.edit.eolMac'), checked: doc?.eol === 'CR', action: withDoc(() => cmd.convertEol('CR')) }
          ]
        },
        {
          label: t('menu.edit.case'),
          items: [
            { label: t('menu.edit.caseUpper'), action: withDoc(() => cmd.convertCase('upper')) },
            { label: t('menu.edit.caseLower'), action: withDoc(() => cmd.convertCase('lower')) },
            { label: t('menu.edit.caseSentence'), action: withDoc(() => cmd.convertCase('sentence')) }
          ]
        },
        {
          label: t('menu.edit.spaces'),
          items: [
            { label: t('menu.edit.trimRight'), action: withDoc(() => cmd.trimSpaces('right')) },
            { label: t('menu.edit.trimLeft'), action: withDoc(() => cmd.trimSpaces('left')) },
            { label: t('menu.edit.trimBoth'), action: withDoc(() => cmd.trimSpaces('both')) },
            { label: t('menu.edit.collapseSpaces'), action: withDoc(cmd.collapseSpaces) }
          ]
        }
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
        {
          label: t('menu.view.sidebarAreas'),
          items: HIDEABLE_SECTIONS.map((id) => ({
            label: t(SECTION_MENU_KEYS[id]),
            checked: !hiddenSections.includes(id),
            action: () => toggleSectionHidden(id)
          }))
        },
        { label: t('menu.view.bottomPanel'), checked: view.bottomPanelVisible, action: () => view.toggle('bottomPanelVisible') },
        { label: t('menu.view.fullScreen'), shortcut: 'F11', checked: view.fullScreen, action: cmd.toggleFullScreen },
        'separator',
        { label: t('menu.view.wordWrap'), checked: view.wordWrap, action: () => view.toggle('wordWrap') },
        { label: t('menu.view.invisibles'), checked: view.showInvisibles, action: () => view.toggle('showInvisibles') },
        'separator',
        { label: t('menu.view.fontIncrease'), shortcut: 'Ctrl++', action: cmd.zoomIn },
        { label: t('menu.view.fontDecrease'), shortcut: 'Ctrl+-', action: cmd.zoomOut },
        { label: t('menu.view.fontReset'), shortcut: 'Ctrl+0', action: cmd.zoomReset },
        'separator',
        { label: t('menu.view.foldAll'), action: cmd.foldAll },
        { label: t('menu.view.unfoldAll'), action: cmd.unfoldAll },
        'separator',
        { label: t('menu.view.toggleTheme'), action: cmd.toggleTheme }
      ]
    },
    {
      title: t('menu.encoding'),
      items: [
        { label: 'UTF-8', checked: doc?.encoding === 'UTF-8', action: withDoc(() => cmd.convertEncoding('UTF-8')) },
        { label: t('menu.encoding.utf8bom'), checked: doc?.encoding === 'UTF-8 BOM', action: withDoc(() => cmd.convertEncoding('UTF-8 BOM')) },
        'separator',
        { label: t('menu.encoding.crlf'), checked: doc?.eol === 'CRLF', action: withDoc(() => cmd.convertEol('CRLF')) },
        { label: t('menu.encoding.lf'), checked: doc?.eol === 'LF', action: withDoc(() => cmd.convertEol('LF')) },
        { label: t('menu.encoding.cr'), checked: doc?.eol === 'CR', action: withDoc(() => cmd.convertEol('CR')) },
        'separator',
        { label: t('menu.encoding.autoFormat'), action: withDoc(() => void cmd.autoFormat()) },
        { label: t('menu.encoding.url'), action: withDoc(cmd.urlEncodeDecode) }
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
        { label: t('menu.tools.openTerminal'), action: cmd.openTerminal },
        { label: t('menu.tools.ai'), shortcut: 'Ctrl+Shift+I', action: cmd.toggleAssistant },
        'separator',
        { label: t('menu.tools.apiClient'), shortcut: 'Ctrl+Shift+A', action: cmd.openApiClient },
        { label: t('menu.tools.apiWebSocket'), action: cmd.newWebSocketDocument },
        { label: t('menu.tools.apiGrpc'), action: cmd.newGrpcDocument },
        { label: t('menu.tools.apiImport'), action: cmd.openApiImport },
        { label: t('menu.tools.apiEnvironments'), action: cmd.newEnvironmentDocument },
        { label: t('menu.tools.apiCookies'), action: cmd.openApiCookies },
        { label: t('menu.tools.apiMock'), action: cmd.openApiMock },
        { label: t('menu.tools.apiMonitor'), action: cmd.openApiMonitor },
        { label: t('menu.tools.apiHistory'), action: cmd.showApiHistory },
        'separator',
        { label: t('menu.tools.spellCheck'), shortcut: 'F7', checked: spelling.enabled, action: spelling.toggle },
        {
          label: t('menu.tools.spellSubmenu'),
          items: [
            { label: t('menu.tools.spellAuto'), checked: spelling.locale === null, action: () => spelling.setLocale(null) },
            ...LOCALES.map((l) => ({ label: t('menu.tools.spellLanguage', { name: l.name }), checked: spelling.locale === l.code, action: () => spelling.setLocale(l.code) }))
          ]
        },
        'separator',
        { label: t('menu.tools.compare') },
        'separator',
        ...HASH_ALGORITHMS.map((algorithm) => ({
          label: algorithm,
          items: [
            { label: t('menu.tools.hashGenerate'), action: () => cmd.openHash(algorithm) },
            { label: t('menu.tools.hashSelection'), action: withDoc(() => void cmd.hashSelection(algorithm)) }
          ]
        }))
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
        'separator',
        { label: t('menu.help.about'), action: cmd.openAbout },
        { label: t('menu.help.support'), action: cmd.openSupport },
        { label: t('menu.help.checkUpdate'), action: cmd.checkUpdate }
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
