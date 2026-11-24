// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { ApiRequest } from '../schema'

export interface CodegenTarget {
  id: string
  /** Nome exibido (nomes técnicos não são traduzidos). */
  label: string
  /** Linguagem do Monaco para colorir o código. */
  monaco: string
  generate(request: ApiRequest): string
}
