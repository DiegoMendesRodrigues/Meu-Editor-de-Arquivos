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

/** Nomes amigáveis para a barra de status. */
export const LANGUAGE_LABELS: Record<string, string> = {
  markdown: 'Markdown', plaintext: 'Texto', latex: 'LaTeX', python: 'Python', c: 'C', cpp: 'C++',
  csharp: 'C#', java: 'Java', javascript: 'JavaScript', typescript: 'TypeScript', php: 'PHP',
  go: 'Go', rust: 'Rust', powershell: 'PowerShell', shell: 'Shell', bat: 'Batch', lua: 'Lua',
  html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less', xml: 'XML', json: 'JSON', sql: 'SQL',
  yaml: 'YAML', ini: 'INI', toml: 'TOML'
}

/** Linguagens oferecidas no menu, em ordem alfabética pelo nome exibido. */
export const LANGUAGE_MENU: string[] = Object.keys(LANGUAGE_LABELS).sort((a, b) =>
  LANGUAGE_LABELS[a].localeCompare(LANGUAGE_LABELS[b], 'pt-BR')
)
