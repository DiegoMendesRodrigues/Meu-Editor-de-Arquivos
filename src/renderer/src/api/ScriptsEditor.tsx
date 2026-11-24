// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import '@/editor/monacoSetup'
import type { ApiRequest } from '@shared/api/schema'
import { useT } from '@/i18n'
import { useTheme } from '@/theme'
import { buttonClass } from '@/components/Modal'

export type ScriptPair = { pre: string; post: string }
export const scriptsOf = (request: ApiRequest): ScriptPair => ({ pre: request.scripts?.pre ?? '', post: request.scripts?.post ?? '' })
export const hasScripts = (s: ScriptPair): boolean => s.pre.trim() !== '' || s.post.trim() !== ''

/** Quem identifica a requisição para a confiança: o arquivo, ou o id do documento ainda sem arquivo. */
export interface ScriptTrustTarget {
  requestKey: string
  /** Pasta da coleção no disco (coleções da nuvem não têm; ali a confiança é por requisição). */
  collectionDir?: string
}

/**
 * Faixa "Esta requisição tem scripts que ainda não foram confiados neste computador". Consulta o Main
 * (apiScriptIsTrusted) a cada mudança dos scripts e depois de cada tentativa de envio (tick).
 */
export function ScriptTrustBanner({ scripts, target, tick, onTrusted, onView }: { scripts: ScriptPair; target: ScriptTrustTarget; tick: number; onTrusted: () => void; onView: () => void }) {
  const t = useT()
  const [trusted, setTrusted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const active = hasScripts(scripts)

  useEffect(() => {
    if (!active) return setTrusted(null)
    let alive = true
    window.api
      .apiScriptIsTrusted({ requestKey: target.requestKey, collectionDir: target.collectionDir, pre: scripts.pre, post: scripts.post })
      .then((ok) => alive && setTrusted(ok))
      .catch(() => alive && setTrusted(null))
    return () => {
      alive = false
    }
  }, [active, scripts.pre, scripts.post, target.requestKey, target.collectionDir, tick])

  if (!active || trusted !== false) return null

  const trust = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.api.apiScriptTrust({ requestKey: target.requestKey, collectionDir: target.collectionDir, pre: scripts.pre, post: scripts.post, wholeCollection: !!target.collectionDir })
      setTrusted(true)
      onTrusted()
    } catch {
      /* continua sem confiança */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div role="status" data-testid="api-script-banner" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[12.5px] text-amber-700">
      <ShieldAlert size={15} className="shrink-0" />
      <span className="min-w-0 flex-1">{t('apiClient.scripts.untrusted')}</span>
      <button type="button" disabled={busy} onClick={() => void trust()} data-testid="api-script-trust" className={buttonClass}>
        {t(target.collectionDir ? 'apiClient.scripts.trustCollection' : 'apiClient.scripts.trustRequest')}
      </button>
      <button type="button" onClick={onView} className={buttonClass}>
        {t('apiClient.scripts.view')}
      </button>
    </div>
  )
}

function ScriptMonaco({ value, onChange, label, testId }: { value: string; onChange: (text: string) => void; label: string; testId: string }) {
  const theme = useTheme()
  return (
    <div className="h-44 rounded border border-border" aria-label={label} data-testid={testId}>
      <Editor
        value={value}
        language="javascript"
        theme={theme === 'dark' ? 'meu-escuro' : 'meu-claro'}
        onChange={(v) => onChange(v ?? '')}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'Cascadia Code', 'Consolas', 'DejaVu Sans Mono', 'Ubuntu Mono', monospace",
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          folding: true,
          detectIndentation: false,
          tabSize: 2,
          // O que o usuário digita é o que vale: sem fechamento automático de aspas e chaves.
          autoClosingBrackets: 'never',
          autoClosingQuotes: 'never',
          autoIndent: 'none',
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          ariaLabel: label
        }}
      />
    </div>
  )
}

/**
 * Scripts "antes de enviar" e "depois da resposta" (JavaScript no sandbox QuickJS). Quando o próprio
 * usuário edita, o script é registrado como confiável neste computador (com atraso, para não gravar a cada tecla).
 */
export function ScriptsEditor({ scripts, target, onChange, onTrusted }: { scripts: ScriptPair; target: ScriptTrustTarget; onChange: (s: ScriptPair) => void; onTrusted: () => void }) {
  const t = useT()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  const edit = (next: ScriptPair): void => {
    onChange(next)
    clearTimeout(timer.current)
    if (!hasScripts(next)) return
    timer.current = setTimeout(() => {
      window.api
        .apiScriptTrust({ requestKey: target.requestKey, collectionDir: target.collectionDir, pre: next.pre, post: next.post })
        .then(onTrusted)
        .catch(() => undefined)
    }, 500)
  }

  return (
    <section data-testid="api-scripts">
      <h3 className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <ShieldCheck size={13} /> {t('apiClient.scripts.title')}
      </h3>
      <p className="mb-2 text-xs text-zinc-500">{t('apiClient.scripts.hint')}</p>
      <div className="flex flex-col gap-3">
        <div>
          <p className="mb-1 text-[12.5px] font-semibold">{t('apiClient.scripts.pre')}</p>
          <ScriptMonaco value={scripts.pre} onChange={(pre) => edit({ ...scripts, pre })} label={t('apiClient.scripts.pre')} testId="api-script-pre" />
        </div>
        <div>
          <p className="mb-1 text-[12.5px] font-semibold">{t('apiClient.scripts.post')}</p>
          <ScriptMonaco value={scripts.post} onChange={(post) => edit({ ...scripts, post })} label={t('apiClient.scripts.post')} testId="api-script-post" />
        </div>
      </div>
    </section>
  )
}
