// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { X } from 'lucide-react'
import { useT } from '@/i18n'
import { useView } from '@/store/view'
import { SearchPanel } from './SearchPanel'

/** Painel inferior: busca em arquivos (console e logs virão depois). */
export function BottomPanel() {
  const t = useT()
  const toggle = useView((s) => s.toggle)
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center gap-4 border-b border-border bg-chrome px-3 text-xs font-semibold uppercase tracking-wide text-zinc-600">
        <span className="border-b-2 border-accent py-1.5">{t('bottom.search')}</span>
        <span className="py-1.5 text-zinc-400">{t('bottom.console')}</span>
        <span className="py-1.5 text-zinc-400">{t('bottom.logs')}</span>
        <button
          type="button"
          aria-label={t('bottom.close')}
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
