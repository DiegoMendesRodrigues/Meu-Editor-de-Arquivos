// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Exportadores do Cliente de API: texto a partir da coleção lida. Valores de segredos nunca entram. */
import { exportCurl } from './curl'
import { exportHar } from './har'
import { exportHttp } from './http'
import { exportOpenApi } from './openapi'
import { exportPostman } from './postman'
import type { ExportInput } from './types'

export type { ExportInput } from './types'

export interface ExportFormat {
  id: 'postman' | 'openapi' | 'har' | 'http' | 'curlBash' | 'curlPowershell'
  /** Chave i18n do nome. */
  labelKey:
    | 'apiClient.export.fmt.postman'
    | 'apiClient.export.fmt.openapi'
    | 'apiClient.export.fmt.har'
    | 'apiClient.export.fmt.http'
    | 'apiClient.export.fmt.curlBash'
    | 'apiClient.export.fmt.curlPowershell'
  extension: string
  run(input: ExportInput): string
}

export const EXPORT_FORMATS: readonly ExportFormat[] = [
  { id: 'postman', labelKey: 'apiClient.export.fmt.postman', extension: 'postman_collection.json', run: exportPostman },
  { id: 'openapi', labelKey: 'apiClient.export.fmt.openapi', extension: 'openapi.yaml', run: exportOpenApi },
  { id: 'har', labelKey: 'apiClient.export.fmt.har', extension: 'har', run: exportHar },
  { id: 'http', labelKey: 'apiClient.export.fmt.http', extension: 'http', run: exportHttp },
  { id: 'curlBash', labelKey: 'apiClient.export.fmt.curlBash', extension: 'sh', run: (i) => exportCurl(i, 'bash') },
  { id: 'curlPowershell', labelKey: 'apiClient.export.fmt.curlPowershell', extension: 'ps1', run: (i) => exportCurl(i, 'powershell') }
]

export { exportPostman, exportOpenApi, exportHar, exportHttp, exportCurl }
