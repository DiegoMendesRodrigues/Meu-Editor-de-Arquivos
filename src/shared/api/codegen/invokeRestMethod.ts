// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { API_LIMITS } from '../limits'
import { psStr } from './escape'
import { headerValue, prepareRequest } from './prepare'
import type { CodegenTarget } from './types'

const PS_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export const invokeRestMethod: CodegenTarget = {
  id: 'invokeRestMethod',
  label: 'PowerShell (Invoke-RestMethod)',
  monaco: 'powershell',
  generate(request) {
    const p = prepareRequest(request)
    const lines: string[] = []
    const contentType = headerValue(p.headers, 'Content-Type')
    const headers = p.headers.filter((h) => h.key.toLowerCase() !== 'content-type' || p.body.kind === 'none')
    if (headers.length > 0) {
      lines.push('$headers = @{')
      for (const h of headers) lines.push(`    ${psStr(h.key)} = ${psStr(h.value)}`)
      lines.push('}', '')
    }
    const b = p.body
    if (b.kind === 'text') lines.push(`$body = ${psStr(b.text)}`, '')
    else if (b.kind === 'form') {
      lines.push('$body = @{')
      for (const f of b.fields) lines.push(`    ${psStr(f.key)} = ${psStr(f.value)}`)
      lines.push('}', '')
    } else if (b.kind === 'multipart') {
      lines.push('$form = @{')
      for (const part of b.parts) lines.push(`    ${psStr(part.key)} = ${part.path !== undefined ? `Get-Item ${psStr(part.path)}` : psStr(part.value ?? '')}`)
      lines.push('}', '')
    }

    const args = [`-Method ${PS_METHODS.has(p.method) ? p.method[0] + p.method.slice(1).toLowerCase() : psStr(p.method)}`, `-Uri ${psStr(p.url)}`]
    if (headers.length > 0) args.push('-Headers $headers')
    if (b.kind === 'text' || b.kind === 'form') {
      if (contentType) args.push(`-ContentType ${psStr(contentType)}`)
      args.push('-Body $body')
    } else if (b.kind === 'multipart') args.push('-Form $form')
    else if (b.kind === 'file') {
      if (contentType) args.push(`-ContentType ${psStr(contentType)}`)
      args.push(`-InFile ${psStr(b.path)}`)
    }
    if (!p.verifyTls) args.push('-SkipCertificateCheck')
    if (!p.followRedirects) args.push('-MaximumRedirection 0')
    if (p.timeoutMs !== API_LIMITS.timeoutDefaultMs) args.push(`-TimeoutSec ${Math.ceil(p.timeoutMs / 1000)}`)
    lines.push(`$response = Invoke-RestMethod ${args.join(' `\n    ')}`, '$response')
    return `${lines.join('\n')}\n`
  }
}
