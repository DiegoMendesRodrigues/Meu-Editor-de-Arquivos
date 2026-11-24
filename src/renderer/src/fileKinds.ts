// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Tipo do arquivo pela extensão, para o ícone da barra lateral (as seções seguem as do botão "+"). */
import { NEW_TYPE_GROUPS } from './newTypes'

export type FileKind = 'document' | 'log' | 'code' | 'script' | 'web' | 'data' | 'other'

const DOCUMENT = new Set(['md', 'markdown', 'txt', 'tex'])
const GROUP_KIND: Record<string, FileKind> = {
  'newGroup.code': 'code',
  'newGroup.scripts': 'script',
  'newGroup.web': 'web',
  'newGroup.data': 'data'
}
const BY_EXTENSION = new Map<string, FileKind>(
  NEW_TYPE_GROUPS.flatMap((g) => g.types.map((type) => [type.ext, GROUP_KIND[g.titleKey] ?? 'other'] as const))
)

export function fileKind(name: string): FileKind {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return 'other' // sem extensão (ou só ".algo", como .gitignore)
  const ext = name.slice(dot + 1).toLowerCase()
  if (DOCUMENT.has(ext)) return 'document'
  if (ext === 'log') return 'log'
  return BY_EXTENSION.get(ext) ?? 'other'
}
