// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Endereços do site usados pelo aplicativo (Ajuda → Suporte Técnico), no idioma da interface. */
import type { Locale } from './i18n'

export const SITE_URL = 'https://meueditordearquivos.aplicativoia.online'

/** Código de idioma que o site espera em ?lang= para cada idioma do aplicativo. */
export const SITE_LANG: Record<Locale, string> = {
  'pt-BR': 'pt-BR',
  'pt-PT': 'pt',
  en: 'en',
  es: 'es',
  fr: 'fr-FR',
  de: 'de'
}

export const supportUrl = (locale: Locale): string => `${SITE_URL}/suporte.php?lang=${SITE_LANG[locale]}`

/** Página inicial do site no idioma do aplicativo. */
export const siteUrl = (locale: Locale): string => `${SITE_URL}/?lang=${SITE_LANG[locale]}`

/** Webservice da versão mais recente publicada, no idioma do aplicativo. */
export const versionUrl = (locale: Locale): string => `${SITE_URL}/version.php?lang=${SITE_LANG[locale]}`

export const GITHUB_URL = 'https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos'
