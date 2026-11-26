// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { API_LIMITS } from '../limits'
import { rustStr } from './escape'
import { prepareRequest } from './prepare'
import type { CodegenTarget } from './types'

const KNOWN = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export const rustReqwest: CodegenTarget = {
  id: 'rustReqwest',
  label: 'Rust (reqwest)',
  monaco: 'rust',
  generate(request) {
    const p = prepareRequest(request)
    const b = p.body
    const builder: string[] = ['reqwest::Client::builder()']
    if (!p.verifyTls) builder.push('.danger_accept_invalid_certs(true)')
    if (!p.followRedirects) builder.push('.redirect(reqwest::redirect::Policy::none())')
    if (p.timeoutMs !== API_LIMITS.timeoutDefaultMs) builder.push(`.timeout(std::time::Duration::from_millis(${p.timeoutMs}))`)
    builder.push('.build()?')

    const method = KNOWN.has(p.method) ? `reqwest::Method::${p.method}` : `reqwest::Method::from_bytes(${rustStr(p.method)}.as_bytes())?`
    const pre: string[] = []
    const chain: string[] = [`.request(${method}, ${rustStr(p.url)})`]
    for (const h of p.headers.filter((x) => (b.kind !== 'multipart' && b.kind !== 'form') || x.key.toLowerCase() !== 'content-type')) chain.push(`.header(${rustStr(h.key)}, ${rustStr(h.value)})`)
    if (b.kind === 'text') chain.push(`.body(${rustStr(b.text)})`)
    else if (b.kind === 'form') {
      // O reqwest define o Content-Type do formulário sozinho.
      chain.push(`.form(&[${b.fields.map((f) => `(${rustStr(f.key)}, ${rustStr(f.value)})`).join(', ')}])`)
    } else if (b.kind === 'multipart') {
      let form = 'reqwest::multipart::Form::new()'
      for (const part of b.parts) form += part.path !== undefined ? `\n        .file(${rustStr(part.key)}, ${rustStr(part.path)}).await?` : `\n        .text(${rustStr(part.key)}, ${rustStr(part.value ?? '')})`
      pre.push(`let form = ${form};`)
      chain.push('.multipart(form)')
    } else if (b.kind === 'file') chain.push(`.body(tokio::fs::read(${rustStr(b.path)}).await?)`)
    chain.push('.send()', '.await?')

    const body = [
      `let client = ${builder.join('\n        ')};`,
      ...pre,
      `let response = client\n        ${chain.join('\n        ')};`,
      'println!("{}", response.status());',
      'println!("{}", response.text().await?);',
      'Ok(())'
    ]
    return `#[tokio::main]\nasync fn main() -> Result<(), Box<dyn std::error::Error>> {\n${body.map((l) => `    ${l}`).join('\n')}\n}\n`
  }
}
