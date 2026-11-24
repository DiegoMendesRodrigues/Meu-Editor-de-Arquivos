// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Exportar como comandos curl (bash ou PowerShell), um por requisição, com o nome em comentário. */
import { curlCommand, type CurlShell } from '../codegen/curlCommon'
import type { ExportInput } from './types'

export { curlCommand }

export function exportCurl(input: ExportInput, shell: CurlShell): string {
  return `${input.items.map(({ request }) => `# ${request.name || request.url}\n${curlCommand(request, shell)}`).join('\n\n')}\n`
}
