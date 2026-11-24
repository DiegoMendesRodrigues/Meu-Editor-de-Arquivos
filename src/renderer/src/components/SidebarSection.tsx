// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { X } from 'lucide-react'

/** Seção da barra lateral: título em caixa alta e botões de ação (visíveis ao passar o mouse). */
export function Section({
  title,
  actions,
  alwaysShowActions = false,
  children
}: {
  title: string
  actions?: React.ReactNode
  /** Mostra os botões do título o tempo todo (e não só ao passar o mouse). */
  alwaysShowActions?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="mb-3">
      <div className="group flex items-center px-3 py-1">
        <h2 className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        <div className={`flex gap-0.5 ${alwaysShowActions ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>{actions}</div>
      </div>
      {children}
    </section>
  )
}

export function IconButton({ icon: Icon, label, onClick }: { icon: typeof X; label: string; onClick: () => void }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className="rounded p-0.5 text-zinc-500 hover:bg-zinc-300">
      <Icon size={13} />
    </button>
  )
}
