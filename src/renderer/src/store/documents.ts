import { create } from 'zustand'
import type { CloudFileContent, Encoding, Eol, OpenedFile, SavedFile } from '@shared/ipc'
import { languageFromName } from '@/editor/languages'

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
  eol: Eol
  /** Markdown abre formatado ('preview'); o usuário alterna para 'edit' para editar o texto. */
  mode: DocumentMode
  /** O arquivo foi excluído ou movido por outro programa. */
  missingOnDisk?: boolean
  /** Vínculo com o arquivo na nuvem (id, caminho lógico e a versão sincronizada). */
  cloud?: CloudRef
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

  newDocument(): void
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
  setEncoding(id: string, encoding: Encoding): void
  /** Converte as quebras de linha do texto (e do documento) para o formato escolhido. */
  setEol(id: string, eol: Eol): void
  /** Substitui todos os documentos pelos da sessão restaurada. */
  restore(documents: Omit<EditorDocument, 'id'>[], activeIndex: number): void
}

const defaultEol: Eol = navigator.userAgent.includes('Windows') ? 'CRLF' : 'LF'
const LF = String.fromCharCode(10)
const CRLF = String.fromCharCode(13, 10)
const EOL_PATTERN = new RegExp(`${CRLF}|${String.fromCharCode(13)}|${LF}`, 'g')
let seq = 0
const nextId = (): string => `doc-${++seq}`

export const isDirty = (d: EditorDocument): boolean =>
  d.content !== d.savedContent || d.encoding !== (d.savedEncoding ?? d.encoding)

/** Identificador estável do modelo no Monaco (um modelo por documento). */
export const modelPath = (d: EditorDocument): string => `inmemory://doc/${d.id}/${d.name}`

export const useDocuments = create<DocumentsState>((set) => ({
  documents: [],
  activeId: null,
  cursor: { line: 1, column: 1, selectedChars: 0 },
  untitledCounter: 0,

  newDocument: () =>
    set((s) => {
      const n = s.untitledCounter + 1
      const doc: EditorDocument = {
        id: nextId(),
        path: null,
        name: `Sem título ${n}.md`,
        content: '',
        savedContent: '',
        language: 'markdown',
        encoding: 'UTF-8',
        eol: defaultEol,
        mode: 'edit'
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
          ? { ...d, path: saved.path, name: saved.name, savedContent: content, savedEncoding: d.encoding, language: languageFromName(saved.name), missingOnDisk: false }
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
          ? { ...d, content: file.content, savedContent: file.content, encoding: file.encoding, savedEncoding: file.encoding, eol: file.eol, missingOnDisk: false }
          : d
      )
    })),

  restore: (restored, activeIndex) => {
    const documents = restored.map((d) => ({ ...d, id: nextId() }))
    // Continua a numeração de "Sem título N" a partir do maior número restaurado.
    const untitledCounter = Math.max(
      0,
      ...documents.filter((d) => !d.path).map((d) => Number(/Sem título (\d+)/.exec(d.name)?.[1] ?? 0))
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
        cloud: { id: file.id, path: file.path, version: file.version }
      }
      return { documents: [...s.documents, doc], activeId: doc.id }
    }),

  markCloudSaved: (id, cloud, content) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, cloud, savedContent: content, savedEncoding: d.encoding } : d))
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
        d.id === id ? { ...d, eol, content: d.content.replace(EOL_PATTERN, eol === 'CRLF' ? CRLF : LF) } : d
      )
    }))
}))

/** Linguagens com visualização própria: Markdown formatado e JSON em árvore. */
export const canPreviewLanguage = (language: string): boolean => language === 'markdown' || language === 'json'
export const canPreview = (d: EditorDocument | undefined): boolean => !!d && canPreviewLanguage(d.language)

export const useActiveDocument = (): EditorDocument | undefined =>
  useDocuments((s) => s.documents.find((d) => d.id === s.activeId))
