// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { API_LIMITS } from '../limits'
import { dq } from './escape'
import { prepareRequest } from './prepare'
import type { CodegenTarget } from './types'

export const javaHttpClient: CodegenTarget = {
  id: 'javaHttpClient',
  label: 'Java (HttpClient)',
  monaco: 'java',
  generate(request) {
    const p = prepareRequest(request)
    const b = p.body
    const imports = new Set(['java.net.URI', 'java.net.http.HttpClient', 'java.net.http.HttpRequest', 'java.net.http.HttpResponse'])
    const body: string[] = []
    let publisher = 'HttpRequest.BodyPublishers.noBody()'
    const headers = p.headers.map((h) => ({ key: h.key, expr: dq(h.value) }))

    if (b.kind === 'text') publisher = `HttpRequest.BodyPublishers.ofString(${dq(b.text)})`
    else if (b.kind === 'form') {
      imports.add('java.net.URLEncoder').add('java.nio.charset.StandardCharsets').add('java.util.List').add('java.util.stream.Collectors')
      body.push('List<String[]> fields = List.of(')
      body.push(b.fields.map((f) => `        new String[] { ${dq(f.key)}, ${dq(f.value)} }`).join(',\n'))
      body.push(');')
      body.push('String form = fields.stream()', '        .map(f -> URLEncoder.encode(f[0], StandardCharsets.UTF_8) + "=" + URLEncoder.encode(f[1], StandardCharsets.UTF_8))', '        .collect(Collectors.joining("&"));')
      publisher = 'HttpRequest.BodyPublishers.ofString(form)'
    } else if (b.kind === 'multipart') {
      imports.add('java.io.ByteArrayOutputStream').add('java.nio.charset.StandardCharsets').add('java.nio.file.Files').add('java.nio.file.Path')
      body.push('String boundary = "----Boundary" + System.nanoTime();', 'ByteArrayOutputStream out = new ByteArrayOutputStream();')
      for (const part of b.parts) {
        if (part.path !== undefined) {
          body.push(`out.write(("--" + boundary + "\\r\\nContent-Disposition: form-data; name=" + ${dq(`"${part.key}"`)} + "; filename=" + ${dq(`"${part.path.split(/[\\/]/).pop() ?? ''}"`)} + "\\r\\nContent-Type: application/octet-stream\\r\\n\\r\\n").getBytes(StandardCharsets.UTF_8));`)
          body.push(`out.write(Files.readAllBytes(Path.of(${dq(part.path)})));`, 'out.write("\\r\\n".getBytes(StandardCharsets.UTF_8));')
        } else {
          body.push(`out.write(("--" + boundary + "\\r\\nContent-Disposition: form-data; name=" + ${dq(`"${part.key}"`)} + "\\r\\n\\r\\n" + ${dq(part.value ?? '')} + "\\r\\n").getBytes(StandardCharsets.UTF_8));`)
        }
      }
      body.push('out.write(("--" + boundary + "--\\r\\n").getBytes(StandardCharsets.UTF_8));')
      headers.push({ key: 'Content-Type', expr: '"multipart/form-data; boundary=" + boundary' })
      publisher = 'HttpRequest.BodyPublishers.ofByteArray(out.toByteArray())'
    } else if (b.kind === 'file') {
      imports.add('java.nio.file.Path')
      publisher = `HttpRequest.BodyPublishers.ofFile(Path.of(${dq(b.path)}))`
    }

    const builder = p.followRedirects ? 'HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build()' : 'HttpClient.newHttpClient()'
    const req: string[] = ['HttpRequest request = HttpRequest.newBuilder()', `        .uri(URI.create(${dq(p.url)}))`]
    if (p.timeoutMs !== API_LIMITS.timeoutDefaultMs) {
      imports.add('java.time.Duration')
      req.push(`        .timeout(Duration.ofMillis(${p.timeoutMs}))`)
    }
    for (const h of headers) req.push(`        .header(${dq(h.key)}, ${h.expr})`)
    req.push(`        .method(${dq(p.method)}, ${publisher})`, '        .build();')

    const main = [...body, ...(body.length ? [''] : []), `HttpClient client = ${builder};`, ...req, '', 'HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());', 'System.out.println(response.statusCode());', 'System.out.println(response.body());']
    const importLines = [...imports].sort().map((i) => `import ${i};`)
    return `${importLines.join('\n')}\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n${main.map((l) => (l ? `        ${l}` : l)).join('\n')}\n    }\n}\n`
  }
}
