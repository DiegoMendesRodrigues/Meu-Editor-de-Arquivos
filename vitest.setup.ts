// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useLocale } from '@/i18n'

// Os testes conferem textos em português do Brasil, independentemente do idioma da máquina que os executa.
useLocale.setState({ locale: 'pt-BR' })
