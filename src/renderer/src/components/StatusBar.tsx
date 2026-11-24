// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo } from 'react'
import { Cloud, HardDrive } from 'lucide-react'
import { useAccount } from '@/store/account'
import { formatStorage, useCloud, useStorageMode } from '@/store/cloud'
import { isApiLanguage, languageLabel } from '@/editor/languages'
import { useApiStore } from '@/store/api'
import { useT } from '@/i18n'
import { useActiveDocument, useDocuments } from '@/store/documents'
import { useLibrary } from '@/store/library'
import { useNotice } from '@/store/notice'

const formatSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const encoder = new TextEncoder()

export function StatusBar() {
  const t = useT()
  const doc = useActiveDocument()
  const cursor = useDocuments((s) => s.cursor)
  const recording = useLibrary((s) => s.recording)
  const notice = useNotice((s) => s.message)
  // O tamanho só é recalculado quando o texto muda (não a cada movimento do cursor), importante em arquivos grandes.
  const content = doc?.content
  const mode = useStorageMode()
  const user = useAccount((s) => s.status.user)
  const size = useMemo(() => (content === undefined ? 0 : encoder.encode(content).length), [content])
  const storageBytes = useCloud((s) => s.storageBytes)
  const apiEnv = useApiStore((s) => s.envInfo)
  const apiEnvKey = useApiStore((s) => s.activeEnvironment)

  // Ao entrar (ou trocar de conta), busca o espaço usado na nuvem; ao sair, ele some do rodapé.
  useEffect(() => {
    void useCloud.getState().refreshStorage()
  }, [user?.id])

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-chrome px-3 text-xs text-zinc-600">
      {recording && (
        <span role="status" className="font-medium text-red-700">
          {t('status.recording')}
        </span>
      )}
      {doc ? (
        <>
          <span>
            {t('status.lineCol', { line: cursor.line, col: cursor.column })}
          </span>
          {cursor.selectedChars > 0 && <span>{t('status.selected', { n: cursor.selectedChars })}</span>}
          {notice && (
            <span role="status" className="font-medium text-emerald-700">
              {notice}
            </span>
          )}
          {isApiLanguage(doc.language) && (
            <span
              data-testid="status-api-env"
              title={t('apiClient.env.select')}
              className={apiEnv?.production && apiEnv.key === apiEnvKey ? 'rounded bg-red-600 px-1.5 font-semibold text-white' : ''}
            >
              {apiEnv && apiEnv.key === apiEnvKey ? t('apiClient.env.status', { name: apiEnv.name }) : t('apiClient.env.statusNone')}
            </span>
          )}
          <span className="ml-auto">{formatSize(size)}</span>
          <span>{doc.encoding}</span>
          <span>{doc.eol}</span>
          <span>{languageLabel(doc.language)}</span>
        </>
      ) : (
        <span>{t('status.ready')}</span>
      )}
      {user && storageBytes !== null && (
        <span className={doc ? '' : 'ml-auto'} title={t('storage.used')} data-testid="cloud-storage">
          {formatStorage(storageBytes)}
        </span>
      )}
      {/* Local de armazenamento em uso; com a conta conectada, o clique alterna entre nuvem e disco. */}
      <button
        type="button"
        disabled={!user}
        onClick={() => useCloud.getState().setPreferCloud(mode !== 'cloud')}
        title={mode === 'cloud' ? t('storage.cloud') : t('storage.local')}
        aria-label={mode === 'cloud' ? t('storage.cloud') : t('storage.local')}
        data-storage={mode}
        className={`${doc || (user && storageBytes !== null) ? '' : 'ml-auto '}flex items-center rounded px-1 hover:bg-zinc-300 disabled:hover:bg-transparent`}
      >
        {mode === 'cloud' ? <Cloud size={14} className="text-sky-600" /> : <HardDrive size={14} />}
      </button>
    </footer>
  )
}
