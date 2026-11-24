// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { ApiSendResult } from '@shared/api/protocol'
import { useDocuments } from '@/store/documents'

/** Última resposta de cada requisição aberta. Só na memória: nada disso vai para a sessão nem para a nuvem. */
export interface DocResponse {
  /** Id do envio em andamento (null = parado). */
  runId: string | null
  result: ApiSendResult | null
  /** ISO 8601 do envio. */
  sentAt: string | null
  environment: string | null
}

interface ResponsesState {
  byDoc: Record<string, DocResponse>
  start(docId: string, runId: string): void
  finish(docId: string, runId: string, result: ApiSendResult, environment: string | null): void
  /** Desfaz o início de um envio que não chegou a sair (ex.: esperando a confirmação de produção). */
  abort(docId: string, runId: string): void
  clear(docId: string): void
}

const EMPTY: DocResponse = { runId: null, result: null, sentAt: null, environment: null }

export const useResponses = create<ResponsesState>((set) => ({
  byDoc: {},
  start: (docId, runId) => set((s) => ({ byDoc: { ...s.byDoc, [docId]: { ...(s.byDoc[docId] ?? EMPTY), runId } } })),
  finish: (docId, runId, result, environment) =>
    set((s) => {
      const current = s.byDoc[docId]
      // Um envio mais novo já começou (ou o documento foi fechado): este resultado chegou atrasado.
      if (!current || current.runId !== runId) return s
      return { byDoc: { ...s.byDoc, [docId]: { runId: null, result, sentAt: new Date().toISOString(), environment } } }
    }),
  abort: (docId, runId) =>
    set((s) => {
      const current = s.byDoc[docId]
      if (!current || current.runId !== runId) return s
      return { byDoc: { ...s.byDoc, [docId]: { ...current, runId: null } } }
    }),
  clear: (docId) =>
    set((s) => {
      if (!(docId in s.byDoc)) return s
      const { [docId]: _gone, ...rest } = s.byDoc
      return { byDoc: rest }
    })
}))

export const useDocResponse = (docId: string): DocResponse => useResponses((s) => s.byDoc[docId]) ?? EMPTY

// Fechou o documento: descarta a resposta (pode ter até 10 MB).
useDocuments.subscribe((state, prev) => {
  if (state.documents === prev.documents) return
  const open = new Set(state.documents.map((d) => d.id))
  for (const id of Object.keys(useResponses.getState().byDoc)) if (!open.has(id)) useResponses.getState().clear(id)
})
