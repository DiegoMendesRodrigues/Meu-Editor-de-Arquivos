// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { app } from 'electron'
import { detectLocale, translate, type Locale, type MessageKey, type Params } from '@shared/i18n'

/**
 * Idioma usado nos diálogos nativos e nas mensagens de erro do processo principal.
 * Começa no idioma do sistema e acompanha a escolha do usuário na interface (o Renderer avisa a cada troca).
 */
let locale: Locale | null = null

export const currentLocale = (): Locale => (locale ??= detectLocale([app?.getLocale?.() ?? '']))

export function setMainLocale(next: Locale): void {
  locale = next
}

export const tm = (key: MessageKey, params?: Params): string => translate(currentLocale(), key, params)
