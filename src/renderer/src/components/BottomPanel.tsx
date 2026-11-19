import { X } from 'lucide-react'
import { useView } from '@/store/view'
import { SearchPanel } from './SearchPanel'

/** Painel inferior: busca em arquivos (console e logs virão depois). */
export function BottomPanel() {
  const toggle = useView((s) => s.toggle)
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-8 shrink-0 items-center gap-4 border-b border-border bg-chrome px-3 text-xs font-semibold uppercase tracking-wide text-zinc-600">
        <span className="border-b-2 border-accent py-1.5">Busca</span>
        <span className="py-1.5 text-zinc-400">Console</span>
        <span className="py-1.5 text-zinc-400">Logs</span>
        <button
          type="button"
          aria-label="Fechar painel"
          onClick={() => toggle('bottomPanelVisible')}
          className="ml-auto rounded p-0.5 hover:bg-zinc-300"
        >
          <X size={14} />
        </button>
      </div>
      <SearchPanel />
    </div>
  )
}
