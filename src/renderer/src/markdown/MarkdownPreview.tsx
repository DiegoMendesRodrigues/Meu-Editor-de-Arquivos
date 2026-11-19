import { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Pencil } from 'lucide-react'

/**
 * Renderização segura: react-markdown não interpreta HTML embutido no documento,
 * então nenhum script do arquivo é executado. Links externos abrem no navegador
 * do sistema (o processo principal bloqueia a navegação dentro do app).
 */
const components: Components = {
  a: ({ href, children }) => {
    const external = !!href && /^(https?:|mailto:)/.test(href)
    if (href?.startsWith('#')) return <a href={href}>{children}</a>
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" title={href}>
        {children}
      </a>
    ) : (
      <span className="text-accent underline decoration-dotted" title={`Link local: ${href ?? ''}`}>
        {children}
      </span>
    )
  },
  input: ({ checked, type }) => <input type={type} checked={checked} readOnly disabled className="mr-1.5 align-middle" />
}

export const MarkdownPreview = memo(function MarkdownPreview({ content, onEdit }: { content: string; onEdit: () => void }) {
  return (
    <div className="h-full overflow-y-auto bg-white">
      {content.trim() === '' ? (
        <div className="grid h-full place-items-center text-zinc-400">
          <button type="button" onClick={onEdit} className="flex items-center gap-2 rounded border border-border px-3 py-1.5 hover:bg-zinc-100">
            <Pencil size={14} /> Documento vazio. Clique para editar.
          </button>
        </div>
      ) : (
        <article className="prose prose-zinc mx-auto max-w-4xl px-10 py-8 select-text prose-headings:font-semibold prose-a:text-accent prose-code:before:content-none prose-code:after:content-none prose-pre:bg-zinc-100 prose-pre:text-zinc-800 prose-table:text-sm prose-th:border prose-th:border-zinc-300 prose-th:bg-zinc-50 prose-th:px-3 prose-th:py-1.5 prose-td:border prose-td:border-zinc-300 prose-td:px-3 prose-td:py-1.5">
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {content}
          </Markdown>
        </article>
      )}
    </div>
  )
})
