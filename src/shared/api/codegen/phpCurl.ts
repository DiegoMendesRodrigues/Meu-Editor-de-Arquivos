// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { API_LIMITS } from '../limits'
import { phpStr } from './escape'
import { prepareRequest } from './prepare'
import type { CodegenTarget } from './types'

export const phpCurl: CodegenTarget = {
  id: 'phpCurl',
  label: 'PHP (cURL)',
  monaco: 'php',
  generate(request) {
    const p = prepareRequest(request)
    const b = p.body
    const opts: string[] = [`    CURLOPT_URL => ${phpStr(p.url)},`, `    CURLOPT_CUSTOMREQUEST => ${phpStr(p.method)},`, '    CURLOPT_RETURNTRANSFER => true,']
    const headers = p.headers.filter((h) => !(b.kind === 'multipart' && h.key.toLowerCase() === 'content-type'))
    if (headers.length > 0) opts.push(`    CURLOPT_HTTPHEADER => [\n${headers.map((h) => `        ${phpStr(`${h.key}: ${h.value}`)},`).join('\n')}\n    ],`)
    if (b.kind === 'text') opts.push(`    CURLOPT_POSTFIELDS => ${phpStr(b.text)},`)
    else if (b.kind === 'form') opts.push(`    CURLOPT_POSTFIELDS => http_build_query([\n${b.fields.map((f) => `        ${phpStr(f.key)} => ${phpStr(f.value)},`).join('\n')}\n    ]),`)
    else if (b.kind === 'multipart') opts.push(`    CURLOPT_POSTFIELDS => [\n${b.parts.map((part) => `        ${phpStr(part.key)} => ${part.path !== undefined ? `new CURLFile(${phpStr(part.path)})` : phpStr(part.value ?? '')},`).join('\n')}\n    ],`)
    else if (b.kind === 'file') opts.push(`    CURLOPT_POSTFIELDS => file_get_contents(${phpStr(b.path)}),`)
    opts.push(`    CURLOPT_FOLLOWLOCATION => ${p.followRedirects ? 'true' : 'false'},`)
    if (!p.verifyTls) opts.push('    CURLOPT_SSL_VERIFYPEER => false,', '    CURLOPT_SSL_VERIFYHOST => 0,')
    opts.push(`    CURLOPT_TIMEOUT => ${p.timeoutMs === API_LIMITS.timeoutDefaultMs ? 30 : Math.ceil(p.timeoutMs / 1000)},`)
    return `<?php\n\n$ch = curl_init();\ncurl_setopt_array($ch, [\n${opts.join('\n')}\n]);\n\n$response = curl_exec($ch);\nif ($response === false) {\n    echo curl_error($ch);\n} else {\n    echo curl_getinfo($ch, CURLINFO_HTTP_CODE) . "\\n" . $response;\n}\ncurl_close($ch);\n`
  }
}
