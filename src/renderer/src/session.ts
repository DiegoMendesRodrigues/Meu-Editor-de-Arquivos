// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Sessão e recuperação.
 * - Gravação automática (com atraso curto) sempre que abas, pasta ou preferências mudam,
 *   incluindo o texto não salvo: se o app travar, nada se perde.
 * - Fechar o app não pergunta nem descarta nada: a sessão final também guarda o texto
 *   não salvo (inclusive de documentos que nunca foram salvos), independente de o usuário salvar.
 * - Ao iniciar, restaura tudo; textos recuperados voltam marcados como não salvos.
 */
import { SESSION_MAX_UNSAVED_CHARS, type SessionData, type SessionDocument } from '@shared/ipc'
import { languageFromName } from '@/editor/languages'
import { isDirty, useDocuments, type EditorDocument } from '@/store/documents'
import { applyLocale, useLocale } from '@/i18n'
import { useView } from '@/store/view'
import { useSpelling } from '@/store/spelling'
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
    ...(d.syncId ? { syncId: d.syncId } : {}),
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
      tabSize: view.tabSize,
      locale: useLocale.getState().locale
    },
    spelling: (() => {
      const s = useSpelling.getState()
      return { enabled: s.enabled, ...(s.locale ? { locale: s.locale } : {}), words: s.words }
    })()
  }
}

async function write(includeUnsaved: boolean): Promise<boolean> {
  try {
    await window.api.saveSession(snapshot(includeUnsaved))
    return true
  } catch {
    // Falha de gravação da sessão não deve interromper a edição; o Main registra no log.
    return false
  }
}

/** Há texto não salvo (alterações ou documentos sem arquivo) que a sessão precisa guardar? */
export function hasUnsavedText(): boolean {
  return useDocuments.getState().documents.some((d) => isDirty(d) || (d.path === null && d.content !== ''))
}

/** O texto não salvo cabe no limite da sessão? */
export function unsavedFitsInSession(): boolean {
  const total = useDocuments
    .getState()
    .documents.reduce((n, d) => n + (isDirty(d) || (d.path === null && d.content !== '') ? d.content.length : 0), 0)
  return total <= SESSION_MAX_UNSAVED_CHARS
}

function schedule(): void {
  if (!ready) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void write(true)
  }, AUTOSAVE_DELAY_MS)
}

/**
 * Grava a sessão imediatamente (usado ao fechar a janela). Devolve false se a gravação falhou;
 * nesse caso a gravação automática continua ligada.
 */
export async function flushSession(includeUnsaved: boolean): Promise<boolean> {
  if (timer) clearTimeout(timer)
  timer = null
  ready = false // nada mais é gravado depois da sessão final
  const ok = await write(includeUnsaved)
  if (!ok) ready = true
  return ok
}

/** Reconstrói um documento da sessão; devolve null se não houver como recuperá-lo. */
async function restoreDocument(s: SessionDocument): Promise<Omit<EditorDocument, 'id'> | null> {
  const base = { name: s.name, mode: s.mode, encoding: s.encoding, eol: s.eol, language: s.language ?? languageFromName(s.name), ...(s.cloud ? { cloud: s.cloud } : {}), ...(s.syncId ? { syncId: s.syncId } : {}) }
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
      savedEol: file.eol,
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
export async function restoreSession(): Promise<{ restored: boolean }> {
  let data: SessionData | null = null
  try {
    data = await window.api.loadSession()
  } catch {
    data = null
  }

  if (data) {
    // O idioma escolhido antes volta; sem escolha salva, vale o do sistema (já aplicado ao iniciar).
    const { locale, ...viewValues } = data.view
    useView.getState().setAll(viewValues)
    if (locale) applyLocale(locale)
    if (data.spelling) {
      const { enabled, locale: spellLocale, words } = data.spelling
      useSpelling.getState().setAll({ enabled, locale: spellLocale ?? null, words })
    }

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
      restored.push(doc)
    }
    if (restored.length > 0) useDocuments.getState().restore(restored, activeIndex)
  }

  ready = true
  const restored = useDocuments.getState().documents.length > 0
  return { restored }
}

/** Liga a gravação automática; devolve a função que a desliga. */
export function startSessionAutosave(): () => void {
  const unsubscribers = [useDocuments.subscribe(schedule), useWorkspace.subscribe(schedule), useView.subscribe(schedule), useLocale.subscribe(schedule), useSpelling.subscribe(schedule)]
  return () => unsubscribers.forEach((u) => u())
}
