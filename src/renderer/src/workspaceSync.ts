// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Área de trabalho sincronizada pela nuvem.
 *
 * Com a conta conectada, as abas que não dependem do disco deste computador (documentos sem
 * título e arquivos da nuvem), com o texto ainda não salvo, ficam guardadas na conta. Outro
 * computador conectado à mesma conta mostra as mesmas abas e recebe as alterações.
 *
 * O que fica guardado (formato 2), para não ocupar a nuvem com cópias:
 * - documento sem título: o texto (é a única cópia dele);
 * - arquivo da nuvem sem alterações: só a referência (id, caminho e versão); o texto vem do arquivo;
 * - arquivo da nuvem com alterações: só o texto atual; o texto salvo vem do arquivo, na versão indicada.
 *
 * Cada computador lembra a última versão sincronizada ("base"). Ao receber a versão da nuvem:
 * - aba que só mudou lá: recebe o texto novo;
 * - aba que mudou aqui: este computador envia a sua versão;
 * - texto mudado nos dois computadores: este fica com o seu, e o texto do outro abre numa aba nova
 *   "(conflito)", para nada se perder;
 * - aba fechada lá (e sem mudanças aqui): é fechada; aba nova lá: é aberta.
 * Arquivos abertos do disco não entram: o caminho só existe neste computador.
 */
import { z } from 'zod'
import { t } from '@/i18n'
import { useAccount } from '@/store/account'
import { newSyncId, useDocuments, type EditorDocument } from '@/store/documents'
import { useNotice } from '@/store/notice'

const PUSH_DELAY_MS = 2000
const POLL_INTERVAL_MS = 10_000
const MAX_BYTES = 9 * 1024 * 1024

const cloudRefSchema = z.object({ id: z.string().min(1).max(64), path: z.string().min(1).max(512), version: z.number().int().min(0) })
const commonEntry = {
  syncId: z.string().min(1).max(64),
  name: z.string().min(1).max(260),
  language: z.string().max(64),
  mode: z.enum(['preview', 'edit']),
  encoding: z.enum(['UTF-8', 'UTF-8 BOM']),
  eol: z.enum(['LF', 'CRLF', 'CR']),
  cloud: cloudRefSchema.optional()
}
/** Formato 2: o texto só vem quando é necessário (sem título, ou arquivo da nuvem com alterações). */
const entrySchema = z.object({ ...commonEntry, content: z.string().optional() })
/** Formato 1 (versões anteriores): sempre com o texto atual e o salvo. */
const legacyEntrySchema = z.object({ ...commonEntry, content: z.string(), savedContent: z.string() })
const workspaceSchema = z.object({ version: z.literal(2), activeSyncId: z.string().nullable(), documents: z.array(entrySchema).max(500) })
const legacyWorkspaceSchema = z.object({ version: z.literal(1), activeSyncId: z.string().nullable(), documents: z.array(legacyEntrySchema).max(500) })

export type SyncEntry = z.infer<typeof entrySchema>
export type WorkspaceData = z.infer<typeof workspaceSchema>
/** Texto de um arquivo da nuvem numa versão (o salvo de uma aba local ou o baixado da nuvem). */
export type CloudTexts = Map<string, { content: string; version: number }>

/** A aba participa da sincronização? (sem arquivo no disco e com algo a guardar) */
export const isSynced = (d: EditorDocument): boolean => d.path === null && (d.cloud !== undefined || d.content !== '')

/** Arquivo da nuvem com texto diferente do salvo (o texto precisa ir junto). */
const hasUnsavedText = (d: EditorDocument): boolean => !d.cloud || d.content !== d.savedContent

export function toEntry(d: EditorDocument): SyncEntry {
  return {
    syncId: d.syncId!,
    name: d.name,
    language: d.language,
    mode: d.mode,
    encoding: d.encoding,
    eol: d.eol,
    ...(d.cloud ? { cloud: d.cloud } : {}),
    ...(hasUnsavedText(d) ? { content: d.content } : {})
  }
}

/** Lê a área de trabalho da nuvem nos dois formatos; o formato 1 vira o 2 (sem cópias desnecessárias). */
export function parseWorkspace(json: string | null): WorkspaceData {
  const empty: WorkspaceData = { version: 2, activeSyncId: null, documents: [] }
  if (!json) return empty
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return empty
  }
  const current = workspaceSchema.safeParse(raw)
  if (current.success) return current.data
  const legacy = legacyWorkspaceSchema.safeParse(raw)
  if (!legacy.success) return empty
  return {
    version: 2,
    activeSyncId: legacy.data.activeSyncId,
    documents: legacy.data.documents.map(({ savedContent, content, ...e }) =>
      e.cloud && content === savedContent ? e : { ...e, content }
    )
  }
}

const same = (a: SyncEntry | undefined, b: SyncEntry | undefined): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * Monta a aba a partir da entrada. Arquivos da nuvem precisam do texto salvo (em `texts`); sem ele,
 * uma entrada sem texto próprio não pode ser aberta (null).
 */
function fromEntry(e: SyncEntry, texts: CloudTexts): Omit<EditorDocument, 'id'> | null {
  const common = { path: null, name: e.name, language: e.language, encoding: e.encoding, savedEncoding: e.encoding, eol: e.eol, mode: e.mode, syncId: e.syncId }
  if (!e.cloud) return { ...common, content: e.content ?? '', savedContent: '' }
  const saved = texts.get(e.cloud.id)
  if (e.content === undefined) {
    if (!saved) return null
    // Sem alterações: o texto é o do arquivo (se já houver versão mais nova na nuvem, fica com ela).
    return { ...common, content: saved.content, savedContent: saved.content, cloud: { ...e.cloud, version: Math.max(e.cloud.version, saved.version) } }
  }
  // Com alterações: mantém a versão de origem, para a gravação detectar se o arquivo mudou na nuvem.
  return { ...common, content: e.content, savedContent: saved?.content ?? '', cloud: e.cloud }
}

export interface MergeResult {
  /** Novas abas na ordem final (as do disco continuam onde estavam). */
  documents: (EditorDocument | Omit<EditorDocument, 'id'>)[]
  /** Há mudanças locais que a nuvem ainda não tem. */
  needsPush: boolean
  /** Nomes das abas abertas por conflito (texto mudado nos dois computadores). */
  conflicts: string[]
}

export interface MergeOptions {
  /** Texto salvo dos arquivos da nuvem, por id. */
  texts: CloudTexts
  /** Nome da aba de conflito a partir do nome original. */
  conflictName(name: string): string
  newSyncId(): string
}

/**
 * Junta a área de trabalho da nuvem com a local, usando a base (última versão sincronizada).
 * Função pura, para poder ser testada.
 */
export function mergeWorkspace(local: EditorDocument[], remote: SyncEntry[], base: Map<string, SyncEntry>, opts: MergeOptions): MergeResult {
  const remoteById = new Map(remote.map((e) => [e.syncId, e]))
  const out: (EditorDocument | Omit<EditorDocument, 'id'>)[] = []
  const conflicts: string[] = []
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
    const before = base.get(d.syncId)
    if (!theirs) {
      if (base.has(d.syncId) && same(mine, before)) continue // fechada em outro computador: fecha aqui também
      needsPush = true // aba nova aqui
      out.push(d)
      continue
    }
    if (same(mine, theirs)) {
      out.push(d)
      continue
    }
    const textChangedHere = mine.content !== before?.content
    const textChangedThere = theirs.content !== before?.content
    if (same(mine, before) || !textChangedHere) {
      // Só mudou lá (ou aqui mudou só o modo de exibição): recebe a versão de lá.
      const received = fromEntry(theirs, opts.texts)
      out.push(received ? { ...d, ...received } : d)
      continue
    }
    // O texto mudou aqui: fica o daqui, e a nuvem é atualizada.
    needsPush = true
    out.push(d)
    // Mudou lá também, com texto não salvo diferente: o de lá abre numa aba própria.
    // (Se lá o arquivo foi salvo, a gravação daqui avisa do conflito de versão.)
    if (textChangedThere && theirs.content !== undefined && theirs.content !== mine.content) {
      const name = opts.conflictName(theirs.name)
      out.push({
        path: null,
        name,
        content: theirs.content,
        savedContent: '',
        language: theirs.language,
        encoding: theirs.encoding,
        savedEncoding: theirs.encoding,
        eol: theirs.eol,
        mode: 'edit',
        syncId: opts.newSyncId()
      })
      conflicts.push(name)
    }
  }
  for (const e of remote) {
    if (seen.has(e.syncId)) continue
    if (base.has(e.syncId)) {
      needsPush = true // fechada aqui depois da última sincronização
      continue
    }
    const received = fromEntry(e, opts.texts)
    if (received) out.push(received)
  }
  return { documents: out, needsPush, conflicts }
}

/**
 * Arquivos da nuvem cujo texto salvo é preciso baixar para abrir as entradas recebidas
 * (os que nenhuma aba deste computador já tem na mesma versão ou mais nova).
 */
export function cloudTextsNeeded(local: EditorDocument[], remote: SyncEntry[], known: CloudTexts): string[] {
  const bySyncId = new Map(local.filter((d) => d.syncId).map((d) => [d.syncId!, d]))
  const ids = new Set<string>()
  for (const e of remote) {
    if (!e.cloud) continue
    const mine = bySyncId.get(e.syncId)
    if (mine && same(toEntry(mine), e)) continue
    const have = known.get(e.cloud.id)
    if (!have || have.version < e.cloud.version) ids.add(e.cloud.id)
  }
  return [...ids]
}

/** Texto salvo que as abas deste computador já têm, por arquivo da nuvem. */
function localCloudTexts(docs: EditorDocument[]): CloudTexts {
  const texts: CloudTexts = new Map()
  for (const d of docs) {
    if (!d.cloud) continue
    const have = texts.get(d.cloud.id)
    if (!have || have.version < d.cloud.version) texts.set(d.cloud.id, { content: d.savedContent, version: d.cloud.version })
  }
  return texts
}

/** Junta dois conjuntos de textos, ficando com a versão mais nova de cada arquivo. */
function newest(a: CloudTexts, b: CloudTexts): CloudTexts {
  const out: CloudTexts = new Map(a)
  for (const [id, v] of b) {
    const have = out.get(id)
    if (!have || have.version <= v.version) out.set(id, v)
  }
  return out
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
  return { version: 2, activeSyncId: active && isSynced(active) ? active.syncId ?? null : null, documents: synced.map(toEntry) }
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
    const remote = parseWorkspace(res.data)

    // Baixa o texto dos arquivos da nuvem que as abas recebidas precisam. Um arquivo excluído
    // na nuvem fica sem texto (a aba sem alterações não abre); falta de conexão interrompe tudo.
    const texts = localCloudTexts(useDocuments.getState().documents)
    for (const id of cloudTextsNeeded(useDocuments.getState().documents, remote.documents, texts)) {
      const file = await window.api.cloudReadIfExists(id)
      if (file) texts.set(id, { content: file.content, version: file.version })
    }

    // O estado é lido de novo depois dos downloads, para não perder o que foi digitado enquanto isso.
    const state = useDocuments.getState()
    // Na primeira sincronização, uma aba vazia sem título deste computador dá lugar às da nuvem.
    const local = firstPull && remote.documents.length > 0
      ? state.documents.filter((d) => !(d.path === null && !d.cloud && d.content === ''))
      : state.documents
    const merged = mergeWorkspace(local, remote.documents, base, {
      texts: newest(texts, localCloudTexts(state.documents)),
      conflictName: (name) => t('sync.conflictName', { name }),
      newSyncId
    })
    needsPush = merged.needsPush || (firstPull && remote.documents.length === 0 && local.some(isSynced))
    version = res.version
    base = new Map(remote.documents.map((e) => [e.syncId, e]))
    applying = true
    useDocuments.getState().replaceDocuments(merged.documents, firstPull ? remote.activeSyncId : null)
    firstPull = false
    if (merged.conflicts.length > 0) useNotice.getState().show(t('sync.conflict', { names: merged.conflicts.join(', ') }))
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
  // Sem resposta rápida do servidor, fica assim mesmo: a sessão local guarda o texto.
  await Promise.race([push(), new Promise((resolve) => setTimeout(resolve, 3000))])
}
