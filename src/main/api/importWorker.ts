// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Análise de arquivos importados (Postman, OpenAPI, HAR...) numa thread separada: um arquivo enorme
 * ou malicioso não trava o processo principal, que encerra a thread se passar do tempo limite.
 */
import { parentPort } from 'node:worker_threads'
import type { ApiImportFormat } from '@shared/api/protocol'
import { parseImport } from '@shared/api/import'
import type { WsdlFilesOption } from '@shared/api/import/wsdlFiles'

parentPort?.on('message', (req: { text: string; format: ApiImportFormat; wsdl?: WsdlFilesOption }) => {
  parentPort!.postMessage(parseImport(req.text, req.format, req.wsdl))
})
