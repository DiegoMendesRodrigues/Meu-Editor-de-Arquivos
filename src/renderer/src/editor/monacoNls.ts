// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Textos internos do Monaco (janela de correções, busca, paleta de comandos...) no idioma do app.
 * O Monaco lê as traduções uma única vez, ao carregar; por isso elas são escolhidas antes de ele ser
 * importado. Se o idioma mudar com o app aberto, os textos internos acompanham na próxima abertura.
 */
import type { Locale } from '@shared/i18n'

type MonacoLanguage = 'de' | 'es' | 'fr' | 'pt-br' | null

/** Tradução do Monaco que corresponde a cada idioma do app (inglês é o texto original). */
const forLocale = (locale: Locale): MonacoLanguage =>
  locale === 'pt-BR' || locale === 'pt-PT' ? 'pt-br' : locale === 'en' ? null : locale

let loaded: MonacoLanguage = null

/** Textos do Monaco em português, pelo índice da mensagem (ver lookupMessage em monaco-editor/esm/vs/nls.js). */
export const PT_MESSAGES: Record<number, string> = {
  904: 'Correção rápida...',
  915: 'Ocultar desativadas',
  916: 'Mostrar desativadas',
  917: 'Mais ações...',
  918: 'Correção rápida',
  930: 'Executar: {0}',
  931: 'Mostrar ações de código. Correção rápida preferida disponível ({0})',
  932: 'Mostrar ações de código ({0})',
  933: 'Mostrar ações de código',
  1195: 'Ver problema',
  1196: 'Nenhuma correção rápida disponível',
  1197: 'Procurando correções rápidas...',
  1198: 'Nenhuma correção rápida disponível',
  1199: 'Correção rápida...',
  1668: 'Correção rápida'
}

/** Carrega as traduções do Monaco; precisa rodar antes da primeira importação do 'monaco-editor'. */
export async function loadMonacoNls(locale: Locale): Promise<void> {
  const lang = forLocale(locale)
  switch (lang) {
    case 'de':
      await import('monaco-editor/nls/lang/de')
      break
    case 'es':
      await import('monaco-editor/nls/lang/es')
      break
    case 'fr':
      await import('monaco-editor/nls/lang/fr')
      break
    case 'pt-br':
      // O pacote pt-br do Monaco vem vazio: os textos da janela de correções e do balão de erro
      // são fornecidos aqui (índices das mensagens do monaco-editor 0.57; os demais ficam em inglês).
      ;(globalThis as { _VSCODE_NLS_MESSAGES?: (string | null)[] })._VSCODE_NLS_MESSAGES = Object.assign([], PT_MESSAGES)
      break
  }
  loaded = lang
}

/** Os textos internos já carregados estão no idioma atual do app? */
export const monacoSpeaks = (locale: Locale): boolean => forLocale(locale) === loaded
