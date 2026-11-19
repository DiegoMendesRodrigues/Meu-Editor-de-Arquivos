// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useState } from 'react'
import type { CloudFileMeta } from '@shared/ipc'
import { openFromCloud, pushToCloud } from '@/cloud'
import { useLocale, useT } from '@/i18n'
import { errorMessage, useAccount } from '@/store/account'
import { useDialogs } from '@/store/dialogs'
import { useActiveDocument } from '@/store/documents'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from './Modal'

const formatSize = (b: number): string => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

function NeedLogin({ onClose }: { onClose: () => void }) {
  const t = useT()
  const show = useDialogs((s) => s.show)
  return (
    <div className="text-sm">
      <p className="mb-3">{t('cloud.needLogin')}</p>
      <button type="button" className={primaryButtonClass} onClick={() => show('account')}>
        {t('cloud.signInButton')}
      </button>
      <button type="button" className={`${buttonClass} ml-2`} onClick={onClose}>
        {t('common.cancel')}
      </button>
    </div>
  )
}

export function CloudOpenDialog() {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const close = useDialogs((s) => s.close)
  const user = useAccount((s) => s.status.user)
  const [files, setFiles] = useState<CloudFileMeta[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = async (): Promise<void> => {
    try {
      setFiles(await window.api.cloudList())
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
      void useAccount.getState().load()
    }
  }
  useEffect(() => {
    if (user) void refresh()
  }, [user])

  const open = async (id: string): Promise<void> => {
    if (await openFromCloud(id)) close()
  }
  const remove = async (f: CloudFileMeta): Promise<void> => {
    if (!window.confirm(t('cloud.confirmDelete', { path: f.path }))) return
    try {
      await window.api.cloudDelete(f.id)
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal title={t('cloud.open.title')} description={t('cloud.open.description')} onClose={close}>
      {!user ? (
        <NeedLogin onClose={close} />
      ) : (
        <div className="text-sm">
          {error && <p role="alert" className="mb-2 text-xs text-red-700">{error}</p>}
          {files === null && !error && <p className="text-zinc-400">{t('cloud.loading')}</p>}
          {files?.length === 0 && <p className="text-zinc-400">{t('cloud.empty')}</p>}
          <ul className="divide-y divide-border rounded border border-border" aria-label={t('cloud.list')}>
            {files?.map((f) => (
              <li key={f.id} className="flex items-center gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.path}</div>
                  <div className="text-xs text-zinc-500">
                    {t('cloud.fileInfo', { version: f.version, size: formatSize(f.size), date: new Date(f.updatedAt).toLocaleString(locale) })}
                  </div>
                </div>
                <button type="button" className={primaryButtonClass} onClick={() => void open(f.id)}>{t('common.open')}</button>
                <button type="button" className={buttonClass} onClick={() => void remove(f)}>{t('common.delete')}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

export function CloudSaveDialog() {
  const t = useT()
  const close = useDialogs((s) => s.close)
  const user = useAccount((s) => s.status.user)
  const doc = useActiveDocument()
  const [path, setPath] = useState(doc?.cloud?.path ?? doc?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!doc) return
    const clean = path.trim()
    if (!clean || clean.startsWith('/') || clean.includes('\\') || clean.split('/').some((p) => p === '' || p === '.' || p === '..')) {
      return setError(t('cloud.save.invalidPath'))
    }
    setBusy(true)
    const ok = await pushToCloud(doc, clean)
    setBusy(false)
    if (ok) close()
  }

  return (
    <Modal title={t('cloud.save.title')} description={t('cloud.save.description')} onClose={close}>
      {!user ? (
        <NeedLogin onClose={close} />
      ) : (
        <form onSubmit={(e) => void submit(e)} className="flex max-w-md flex-col gap-3 text-sm">
          <label className="text-xs text-zinc-600">
            {t('cloud.save.path')}
            <input value={path} onChange={(e) => setPath(e.target.value)} aria-label={t('cloud.save.path')} className={fieldClass} autoFocus />
          </label>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !doc} className={primaryButtonClass}>{busy ? t('cloud.save.sending') : t('cloud.save.title')}</button>
            <button type="button" className={buttonClass} onClick={close}>{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
