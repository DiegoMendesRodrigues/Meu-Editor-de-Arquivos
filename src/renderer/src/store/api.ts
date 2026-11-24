// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { ApiCollectionPayload, ApiEnvironmentPayload } from '@shared/api/protocol'
import { applyEol } from '@shared/eol'
import { findCollection } from '@/api/collections'
import { parseCollection, parseEnvironment, serializeEnvironment } from '@/api/environment'
import { isApiLanguage } from '@/editor/languages'
import { useDocuments, type EditorDocument } from './documents'

/** Janelas do Cliente de API abertas pela barra lateral e pelos menus (renderizadas por ApiDialogs). */
export type ApiDialog =
  | { kind: 'import'; dir?: string }
  | { kind: 'export'; dir: string }
  | { kind: 'runner'; dir: string }
  | { kind: 'cookies' }
  | { kind: 'mock'; dir?: string }
  | { kind: 'newFolder'; dir: string }
  | { kind: 'newCollection' }

/** Resumo do ambiente ativo (para a barra de status, os cookies e o seletor). */
export interface EnvironmentInfo {
  key: string
  id: string
  name: string
  production: boolean
}

interface ApiState {
  /** Caminho (ou id do documento, se ainda não salvo) do .apienv ativo; null = sem ambiente. */
  activeEnvironment: string | null
  setActiveEnvironment: (key: string | null) => void
  /** Leitura do ambiente ativo; null quando não há ambiente ou ele não pôde ser lido. */
  envInfo: EnvironmentInfo | null
  /** As seções de coleções e histórico aparecem na barra lateral. */
  sidebarOn: boolean
  setSidebarOn: (on: boolean) => void
  /** Sobem a cada gravação de coleção ou nova execução, para a barra lateral reler. */
  collectionsTick: number
  historyTick: number
  bumpCollections: () => void
  bumpHistory: () => void
  dialog: ApiDialog | null
  openDialog: (dialog: ApiDialog) => void
  closeDialog: () => void
}

const ENV_KEY = 'api.activeEnvironment'
const SIDEBAR_KEY = 'api.sidebar'

function load(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}
function save(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key)
    else globalThis.localStorage?.setItem(key, value)
  } catch {
    // armazenamento bloqueado: a escolha vale só nesta sessão
  }
}

export const useApiStore = create<ApiState>((set) => ({
  activeEnvironment: load(ENV_KEY),
  setActiveEnvironment: (key) => {
    save(ENV_KEY, key)
    set({ activeEnvironment: key, envInfo: null })
    scheduleInfo()
  },
  envInfo: null,
  sidebarOn: load(SIDEBAR_KEY) === '1',
  setSidebarOn: (on) => {
    save(SIDEBAR_KEY, on ? '1' : null)
    set({ sidebarOn: on })
  },
  collectionsTick: 0,
  historyTick: 0,
  bumpCollections: () => set((s) => ({ collectionsTick: s.collectionsTick + 1 })),
  bumpHistory: () => set((s) => ({ historyTick: s.historyTick + 1 })),
  dialog: null,
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null })
}))

/** Chave do documento como ambiente: caminho no disco, "cloud:<id>" na nuvem ou o id da aba (não salvo). */
export const environmentKeyOf = (doc: Pick<EditorDocument, 'id' | 'path' | 'cloud'>): string => doc.path ?? (doc.cloud ? `cloud:${doc.cloud.id}` : doc.id)

const findDocByKey = (key: string): EditorDocument | undefined => useDocuments.getState().documents.find((d) => environmentKeyOf(d) === key)

/** Texto do ambiente: da aba aberta (com as alterações não salvas) ou, senão, do disco ou da nuvem. */
async function readEnvironmentText(key: string): Promise<string | null> {
  const open = findDocByKey(key)
  if (open) return open.content
  try {
    if (key.startsWith('cloud:')) return (await window.api.cloudRead(key.slice(6))).content
    if (/^doc-\d+$/.test(key)) return null // aba não salva que já foi fechada
    return (await window.api.readFile(key)).content
  } catch {
    return null
  }
}

let infoTimer: ReturnType<typeof setTimeout> | undefined
async function refreshInfo(): Promise<void> {
  const key = useApiStore.getState().activeEnvironment
  if (!key) return useApiStore.setState({ envInfo: null })
  const text = await readEnvironmentText(key)
  const env = text === null ? null : parseEnvironment(text)
  if (useApiStore.getState().activeEnvironment !== key) return
  useApiStore.setState({ envInfo: env ? { key, id: env.id, name: env.name, production: env.production } : null })
}
function scheduleInfo(): void {
  clearTimeout(infoTimer)
  infoTimer = setTimeout(() => void refreshInfo(), 150)
}

if (typeof window !== 'undefined') {
  // O resumo acompanha as edições do ambiente ativo e as abas que abrem ou fecham.
  useDocuments.subscribe((state, prev) => {
    const key = useApiStore.getState().activeEnvironment
    if (!key) return
    const now = state.documents.find((d) => environmentKeyOf(d) === key)
    const before = prev.documents.find((d) => environmentKeyOf(d) === key)
    if (now?.content !== before?.content) scheduleInfo()
  })
  setTimeout(scheduleInfo, 600)
}

/** Contexto que acompanha um envio: ambiente ativo e coleção da pasta da requisição. */
export interface SendContext {
  environment: ApiEnvironmentPayload | null
  collection: ApiCollectionPayload | null
}

/** Ambiente ativo e coleção do documento (procura collection.apicol nas pastas acima do arquivo). */
export async function getSendContext(doc: EditorDocument): Promise<SendContext> {
  let environment: ApiEnvironmentPayload | null = null
  const key = useApiStore.getState().activeEnvironment
  if (key) {
    const text = await readEnvironmentText(key)
    const env = text === null ? null : parseEnvironment(text)
    if (env) environment = { id: env.id, name: env.name, production: env.production, variables: env.variables }
  }
  let collection: ApiCollectionPayload | null = null
  const found = await findCollection(doc)
  const col = found ? parseCollection(found.text) : null
  if (col) collection = { id: col.id, variables: col.variables, auth: col.auth }
  return { environment, collection }
}

/**
 * Grava no ambiente ativo as variáveis extraídas de uma resposta. Só mexe nas não secretas (as secretas
 * já foram para o cofre no Main). Abre o ambiente se estiver fechado; o documento fica com ● para salvar.
 */
export async function applyExtractedVariables(values: { key: string; value: string }[]): Promise<void> {
  const key = useApiStore.getState().activeEnvironment
  if (!key || values.length === 0) return
  let doc = findDocByKey(key)
  if (!doc) {
    try {
      if (key.startsWith('cloud:')) useDocuments.getState().addCloudFile(await window.api.cloudRead(key.slice(6)))
      else if (!/^doc-\d+$/.test(key)) useDocuments.getState().addOpenedFiles([await window.api.readFile(key)])
    } catch {
      return
    }
    doc = findDocByKey(key)
  }
  if (!doc) return
  const env = parseEnvironment(doc.content)
  if (!env) return
  const variables = [...env.variables]
  for (const { key: name, value } of values) {
    const i = variables.findIndex((v) => v.key === name)
    if (i >= 0) {
      if (!variables[i]!.secret) variables[i] = { ...variables[i]!, value }
    } else variables.push({ key: name, value, secret: false })
  }
  const text = applyEol(serializeEnvironment({ ...env, variables }), doc.eol)
  if (text !== doc.content) useDocuments.getState().updateContent(doc.id, text)
}

/** O documento ativo é do Cliente de API (requisição, ambiente, coleção...)? */
export const isApiDocument = (doc: EditorDocument | undefined): boolean => !!doc && isApiLanguage(doc.language)
