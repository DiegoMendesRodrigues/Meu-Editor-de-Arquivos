// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import Editor from '@monaco-editor/react'
import '@/editor/monacoSetup'
import { useTheme } from '@/theme'

/** Monaco só para leitura (corpo da resposta formatado ou bruto). */
export function ReadOnlyMonaco({ value, language, label }: { value: string; language: string; label: string }) {
  const theme = useTheme()
  return (
    <div className="h-full" aria-label={label} data-testid="api-response-monaco">
      <Editor
        value={value}
        language={language}
        theme={theme === 'dark' ? 'meu-escuro' : 'meu-claro'}
        options={{
          readOnly: true,
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'Cascadia Code', 'Consolas', 'DejaVu Sans Mono', 'Ubuntu Mono', monospace",
          wordWrap: 'on',
          folding: true,
          scrollBeyondLastLine: false,
          domReadOnly: true,
          renderWhitespace: 'none'
        }}
      />
    </div>
  )
}
