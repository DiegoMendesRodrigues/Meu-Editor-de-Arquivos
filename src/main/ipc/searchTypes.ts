// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Tipos e limites compartilhados entre o processo principal e a thread de busca (searchWorker). */
import type { ReplaceResponse } from '@shared/ipc'
import type { SearchOptions } from '@shared/search'

export const MAX_FILES_SCANNED = 20000

export type WorkRequest =
  | { kind: 'search'; root: string; options: SearchOptions; include: string }
  | { kind: 'replace'; root: string; options: SearchOptions; replacement: string; paths: string[]; binaryOrLarge: string }

export type ReplaceWorkResult = ReplaceResponse & { changed: string[] }
