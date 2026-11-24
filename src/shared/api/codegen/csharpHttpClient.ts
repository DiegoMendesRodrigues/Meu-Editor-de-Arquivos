// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { dq } from './escape'
import { headerValue, prepareRequest } from './prepare'
import type { CodegenTarget } from './types'

export const csharpHttpClient: CodegenTarget = {
  id: 'csharpHttpClient',
  label: 'C# (HttpClient)',
  monaco: 'csharp',
  generate(request) {
    const p = prepareRequest(request)
    const b = p.body
    const lines: string[] = ['using System.Net.Http;', 'using System.Text;', '']
    if (!p.verifyTls || !p.followRedirects) {
      const props: string[] = []
      if (!p.followRedirects) props.push('AllowAutoRedirect = false')
      if (!p.verifyTls) props.push('ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator')
      lines.push(`var handler = new HttpClientHandler { ${props.join(', ')} };`, 'using var client = new HttpClient(handler);')
    } else lines.push('using var client = new HttpClient();')
    lines.push(`using var request = new HttpRequestMessage(new HttpMethod(${dq(p.method)}), ${dq(p.url)});`)

    const contentType = headerValue(p.headers, 'Content-Type')
    const hasContent = b.kind !== 'none'
    for (const h of p.headers) {
      if (hasContent && h.key.toLowerCase() === 'content-type') continue
      lines.push(`request.Headers.TryAddWithoutValidation(${dq(h.key)}, ${dq(h.value)});`)
    }
    if (b.kind === 'text') {
      const media = (contentType ?? 'text/plain').split(';')[0]!.trim()
      lines.push(`request.Content = new StringContent(${dq(b.text)}, Encoding.UTF8, ${dq(media)});`)
    } else if (b.kind === 'form') {
      lines.push('request.Content = new FormUrlEncodedContent(new Dictionary<string, string>', '{')
      for (const f of b.fields) lines.push(`    { ${dq(f.key)}, ${dq(f.value)} },`)
      lines.push('});')
    } else if (b.kind === 'multipart') {
      lines.push('var content = new MultipartFormDataContent();')
      for (const part of b.parts) {
        if (part.path !== undefined) lines.push(`content.Add(new StreamContent(File.OpenRead(${dq(part.path)})), ${dq(part.key)}, Path.GetFileName(${dq(part.path)}));`)
        else lines.push(`content.Add(new StringContent(${dq(part.value ?? '')}), ${dq(part.key)});`)
      }
      lines.push('request.Content = content;')
    } else if (b.kind === 'file') {
      lines.push(`request.Content = new StreamContent(File.OpenRead(${dq(b.path)}));`)
      if (contentType) lines.push(`request.Content.Headers.TryAddWithoutValidation("Content-Type", ${dq(contentType)});`)
    }
    lines.push('', 'using var response = await client.SendAsync(request);', 'Console.WriteLine((int)response.StatusCode);', 'Console.WriteLine(await response.Content.ReadAsStringAsync());')
    return `${lines.join('\n')}\n`
  }
}
