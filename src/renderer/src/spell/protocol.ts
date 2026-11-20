// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Mensagens trocadas entre a interface e o worker do corretor ortográfico. */
import type { Locale } from '@shared/i18n'

export interface Misspelling {
  offset: number
  length: number
  word: string
}

export type SpellRequest =
  | { id: number; type: 'check'; locale: Locale; language: string; text: string }
  | { id: number; type: 'suggest'; locale: Locale; word: string }
  | { id: number; type: 'words'; words: string[] }

export type SpellResponse =
  | { id: number; type: 'check'; errors: Misspelling[] }
  | { id: number; type: 'suggest'; suggestions: string[] }
  | { id: number; type: 'ok' }
  | { id: number; type: 'error'; message: string }
