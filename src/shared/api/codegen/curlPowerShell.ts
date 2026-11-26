// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { CodegenTarget } from './types'
import { curlCommand } from './curlCommon'

export const curlPowerShell: CodegenTarget = {
  id: 'curlPowerShell',
  label: 'curl (PowerShell)',
  monaco: 'powershell',
  generate: (request) => `${curlCommand(request, 'powershell')}
`
}
