// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { t } from '@/i18n'

/** Linguagem do Monaco a partir da extensão do arquivo. */
const BY_EXTENSION: Record<string, string> = {
  md: 'markdown', markdown: 'markdown', txt: 'plaintext', log: 'plaintext', tex: 'latex',
  py: 'python', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp', java: 'java',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', php: 'php', go: 'go', rs: 'rust',
  ps1: 'powershell', psm1: 'powershell', sh: 'shell', bash: 'shell', bat: 'bat', cmd: 'bat', lua: 'lua',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less', xml: 'xml', json: 'json',
  csv: 'plaintext', sql: 'sql', yaml: 'yaml', yml: 'yaml', toml: 'toml', ini: 'ini', conf: 'ini'
}

export function languageFromName(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return BY_EXTENSION[ext] ?? 'plaintext'
}

/** Nomes das linguagens na barra de status e no menu (só "Texto" depende do idioma do aplicativo). */
const LANGUAGE_NAMES: Record<string, string> = {
  markdown: 'Markdown', latex: 'LaTeX', python: 'Python', c: 'C', cpp: 'C++',
  csharp: 'C#', java: 'Java', javascript: 'JavaScript', typescript: 'TypeScript', php: 'PHP',
  go: 'Go', rust: 'Rust', powershell: 'PowerShell', shell: 'Shell', bat: 'Batch', lua: 'Lua',
  html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less', xml: 'XML', json: 'JSON', sql: 'SQL',
  yaml: 'YAML', ini: 'INI', toml: 'TOML'
}

export const languageLabel = (id: string): string => (id === 'plaintext' ? t('lang.plaintext') : (LANGUAGE_NAMES[id] ?? id))

/** Linguagens oferecidas no menu, em ordem alfabética pelo nome exibido. */
export const languageMenu = (translate: typeof t = t): string[] => {
  const name = (id: string): string => (id === 'plaintext' ? translate('lang.plaintext') : LANGUAGE_NAMES[id])
  return ['plaintext', ...Object.keys(LANGUAGE_NAMES)].sort((a, b) => name(a).localeCompare(name(b), 'pt-BR'))
}
