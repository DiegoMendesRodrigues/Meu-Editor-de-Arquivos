// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useMemo, useState } from 'react'
import Editor from '@monaco-editor/react'
import { Check, Copy } from 'lucide-react'
import { CODEGEN_TARGETS } from '@shared/api/codegen'
import type { ApiRequest } from '@shared/api/schema'
import { Modal, buttonClass, fieldClass } from '@/components/Modal'
import { useT } from '@/i18n'
import { useTheme } from '@/theme'

/** Gerar código (curl, PowerShell, Python, fetch, axios, C#, Java, Go, PHP, Rust). Só texto, sem resolver segredos. */
export function CodegenDialog({ open, onClose, request }: { open: boolean; onClose: () => void; request: ApiRequest }) {
  const t = useT()
  const theme = useTheme()
  const [targetId, setTargetId] = useState<string>(CODEGEN_TARGETS[0]!.id)
  const [copied, setCopied] = useState(false)
  const target = CODEGEN_TARGETS.find((x) => x.id === targetId) ?? CODEGEN_TARGETS[0]!
  const code = useMemo(() => (open ? target.generate(request) : ''), [open, target, request])

  if (!open) return null

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Modal title={t('apiClient.codegen.title')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            {t('apiClient.codegen.language')}
            <select aria-label={t('apiClient.codegen.language')} value={targetId} onChange={(e) => setTargetId(e.target.value)} className={`${fieldClass} w-auto`}>
              {CODEGEN_TARGETS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={`${buttonClass} ml-auto inline-flex items-center gap-1`} onClick={() => void copy()}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? t('apiClient.codegen.copied') : t('apiClient.codegen.copy')}
          </button>
        </div>
        <div className="h-[340px] overflow-hidden rounded border border-border" data-testid="codegen-code">
          <Editor
            path={`inmemory://codegen/${target.id}`}
            value={code}
            language={target.monaco}
            theme={theme === 'dark' ? 'meu-escuro' : 'meu-claro'}
            options={{ readOnly: true, minimap: { enabled: false }, automaticLayout: true, scrollBeyondLastLine: false, fontSize: 12, wordWrap: 'on', domReadOnly: true }}
          />
        </div>
        <p className="text-xs text-zinc-500">{t('apiClient.codegen.note')}</p>
      </div>
    </Modal>
  )
}
