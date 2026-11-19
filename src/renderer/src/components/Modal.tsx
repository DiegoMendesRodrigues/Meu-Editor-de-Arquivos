// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useT } from '@/i18n'

/** Janela modal padrão (Radix Dialog): foco preso, fecha com Esc. */
export function Modal({
  title,
  description,
  onClose,
  children
}: {
  title: string
  /** Texto de apoio sob o título; opcional. */
  description?: string
  onClose: () => void
  children: React.ReactNode
}) {
  const t = useT()
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content {...(description ? {} : { 'aria-describedby': undefined })} className="fixed left-1/2 top-1/2 z-50 flex max-h-[80vh] w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-white shadow-xl outline-none">
          <div className="flex items-center border-b border-border px-4 py-2.5">
            <Dialog.Title className="flex-1 text-sm font-semibold">{title}</Dialog.Title>
            <Dialog.Close aria-label={t('common.close')} className="rounded p-0.5 hover:bg-zinc-200">
              <X size={16} />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="px-4 pt-2 text-xs text-zinc-500">{description}</Dialog.Description>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const fieldClass = 'w-full rounded border border-border bg-white px-2 py-1 text-sm outline-none focus:border-accent'
export const buttonClass = 'rounded border border-border px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50'
export const primaryButtonClass = 'rounded bg-accent px-3 py-1 text-sm text-white disabled:opacity-50'
