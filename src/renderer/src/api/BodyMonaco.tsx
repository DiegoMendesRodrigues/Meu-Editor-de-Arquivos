// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useState } from 'react'
import Editor from '@monaco-editor/react'
import { Wand2 } from 'lucide-react'
import '@/editor/monacoSetup'
import { FORMAT_MAX_CHARS } from '@shared/ipc'
import { useT } from '@/i18n'
import { useNotice } from '@/store/notice'
import { useTheme } from '@/theme'

const FORMATTABLE = new Set(['json', 'xml', 'html'])

/** Corpo em texto no Monaco, com o realce da linguagem e o botão Formatar (a auto formatação do app). */
export function BodyMonaco({ language, value, onChange, label }: { language: 'json' | 'xml' | 'text' | 'html'; value: string; onChange: (text: string) => void; label: string }) {
  const t = useT()
  const theme = useTheme()
  const [busy, setBusy] = useState(false)

  const format = async (): Promise<void> => {
    if (value.length > FORMAT_MAX_CHARS) return useNotice.getState().show(t('format.tooLarge'))
    setBusy(true)
    try {
      const r = await window.api.formatCode(language, '', value)
      if (r.status === 'ok') onChange(r.text)
      else useNotice.getState().show(t('apiClient.body.formatFailed'))
    } catch {
      useNotice.getState().show(t('apiClient.body.formatFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-40 flex-1 flex-col gap-1">
      {FORMATTABLE.has(language) && (
        <div>
          <button type="button" disabled={busy || value === ''} onClick={() => void format()} className="flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[12.5px] hover:bg-zinc-100 disabled:opacity-50">
            <Wand2 size={13} /> {t('apiClient.body.format')}
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 rounded border border-border" aria-label={label} data-testid="api-body-editor">
        <Editor
          value={value}
          language={language === 'text' ? 'plaintext' : language}
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
            tabSize: 2
          }}
        />
      </div>
    </div>
  )
}
