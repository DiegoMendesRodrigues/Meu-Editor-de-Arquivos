// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { dq } from './escape'
import { prepareRequest } from './prepare'
import type { CodegenTarget } from './types'

export const jsFetch: CodegenTarget = {
  id: 'jsFetch',
  label: 'JavaScript (fetch)',
  monaco: 'javascript',
  generate(request) {
    const p = prepareRequest(request)
    const pre: string[] = []
    const opts: string[] = [`  method: ${dq(p.method)},`]
    if (p.headers.length > 0) opts.push(`  headers: {\n${p.headers.map((h) => `    ${dq(h.key)}: ${dq(h.value)},`).join('\n')}\n  },`)
    const b = p.body
    const bodyAllowed = p.method !== 'GET' && p.method !== 'HEAD'
    if (b.kind === 'text' && bodyAllowed) opts.push(`  body: ${dq(b.text)},`)
    else if (b.kind === 'form' && bodyAllowed) opts.push(`  body: new URLSearchParams({\n${b.fields.map((f) => `    ${dq(f.key)}: ${dq(f.value)},`).join('\n')}\n  }),`)
    else if (b.kind === 'multipart' && bodyAllowed) {
      pre.push('const form = new FormData();')
      for (const part of b.parts) pre.push(part.path !== undefined ? `form.append(${dq(part.key)}, await openAsBlob(${dq(part.path)}));` : `form.append(${dq(part.key)}, ${dq(part.value ?? '')});`)
      pre.push('')
      opts.push('  body: form,')
    } else if (b.kind === 'file' && bodyAllowed) opts.push(`  body: await openAsBlob(${dq(b.path)}),`)
    if (!p.followRedirects) opts.push('  redirect: "manual",')
    const needsFs = (b.kind === 'multipart' && b.parts.some((x) => x.path !== undefined)) || b.kind === 'file'
    const head = needsFs ? 'import { openAsBlob } from "node:fs";\n\n' : ''
    return `${head}${pre.join('\n')}${pre.length ? '\n' : ''}const response = await fetch(${dq(p.url)}, {\n${opts.join('\n')}\n});\n\nconsole.log(response.status);\nconsole.log(await response.text());\n`
  }
}
