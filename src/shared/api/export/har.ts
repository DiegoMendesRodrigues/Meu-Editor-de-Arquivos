// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Exportar como HAR 1.2 (as requisições, sem respostas: nada foi enviado). */
import { prepareRequest } from '../codegen/prepare'
import { splitUrl } from '../import/common'
import type { ExportInput } from './types'

export function exportHar(input: ExportInput): string {
  const started = new Date().toISOString()
  const entries = input.items.map(({ request }) => {
    const p = prepareRequest(request)
    const { params } = splitUrl(p.url)
    const b = p.body
    const contentType = p.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? ''
    let postData: Record<string, unknown> | undefined
    if (b.kind === 'text') postData = { mimeType: contentType || 'text/plain', text: b.text }
    else if (b.kind === 'form') postData = { mimeType: 'application/x-www-form-urlencoded', params: b.fields.map((f) => ({ name: f.key, value: f.value })) }
    else if (b.kind === 'multipart') postData = { mimeType: 'multipart/form-data', params: b.parts.map((x) => ({ name: x.key, ...(x.path !== undefined ? { fileName: x.path } : { value: x.value ?? '' }) })) }
    else if (b.kind === 'file') postData = { mimeType: contentType || 'application/octet-stream', text: '' }
    return {
      startedDateTime: started,
      time: 0,
      request: {
        method: p.method,
        url: p.url,
        httpVersion: 'HTTP/1.1',
        cookies: [],
        headers: p.headers.map((h) => ({ name: h.key, value: h.value })),
        queryString: params.map((q) => ({ name: q.key, value: q.value })),
        ...(postData ? { postData } : {}),
        headersSize: -1,
        bodySize: b.kind === 'text' ? new TextEncoder().encode(b.text).length : -1
      },
      response: { status: 0, statusText: '', httpVersion: 'HTTP/1.1', cookies: [], headers: [], content: { size: 0, mimeType: '' }, redirectURL: '', headersSize: -1, bodySize: -1 },
      cache: {},
      timings: { send: 0, wait: 0, receive: 0 }
    }
  })
  const har = { log: { version: '1.2', creator: { name: 'Meu Editor de Arquivos', version: '1.0' }, entries } }
  return `${JSON.stringify(har, null, 2)}\n`
}
