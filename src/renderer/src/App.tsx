// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
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
import * as cmd from '@/commands'
import { AboutDialog, ShortcutsDialog } from '@/components/AboutDialogs'
import { AccountDialog } from '@/components/AccountDialog'
import { CloudOpenDialog, CloudSaveDialog } from '@/components/CloudDialogs'
import { MacrosDialog } from '@/components/MacrosDialog'
import { SnippetsDialog } from '@/components/SnippetsDialog'
import { useDialogs } from '@/store/dialogs'
import { applyLocale, useLocale, useT } from '@/i18n'
import { useAccount } from '@/store/account'
import { useLibrary } from '@/store/library'

/** Atalhos globais da aplicação (os de edição ficam com o próprio Monaco). */
function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
  const sidebarVisible = useView((s) => s.sidebarVisible)
  const bottomPanelVisible = useView((s) => s.bottomPanelVisible)
  const dialog = useDialogs((s) => s.open)
  const t = useT()
  // Quantos documentos voltaram com texto não salvo (o texto do aviso é montado ao desenhar, no idioma atual).
  const [restoredCount, setRestoredCount] = useState(0)
  useGlobalShortcuts()

  // Restaura a sessão anterior; sem nada para restaurar, começa com um documento em branco.
  useEffect(() => {
    // Avisa o processo principal do idioma inicial (o do sistema, ou inglês se não houver tradução).
    applyLocale(useLocale.getState().locale)
    let stopAutosave = () => {}
    let cancelled = false
    void restoreSession().then(({ restored, recovered }) => {
      if (cancelled) return
      if (!restored) useDocuments.getState().newDocument()
      setRestoredCount(recovered)
      stopAutosave = startSessionAutosave()
    })
    void useWorkspace.getState().refreshRecent()
    return () => {
      cancelled = true
      stopAutosave()
    }
  }, [])

  // Monitoramento de alterações externas e confirmação ao fechar a janela.
  useEffect(() => startFileSync(), [])
  useEffect(() => void useLibrary.getState().load(), [])
  useEffect(() => void useAccount.getState().load(), [])
  useEffect(() => window.api.onBeforeClose(() => void cmd.requestQuit()), [])

  return (
    <div className="flex h-full flex-col">
      <MenuBar />
      <Toolbar />
      {restoredCount > 0 && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900">
          <span className="flex-1">{t('app.restored', { n: restoredCount })} {t('app.restoredHint')}</span>
          <button type="button" aria-label={t('app.closeNotice')} onClick={() => setRestoredCount(0)} className="rounded p-0.5 hover:bg-amber-100">
            <X size={14} />
          </button>
        </div>
      )}
      <Group orientation="horizontal" className="min-h-0 flex-1">
        {sidebarVisible && (
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
                <TabBar />
                <div className="min-h-0 flex-1">
                  <EditorPane />
                </div>
              </div>
            </Panel>
            {bottomPanelVisible && (
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
      <StatusBar />
      {dialog === 'snippets' && <SnippetsDialog />}
      {dialog === 'macros' && <MacrosDialog />}
      {dialog === 'account' && <AccountDialog />}
      {dialog === 'cloudOpen' && <CloudOpenDialog />}
      {dialog === 'cloudSave' && <CloudSaveDialog />}
      {dialog === 'shortcuts' && <ShortcutsDialog />}
      {dialog === 'about' && <AboutDialog />}
    </div>
  )
}
