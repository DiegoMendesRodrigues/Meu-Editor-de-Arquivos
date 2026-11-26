// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { ApiRequest } from '@shared/api/schema'
import { examplePath } from '@shared/api/mockRoutes'
import type { MessageKey } from '@shared/i18n'
import { useDocuments, type EditorDocument } from '@/store/documents'
import { useNotice } from '@/store/notice'
import { dirOf } from './collections'
import { toSavedResponse, type ViewResponse } from './response/model'

type T = (key: MessageKey, params?: Record<string, string | number>) => string

/** Nome seguro para uma pasta: sem separadores nem caracteres que o Windows recusa, sem ponto ou espaço no fim. */
const safeSegment = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').trim().slice(0, 80) || 'requisicao'

const pad = (n: number): string => String(n).padStart(2, '0')

/** AAAA-MM-DD_HHMMSS na hora local. */
export function exampleStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/**
 * Salva a resposta como exemplo: grava <pasta do .apireq>/.respostas/<requisição>/AAAA-MM-DD_HHMMSS_<status>.apiresp
 * e acrescenta o caminho relativo em request.examples. Se a pasta não estiver autorizada, pede a pasta por diálogo.
 */
export async function saveResponseExample(doc: EditorDocument, request: ApiRequest, res: ViewResponse, t: T, update: (next: ApiRequest) => void): Promise<void> {
  const notice = useNotice.getState()
  if (!doc.path) return notice.show(t('apiClient.response.exampleNeedsSave'))
  const saved = toSavedResponse(res, request.id)
  if (!saved) return notice.show(t('apiClient.response.exampleFailed'))
  const name = safeSegment((doc.path.split(/[\\/]/).pop() ?? '').replace(/\.apireq$/i, ''))
  const relativePath = `.respostas/${name}/${exampleStamp(new Date())}_${res.status}.apiresp`
  const files = [{ relativePath, content: `${JSON.stringify(saved, null, 2)}\n` }]
  let dir = dirOf(doc.path)
  let created: string[]
  try {
    created = await window.api.apiWriteFiles({ dir, files })
  } catch {
    // Pasta fora das autorizadas: pede a pasta por diálogo (a escolhida passa a valer).
    try {
      const folder = await window.api.openFolder()
      if (!folder) return
      dir = folder.path
      created = await window.api.apiWriteFiles({ dir, files })
    } catch {
      return notice.show(t('apiClient.response.exampleFailed'))
    }
  }
  const file = created[0]
  if (!file) return notice.show(t('apiClient.response.exampleFailed'))
  const rel = `.respostas/${name}/${file.replace(/\\/g, '/').split('/').pop()}`
  if (!request.examples.includes(rel)) update({ ...request, examples: [...request.examples, rel] })
  notice.show(t('apiClient.response.exampleSaved', { path: rel }))
}

/** Abre um .apiresp listado em request.examples. */
export async function openExample(doc: EditorDocument, rel: string, t: T): Promise<void> {
  if (!doc.path) return
  try {
    useDocuments.getState().addOpenedFiles([await window.api.readFile(examplePath(doc.path, rel))])
  } catch {
    useNotice.getState().show(t('apiClient.response.exampleFailed'))
  }
}
