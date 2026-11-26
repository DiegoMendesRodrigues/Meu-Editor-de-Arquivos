// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { GqlSchemaModel } from '@shared/api/graphql'

/** Schema carregado de um documento. Fica só na memória: nunca vai para o arquivo, a sessão nem a nuvem. */
export interface GraphqlSchemaEntry {
  status: 'loading' | 'loaded' | 'error'
  model: GqlSchemaModel | null
  /** Chave i18n do erro (sem prefixo de params). */
  error: { key: string; params?: Record<string, string | number> } | null
}

interface GraphqlSchemaState {
  byDoc: Record<string, GraphqlSchemaEntry>
  set: (docId: string, entry: GraphqlSchemaEntry) => void
  clear: (docId: string) => void
}

export const useGraphqlSchemas = create<GraphqlSchemaState>((set) => ({
  byDoc: {},
  set: (docId, entry) => set((s) => ({ byDoc: { ...s.byDoc, [docId]: entry } })),
  clear: (docId) =>
    set((s) => {
      const { [docId]: _gone, ...rest } = s.byDoc
      return { byDoc: rest }
    })
}))

/** Lê o modelo de um documento fora de componentes (o provedor de autocompletar usa). */
export const getGraphqlModel = (docId: string): GqlSchemaModel | null => useGraphqlSchemas.getState().byDoc[docId]?.model ?? null
