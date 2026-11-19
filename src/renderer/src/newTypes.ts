// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { MessageKey } from '@shared/i18n'

/** Tipos de documento oferecidos em "Novo". O nome vem do dicionário quando é traduzível. */
export const NEW_TYPES: { ext: string; name: string; nameKey?: MessageKey }[] = [
  { ext: 'md', name: 'Markdown' },
  { ext: 'txt', name: 'text', nameKey: 'newType.txt' },
  { ext: 'py', name: 'Python' },
  { ext: 'sql', name: 'SQL' }
]
