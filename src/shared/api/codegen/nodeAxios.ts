// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { dq } from './escape'
import { prepareRequest } from './prepare'
import type { CodegenTarget } from './types'

export const nodeAxios: CodegenTarget = {
  id: 'nodeAxios',
  label: 'Node.js (axios)',
  monaco: 'javascript',
  generate(request) {
    const p = prepareRequest(request)
    const imports = ['import axios from "axios";']
    const pre: string[] = []
    const opts: string[] = [`  method: ${dq(p.method.toLowerCase())},`, `  url: ${dq(p.url)},`]
    if (p.headers.length > 0) opts.push(`  headers: {\n${p.headers.map((h) => `    ${dq(h.key)}: ${dq(h.value)},`).join('\n')}\n  },`)
    const b = p.body
    if (b.kind === 'text') opts.push(`  data: ${dq(b.text)},`)
    else if (b.kind === 'form') opts.push(`  data: new URLSearchParams({\n${b.fields.map((f) => `    ${dq(f.key)}: ${dq(f.value)},`).join('\n')}\n  }),`)
    else if (b.kind === 'multipart') {
      pre.push('const form = new FormData();')
      let fs = false
      for (const part of b.parts) {
        if (part.path !== undefined) {
          fs = true
          pre.push(`form.append(${dq(part.key)}, await openAsBlob(${dq(part.path)}));`)
        } else pre.push(`form.append(${dq(part.key)}, ${dq(part.value ?? '')});`)
      }
      if (fs) imports.push('import { openAsBlob } from "node:fs";')
      pre.push('')
      opts.push('  data: form,')
    } else if (b.kind === 'file') {
      imports.push('import { createReadStream } from "node:fs";')
      opts.push(`  data: createReadStream(${dq(b.path)}),`)
    }
    if (!p.followRedirects) opts.push('  maxRedirects: 0,')
    if (!p.verifyTls) {
      imports.push('import https from "node:https";')
      opts.push('  httpsAgent: new https.Agent({ rejectUnauthorized: false }),')
    }
    opts.push(`  timeout: ${p.timeoutMs},`, '  validateStatus: () => true,')
    return `${imports.join('\n')}\n\n${pre.join('\n')}${pre.length ? '\n' : ''}const response = await axios({\n${opts.join('\n')}\n});\n\nconsole.log(response.status);\nconsole.log(response.data);\n`
  }
}
