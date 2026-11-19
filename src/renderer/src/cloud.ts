// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Sincronização de documentos com a nuvem (API intermediária). */
import type { MessageKey } from '@shared/i18n'
import { t } from '@/i18n'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { errorMessage, useAccount } from '@/store/account'

function report(titleKey: MessageKey, err: unknown): void {
  window.alert(t(titleKey) + '\n\n' + errorMessage(err))
  void useAccount.getState().load() // a sessão pode ter expirado
}

/**
 * Envia o documento para a nuvem no caminho indicado.
 * Se a versão na nuvem mudou desde a última sincronização, pergunta antes de sobrescrever.
 */
export async function pushToCloud(doc: EditorDocument, cloudPath: string): Promise<boolean> {
  const content = doc.content
  const baseVersion = doc.cloud && doc.cloud.path === cloudPath ? doc.cloud.version : null
  try {
    let res = await window.api.cloudSave({ path: cloudPath, content, encoding: doc.encoding, baseVersion, force: false })
    if (!res.ok) {
      const overwrite = window.confirm(t('cloud.confirmOverwrite', { path: cloudPath, version: res.current.version }))
      if (!overwrite) return false
      res = await window.api.cloudSave({ path: cloudPath, content, encoding: doc.encoding, baseVersion, force: true })
    }
    if (!res.ok) return false
    useDocuments.getState().markCloudSaved(doc.id, { id: res.file.id, path: res.file.path, version: res.file.version }, content)
    return true
  } catch (err) {
    report('err.saveCloud', err)
    return false
  }
}

export async function openFromCloud(id: string): Promise<boolean> {
  try {
    useDocuments.getState().addCloudFile(await window.api.cloudRead(id))
    return true
  } catch (err) {
    report('err.openCloud', err)
    return false
  }
}
