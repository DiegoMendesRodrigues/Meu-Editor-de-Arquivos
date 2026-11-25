// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo, useState } from 'react'
import { finishCloudSave, openFromCloud, pendingCloudSaveDoc, pushToCloud } from '@/cloud'
import { allFolders, baseName, buildCloudTree, isValidCloudName, joinPath, parentOf, useCloud } from '@/store/cloud'
import { formatTotalMb } from '@/cloudInfo'
import { useLocale, useT } from '@/i18n'
import { useAccount } from '@/store/account'
import { useDialogs } from '@/store/dialogs'
import { useActiveDocument, useDocuments } from '@/store/documents'
import { CloudRows, type CloudRowsMode } from './CloudTree'
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
  const files = useCloud((s) => s.files)
  const folders = useCloud((s) => s.folders)
  const plan = useCloud((s) => s.plan)
  const loading = useCloud((s) => s.loading)
  const error = useCloud((s) => s.error)
  const tree = useMemo(() => buildCloudTree(files, folders), [files, folders])

  useEffect(() => {
    if (user) void useCloud.getState().load()
  }, [user])

  const description = user ? (
    <>
      <span className="block">{t('cloud.open.summary', { n: files.length, size: formatTotalMb(files, locale) })}</span>
      {plan && <span className="block">{t('cloud.open.plan', { plan: plan.name, maxFiles: plan.maxFiles, maxSizeMb: plan.maxSizeMb })}</span>}
    </>
  ) : (
    t('cloud.open.description')
  )
  const mode: CloudRowsMode = {
    onOpen: (f) => void openFromCloud(f.id).then((ok) => ok && close()),
    info: (f) => t('cloud.fileInfo', { version: f.version, size: formatSize(f.size), date: new Date(f.updatedAt).toLocaleString(locale) })
  }

  return (
    <Modal title={t('cloud.open.title')} description={description} onClose={close}>
      {!user ? (
        <NeedLogin onClose={close} />
      ) : (
        <div className="text-sm">
          {error && <p role="alert" className="mb-2 text-xs text-red-700">{error}</p>}
          {loading && files.length === 0 && !error && <p className="text-zinc-400">{t('cloud.loading')}</p>}
          {!loading && !error && files.length === 0 && <p className="text-zinc-400">{t('cloud.empty')}</p>}
          <div role="tree" aria-label={t('cloud.list')} data-testid="cloud-open-tree" className="rounded border border-border bg-surface py-1">
            <CloudRows node={tree} files={files} mode={mode} />
          </div>
        </div>
      )}
    </Modal>
  )
}

/** Aviso de limite do plano: a nuvem recusou a gravação (quantidade de arquivos ou armazenamento). */
export function CloudLimitAlert() {
  const t = useT()
  const limit = useCloud((s) => s.limitAlert)
  if (!limit) return null
  const close = (): void => useCloud.getState().showLimitAlert(null)
  return (
    <Modal title={t('cloud.limit.title')} size="sm" onClose={close}>
      <div role="alert" className="flex flex-col gap-4 text-sm" data-testid="cloud-limit-alert" data-limit={limit}>
        <p>{t(limit === 'files' ? 'cloud.limit.files' : 'cloud.limit.storage')}</p>
        <div className="flex justify-end">
          <button type="button" className={primaryButtonClass} onClick={close} autoFocus>
            {t('cloud.limit.ok')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function CloudSaveDialog() {
  const t = useT()
  const closeDialog = useDialogs((s) => s.close)
  const user = useAccount((s) => s.status.user)
  const files = useCloud((s) => s.files)
  const folders = useCloud((s) => s.folders)
  const activeDoc = useActiveDocument()
  const [docId] = useState(() => pendingCloudSaveDoc() ?? activeDoc?.id)
  const doc = useDocuments((s) => s.documents.find((d) => d.id === docId))
  const [folder, setFolder] = useState(() => (doc?.cloud ? parentOf(doc.cloud.path) : useCloud.getState().targetFolder))
  const [name, setName] = useState(() => (doc?.cloud ? baseName(doc.cloud.path) : doc?.name ?? ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const options = allFolders(files, folders)
  if (!options.includes(folder)) options.push(folder)

  useEffect(() => {
    if (user) void useCloud.getState().load()
  }, [user])

  const close = (saved = false): void => {
    finishCloudSave(saved)
    closeDialog()
  }

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!doc) return
    if (!isValidCloudName(name)) return setError(t('cloud.save.invalidName'))
    setBusy(true)
    const ok = await pushToCloud(doc, joinPath(folder, name.trim()))
    setBusy(false)
    if (ok) close(true)
  }

  return (
    <Modal title={t('cloud.save.title')} description={t('cloud.save.description')} onClose={() => close(false)}>
      {!user ? (
        <NeedLogin onClose={() => close(false)} />
      ) : (
        <form onSubmit={(e) => void submit(e)} className="flex max-w-md flex-col gap-3 text-sm">
          <label className="text-xs text-zinc-600">
            {t('cloud.save.folder')}
            <select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label={t('cloud.save.folder')} className={fieldClass}>
              {options.map((f) => (
                <option key={f} value={f}>
                  {f === '' ? t('cloud.root') : f}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            {t('cloud.save.name')}
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('cloud.save.name')} className={fieldClass} autoFocus />
          </label>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !doc} className={primaryButtonClass}>
              {busy ? t('cloud.save.sending') : t('cloud.save.title')}
            </button>
            <button type="button" className={buttonClass} onClick={() => close(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
