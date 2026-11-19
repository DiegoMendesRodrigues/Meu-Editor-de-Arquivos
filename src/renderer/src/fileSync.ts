// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Reage a alterações feitas por outros programas nos arquivos abertos.
 * - Documento sem alterações: recarrega em silêncio.
 * - Documento com alterações: pergunta se deve recarregar e descartar as alterações.
 * - Arquivo excluído: marca a aba; salvar recria o arquivo.
 */
import type { FileChange } from '@shared/ipc'
import { monaco } from '@/editor/monacoSetup'
import { isDirty, modelPath, useDocuments, type EditorDocument } from '@/store/documents'

/** Atualiza o modelo do Monaco mantendo o histórico (Ctrl+Z volta ao conteúdo anterior). */
function replaceModelContent(doc: EditorDocument, text: string): void {
  const model = monaco.editor.getModel(monaco.Uri.parse(modelPath(doc)))
  if (!model || model.getValue() === text) return
  model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null)
}

const pending = new Set<string>()

async function handleChange(change: FileChange): Promise<void> {
  const store = useDocuments.getState()
  const doc = store.documents.find((d) => d.path === change.path)
  if (!doc) return void window.api.unwatchFile(change.path)

  if (change.kind === 'deleted') return store.setMissingOnDisk(doc.id, true)

  // Evita dois diálogos para o mesmo arquivo quando chegam eventos em sequência.
  if (pending.has(doc.id)) return
  pending.add(doc.id)
  try {
    if (isDirty(doc) && !(await window.api.confirmReload(doc.name))) return
    const file = await window.api.readFile(change.path)
    const current = useDocuments.getState().documents.find((d) => d.id === doc.id)
    if (!current) return
    replaceModelContent(current, file.content)
    useDocuments.getState().reloadFromDisk(doc.id, file)
  } catch {
    // Arquivo pode ter sido removido entre o aviso e a leitura.
    useDocuments.getState().setMissingOnDisk(doc.id, true)
  } finally {
    pending.delete(doc.id)
  }
}

export function startFileSync(): () => void {
  return window.api.onFileChanged((change) => void handleChange(change))
}
