// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { Locale } from '@shared/i18n'

/** Preferências do corretor ortográfico (guardadas na sessão). */
export interface SpellingValues {
  enabled: boolean
  /** Idioma da verificação; null = o mesmo idioma da interface. */
  locale: Locale | null
  /** Dicionário do usuário: palavras aceitas em qualquer idioma. */
  words: string[]
}

interface SpellingState extends SpellingValues {
  toggle(): void
  setLocale(locale: Locale | null): void
  addWord(word: string): void
  setAll(values: Partial<SpellingValues>): void
}

export const MAX_USER_WORDS = 5000

export const useSpelling = create<SpellingState>((set) => ({
  enabled: true,
  locale: null,
  words: [],
  toggle: () => set((s) => ({ enabled: !s.enabled })),
  setLocale: (locale) => set({ locale }),
  addWord: (word) =>
    set((s) => (s.words.includes(word) || s.words.length >= MAX_USER_WORDS ? s : { words: [...s.words, word].sort((a, b) => a.localeCompare(b)) })),
  setAll: (values) => set(values)
}))
