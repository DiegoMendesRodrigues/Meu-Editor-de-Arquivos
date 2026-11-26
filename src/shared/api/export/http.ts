// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Exportar como arquivo .http (REST Client / JetBrains): variáveis no topo e um bloco por requisição. */
import { encodeKeepingVariables, prepareRequest } from '../codegen/prepare'
import type { ExportInput } from './types'

export function exportHttp(input: ExportInput): string {
  const out: string[] = []
  for (const v of input.variables) out.push(`@${v.key} = ${v.value}`)
  if (input.variables.length > 0) out.push('')
  input.items.forEach(({ folder, request }, index) => {
    const p = prepareRequest(request)
    if (index > 0 || input.variables.length > 0) out.push('')
    out.push(`### ${folder ? `${folder}/` : ''}${request.name || request.url}`)
    out.push(`${p.method} ${p.url}`)
    for (const h of p.headers) out.push(`${h.key}: ${h.value}`)
    const b = p.body
    if (b.kind === 'text') out.push('', b.text)
    else if (b.kind === 'form') out.push('', b.fields.map((f) => `${encodeKeepingVariables(f.key)}=${encodeKeepingVariables(f.value)}`).join('&'))
    else if (b.kind === 'file') out.push('', `< ${b.path}`)
    else if (b.kind === 'multipart') {
      const boundary = 'WebAppBoundary'
      out.push(`Content-Type: multipart/form-data; boundary=${boundary}`, '')
      for (const part of b.parts) {
        out.push(`--${boundary}`)
        out.push(part.path !== undefined ? `Content-Disposition: form-data; name="${part.key}"; filename="${part.path.split(/[\\/]/).pop() ?? ''}"` : `Content-Disposition: form-data; name="${part.key}"`, '')
        out.push(part.path !== undefined ? `< ${part.path}` : (part.value ?? ''))
      }
      out.push(`--${boundary}--`)
    }
  })
  return `${out.join('\n')}\n`
}
