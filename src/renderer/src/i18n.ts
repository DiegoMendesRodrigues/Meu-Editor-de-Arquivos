// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import { detectLocale, isLocale, translate, type Locale, type MessageKey, type Params } from '@shared/i18n'

interface LocaleState {
  locale: Locale
  setLocale(locale: Locale): void
}

/** Último idioma escolhido, guardado também aqui para ser lido já na abertura (antes da sessão). */
const STORAGE_KEY = 'meu-editor.locale'

function stored(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

/** Idioma inicial: o último escolhido ou, sem escolha, o principal do sistema (inglês se não houver tradução). */
const initial = (): Locale => stored() ?? detectLocale([navigator.language])

export const useLocale = create<LocaleState>((set) => ({
  locale: initial(),
  setLocale: (locale) => set({ locale })
}))

/** Tradutor para usar fora de componentes (comandos, stores): lê o idioma atual no momento da chamada. */
export const t = (key: MessageKey, params?: Params): string => translate(useLocale.getState().locale, key, params)

/** Tradutor para componentes: a interface é redesenhada quando o idioma muda. */
export function useT(): (key: MessageKey, params?: Params) => string {
  const locale = useLocale((s) => s.locale)
  return (key, params) => translate(locale, key, params)
}

/** Aplica o idioma no estado, no atributo lang da página e avisa o processo principal (diálogos nativos). */
export function applyLocale(locale: Locale): void {
  useLocale.getState().setLocale(locale)
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* sem armazenamento local: vale o idioma do sistema na próxima abertura */
  }
  document.documentElement.lang = locale
  void window.api.setLocale(locale).catch(() => undefined)
}
