// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect } from 'react'
import { Minimize2 } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { MenuBar } from '@/components/MenuBar'
import { Toolbar } from '@/components/Toolbar'
import { Sidebar } from '@/components/Sidebar'
import { TabBar } from '@/components/TabBar'
import { EditorPane } from '@/components/EditorPane'
import { BottomPanel } from '@/components/BottomPanel'
import { StatusBar } from '@/components/StatusBar'
import { useDocuments } from '@/store/documents'
import { useSpelling } from '@/store/spelling'
import { useView } from '@/store/view'
import { useWorkspace } from '@/store/workspace'
import { startFileSync } from '@/fileSync'
import { restoreSession, startSessionAutosave } from '@/session'
import { startWorkspaceSync } from '@/workspaceSync'
import * as cmd from '@/commands'
import { AboutDialog, ShortcutsDialog, UpdateDialog } from '@/components/AboutDialogs'
import { AccountDialog } from '@/components/AccountDialog'
import { CloudOpenDialog, CloudSaveDialog } from '@/components/CloudDialogs'
import { MacrosDialog } from '@/components/MacrosDialog'
import { SnippetsDialog } from '@/components/SnippetsDialog'
import { HashDialog } from '@/components/HashDialog'
import { useDialogs } from '@/store/dialogs'
import { applyLocale, useLocale, useT } from '@/i18n'
import { useAccount } from '@/store/account'
import { useLibrary } from '@/store/library'
import { useApplyTheme } from '@/theme'
import { TerminalPanel } from '@/terminal/TerminalPanel'
import { useTerminals } from '@/store/terminals'
import { ApiDialogs } from '@/api/ApiDialogs'

/** Atalhos globais da aplicação (os de edição ficam com o próprio Monaco). */
function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        cmd.toggleFullScreen()
        return
      }
      // No terminal, as teclas vão para o shell (Ctrl+W apaga palavra, Ctrl+R busca no histórico...).
      if (e.target instanceof Element && e.target.closest('[data-terminal]')) return
      if (e.key === 'F7' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        useSpelling.getState().toggle()
        return
      }
      if (!e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      const run = (fn: () => unknown) => {
        e.preventDefault()
        e.stopPropagation()
        void fn()
      }
      if (key === 'n' && !e.shiftKey) run(() => cmd.newFile())
      else if (key === 'b' && e.shiftKey) run(() => useView.getState().toggle('sidebarVisible'))
      else if (key === 'f' && e.shiftKey) run(() => cmd.openSearch())
      else if (key === 'r' && e.shiftKey) run(cmd.toggleMacroRecording)
      else if (key === 'm' && e.shiftKey) run(cmd.playLastMacro)
      else if (key === 'k' && e.shiftKey) run(cmd.openFolder)
      else if (key === 'a' && e.shiftKey) run(cmd.openApiClient)
      else if (key === 'o' && !e.shiftKey) run(cmd.openFile)
      else if (key === 's' && e.shiftKey) run(cmd.saveAs)
      else if (key === 's') run(cmd.save)
      else if (key === 'w' && !e.shiftKey) run(cmd.closeFile)
      else if (key === 'e' && e.shiftKey) run(cmd.togglePreview)
      else if (key === '=' || key === '+') run(cmd.zoomIn)
      else if (key === '-') run(cmd.zoomOut)
      else if (key === '0') run(cmd.zoomReset)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}

const separatorClass = 'bg-border transition-colors data-[separator]:hover:bg-accent'

export function App() {
  const t = useT()
  const sidebarVisible = useView((s) => s.sidebarVisible)
  const bottomPanelVisible = useView((s) => s.bottomPanelVisible)
  const fullScreen = useView((s) => s.fullScreen)
  const hasTerminals = useTerminals((s) => s.tabs.length > 0)
  const dialog = useDialogs((s) => s.open)
  useGlobalShortcuts()
  useApplyTheme()

  // A janela também pode sair da tela inteira por fora do app; o estado acompanha.
  useEffect(() => window.api.onFullScreenChanged((on) => useView.getState().setFullScreen(on)), [])

  // Restaura a sessão anterior; sem nada para restaurar, começa com um documento em branco.
  useEffect(() => {
    // Avisa o processo principal do idioma inicial (o do sistema, ou inglês se não houver tradução).
    applyLocale(useLocale.getState().locale)
    let stopAutosave = () => {}
    let stopSync = () => {}
    let cancelled = false
    void restoreSession().then(({ restored }) => {
      if (cancelled) return
      if (!restored) useDocuments.getState().newDocument()
      stopAutosave = startSessionAutosave()
      // Com a conta conectada, as abas e os textos não salvos também ficam na nuvem.
      stopSync = startWorkspaceSync()
    })
    void useWorkspace.getState().refreshRecent()
    return () => {
      cancelled = true
      stopAutosave()
      stopSync()
    }
  }, [])

  // Monitoramento de alterações externas e confirmação ao fechar a janela.
  useEffect(() => startFileSync(), [])

  // Arquivos arrastados do explorador do sistema para qualquer ponto da janela são abertos.
  // Fase de captura: o editor não recebe o arquivo (nem insere o caminho como texto).
  useEffect(() => {
    const hasFiles = (e: DragEvent): boolean => !!e.dataTransfer?.types.includes('Files')
    const onDragOver = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer!.dropEffect = 'copy'
    }
    const onDrop = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      e.stopPropagation()
      void cmd.openDroppedFiles(Array.from(e.dataTransfer!.files))
    }
    window.addEventListener('dragover', onDragOver, true)
    window.addEventListener('drop', onDrop, true)
    return () => {
      window.removeEventListener('dragover', onDragOver, true)
      window.removeEventListener('drop', onDrop, true)
    }
  }, [])
  useEffect(() => void useLibrary.getState().load(), [])
  useEffect(() => void useAccount.getState().load(), [])
  useEffect(() => window.api.onBeforeClose(() => void cmd.requestQuit()), [])

  const dialogs = (
    <>
      {dialog === 'snippets' && <SnippetsDialog />}
      {dialog === 'macros' && <MacrosDialog />}
      {dialog === 'account' && <AccountDialog />}
      {dialog === 'cloudOpen' && <CloudOpenDialog />}
      {dialog === 'cloudSave' && <CloudSaveDialog />}
      {dialog === 'shortcuts' && <ShortcutsDialog />}
      {dialog === 'about' && <AboutDialog />}
      {dialog === 'update' && <UpdateDialog />}
      {dialog === 'hash' && <HashDialog />}
      <ApiDialogs />
    </>
  )

  // Tela inteira: só o documento atual, sem menus, barras, abas e painéis. A árvore é a mesma
  // (os elementos só são omitidos) para o editor não ser recriado nem perder o desfazer.
  return (
    <div className="relative flex h-full flex-col" {...(fullScreen ? { 'data-fullscreen': '' } : {})}>
      {!fullScreen && <MenuBar />}
      {!fullScreen && <Toolbar />}
      <Group orientation="horizontal" className="min-h-0 flex-1">
        {sidebarVisible && !fullScreen && (
          <>
            <Panel id="sidebar" defaultSize={240} minSize={160} maxSize="50%">
              <Sidebar />
            </Panel>
            <Separator className={`w-px ${separatorClass}`} />
          </>
        )}
        <Panel id="main" minSize={300}>
          <Group orientation="vertical" className="h-full">
            <Panel id="editor" minSize={120}>
              <div className="flex h-full flex-col">
                {!fullScreen && <TabBar />}
                <div className="min-h-0 flex-1">
                  <EditorPane />
                </div>
              </div>
            </Panel>
            {/* Terminais (Ferramentas → Abrir o terminal), logo abaixo do documento. */}
            {hasTerminals && !fullScreen && (
              <>
                <Separator className={`h-px ${separatorClass}`} />
                <Panel id="terminal" defaultSize={240} minSize={100}>
                  <TerminalPanel />
                </Panel>
              </>
            )}
            {bottomPanelVisible && !fullScreen && (
              <>
                <Separator className={`h-px ${separatorClass}`} />
                <Panel id="bottom" defaultSize={180} minSize={80}>
                  <BottomPanel />
                </Panel>
              </>
            )}
          </Group>
        </Panel>
      </Group>
      {!fullScreen && <StatusBar />}
      {fullScreen && (
        <button
          type="button"
          onClick={cmd.toggleFullScreen}
          title={t('fullScreen.exit')}
          aria-label={t('fullScreen.exit')}
          className="absolute right-5 top-2 z-40 rounded border border-border bg-surface/80 p-1 text-zinc-600 opacity-40 shadow-sm transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <Minimize2 size={16} />
        </button>
      )}
      {dialogs}
    </div>
  )
}
