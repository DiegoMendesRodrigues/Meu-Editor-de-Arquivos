import { useEffect, useState } from 'react'
import type { CloudFileMeta } from '@shared/ipc'
import { openFromCloud, pushToCloud } from '@/cloud'
import { errorMessage, useAccount } from '@/store/account'
import { useDialogs } from '@/store/dialogs'
import { useActiveDocument } from '@/store/documents'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from './Modal'

const formatSize = (b: number): string => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

function NeedLogin({ onClose }: { onClose: () => void }) {
  const show = useDialogs((s) => s.show)
  return (
    <div className="text-sm">
      <p className="mb-3">Entre na sua conta para usar os arquivos da nuvem.</p>
      <button type="button" className={primaryButtonClass} onClick={() => show('account')}>
        Entrar ou criar conta
      </button>
      <button type="button" className={`${buttonClass} ml-2`} onClick={onClose}>
        Cancelar
      </button>
    </div>
  )
}

export function CloudOpenDialog() {
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
    if (!window.confirm(`Excluir "${f.path}" da nuvem? Esta ação não pode ser desfeita.`)) return
    try {
      await window.api.cloudDelete(f.id)
      await refresh()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Modal title="Abrir da nuvem" description="Arquivos sincronizados na sua conta." onClose={close}>
      {!user ? (
        <NeedLogin onClose={close} />
      ) : (
        <div className="text-sm">
          {error && <p role="alert" className="mb-2 text-xs text-red-700">{error}</p>}
          {files === null && !error && <p className="text-zinc-400">Carregando…</p>}
          {files?.length === 0 && <p className="text-zinc-400">Nenhum arquivo na nuvem. Use Arquivo → Salvar na nuvem.</p>}
          <ul className="divide-y divide-border rounded border border-border" aria-label="Arquivos na nuvem">
            {files?.map((f) => (
              <li key={f.id} className="flex items-center gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.path}</div>
                  <div className="text-xs text-zinc-500">
                    versão {f.version} · {formatSize(f.size)} · {new Date(f.updatedAt).toLocaleString('pt-BR')}
                  </div>
                </div>
                <button type="button" className={primaryButtonClass} onClick={() => void open(f.id)}>Abrir</button>
                <button type="button" className={buttonClass} onClick={() => void remove(f)}>Excluir</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

export function CloudSaveDialog() {
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
      return setError('Use um caminho relativo com "/" (ex.: projetos/notas.md), sem ".." nem barra no início.')
    }
    setBusy(true)
    const ok = await pushToCloud(doc, clean)
    setBusy(false)
    if (ok) close()
  }

  return (
    <Modal title="Salvar na nuvem" description="Guarda este documento na sua conta, para abrir em outros computadores." onClose={close}>
      {!user ? (
        <NeedLogin onClose={close} />
      ) : (
        <form onSubmit={(e) => void submit(e)} className="flex max-w-md flex-col gap-3 text-sm">
          <label className="text-xs text-zinc-600">
            Caminho na nuvem
            <input value={path} onChange={(e) => setPath(e.target.value)} aria-label="Caminho na nuvem" className={fieldClass} autoFocus />
          </label>
          {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !doc} className={primaryButtonClass}>{busy ? 'Enviando…' : 'Salvar na nuvem'}</button>
            <button type="button" className={buttonClass} onClick={close}>Cancelar</button>
          </div>
        </form>
      )}
    </Modal>
  )
}
