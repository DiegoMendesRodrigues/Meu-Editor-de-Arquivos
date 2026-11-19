// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Idiomas do aplicativo. Os textos ficam em dicionários por idioma (um arquivo cada);
 * o português do Brasil é a referência e os demais precisam ter exatamente as mesmas chaves
 * (o TypeScript recusa a compilação se faltar alguma).
 */
import { de } from './de'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { ptBR, type Messages } from './pt-BR'
import { ptPT } from './pt-PT'

export type MessageKey = keyof Messages
export type Params = Record<string, string | number>

export const LOCALES = [
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'pt-PT', name: 'Português (Portugal)' }
] as const

export type Locale = (typeof LOCALES)[number]['code']

export const DEFAULT_LOCALE: Locale = 'en'

export const isLocale = (value: unknown): value is Locale => LOCALES.some((l) => l.code === value)

const dictionaries: Record<Locale, Record<string, string>> = { de, es, fr, en, 'pt-BR': ptBR, 'pt-PT': ptPT }

/**
 * Escolhe o idioma a partir da lista de preferências do sistema (ex.: navigator.languages).
 * Usa o primeiro idioma disponível; se nenhum for, inglês.
 */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const raw of preferred) {
    const tag = raw.replace('_', '-').toLowerCase()
    const [lang, region] = tag.split('-')
    if (lang === 'pt') {
      // "pt" sem região e pt-BR usam o português do Brasil; as demais regiões (PT, AO, MZ...) o de Portugal.
      return !region || region === 'br' ? 'pt-BR' : 'pt-PT'
    }
    if (lang === 'de' || lang === 'es' || lang === 'fr' || lang === 'en') return lang
  }
  return DEFAULT_LOCALE
}

/**
 * Traduz uma chave, trocando {nome} pelos parâmetros.
 * Com o parâmetro `n`, usa a variante singular "chave.one" quando a regra de plural do idioma pede (a chave
 * sem sufixo é o plural).
 */
export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  const dict = dictionaries[locale]
  let text = dict[key]
  if (params && typeof params.n === 'number') {
    if (new Intl.PluralRules(locale).select(params.n) === 'one') text = dict[`${key}.one`] ?? text
  }
  text ??= dictionaries[DEFAULT_LOCALE][key] ?? key
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (all, name: string) => (name in params ? String(params[name]) : all))
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Número de um nome de documento sem título ("Sem título 3.md", "Untitled 3.txt"...), em qualquer idioma;
 * 0 se o nome não for desse tipo. Serve para continuar a numeração ao restaurar a sessão.
 */
export function untitledNumber(name: string): number {
  for (const { code } of LOCALES) {
    const pattern = escapeRegExp(dictionaries[code]['doc.untitled']).replace(escapeRegExp('{n}'), '(\\d+)')
    const match = new RegExp(`^${pattern}(?:\\.|$)`).exec(name)
    if (match) return Number(match[1])
  }
  return 0
}
