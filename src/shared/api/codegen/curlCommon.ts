// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { API_LIMITS } from '../limits'
import type { ApiRequest } from '../schema'
import { bashStr, psStr } from './escape'
import { prepareRequest } from './prepare'

export type CurlShell = 'bash' | 'powershell'

/** Monta o comando curl (bash, ou PowerShell com curl.exe); cada opção numa linha, com continuação. */
export function curlCommand(request: ApiRequest, shell: CurlShell): string {
  const p = prepareRequest(request, { basicAsHeader: false })
  const q = shell === 'bash' ? bashStr : psStr
  const cont = shell === 'bash' ? ' \\' : ' `'
  const args: string[] = []

  let methodArg = ''
  if (p.method === 'HEAD') methodArg = '-I '
  else if (p.method !== 'GET' && !(p.method === 'POST' && p.body.kind !== 'none')) methodArg = `-X ${p.method} `
  args.push(`${methodArg}${q(p.url)}`)
  for (const h of p.headers) {
    // O curl define o Content-Type do multipart (com o boundary) sozinho.
    args.push(`-H ${q(`${h.key}: ${h.value}`)}`)
  }
  if (p.basic) args.push(`-u ${q(`${p.basic.username}:${p.basic.password}`)}`)

  const b = p.body
  if (b.kind === 'text') args.push(`--data-raw ${q(b.text)}`)
  else if (b.kind === 'form') for (const f of b.fields) args.push(`--data-urlencode ${q(`${f.key}=${f.value}`)}`)
  else if (b.kind === 'multipart') for (const part of b.parts) args.push(`-F ${q(part.path !== undefined ? `${part.key}=@${part.path}` : `${part.key}=${part.value ?? ''}`)}`)
  else if (b.kind === 'file') args.push(`--data-binary ${q(`@${b.path}`)}`)

  if (!p.verifyTls) args.push('-k')
  if (p.followRedirects) args.push('-L')
  if (p.timeoutMs !== API_LIMITS.timeoutDefaultMs) args.push(`--max-time ${Math.ceil(p.timeoutMs / 1000)}`)

  const head = shell === 'bash' ? 'curl' : 'curl.exe'
  const [first, ...rest] = args
  return [`${head} ${first}`, ...rest.map((a) => `  ${a}`)].join(`${cont}\n`)
}
