// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { loadMonacoNls } from './editor/monacoNls'
import { useLocale } from './i18n'

// As traduções do Monaco precisam estar prontas antes de ele ser carregado (pelo bootstrap).
await loadMonacoNls(useLocale.getState().locale)
await import('./bootstrap')
