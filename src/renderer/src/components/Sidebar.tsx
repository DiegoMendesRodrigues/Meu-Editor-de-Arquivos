import { FileText } from 'lucide-react'
import { isDirty, useDocuments } from '@/store/documents'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h2 className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  )
}

export function Sidebar() {
  const documents = useDocuments((s) => s.documents)
  const activeId = useDocuments((s) => s.activeId)
  const setActive = useDocuments((s) => s.setActive)

  return (
    <aside className="h-full overflow-y-auto bg-chrome pt-2">
      <Section title="Documentos abertos">
        {documents.length === 0 && <p className="px-3 text-zinc-400">Nenhum documento aberto.</p>}
        <ul>
          {documents.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                title={d.path ?? d.name}
                onClick={() => setActive(d.id)}
                className={`flex w-full items-center gap-2 truncate px-3 py-1 text-left hover:bg-zinc-200 ${
                  d.id === activeId ? 'bg-zinc-200 font-medium' : ''
                }`}
              >
                <FileText size={14} className="shrink-0 text-zinc-500" />
                <span className="truncate">{d.name}</span>
                {isDirty(d) && <span className="ml-auto text-accent">●</span>}
              </button>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Explorador">
        <p className="px-3 text-zinc-400">Abrir pasta: próxima etapa.</p>
      </Section>
      <Section title="Recentes">
        <p className="px-3 text-zinc-400">Em breve.</p>
      </Section>
    </aside>
  )
}
