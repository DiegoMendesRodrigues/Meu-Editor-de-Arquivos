// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { API_LIMITS } from '../limits'
import { dq } from './escape'
import { prepareRequest, type PreparedHeader } from './prepare'
import type { CodegenTarget } from './types'

const dict = (rows: PreparedHeader[]): string => `{\n${rows.map((r) => `        ${dq(r.key)}: ${dq(r.value)},`).join('\n')}\n    }`

export const pythonRequests: CodegenTarget = {
  id: 'pythonRequests',
  label: 'Python (requests)',
  monaco: 'python',
  generate(request) {
    const p = prepareRequest(request)
    const args: string[] = [`${dq(p.method)}`, dq(p.url)]
    if (p.headers.length > 0) args.push(`headers=${dict(p.headers)}`)
    const b = p.body
    if (b.kind === 'text') args.push(`data=${dq(b.text)}.encode("utf-8")`)
    else if (b.kind === 'form') args.push(`data=${dict(b.fields)}`)
    else if (b.kind === 'multipart') {
      const parts = b.parts.map((part) => `        ${dq(part.key)}: ${part.path !== undefined ? `open(${dq(part.path)}, "rb")` : `(None, ${dq(part.value ?? '')})`},`)
      args.push(`files={\n${parts.join('\n')}\n    }`)
    } else if (b.kind === 'file') args.push(`data=open(${dq(b.path)}, "rb")`)
    if (!p.verifyTls) args.push('verify=False')
    if (!p.followRedirects) args.push('allow_redirects=False')
    args.push(`timeout=${p.timeoutMs === API_LIMITS.timeoutDefaultMs ? 30 : p.timeoutMs / 1000}`)
    const call = `response = requests.request(\n${args.map((a) => `    ${a},`).join('\n')}\n)`
    return `import requests\n\n${call}\nprint(response.status_code)\nprint(response.text)\n`
  }
}
