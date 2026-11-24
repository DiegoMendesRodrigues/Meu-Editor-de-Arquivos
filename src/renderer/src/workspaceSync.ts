// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Área de trabalho sincronizada pela nuvem.
 *
 * Com a conta conectada, as abas que não dependem do disco deste computador (documentos sem
 * título e arquivos da nuvem), com o texto ainda não salvo, ficam guardadas na conta. Outro
 * computador conectado à mesma conta mostra as mesmas abas e recebe as alterações.
 *
 * Cada computador lembra a última versão sincronizada ("base"). Ao receber a versão da nuvem:
 * - aba que só mudou lá: recebe o texto novo;
 * - aba que mudou aqui: este computador vence e envia a sua versão;
 * - aba fechada lá (e sem mudanças aqui): é fechada; aba nova lá: é aberta.
 * Arquivos abertos do disco não entram: o caminho só existe neste computador.
 */
import { z } from 'zod'
import { useAccount } from '@/store/account'
import { newSyncId, useDocuments, type EditorDocument } from '@/store/documents'

const PUSH_DELAY_MS = 2000
const POLL_INTERVAL_MS = 10_000
const MAX_BYTES = 9 * 1024 * 1024

const entrySchema = z.object({
  syncId: z.string().min(1).max(64),
  name: z.string().min(1).max(260),
  language: z.string().max(64),
  mode: z.enum(['preview', 'edit']),
  encoding: z.enum(['UTF-8', 'UTF-8 BOM']),
  eol: z.enum(['LF', 'CRLF', 'CR']),
  cloud: z.object({ id: z.string().min(1).max(64), path: z.string().min(1).max(512), version: z.number().int().min(0) }).optional(),
  content: z.string(),
  savedContent: z.string()
})
const workspaceSchema = z.object({ version: z.literal(1), activeSyncId: z.string().nullable(), documents: z.array(entrySchema).max(500) })

export type SyncEntry = z.infer<typeof entrySchema>
export type WorkspaceData = z.infer<typeof workspaceSchema>

/** A aba participa da sincronização? (sem arquivo no disco e com algo a guardar) */
export const isSynced = (d: EditorDocument): boolean => d.path === null && (d.cloud !== undefined || d.content !== '')

export function toEntry(d: EditorDocument): SyncEntry {
  return {
    syncId: d.syncId!,
    name: d.name,
    language: d.language,
    mode: d.mode,
    encoding: d.encoding,
    eol: d.eol,
    ...(d.cloud ? { cloud: d.cloud } : {}),
    content: d.content,
    savedContent: d.savedContent
  }
}

const same = (a: SyncEntry | undefined, b: SyncEntry | undefined): boolean => JSON.stringify(a) === JSON.stringify(b)

const fromEntry = (e: SyncEntry): Omit<EditorDocument, 'id'> => ({
  path: null,
  name: e.name,
  content: e.content,
  savedContent: e.savedContent,
  language: e.language,
  encoding: e.encoding,
  savedEncoding: e.encoding,
  eol: e.eol,
  mode: e.mode,
  syncId: e.syncId,
  ...(e.cloud ? { cloud: e.cloud } : {})
})

export interface MergeResult {
  /** Novas abas na ordem final (as do disco continuam onde estavam). */
  documents: (EditorDocument | Omit<EditorDocument, 'id'>)[]
  /** Há mudanças locais que a nuvem ainda não tem. */
  needsPush: boolean
}

/**
 * Junta a área de trabalho da nuvem com a local, usando a base (última versão sincronizada).
 * Função pura, para poder ser testada.
 */
export function mergeWorkspace(local: EditorDocument[], remote: SyncEntry[], base: Map<string, SyncEntry>): MergeResult {
  const remoteById = new Map(remote.map((e) => [e.syncId, e]))
  const out: (EditorDocument | Omit<EditorDocument, 'id'>)[] = []
  let needsPush = false
  const seen = new Set<string>()

  for (const d of local) {
    if (!isSynced(d) || !d.syncId) {
      out.push(d)
      continue
    }
    seen.add(d.syncId)
    const mine = toEntry(d)
    const theirs = remoteById.get(d.syncId)
    const changedHere = !same(mine, base.get(d.syncId))
    if (theirs) {
      if (changedHere) {
        if (!same(mine, theirs)) needsPush = true
        out.push(d)
      } else {
        out.push(same(mine, theirs) ? d : { ...d, ...fromEntry(theirs) })
      }
    } else if (base.has(d.syncId) && !changedHere) {
      // Fechada em outro computador: fecha aqui também.
    } else {
      needsPush = true // aba nova aqui
      out.push(d)
    }
  }
  for (const e of remote) {
    if (seen.has(e.syncId)) continue
    if (base.has(e.syncId)) {
      needsPush = true // fechada aqui depois da última sincronização
      continue
    }
    out.push(fromEntry(e))
  }
  return { documents: out, needsPush }
}

// ---- Estado da sincronização ----

let version = 0
let base = new Map<string, SyncEntry>()
let pushTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let busy = false
let applying = false
let firstPull = true

const signedIn = (): boolean => !!useAccount.getState().status.user

function ensureSyncIds(): void {
  const docs = useDocuments.getState().documents
  if (docs.every((d) => d.syncId)) return
  useDocuments.setState({ documents: docs.map((d) => (d.syncId ? d : { ...d, syncId: newSyncId() })) })
}

function localData(): WorkspaceData {
  const { documents, activeId } = useDocuments.getState()
  const synced = documents.filter(isSynced)
  const active = documents.find((d) => d.id === activeId)
  return { version: 1, activeSyncId: active && isSynced(active) ? active.syncId ?? null : null, documents: synced.map(toEntry) }
}

async function push(): Promise<void> {
  if (!signedIn()) return
  if (busy) return schedulePush()
  busy = true
  try {
    ensureSyncIds()
    const data = localData()
    const json = JSON.stringify(data)
    if (json.length > MAX_BYTES) return // grande demais: fica só neste computador (a sessão local guarda)
    const res = await window.api.workspacePut(json, version)
    if (res.ok) {
      version = res.version
      base = new Map(data.documents.map((e) => [e.syncId, e]))
    } else {
      busy = false
      await pull() // outro computador gravou antes: junta e envia de novo
    }
  } catch {
    /* sem conexão: tenta na próxima alteração ou consulta */
  } finally {
    busy = false
  }
}

function schedulePush(): void {
  if (applying || !signedIn()) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void push()
  }, PUSH_DELAY_MS)
}

/** Busca a área de trabalho da nuvem e junta com a local. */
export async function pull(): Promise<void> {
  if (!signedIn() || busy) return
  busy = true
  let needsPush = false
  try {
    ensureSyncIds()
    const res = await window.api.workspaceGet()
    if (res.version === version && !firstPull) return
    const parsed = res.data ? workspaceSchema.safeParse(JSON.parse(res.data)) : null
    const remote = parsed?.success ? parsed.data : { version: 1 as const, activeSyncId: null, documents: [] }
    const state = useDocuments.getState()
    // Na primeira sincronização, uma aba vazia sem título deste computador dá lugar às da nuvem.
    const local = firstPull && remote.documents.length > 0
      ? state.documents.filter((d) => !(d.path === null && !d.cloud && d.content === ''))
      : state.documents
    const merged = mergeWorkspace(local, remote.documents, base)
    needsPush = merged.needsPush || (firstPull && remote.documents.length === 0 && local.some(isSynced))
    version = res.version
    base = new Map(remote.documents.map((e) => [e.syncId, e]))
    applying = true
    useDocuments.getState().replaceDocuments(merged.documents, firstPull ? remote.activeSyncId : null)
    firstPull = false
  } catch {
    /* sem conexão ou sessão expirada: tenta de novo na próxima consulta */
  } finally {
    applying = false
    busy = false
  }
  if (needsPush) schedulePush()
}

function reset(): void {
  version = 0
  base = new Map()
  firstPull = true
}

/** Liga a sincronização (envio após alterações, consulta periódica e ao voltar para a janela). */
export function startWorkspaceSync(): () => void {
  let user = useAccount.getState().status.user?.id ?? null
  if (user) void pull()
  const unsubDocs = useDocuments.subscribe((s, prev) => {
    if (s.documents !== prev.documents || s.activeId !== prev.activeId) schedulePush()
  })
  const unsubAccount = useAccount.subscribe((s) => {
    const next = s.status.user?.id ?? null
    if (next === user) return
    user = next
    reset()
    if (next) void pull()
  })
  const onFocus = (): void => void pull()
  window.addEventListener('focus', onFocus)
  pollTimer = setInterval(() => void pull(), POLL_INTERVAL_MS)
  return () => {
    unsubDocs()
    unsubAccount()
    window.removeEventListener('focus', onFocus)
    if (pollTimer) clearInterval(pollTimer)
    if (pushTimer) clearTimeout(pushTimer)
  }
}

/** Envia na hora o que estiver pendente (ao fechar o app). */
export async function flushWorkspace(): Promise<void> {
  if (!pushTimer) return
  clearTimeout(pushTimer)
  pushTimer = null
  // Sem resposta rápida do servidor, fecha assim mesmo: a sessão local guarda o texto.
  await Promise.race([push(), new Promise((resolve) => setTimeout(resolve, 3000))])
}
