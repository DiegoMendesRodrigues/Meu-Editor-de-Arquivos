// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createContext, useContext, useState } from 'react'
import { Play, type X } from 'lucide-react'
import { useT } from '@/i18n'
import { useSidebarLayout, type SidebarSectionId } from '@/store/sidebarLayout'

/** Áreas visíveis agora, na ordem da tela (para mover pelo teclado com Alt+↑/↓). */
export const VisibleSectionsContext = createContext<SidebarSectionId[]>([])

/** Tipo próprio do arrastar das áreas, para não se misturar com o arrastar de documentos para a nuvem. */
const SECTION_DRAG_TYPE = 'application/x-meu-editor-sidebar-section'
/** Área sendo arrastada (o dataTransfer só pode ser lido no drop, e o indicador precisa dela antes). */
let dragging: SidebarSectionId | null = null

/**
 * Área da barra lateral. O triângulo (ou um clique no título) abre e fecha a área; arrastar o título para
 * cima ou para baixo muda a ordem, que fica guardada neste computador (Alt+↑/↓ faz o mesmo pelo teclado).
 * Os botões de ação ficam à direita do título (visíveis ao passar o mouse).
 */
export function Section({
  id,
  title,
  actions,
  alwaysShowActions = false,
  children
}: {
  id: SidebarSectionId
  title: string
  actions?: React.ReactNode
  /** Mostra os botões do título o tempo todo (e não só ao passar o mouse). */
  alwaysShowActions?: boolean
  children: React.ReactNode
}) {
  const t = useT()
  const collapsed = useSidebarLayout((s) => s.collapsed.includes(id))
  const toggle = useSidebarLayout((s) => s.toggle)
  const move = useSidebarLayout((s) => s.move)
  const step = useSidebarLayout((s) => s.step)
  const visible = useContext(VisibleSectionsContext)
  const [dropAt, setDropAt] = useState<'before' | 'after' | null>(null)
  const bodyId = `sidebar-section-${id}`

  const overSelf = (e: React.DragEvent): boolean => !dragging || dragging === id || !e.dataTransfer.types.includes(SECTION_DRAG_TYPE)

  return (
    <section
      data-section={id}
      className={`mb-1 border-y-2 border-transparent ${dropAt === 'before' ? 'border-t-accent' : ''} ${dropAt === 'after' ? 'border-b-accent' : ''}`}
      onDragOver={(e) => {
        if (overSelf(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        const rect = e.currentTarget.getBoundingClientRect()
        setDropAt(e.clientY > rect.top + rect.height / 2 ? 'after' : 'before')
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropAt(null)
      }}
      onDrop={(e) => {
        if (overSelf(e) || !dragging) return
        e.preventDefault()
        move(dragging, id, dropAt === 'after')
        setDropAt(null)
      }}
    >
      <div className={`group flex items-center py-1 pl-1 pr-3 ${collapsed ? '' : 'mb-1'}`}>
        <button
          type="button"
          draggable
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          title={t('sidebar.sectionHint')}
          onClick={() => toggle(id)}
          onKeyDown={(e) => {
            if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
            e.preventDefault()
            step(id, e.key === 'ArrowUp' ? -1 : 1, visible)
            // O botão continua focado depois de a área mudar de lugar.
            const button = e.currentTarget
            requestAnimationFrame(() => button.focus())
          }}
          onDragStart={(e) => {
            dragging = id
            e.dataTransfer.setData(SECTION_DRAG_TYPE, id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => {
            dragging = null
          }}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-1 rounded px-1 text-left active:cursor-grabbing"
        >
          <Play
            size={8}
            fill="currentColor"
            aria-hidden
            className={`shrink-0 text-zinc-500 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          />
          <h2 className="truncate text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        </button>
        {actions && (
          <div className={`flex gap-0.5 ${alwaysShowActions ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>{actions}</div>
        )}
      </div>
      <div id={bodyId} hidden={collapsed} className="mb-2">
        {children}
      </div>
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
