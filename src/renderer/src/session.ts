/**
 * Sessão e recuperação.
 * - Gravação automática (com atraso curto) sempre que abas, pasta ou preferências mudam,
 *   incluindo o texto não salvo: se o app travar, nada se perde.
 * - Ao fechar normalmente, o usuário já decidiu sobre os não salvos; a sessão
 *   final guarda só abas, pasta e preferências.
 * - Ao iniciar, restaura tudo; textos recuperados voltam marcados como não salvos.
 */
import type { SessionData, SessionDocument } from '@shared/ipc'
import { languageFromName } from '@/editor/languages'
import { isDirty, useDocuments, type EditorDocument } from '@/store/documents'
import { useView } from '@/store/view'
import { useWorkspace } from '@/store/workspace'

const AUTOSAVE_DELAY_MS = 1500

let ready = false
let timer: ReturnType<typeof setTimeout> | null = null

const baseName = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path

/** Monta os dados da sessão a partir do estado atual. */
export function snapshot(includeUnsaved: boolean): SessionData {
  const { documents, activeId } = useDocuments.getState()
  const view = useView.getState()

  const kept = documents.filter((d) => d.path !== null || (includeUnsaved && d.content !== ''))
  const sessionDocs: SessionDocument[] = kept.map((d) => ({
    path: d.path,
    name: d.name,
    mode: d.mode,
    encoding: d.encoding,
    eol: d.eol,
    language: d.language,
    ...(d.cloud ? { cloud: d.cloud } : {}),
    ...(includeUnsaved && (isDirty(d) || d.path === null) ? { unsavedContent: d.content } : {})
  }))

  return {
    version: 1,
    folder: useWorkspace.getState().folder?.path ?? null,
    activeIndex: kept.findIndex((d) => d.id === activeId),
    documents: sessionDocs,
    view: {
      sidebarVisible: view.sidebarVisible,
      bottomPanelVisible: view.bottomPanelVisible,
      wordWrap: view.wordWrap,
      showInvisibles: view.showInvisibles,
      insertSpaces: view.insertSpaces,
      fontSize: view.fontSize,
      tabSize: view.tabSize
    }
  }
}

async function write(includeUnsaved: boolean): Promise<void> {
  try {
    await window.api.saveSession(snapshot(includeUnsaved))
  } catch {
    // Falha de gravação da sessão não deve interromper a edição; o Main registra no log.
  }
}

function schedule(): void {
  if (!ready) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void write(true)
  }, AUTOSAVE_DELAY_MS)
}

/** Grava a sessão imediatamente (usado ao fechar a janela). */
export async function flushSession(includeUnsaved: boolean): Promise<void> {
  if (timer) clearTimeout(timer)
  timer = null
  ready = false // nada mais é gravado depois da sessão final
  await write(includeUnsaved)
}

/** Reconstrói um documento da sessão; devolve null se não houver como recuperá-lo. */
async function restoreDocument(s: SessionDocument): Promise<Omit<EditorDocument, 'id'> | null> {
  const base = { name: s.name, mode: s.mode, encoding: s.encoding, eol: s.eol, language: s.language ?? languageFromName(s.name), ...(s.cloud ? { cloud: s.cloud } : {}) }
  if (s.path === null) {
    return s.unsavedContent === undefined ? null : { ...base, path: null, content: s.unsavedContent, savedContent: '' }
  }
  try {
    const file = await window.api.readFile(s.path)
    return {
      ...base,
      path: file.path,
      name: file.name,
      // Conversões de codificação/quebra de linha ainda não salvas voltam como estavam.
      encoding: s.unsavedContent === undefined ? file.encoding : s.encoding,
      savedEncoding: file.encoding,
      eol: s.unsavedContent === undefined ? file.eol : s.eol,
      content: s.unsavedContent ?? file.content,
      savedContent: file.content
    }
  } catch {
    // O arquivo sumiu do disco: só vale reabrir se havia texto não salvo para recuperar.
    if (s.unsavedContent === undefined) return null
    return { ...base, path: s.path, content: s.unsavedContent, savedContent: '', missingOnDisk: true }
  }
}

/** Restaura a sessão anterior. Devolve quantos documentos tinham texto recuperado. */
export async function restoreSession(): Promise<{ restored: boolean; recovered: number }> {
  let data: SessionData | null = null
  try {
    data = await window.api.loadSession()
  } catch {
    data = null
  }

  let recovered = 0
  if (data) {
    useView.getState().setAll(data.view)

    if (data.folder) {
      try {
        await window.api.listFolder(data.folder) // confirma que a pasta ainda existe
        useWorkspace.getState().setFolder({ path: data.folder, name: baseName(data.folder) })
      } catch {
        /* pasta removida: não restaura */
      }
    }

    const restored: Omit<EditorDocument, 'id'>[] = []
    let activeIndex = -1
    for (const [i, s] of data.documents.entries()) {
      const doc = await restoreDocument(s)
      if (!doc) continue
      if (i === data.activeIndex) activeIndex = restored.length
      if (s.unsavedContent !== undefined && doc.content !== doc.savedContent) recovered++
      restored.push(doc)
    }
    if (restored.length > 0) useDocuments.getState().restore(restored, activeIndex)
  }

  ready = true
  const restored = useDocuments.getState().documents.length > 0
  return { restored, recovered }
}

/** Liga a gravação automática; devolve a função que a desliga. */
export function startSessionAutosave(): () => void {
  const unsubscribers = [useDocuments.subscribe(schedule), useWorkspace.subscribe(schedule), useView.subscribe(schedule)]
  return () => unsubscribers.forEach((u) => u())
}
