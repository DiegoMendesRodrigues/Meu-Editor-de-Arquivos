// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Ações na nuvem (API intermediária): abrir, salvar, mover, excluir e pastas. */
import type { CloudFileMeta } from '@shared/ipc'
import { toStoredText } from '@shared/eol'
import type { MessageKey } from '@shared/i18n'
import { t } from '@/i18n'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { errorMessage, useAccount } from '@/store/account'
import { joinPath, baseName, useCloud } from '@/store/cloud'
import { useDialogs } from '@/store/dialogs'

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
    let res = await window.api.cloudSave({ path: cloudPath, content: toStoredText(content, doc.eol), encoding: doc.encoding, baseVersion, force: false })
    if (!res.ok) {
      const overwrite = window.confirm(t('cloud.confirmOverwrite', { path: cloudPath, version: res.current.version }))
      if (!overwrite) return false
      res = await window.api.cloudSave({ path: cloudPath, content: toStoredText(content, doc.eol), encoding: doc.encoding, baseVersion, force: true })
    }
    if (!res.ok) return false
    useDocuments.getState().markCloudSaved(doc.id, { id: res.file.id, path: res.file.path, version: res.file.version }, content)
    useCloud.getState().upsertFile(res.file)
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

// ---- "Salvar na nuvem" com escolha de pasta e nome ----

let pendingSave: { docId: string; resolve: (saved: boolean) => void } | null = null

/** Abre o diálogo de salvar na nuvem para o documento; resolve com true se ele foi salvo. */
export function requestCloudSave(doc: EditorDocument): Promise<boolean> {
  pendingSave?.resolve(false)
  return new Promise((resolve) => {
    pendingSave = { docId: doc.id, resolve }
    useDialogs.getState().show('cloudSave')
  })
}

/** Documento que o diálogo de salvar na nuvem está salvando (ou o ativo, se aberto pelo menu). */
export const pendingCloudSaveDoc = (): string | null => pendingSave?.docId ?? null

/** Chamado pelo diálogo ao terminar (salvo ou cancelado). */
export function finishCloudSave(saved: boolean): void {
  pendingSave?.resolve(saved)
  pendingSave = null
}

/**
 * Envia uma cópia de um documento do computador para a pasta da nuvem (arrastar para a barra lateral).
 * O documento continua ligado ao arquivo do disco; a cópia aparece na árvore da nuvem.
 */
export async function copyDocumentToCloud(doc: EditorDocument, folder: string): Promise<boolean> {
  const path = joinPath(folder, doc.name)
  const req = { path, content: toStoredText(doc.content, doc.eol), encoding: doc.encoding, baseVersion: null, force: false }
  try {
    let res = await window.api.cloudSave(req)
    if (!res.ok) {
      if (!window.confirm(t('cloud.confirmOverwrite', { path, version: res.current.version }))) return false
      res = await window.api.cloudSave({ ...req, force: true })
    }
    if (!res.ok) return false
    useCloud.getState().upsertFile(res.file)
    return true
  } catch (err) {
    report('err.saveCloud', err)
    return false
  }
}

// ---- Pastas e organização ----

/** Move o arquivo para outra pasta (mantendo o nome). Atualiza as abas abertas desse arquivo. */
export async function moveCloudFile(file: CloudFileMeta, folder: string): Promise<boolean> {
  const target = joinPath(folder, baseName(file.path))
  if (target === file.path) return true
  try {
    const moved = await window.api.cloudMove(file.id, target)
    useCloud.getState().upsertFile(moved)
    useDocuments.getState().updateCloudPath(moved.id, moved.path, moved.version)
    return true
  } catch (err) {
    report('cloud.moveError', err)
    return false
  }
}

export async function deleteCloudFile(file: CloudFileMeta): Promise<void> {
  if (!window.confirm(t('cloud.confirmDelete', { path: file.path }))) return
  try {
    await window.api.cloudDelete(file.id)
    await useCloud.getState().load()
  } catch (err) {
    report('cloud.deleteError', err)
  }
}

export async function createCloudFolder(path: string): Promise<boolean> {
  try {
    await window.api.cloudCreateFolder(path)
    await useCloud.getState().load()
    return true
  } catch (err) {
    report('cloud.folderError', err)
    return false
  }
}

export async function deleteCloudFolder(path: string): Promise<void> {
  if (!window.confirm(t('cloud.confirmDeleteFolder', { path }))) return
  try {
    await window.api.cloudDeleteFolder(path)
    await useCloud.getState().load()
  } catch (err) {
    report('cloud.deleteError', err)
  }
}
