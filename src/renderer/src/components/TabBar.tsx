// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { X } from 'lucide-react'
import { closeFile } from '@/commands'
import { useT } from '@/i18n'
import { isDirty, useDocuments } from '@/store/documents'

export function TabBar() {
  const t = useT()
  const documents = useDocuments((s) => s.documents)
  const activeId = useDocuments((s) => s.activeId)
  const setActive = useDocuments((s) => s.setActive)

  return (
    <div role="tablist" className="flex h-9 shrink-0 overflow-x-auto border-b border-border bg-chrome">
      {documents.map((d) => {
        const active = d.id === activeId
        const dirty = isDirty(d)
        return (
          <div
            key={d.id}
            role="tab"
            aria-selected={active}
            title={d.missingOnDisk ? t('tab.missingOnDisk', { path: d.path ?? d.name }) : d.path ?? d.name}
            onClick={() => setActive(d.id)}
            onAuxClick={(e) => e.button === 1 && void closeFile(d.id)}
            className={`group flex min-w-0 max-w-56 cursor-default items-center gap-2 border-r border-border px-3 ${
              active ? 'border-t-2 border-t-accent bg-white' : 'border-t-2 border-t-transparent hover:bg-zinc-200'
            }`}
          >
            <span className={`truncate ${d.missingOnDisk ? 'text-red-600 line-through' : ''}`}>{d.name}</span>
            <button
              type="button"
              aria-label={t('tab.close', { name: d.name })}
              onClick={(e) => {
                e.stopPropagation()
                void closeFile(d.id)
              }}
              className="grid size-5 shrink-0 place-items-center rounded hover:bg-zinc-300"
            >
              {dirty ? (
                <>
                  <span className="text-accent group-hover:hidden">●</span>
                  <X size={14} className="hidden group-hover:block" />
                </>
              ) : (
                <X size={14} className={active ? '' : 'opacity-0 group-hover:opacity-100'} />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
