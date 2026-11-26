// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useState } from 'react'
import { checkName } from '@shared/fileName'
import { useT } from '@/i18n'
import { useApiStore } from '@/store/api'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from '@/components/Modal'
import { CookiesDialog } from './CookiesDialog'
import { ExportDialog } from './ExportDialog'
import { ImportDialog } from './ImportDialog'
import { MockDialog } from './MockDialog'
import { MonitorDialog } from './MonitorDialog'
import { RunnerDialog } from './RunnerDialog'
import { createCloudCollection, createFolderIn } from './collectionActions'

/** Janela com um campo de nome (nova pasta, nova coleção na nuvem). */
function NameDialog({ title, label, onSubmit, onClose }: { title: string; label: string; onSubmit: (name: string) => Promise<boolean>; onClose: () => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = checkName(name)
  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (problem || busy) return
    setBusy(true)
    const ok = await onSubmit(name.trim())
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {label}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-invalid={problem !== null && problem !== 'empty'} className={fieldClass} />
        </label>
        {problem && problem !== 'empty' && (
          <p role="alert" className="text-xs text-red-700">
            {t(problem === 'tooLong' ? 'rename.tooLong' : 'rename.invalid')}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="submit" disabled={problem !== null || busy} className={primaryButtonClass}>
            {t('apiClient.col.create')}
          </button>
          <button type="button" onClick={onClose} className={buttonClass}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Janelas do Cliente de API abertas pela barra lateral e pelos menus. */
export function ApiDialogs() {
  const t = useT()
  const dialog = useApiStore((s) => s.dialog)
  const close = useApiStore((s) => s.closeDialog)
  if (!dialog) return null
  switch (dialog.kind) {
    case 'import':
      return <ImportDialog open onClose={close} dir={dialog.dir} />
    case 'export':
      return <ExportDialog open onClose={close} dir={dialog.dir} />
    case 'runner':
      return <RunnerDialog open onClose={close} dir={dialog.dir} />
    case 'mock':
      return <MockDialog onClose={close} dir={dialog.dir} />
    case 'monitor':
      return <MonitorDialog onClose={close} dir={dialog.dir} />
    case 'cookies':
      return <CookiesDialog onClose={close} />
    case 'newFolder':
      return <NameDialog title={t('apiClient.col.newFolder')} label={t('apiClient.col.folderName')} onSubmit={(name) => createFolderIn(dialog.dir, name)} onClose={close} />
    case 'newCollection':
      return <NameDialog title={t('apiClient.col.new')} label={t('apiClient.col.collectionName')} onSubmit={createCloudCollection} onClose={close} />
  }
}
