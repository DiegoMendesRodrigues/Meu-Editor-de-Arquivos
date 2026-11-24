// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo, useState } from 'react'
import { FORMAT_MAX_CHARS } from '@shared/ipc'
import { useT } from '@/i18n'
import { JsonViewer } from '@/json/JsonViewer'
import { bodyKind, bodyText, formatBytes, type BodyKind, type ViewResponse } from './model'
import { ReadOnlyMonaco } from './ReadOnlyMonaco'

type View = 'tree' | 'pretty' | 'raw' | 'image'

const LANGUAGE: Record<BodyKind, string> = { json: 'json', xml: 'xml', html: 'html', text: 'plaintext', image: 'plaintext', binary: 'plaintext' }

function isValidJson(text: string): boolean {
  if (text.length > 20 * 1024 * 1024) return false
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

/** Texto formatado: JSON localmente; XML e HTML pela auto formatação do app (thread do Main). */
function usePretty(kind: BodyKind, text: string, enabled: boolean): string {
  const [pretty, setPretty] = useState(text)
  useEffect(() => {
    setPretty(text)
    if (!enabled || text.length === 0 || text.length > FORMAT_MAX_CHARS) return
    if (kind === 'json') {
      try {
        setPretty(JSON.stringify(JSON.parse(text), null, 2))
      } catch {
        /* JSON inválido: fica o texto recebido */
      }
      return
    }
    if (kind !== 'xml' && kind !== 'html') return
    let alive = true
    window.api
      .formatCode(kind, '', text)
      .then((r) => alive && r.status === 'ok' && setPretty(r.text))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [kind, text, enabled])
  return pretty
}

/** Corpo da resposta: Árvore (JSON), Formatado, Bruto e Imagem. HTML aparece só como código. */
export function ResponseBody({ res, forcedType }: { res: ViewResponse; forcedType?: string }) {
  const t = useT()
  const kind = bodyKind(res.body, forcedType)
  const text = useMemo(() => (kind === 'image' || kind === 'binary' ? '' : bodyText(res.body)), [res.body, kind])
  const jsonOk = useMemo(() => kind === 'json' && isValidJson(text), [kind, text])
  const views: View[] = kind === 'image' ? ['image'] : kind === 'binary' ? [] : jsonOk ? ['tree', 'pretty', 'raw'] : ['pretty', 'raw']
  const [chosen, setChosen] = useState<View | null>(null)
  const view: View | null = chosen && views.includes(chosen) ? chosen : (views[0] ?? null)
  const pretty = usePretty(kind, text, view === 'pretty')

  if (res.body.file) return <p className="p-4 text-zinc-500">{t('apiClient.response.bodyInFile', { file: res.body.file })}</p>
  if (res.body.savedTo) return <p className="select-text break-all p-4 text-zinc-600">{t('apiClient.response.savedTo', { path: res.body.savedTo })}</p>
  if (kind === 'binary') return <p className="p-4 text-zinc-500">{t('apiClient.response.binaryBody', { size: formatBytes(res.size.body) })}</p>
  if (kind !== 'image' && text === '') return <p className="p-4 text-zinc-500">{t('apiClient.response.noBody')}</p>

  const mime = res.body.contentType.split(';')[0]!.trim().toLowerCase()
  return (
    <div className="flex h-full flex-col">
      {views.length > 1 && (
        <div role="tablist" aria-label={t('apiClient.response.view')} className="flex shrink-0 gap-1 border-b border-border px-3 py-1 text-xs">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setChosen(v)}
              className={`rounded px-2 py-0.5 ${view === v ? 'bg-zinc-200 font-semibold' : 'text-zinc-500 hover:bg-zinc-100'}`}
            >
              {t(`apiClient.response.view.${v}` as 'apiClient.response.view.tree')}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {view === 'tree' && <JsonViewer content={text} onEdit={() => undefined} />}
        {view === 'pretty' && <ReadOnlyMonaco value={pretty} language={LANGUAGE[kind]} label={t('apiClient.response.view.pretty')} />}
        {view === 'raw' && <ReadOnlyMonaco value={text} language="plaintext" label={t('apiClient.response.view.raw')} />}
        {view === 'image' && (
          <div className="grid min-h-full place-items-center p-4">
            <img src={`data:${mime};base64,${res.body.text}`} alt={t('apiClient.response.view.image')} className="max-h-full max-w-full object-contain" />
          </div>
        )}
      </div>
    </div>
  )
}
