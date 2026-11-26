// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Ações das coleções na barra lateral: criar, documentar e abrir arquivos. Erros viram um aviso traduzido. */
import { newApiRequest, serializeApiRequest } from '@shared/api/schema'
import { documentCollectionWithAi as documentCollectionWithAiPrompt } from '@/ai/apiActions'
import { DEFAULT_DOC_LABELS, generateCollectionMarkdown, type DocLabels } from '@shared/api/docs'
import type { MessageKey } from '@shared/i18n'
import { openPath } from '@/commands'
import { openFromCloud, createCloudFolder } from '@/cloud'
import { t } from '@/i18n'
import { storageMode, useCloud, joinPath } from '@/store/cloud'
import { useDocuments } from '@/store/documents'
import { useApiStore } from '@/store/api'
import { useWorkspace } from '@/store/workspace'
import { COLLECTION_FILE, FOLDER_FILE, isCloudDir, joinDisk, readCollection, writeCollectionFiles } from './collections'
import { newCollection, serializeCollection } from './environment'

const fail = (): void => window.alert(t('apiClient.col.error'))

/** Abre um arquivo da coleção (caminho do disco ou da nuvem) numa aba. */
export async function openCollectionFile(path: string): Promise<void> {
  if (!isCloudDir(path)) return openPath(path)
  const file = useCloud.getState().files.find((f) => f.path === path)
  if (file) await openFromCloud(file.id)
}

/** Cria uma requisição nova na pasta e abre no construtor. */
export async function createRequestIn(dir: string): Promise<void> {
  try {
    const name = t('apiClient.col.newRequestName')
    const [path] = await writeCollectionFiles(dir, [{ relativePath: `${name}.apireq`, content: serializeApiRequest(newApiRequest(name)) }])
    useApiStore.getState().bumpCollections()
    if (path) await openCollectionFile(path)
  } catch {
    fail()
  }
}

/** Cria uma subpasta (no disco, com um folder.apicol dentro, para ela existir e poder ter configurações). */
export async function createFolderIn(dir: string, name: string): Promise<boolean> {
  const folderName = name.trim()
  try {
    if (isCloudDir(dir)) {
      if (!(await createCloudFolder(joinPath(dir, folderName)))) return false
    } else {
      await writeCollectionFiles(dir, [{ relativePath: `${folderName}/${FOLDER_FILE}`, content: serializeCollection(newCollection(folderName, { type: 'inherit' })) }])
    }
    useApiStore.getState().bumpCollections()
    return true
  } catch {
    fail()
    return false
  }
}

/** Gera o Markdown da coleção e abre numa aba nova, na visualização formatada. */
export async function documentCollection(dir: string): Promise<void> {
  try {
    const { name, markdown } = await collectionMarkdown(dir)
    useDocuments.getState().newDocumentWithContent(`${name}.md`, markdown)
  } catch {
    fail()
  }
}

/** Menu da coleção → "Gerar documentação com IA": o assistente parte do Markdown que o app já gera. */
export async function documentCollectionWithAi(dir: string): Promise<void> {
  try {
    const { name, markdown } = await collectionMarkdown(dir)
    documentCollectionWithAiPrompt(name, markdown)
  } catch {
    fail()
  }
}

async function collectionMarkdown(dir: string): Promise<{ name: string; markdown: string }> {
  const tree = await readCollection(dir)
  // Rótulos da documentação no idioma do app.
  const labels = Object.fromEntries(Object.keys(DEFAULT_DOC_LABELS).map((k) => [k, t(`apiClient.docs.${k}` as MessageKey)])) as unknown as DocLabels
  return { name: tree.collection?.name || t('apiClient.col.newName'), markdown: generateCollectionMarkdown(tree, labels) }
}

/** Abre as configurações (collection.apicol) da coleção. */
export async function openCollectionSettings(dir: string): Promise<void> {
  await openCollectionFile(isCloudDir(dir) ? joinPath(dir, COLLECTION_FILE) : joinDisk(dir, COLLECTION_FILE))
}

/**
 * Nova coleção, no local de armazenamento do rodapé. No disco escolhe uma pasta (e a abre no explorador,
 * como "Abrir pasta"); na nuvem pede o nome numa janela (devolve true para o chamador abri-la).
 */
export async function createLocalCollection(): Promise<void> {
  try {
    const folder = await window.api.openFolder()
    if (!folder) return
    useWorkspace.getState().setFolder(folder)
    const exists = await window.api.readFile(joinDisk(folder.path, COLLECTION_FILE)).then(
      () => true,
      () => false
    )
    if (!exists) await writeCollectionFiles(folder.path, [{ relativePath: COLLECTION_FILE, content: serializeCollection(newCollection(folder.name)) }])
    useApiStore.getState().bumpCollections()
  } catch {
    fail()
  }
}

/** Nova coleção na nuvem: pasta com o nome dado, dentro da pasta selecionada, com collection.apicol. */
export async function createCloudCollection(name: string): Promise<boolean> {
  const collectionName = name.trim()
  const dir = joinPath(useCloud.getState().targetFolder, collectionName)
  try {
    if (!(await createCloudFolder(dir))) return false
    await writeCollectionFiles(dir, [{ relativePath: COLLECTION_FILE, content: serializeCollection(newCollection(collectionName)) }])
    useApiStore.getState().bumpCollections()
    return true
  } catch {
    fail()
    return false
  }
}

/** Nova coleção no local em uso: disco (diálogo de pasta) ou nuvem (janela de nome). */
export async function newCollectionFlow(): Promise<void> {
  if (storageMode() === 'cloud') useApiStore.getState().openDialog({ kind: 'newCollection' })
  else await createLocalCollection()
}
