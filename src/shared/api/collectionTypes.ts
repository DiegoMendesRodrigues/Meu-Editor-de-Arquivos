// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { ApiCollection, ApiRequest } from './schema'

/** Coleção = pasta (no disco ou na nuvem do app) com collection.apicol e arquivos .apireq em subpastas. */
export interface CollectionRequestItem {
  /** Caminho do .apireq (disco) ou caminho da nuvem. */
  path: string
  /** Pasta relativa à raiz da coleção ("" = raiz), com "/". */
  folder: string
  request: ApiRequest
}

export interface CollectionTree {
  dir: string
  location: 'disk' | 'cloud'
  collection: ApiCollection | null
  requests: CollectionRequestItem[]
  /** Arquivos .apienv da coleção (caminhos). */
  environments: string[]
}
