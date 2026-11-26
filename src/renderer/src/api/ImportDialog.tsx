// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useState } from 'react'
import type { MessageKey } from '@shared/i18n'
import { IMPORT_FORMATS, type ApiImportFormat, type ApiImportResponse, type ApiImportResult } from '@shared/api/protocol'
import { serializeApiRequest, type ApiRequest } from '@shared/api/schema'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from '@/components/Modal'
import { useT } from '@/i18n'
import { useApiStore } from '@/store/api'
import { useDocuments } from '@/store/documents'
import { ENVIRONMENTS_DIR, readCollection, writeCollectionFiles } from './collections'
import { newCollection, serializeCollection, serializeEnvironment } from './environment'

/** Importar curl, Postman, OpenAPI, Insomnia, HAR e .http: prévia antes de gravar; nada é enviado. */

/** Acima disso, "Abrir em abas" some (use a coleção). */
const MAX_TABS = 20

const safeName = (name: string, fallback: string): string => {
  const n = name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 80)
  return n || fallback
}

/** Nomes de arquivo sem repetição dentro da mesma pasta ("a", "a (2)"...). */
function uniqueNames(items: ApiImportResult['items']): string[] {
  const taken = new Set<string>()
  return items.map(({ folder, request }) => {
    const stem = safeName(request.name, 'requisicao')
    let name = stem
    for (let n = 2; taken.has(`${folder}/${name}`.toLowerCase()); n++) name = `${stem} (${n})`
    taken.add(`${folder}/${name}`.toLowerCase())
    return name
  })
}

export function buildCollectionFiles(result: ApiImportResult, includeCollectionFile: boolean): { relativePath: string; content: string }[] {
  const files: { relativePath: string; content: string }[] = []
  if (includeCollectionFile) {
    const col = newCollection(result.name)
    col.variables = result.variables.map((v) => ({ key: v.key, value: v.value, secret: false }))
    files.push({ relativePath: 'collection.apicol', content: serializeCollection(col) })
  }
  const names = uniqueNames(result.items)
  result.items.forEach((item, i) => {
    files.push({ relativePath: `${item.folder ? `${item.folder}/` : ''}${names[i]}.apireq`, content: serializeApiRequest(item.request) })
  })
  const envNames = new Set<string>()
  for (const env of result.environments) {
    const stem = safeName(env.name, 'ambiente')
    let name = stem
    for (let n = 2; envNames.has(name.toLowerCase()); n++) name = `${stem} (${n})`
    envNames.add(name.toLowerCase())
    files.push({ relativePath: `${ENVIRONMENTS_DIR}/${name}.apienv`, content: serializeEnvironment(env) })
  }
  return files
}

const METHOD_CLASS: Record<string, string> = { GET: 'text-emerald-600', POST: 'text-amber-600', PUT: 'text-blue-600', PATCH: 'text-violet-600', DELETE: 'text-red-600' }

export function ImportDialog({ open, onClose, dir }: { open: boolean; onClose: () => void; dir?: string }) {
  const t = useT()
  const [text, setText] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [format, setFormat] = useState<ApiImportFormat>('auto')
  const [result, setResult] = useState<ApiImportResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)

  if (!open) return null

  const reset = (): void => {
    setResult(null)
    setMessage(null)
  }

  const chooseFile = async (): Promise<void> => {
    const [path] = await window.api.apiPickFiles('import', false)
    if (!path) return
    setFilePath(path)
    setText('')
    reset()
  }

  const analyze = async (): Promise<void> => {
    setBusy(true)
    reset()
    try {
      const res = await window.api.apiImportParse(filePath ? { path: filePath, format } : { text, format })
      setResult(res)
      if (!res.ok) setMessage({ error: true, text: t(`apiClient.import.error.${res.code}`) })
    } catch {
      setMessage({ error: true, text: t('apiClient.import.error.invalid') })
    } finally {
      setBusy(false)
    }
  }

  const asCollection = async (res: ApiImportResult): Promise<void> => {
    setBusy(true)
    setMessage(null)
    try {
      const target = dir ?? (await window.api.openFolder())?.path
      if (!target) return
      // Uma coleção que já existe na pasta mantém o collection.apicol dela.
      let hasCollection = false
      try {
        hasCollection = (await readCollection(target)).collection !== null
      } catch {
        hasCollection = false
      }
      const written = await writeCollectionFiles(target, buildCollectionFiles(res, !hasCollection))
      // A barra lateral relê as coleções: sem isso a nova coleção só aparecia depois de outro evento.
      useApiStore.getState().bumpCollections()
      setMessage({ error: false, text: t('apiClient.import.written', { n: written.length, dir: target }) })
    } catch {
      setMessage({ error: true, text: t('apiClient.import.error.write') })
    } finally {
      setBusy(false)
    }
  }

  const inTabs = (res: ApiImportResult): void => {
    const docs = useDocuments.getState()
    const names = uniqueNames(res.items)
    res.items.forEach((item: { request: ApiRequest }, i) => docs.newDocumentFrom(`${names[i]}.apireq`, serializeApiRequest(item.request)))
    onClose()
  }

  const ok = result?.ok ? result : null
  const canAnalyze = (filePath !== null || text.trim() !== '') && !busy

  return (
    <Modal title={t('apiClient.import.title')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <textarea
          aria-label={t('apiClient.import.paste')}
          placeholder={t('apiClient.import.paste')}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFilePath(null)
            reset()
          }}
          rows={8}
          spellCheck={false}
          className={`${fieldClass} resize-y font-mono text-xs`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass} onClick={() => void chooseFile()}>
            {t('apiClient.import.chooseFile')}
          </button>
          {filePath && <span className="max-w-[260px] truncate text-xs text-zinc-500" title={filePath}>{t('apiClient.import.file', { name: filePath.split(/[\\/]/).pop() ?? filePath })}</span>}
          <label className="ml-auto flex items-center gap-2 text-xs">
            {t('apiClient.import.format')}
            <select
              aria-label={t('apiClient.import.format')}
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as ApiImportFormat)
                reset()
              }}
              className={`${fieldClass} w-auto`}
            >
              {IMPORT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`apiClient.import.fmt.${f}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={primaryButtonClass} disabled={!canAnalyze} onClick={() => void analyze()}>
            {t('apiClient.import.analyze')}
          </button>
        </div>

        {message && (
          <p role={message.error ? 'alert' : 'status'} className={`text-sm ${message.error ? 'text-red-600' : 'text-emerald-600'}`}>
            {message.text}
          </p>
        )}

        {ok && (
          <section aria-label={t('apiClient.import.title')} className="flex flex-col gap-2 rounded border border-border p-3">
            <p className="text-sm">{t('apiClient.import.detected', { format: t(`apiClient.import.fmt.${ok.format}`), name: ok.name })}</p>
            <p className="text-xs text-zinc-500">
              {t('apiClient.import.count', { n: ok.items.length })}
              {ok.environments.length > 0 || ok.variables.length > 0 ? ` · ${t('apiClient.import.environments', { n: ok.environments.length, v: ok.variables.length })}` : ''}
            </p>
            <ul className="max-h-48 overflow-auto text-xs" data-testid="import-preview">
              {ok.items.map((item, i) => (
                <li key={i} className="flex gap-2 py-0.5">
                  <span className={`w-14 shrink-0 font-bold ${METHOD_CLASS[item.request.method] ?? 'text-zinc-700'}`}>{item.request.method}</span>
                  <span className="truncate">{item.folder ? `${item.folder} / ` : ''}{item.request.name}</span>
                </li>
              ))}
            </ul>
            {ok.warnings.length > 0 && (
              <div className="text-xs text-amber-600">
                <p className="font-semibold">{t('apiClient.import.warnings')}</p>
                <ul className="list-disc pl-4">
                  {ok.warnings.map((w) => (
                    <li key={w}>{t(`apiClient.import.warn.${w}` as MessageKey)}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              {ok.items.length > 0 && ok.items.length <= MAX_TABS && (
                <button type="button" className={buttonClass} disabled={busy} onClick={() => inTabs(ok)}>
                  {t('apiClient.import.openInTabs')}
                </button>
              )}
              <button type="button" className={primaryButtonClass} disabled={busy} onClick={() => void asCollection(ok)}>
                {t('apiClient.import.asCollection')}
              </button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  )
}

