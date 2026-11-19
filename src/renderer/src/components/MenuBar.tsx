import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import * as cmd from '@/commands'
import { LANGUAGE_LABELS, LANGUAGE_MENU } from '@/editor/languages'
import { useActiveDocument } from '@/store/documents'
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
  const view = useView()
  const folderOpen = useWorkspace((s) => s.folder !== null)
  const doc = useActiveDocument()
  const recording = useLibrary((s) => s.recording)
  const account = useAccount((s) => s.status.user)
  const hasRecording = useLibrary((s) => s.steps.length > 0)
  const withDoc = (fn: () => void): (() => void) | undefined => (doc ? fn : undefined)

  const menus: { title: string; items: Entry[] }[] = [
    {
      title: 'Arquivo',
      items: [
        { label: 'Novo', shortcut: 'Ctrl+N', action: cmd.newFile },
        { label: 'Abrir...', shortcut: 'Ctrl+O', action: () => void cmd.openFile() },
        { label: 'Abrir pasta...', shortcut: 'Ctrl+Shift+K', action: () => void cmd.openFolder() },
        { label: 'Fechar pasta', action: folderOpen ? cmd.closeFolder : undefined },
        'separator',
        { label: 'Salvar', shortcut: 'Ctrl+S', action: () => void cmd.save() },
        { label: 'Salvar como...', shortcut: 'Ctrl+Shift+S', action: () => void cmd.saveAs() },
        { label: 'Salvar todos', action: () => void cmd.saveAll() },
        'separator',
        { label: 'Abrir da nuvem...', action: cmd.openCloudFiles },
        { label: 'Salvar na nuvem...', action: withDoc(cmd.saveToCloudDialog) },
        'separator',
        { label: 'Imprimir...' },
        'separator',
        { label: 'Fechar aba', shortcut: 'Ctrl+W', action: () => void cmd.closeFile() },
        { label: 'Fechar todas as abas', action: () => void cmd.closeAll() },
        'separator',
        { label: 'Sair', shortcut: 'Alt+F4', action: () => void cmd.requestQuit() }
      ]
    },
    {
      title: 'Editar',
      items: [
        { label: 'Desfazer', shortcut: 'Ctrl+Z', action: cmd.undo },
        { label: 'Refazer', shortcut: 'Ctrl+Y', action: cmd.redo },
        'separator',
        { label: 'Selecionar tudo', shortcut: 'Ctrl+A', action: cmd.selectAll },
        { label: 'Seleção por coluna', shortcut: 'Shift+Alt+Arrastar', action: cmd.toggleColumnSelection },
        'separator',
        { label: 'Ordenar linhas (A-Z)', action: cmd.sortLinesAsc },
        { label: 'Ordenar linhas (Z-A)', action: cmd.sortLinesDesc },
        { label: 'Remover linhas duplicadas', action: cmd.removeDuplicateLines },
        { label: 'Remover espaços no fim das linhas', action: cmd.trimWhitespace },
        'separator',
        { label: 'Indentar com espaços', checked: view.insertSpaces, action: () => view.toggle('insertSpaces') },
        ...[2, 4, 8].map((n) => ({ label: `Tabulação: ${n} colunas`, checked: view.tabSize === n, action: () => view.setTabSize(n) }))
      ]
    },
    {
      title: 'Pesquisar',
      items: [
        { label: 'Localizar...', shortcut: 'Ctrl+F', action: cmd.find },
        { label: 'Substituir...', shortcut: 'Ctrl+H', action: cmd.replace },
        { label: 'Localizar em arquivos...', shortcut: 'Ctrl+Shift+F', action: () => cmd.openSearch() },
        'separator',
        { label: 'Ir para linha...', shortcut: 'Ctrl+G', action: cmd.goToLine }
      ]
    },
    {
      title: 'Exibir',
      items: [
        { label: 'Alternar visualização (Markdown / JSON)', shortcut: 'Ctrl+Shift+E', action: cmd.togglePreview },
        'separator',
        { label: 'Barra lateral', checked: view.sidebarVisible, action: () => view.toggle('sidebarVisible') },
        { label: 'Painel inferior', checked: view.bottomPanelVisible, action: () => view.toggle('bottomPanelVisible') },
        'separator',
        { label: 'Quebra automática de linha', checked: view.wordWrap, action: () => view.toggle('wordWrap') },
        { label: 'Caracteres invisíveis', checked: view.showInvisibles, action: () => view.toggle('showInvisibles') },
        'separator',
        { label: 'Aumentar fonte', shortcut: 'Ctrl++', action: cmd.zoomIn },
        { label: 'Diminuir fonte', shortcut: 'Ctrl+-', action: cmd.zoomOut },
        { label: 'Tamanho padrão da fonte', shortcut: 'Ctrl+0', action: cmd.zoomReset },
        'separator',
        { label: 'Recolher tudo', action: cmd.foldAll },
        { label: 'Expandir tudo', action: cmd.unfoldAll }
      ]
    },
    {
      title: 'Codificação',
      items: [
        { label: 'UTF-8', checked: doc?.encoding === 'UTF-8', action: withDoc(() => cmd.convertEncoding('UTF-8')) },
        { label: 'UTF-8 com BOM', checked: doc?.encoding === 'UTF-8 BOM', action: withDoc(() => cmd.convertEncoding('UTF-8 BOM')) },
        'separator',
        { label: 'Quebra de linha Windows (CRLF)', checked: doc?.eol === 'CRLF', action: withDoc(() => cmd.convertEol('CRLF')) },
        { label: 'Quebra de linha Unix/Mac (LF)', checked: doc?.eol === 'LF', action: withDoc(() => cmd.convertEol('LF')) }
      ]
    },
    {
      title: 'Linguagem',
      items: LANGUAGE_MENU.map((id) => ({
        label: LANGUAGE_LABELS[id],
        checked: doc?.language === id,
        action: withDoc(() => cmd.setLanguage(id))
      }))
    },
    {
      title: 'Ferramentas',
      items: [
        { label: 'Paleta de comandos', shortcut: 'F1', action: cmd.commandPalette },
        'separator',
        { label: 'Snippets...', action: cmd.openSnippets },
        { label: recording ? 'Parar gravação de macro' : 'Gravar macro', shortcut: 'Ctrl+Shift+R', action: cmd.toggleMacroRecording },
        { label: 'Executar última macro', shortcut: 'Ctrl+Shift+M', action: hasRecording && !recording ? cmd.playLastMacro : undefined },
        { label: 'Macros...', action: cmd.openMacros },
        'separator',
        { label: 'Comparar arquivos...' },
        { label: 'Assistente de IA (Ollama)' }
      ]
    },
    {
      title: 'Conta',
      items: [
        account ? { label: `Meu perfil (${account.name})...`, action: cmd.openAccount } : { label: 'Entrar ou criar conta...', action: cmd.openAccount },
        { label: 'Arquivos da nuvem...', action: cmd.openCloudFiles }
      ]
    },
    { title: 'Plugins', items: [{ label: 'Gerenciar plugins...' }] },
    {
      title: 'Ajuda',
      items: [
        {
          label: 'Sobre',
          action: () =>
            void window.api.getAppInfo().then((info) =>
              window.alert(`Meu Editor de Arquivos\nVersão ${info.version} (${info.platform})\n\nAutor: Diego Mendes Rodrigues`)
            )
        }
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
