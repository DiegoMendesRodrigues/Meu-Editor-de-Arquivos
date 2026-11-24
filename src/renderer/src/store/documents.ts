// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'
import type { CloudFileContent, Encoding, Eol, OpenedFile, SavedFile } from '@shared/ipc'
import { untitledNumber } from '@shared/i18n'
import { languageFromName } from '@/editor/languages'
import { t } from '@/i18n'
import { applyEol } from '@shared/eol'
import { newApiRequest, serializeApiRequest } from '@shared/api/schema'

export interface EditorDocument {
  id: string
  /** Caminho no disco; null para documentos ainda não salvos. */
  path: string | null
  name: string
  content: string
  /** Conteúdo da última gravação, para saber se há alterações pendentes. */
  savedContent: string
  language: string
  encoding: Encoding
  /** Codificação da última gravação/leitura; se diferir de `encoding`, há conversão pendente. Ausente = igual. */
  savedEncoding?: Encoding
  /** Quebra de linha guardada no disco (LF e CR têm o mesmo texto dentro do app). Ausente = igual a `eol`. */
  savedEol?: Eol
  /** Quebra de linha do arquivo. Documentos CR ficam com LF no app e são convertidos ao gravar. */
  eol: Eol
  /** Markdown abre formatado ('preview'); o usuário alterna para 'edit' para editar o texto. */
  mode: DocumentMode
  /** O arquivo foi excluído ou movido por outro programa. */
  missingOnDisk?: boolean
  /** Vínculo com o arquivo na nuvem (id, caminho lógico e a versão sincronizada). */
  cloud?: CloudRef
  /** Identificador entre computadores, para a área de trabalho sincronizada pela nuvem. */
  syncId?: string
}

export interface CloudRef {
  id: string
  path: string
  version: number
}

export type DocumentMode = 'preview' | 'edit'

interface CursorInfo {
  line: number
  column: number
  selectedChars: number
}

interface DocumentsState {
  documents: EditorDocument[]
  activeId: string | null
  cursor: CursorInfo
  untitledCounter: number

  /** Cria um documento sem título; a extensão define a linguagem (padrão: Markdown). */
  newDocument(extension?: string): void
  addOpenedFiles(files: OpenedFile[]): void
  setActive(id: string): void
  updateContent(id: string, content: string): void
  markSaved(id: string, saved: SavedFile, content: string): void
  closeDocument(id: string): void
  setCursor(cursor: CursorInfo): void
  setMode(id: string, mode: DocumentMode): void
  /** Substitui o conteúdo pelo que está no disco (recarregamento). */
  reloadFromDisk(id: string, file: OpenedFile): void
  setMissingOnDisk(id: string, missing: boolean): void
  setLanguage(id: string, language: string): void
  /** Abre um arquivo da nuvem como documento (sem caminho no disco). */
  addCloudFile(file: CloudFileContent): void
  /** Registra a gravação na nuvem: o texto atual passa a ser o sincronizado. */
  markCloudSaved(id: string, cloud: CloudRef, content: string): void
  /** Atualiza as abas de um arquivo da nuvem que foi movido (novo caminho e versão). */
  updateCloudPath(cloudId: string, path: string, version: number): void
  /** Arquivo ou pasta do disco renomeado: as abas desse arquivo (ou de dentro da pasta) seguem o novo caminho. */
  renameLocalPath(oldPath: string, newPath: string): void
  setEncoding(id: string, encoding: Encoding): void
  /** Converte as quebras de linha do texto (e do documento) para o formato escolhido. */
  setEol(id: string, eol: Eol): void
  /**
   * Aplica a área de trabalho sincronizada: documentos sem id são novos. A aba ativa continua a mesma,
   * se ainda existir; senão vai para a indicada por activeSyncId ou para a última.
   */
  replaceDocuments(documents: (EditorDocument | Omit<EditorDocument, 'id'>)[], activeSyncId: string | null): void
  /** Substitui todos os documentos pelos da sessão restaurada. */
  restore(documents: Omit<EditorDocument, 'id'>[], activeIndex: number): void
}

const defaultEol: Eol = navigator.userAgent.includes('Windows') ? 'CRLF' : 'LF'
let seq = 0
const nextId = (): string => `doc-${++seq}`
/** Identificador do documento entre computadores (área de trabalho sincronizada). */
export const newSyncId = (): string => crypto.randomUUID()

export const isDirty = (d: EditorDocument): boolean =>
  d.content !== d.savedContent || d.encoding !== (d.savedEncoding ?? d.encoding) || d.eol !== (d.savedEol ?? d.eol)

/** Identificador estável do modelo no Monaco (um modelo por documento). */
export const modelPath = (d: EditorDocument): string => `inmemory://doc/${d.id}/${d.name}`

/** O caminho é o próprio `root` ou fica dentro dele (separador "\" ou "/"). */
export const isInsidePath = (root: string, path: string): boolean =>
  path === root || path.startsWith(`${root}\\`) || path.startsWith(`${root}/`)

export const useDocuments = create<DocumentsState>((set) => ({
  documents: [],
  activeId: null,
  cursor: { line: 1, column: 1, selectedChars: 0 },
  untitledCounter: 0,

  newDocument: (extension = 'md') =>
    set((s) => {
      const n = s.untitledCounter + 1
      const name = `${t('doc.untitled', { n })}.${extension}`
      const language = languageFromName(name)
      // A requisição de API nasce pronta (GET sem URL) e abre no construtor; os demais tipos, vazios e em texto.
      const isApi = language === 'apireq'
      const content = isApi ? applyEol(serializeApiRequest(newApiRequest()), defaultEol) : ''
      const doc: EditorDocument = {
        id: nextId(),
        path: null,
        name,
        content,
        savedContent: content,
        language,
        encoding: 'UTF-8',
        eol: defaultEol,
        mode: isApi ? 'preview' : 'edit',
        syncId: newSyncId()
      }
      return { documents: [...s.documents, doc], activeId: doc.id, untitledCounter: n }
    }),

  addOpenedFiles: (files) =>
    set((s) => {
      if (files.length === 0) return s
      const documents = [...s.documents]
      let activeId = s.activeId
      for (const f of files) {
        // Se o arquivo já está aberto, apenas ativa a aba existente.
        const existing = documents.find((d) => d.path === f.path)
        if (existing) {
          activeId = existing.id
          continue
        }
        const language = languageFromName(f.name)
        const doc: EditorDocument = {
          id: nextId(),
          path: f.path,
          name: f.name,
          content: f.content,
          savedContent: f.content,
          language,
          encoding: f.encoding,
          savedEncoding: f.encoding,
          eol: f.eol,
          mode: canPreviewLanguage(language) ? 'preview' : 'edit'
        }
        documents.push(doc)
        activeId = doc.id
      }
      return { documents, activeId }
    }),

  setActive: (id) => set({ activeId: id }),

  updateContent: (id, content) =>
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, content } : d)) })),

  markSaved: (id, saved, content) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id
          ? { ...d, path: saved.path, name: saved.name, savedContent: content, savedEncoding: d.encoding, savedEol: undefined, language: languageFromName(saved.name), missingOnDisk: false }
          : d
      )
    })),

  closeDocument: (id) =>
    set((s) => {
      const index = s.documents.findIndex((d) => d.id === id)
      const documents = s.documents.filter((d) => d.id !== id)
      let activeId = s.activeId
      if (activeId === id) activeId = documents[Math.min(index, documents.length - 1)]?.id ?? null
      return { documents, activeId }
    }),

  setCursor: (cursor) => set({ cursor }),

  setMode: (id, mode) =>
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, mode } : d)) })),

  reloadFromDisk: (id, file) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id
          ? { ...d, content: file.content, savedContent: file.content, encoding: file.encoding, savedEncoding: file.encoding, eol: file.eol, savedEol: undefined, missingOnDisk: false }
          : d
      )
    })),

  replaceDocuments: (incoming, activeSyncId) =>
    set((s) => {
      const documents = incoming.map((d) => ('id' in d ? d : { ...d, id: nextId() }))
      const wanted = activeSyncId ? documents.find((d) => d.syncId === activeSyncId) : undefined
      const kept = documents.find((d) => d.id === s.activeId)
      const activeId = wanted?.id ?? kept?.id ?? documents[documents.length - 1]?.id ?? null
      const untitledCounter = Math.max(s.untitledCounter, ...documents.filter((d) => !d.path).map((d) => untitledNumber(d.name)))
      return { documents, activeId, untitledCounter }
    }),

  restore: (restored, activeIndex) => {
    const documents = restored.map((d) => ({ ...d, id: nextId() }))
    // Continua a numeração dos documentos sem título (em qualquer idioma) a partir do maior número restaurado.
    const untitledCounter = Math.max(
      0,
      ...documents.filter((d) => !d.path).map((d) => untitledNumber(d.name))
    )
    const active = documents[Math.min(Math.max(activeIndex, 0), documents.length - 1)]
    set({ documents, activeId: active?.id ?? null, untitledCounter })
  },

  setMissingOnDisk: (id, missing) =>
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, missingOnDisk: missing } : d)) })),

  addCloudFile: (file) =>
    set((s) => {
      const existing = s.documents.find((d) => d.cloud?.id === file.id)
      if (existing) return { activeId: existing.id }
      const name = file.path.split('/').pop() ?? file.path
      const language = languageFromName(name)
      const doc: EditorDocument = {
        id: nextId(),
        path: null,
        name,
        content: file.content,
        savedContent: file.content,
        language,
        encoding: file.encoding,
        savedEncoding: file.encoding,
        eol: file.eol,
        mode: canPreviewLanguage(language) ? 'preview' : 'edit',
        cloud: { id: file.id, path: file.path, version: file.version },
        syncId: newSyncId()
      }
      return { documents: [...s.documents, doc], activeId: doc.id }
    }),

  markCloudSaved: (id, cloud, content) =>
    set((s) => ({
      documents: s.documents.map((d) => {
        if (d.id !== id) return d
        // O nome da aba passa a ser o do arquivo na nuvem (e a linguagem segue a extensão).
        const name = cloud.path.split('/').pop() ?? cloud.path
        return { ...d, cloud, name, language: languageFromName(name), savedContent: content, savedEncoding: d.encoding, savedEol: undefined }
      })
    })),

  updateCloudPath: (cloudId, path, version) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.cloud?.id === cloudId ? { ...d, name: path.split('/').pop() ?? path, cloud: { ...d.cloud, path, version } } : d
      )
    })),

  renameLocalPath: (oldPath, newPath) =>
    set((s) => ({
      documents: s.documents.map((d) => {
        if (!d.path || !isInsidePath(oldPath, d.path)) return d
        const path = newPath + d.path.slice(oldPath.length)
        if (d.path !== oldPath) return { ...d, path } // dentro da pasta renomeada: o nome não muda
        const name = path.split(/[\\/]/).pop() ?? path
        // A linguagem segue a nova extensão, a menos que tenha sido escolhida manualmente.
        const language = d.language === languageFromName(d.name) ? languageFromName(name) : d.language
        return { ...d, path, name, language, mode: canPreviewLanguage(language) ? d.mode : 'edit' }
      })
    })),

  setLanguage: (id, language) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id !== id ? d : { ...d, language, mode: canPreviewLanguage(language) ? d.mode : 'edit' }
      )
    })),

  setEncoding: (id, encoding) =>
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, encoding } : d)) })),

  setEol: (id, eol) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === id ? { ...d, eol, savedEol: d.savedEol ?? d.eol, content: applyEol(d.content, eol) } : d
      )
    }))
}))

/** Linguagens com visualização própria: Markdown formatado, JSON em árvore e o construtor de requisições de API. */
export const canPreviewLanguage = (language: string): boolean => language === 'markdown' || language === 'json' || language === 'apireq'
export const canPreview = (d: EditorDocument | undefined): boolean => !!d && canPreviewLanguage(d.language)

export const useActiveDocument = (): EditorDocument | undefined =>
  useDocuments((s) => s.documents.find((d) => d.id === s.activeId))
