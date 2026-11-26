// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { ApiRequest } from '../schema'

/** O que os exportadores recebem: a coleção já lida. Segredos nunca entram (variáveis secretas saem sem valor). */
export interface ExportInput {
  name: string
  description?: string
  variables: { key: string; value: string }[]
  items: { folder: string; request: ApiRequest }[]
}

/** Separa "a/b" em segmentos. */
export const folderParts = (folder: string): string[] => folder.split('/').filter(Boolean)
