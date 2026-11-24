// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { MessageKey } from '@shared/i18n'

export type NewType = {
  ext: string
  name: string
  /** Nome traduzível (quando existe, substitui `name`). */
  nameKey?: MessageKey
  /** Também aparece em Arquivo → Novo (o botão "Novo" mostra todos). */
  inMenu?: boolean
}

/** Tipos de documento oferecidos no botão "Novo": primeiro os sem seção, depois as seções. */
export const NEW_TYPES: NewType[] = [
  { ext: 'md', name: 'Markdown' },
  { ext: 'markdown', name: 'Markdown' },
  { ext: 'txt', name: 'text', nameKey: 'newType.txt', inMenu: true },
  { ext: 'log', name: 'log', nameKey: 'newType.log' },
  { ext: 'tex', name: 'LaTeX' },
  { ext: 'apireq', name: 'API', nameKey: 'newType.apireq', inMenu: true },
  { ext: 'apienv', name: 'API environment', nameKey: 'newType.apienv', inMenu: true }
]

export const NEW_TYPE_GROUPS: { titleKey: MessageKey; types: NewType[] }[] = [
  {
    titleKey: 'newGroup.code',
    types: [
      { ext: 'py', name: 'Python', inMenu: true },
      { ext: 'c', name: 'C' },
      { ext: 'h', name: 'C' },
      { ext: 'cpp', name: 'C++' },
      { ext: 'cc', name: 'C++' },
      { ext: 'hpp', name: 'C++' },
      { ext: 'cs', name: 'C#' },
      { ext: 'java', name: 'Java' },
      { ext: 'js', name: 'JavaScript' },
      { ext: 'mjs', name: 'JavaScript' },
      { ext: 'cjs', name: 'JavaScript' },
      { ext: 'jsx', name: 'JavaScript' },
      { ext: 'ts', name: 'TypeScript' },
      { ext: 'tsx', name: 'TypeScript' },
      { ext: 'php', name: 'PHP' },
      { ext: 'go', name: 'Go' },
      { ext: 'rs', name: 'Rust' }
    ]
  },
  {
    titleKey: 'newGroup.scripts',
    types: [
      { ext: 'ps1', name: 'PowerShell' },
      { ext: 'psm1', name: 'PowerShell' },
      { ext: 'sh', name: 'Shell' },
      { ext: 'bash', name: 'Shell' },
      { ext: 'bat', name: 'Batch' },
      { ext: 'cmd', name: 'Batch' },
      { ext: 'lua', name: 'Lua' }
    ]
  },
  {
    titleKey: 'newGroup.web',
    types: [
      { ext: 'html', name: 'HTML' },
      { ext: 'htm', name: 'HTML' },
      { ext: 'css', name: 'CSS' },
      { ext: 'scss', name: 'SCSS' },
      { ext: 'less', name: 'Less' },
      { ext: 'xml', name: 'XML' },
      { ext: 'json', name: 'JSON' }
    ]
  },
  {
    titleKey: 'newGroup.data',
    types: [
      { ext: 'csv', name: 'CSV' },
      { ext: 'sql', name: 'SQL', inMenu: true },
      { ext: 'yaml', name: 'YAML' },
      { ext: 'yml', name: 'YAML' },
      { ext: 'toml', name: 'TOML' },
      { ext: 'ini', name: 'INI' },
      { ext: 'conf', name: 'configuration', nameKey: 'newType.conf' }
    ]
  }
]

/** Tipos de Arquivo → Novo (além do Markdown, que é o "Novo" padrão). */
export const MENU_NEW_TYPES: NewType[] = [...NEW_TYPES, ...NEW_TYPE_GROUPS.flatMap((g) => g.types)].filter((type) => type.inMenu)
