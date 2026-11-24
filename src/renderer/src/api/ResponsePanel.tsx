// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { Send } from 'lucide-react'
import { useT } from '@/i18n'

/**
 * Painel da resposta. Fase 0: só a estrutura e o estado vazio. Na fase 1 ganha status, tempo, tamanho,
 * cabeçalhos, cookies, testes, tempos e o corpo (árvore pelo JsonViewer, formatado e bruto).
 */
export function ResponsePanel() {
  const t = useT()
  return (
    <section aria-label={t('apiClient.response')} className="flex h-full flex-col bg-surface" data-testid="api-response">
      <div className="flex h-8 shrink-0 items-center gap-4 border-b border-border bg-chrome px-3 text-xs">
        <span className="font-semibold uppercase tracking-wide text-zinc-600">{t('apiClient.response')}</span>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-zinc-500">
        <div className="max-w-sm">
          <Send size={28} strokeWidth={1.5} className="mx-auto mb-2 text-zinc-400" />
          <p>{t('apiClient.response.empty')}</p>
        </div>
      </div>
    </section>
  )
}
