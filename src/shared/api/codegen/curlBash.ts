// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { CodegenTarget } from './types'
import { curlCommand } from './curlCommon'

export const curlBash: CodegenTarget = {
  id: 'curlBash',
  label: 'curl (bash)',
  monaco: 'shell',
  generate: (request) => `${curlCommand(request, 'bash')}
`
}
