// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useT } from '@/i18n'
import { useTerminals } from '@/store/terminals'
import { useView } from '@/store/view'
import { useTheme } from '@/theme'
import { closeTerminal, connect } from './terminalBus'

const THEMES: Record<'light' | 'dark', ITheme> = {
  // No fundo branco, as cores claras do padrão (o amarelo do PowerShell, por exemplo) ficam ilegíveis.
  light: {
    background: '#ffffff',
    foreground: '#1f2937',
    cursor: '#1f2937',
    selectionBackground: '#bfdbfe',
    black: '#1f2937',
    red: '#b91c1c',
    green: '#15803d',
    yellow: '#a16207',
    blue: '#1d4ed8',
    magenta: '#a21caf',
    cyan: '#0e7490',
    white: '#6b7280',
    brightBlack: '#4b5563',
    brightRed: '#dc2626',
    brightGreen: '#16a34a',
    brightYellow: '#92400e',
    brightBlue: '#2563eb',
    brightMagenta: '#c026d3',
    brightCyan: '#0891b2',
    brightWhite: '#374151'
  },
  dark: { background: '#1e1e1e', foreground: '#e4e4e7', cursor: '#e4e4e7', selectionBackground: '#264f78' }
}

/** Um terminal (xterm.js) ligado a um shell do Main. Fica montado enquanto a aba existir, para não perder o histórico. */
function TerminalView({ id, active }: { id: number; active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const theme = useTheme()
  const fontSize = useView((s) => s.fontSize)

  useEffect(() => {
    const term = new Terminal({
      fontFamily: "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', 'Ubuntu Mono', monospace",
      fontSize: useView.getState().fontSize,
      cursorBlink: true,
      scrollback: 5000,
      theme: THEMES[document.documentElement.classList.contains('dark') ? 'dark' : 'light']
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current!)
    termRef.current = term
    fitRef.current = fit

    // Ctrl+C copia quando há texto selecionado (sem seleção, interrompe o comando, como sempre);
    // Ctrl+V cola pelo evento de colar do navegador, que o xterm trata.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown' || !e.ctrlKey || e.altKey) return true
      const key = e.key.toLowerCase()
      if (key === 'c' && term.hasSelection()) {
        void window.api.copyText(term.getSelection())
        term.clearSelection()
        return false
      }
      if (key === 'v') return false
      return true
    })

    const input = term.onData((data) => void window.api.terminalWrite(id, data).catch(() => {}))
    const sizeSub = term.onResize(({ cols, rows }) => void window.api.terminalResize(id, { cols, rows }).catch(() => {}))
    const disconnect = connect(id, (data) => term.write(data))

    // Acompanha o tamanho do painel (arrastar o divisor, redimensionar a janela).
    const observer = new ResizeObserver(() => {
      if (hostRef.current && hostRef.current.offsetWidth > 0 && hostRef.current.offsetHeight > 0) fit.fit()
    })
    observer.observe(hostRef.current!)
    fit.fit()
    void window.api.terminalResize(id, { cols: term.cols, rows: term.rows }).catch(() => {})

    return () => {
      observer.disconnect()
      disconnect()
      input.dispose()
      sizeSub.dispose()
      term.dispose()
      termRef.current = null
    }
  }, [id])

  useEffect(() => {
    if (termRef.current) termRef.current.options.theme = THEMES[theme]
  }, [theme])

  useEffect(() => {
    if (!termRef.current) return
    termRef.current.options.fontSize = fontSize
    fitRef.current?.fit()
  }, [fontSize])

  useEffect(() => {
    if (!active) return
    fitRef.current?.fit()
    termRef.current?.focus()
  }, [active])

  return <div ref={hostRef} data-terminal className={`absolute inset-0 px-2 pt-1 ${active ? '' : 'invisible'}`} />
}

/** Painel de terminais, abaixo do documento: uma aba por terminal aberto. */
export function TerminalPanel() {
  const t = useT()
  const tabs = useTerminals((s) => s.tabs)
  const activeId = useTerminals((s) => s.activeId)
  const setActive = useTerminals((s) => s.setActive)

  return (
    <section aria-label={t('terminal.panel')} className="flex h-full flex-col bg-surface">
      <div role="tablist" className="flex h-9 shrink-0 overflow-x-auto border-b border-border bg-chrome">
        {tabs.map((tab) => {
          const active = tab.id === activeId
          const title = t('terminal.title', { n: tab.number })
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setActive(tab.id)}
              onAuxClick={(e) => e.button === 1 && closeTerminal(tab.id)}
              className={`group flex min-w-0 max-w-56 cursor-default items-center gap-2 border-r border-border px-3 ${
                active ? 'border-t-2 border-t-accent bg-surface' : 'border-t-2 border-t-transparent hover:bg-zinc-200'
              }`}
            >
              <span className="truncate">{title}</span>
              <button
                type="button"
                aria-label={t('terminal.close', { name: title })}
                title={t('terminal.close', { name: title })}
                onClick={(e) => {
                  e.stopPropagation()
                  closeTerminal(tab.id)
                }}
                className="grid size-5 shrink-0 place-items-center rounded hover:bg-zinc-300"
              >
                <X size={14} className={active ? '' : 'opacity-0 group-hover:opacity-100'} />
              </button>
            </div>
          )
        })}
      </div>
      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <TerminalView key={tab.id} id={tab.id} active={tab.id === activeId} />
        ))}
      </div>
    </section>
  )
}
