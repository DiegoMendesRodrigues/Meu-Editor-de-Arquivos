// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { dq } from './escape'
import { prepareRequest } from './prepare'
import type { CodegenTarget } from './types'

export const goNetHttp: CodegenTarget = {
  id: 'goNetHttp',
  label: 'Go (net/http)',
  monaco: 'go',
  generate(request) {
    const p = prepareRequest(request)
    const b = p.body
    const imports = new Set(['fmt', 'io', 'net/http'])
    const pre: string[] = []
    let reader = 'nil'
    const headers = [...p.headers]
    if (b.kind === 'text') {
      imports.add('strings')
      reader = `strings.NewReader(${dq(b.text)})`
    } else if (b.kind === 'form') {
      imports.add('strings').add('net/url')
      pre.push('form := url.Values{}', ...b.fields.map((f) => `form.Add(${dq(f.key)}, ${dq(f.value)})`), '')
      reader = 'strings.NewReader(form.Encode())'
    } else if (b.kind === 'multipart') {
      imports.add('bytes').add('mime/multipart')
      pre.push('var buf bytes.Buffer', 'writer := multipart.NewWriter(&buf)')
      for (const part of b.parts) {
        if (part.path !== undefined) {
          imports.add('os')
          pre.push(`file, err := os.Open(${dq(part.path)})`, 'if err != nil {', '\tpanic(err)', '}', 'defer file.Close()', `part, err := writer.CreateFormFile(${dq(part.key)}, file.Name())`, 'if err != nil {', '\tpanic(err)', '}', 'io.Copy(part, file)')
        } else pre.push(`writer.WriteField(${dq(part.key)}, ${dq(part.value ?? '')})`)
      }
      pre.push('writer.Close()', '')
      reader = '&buf'
      headers.push({ key: 'Content-Type', value: '\u0000writer.FormDataContentType()' })
    } else if (b.kind === 'file') {
      imports.add('os')
      pre.push(`file, err := os.Open(${dq(b.path)})`, 'if err != nil {', '\tpanic(err)', '}', 'defer file.Close()', '')
      reader = 'file'
    }

    const lines: string[] = [...pre]
    lines.push(`req, err := http.NewRequest(${dq(p.method)}, ${dq(p.url)}, ${reader})`, 'if err != nil {', '\tpanic(err)', '}')
    for (const h of headers) lines.push(`req.Header.Add(${dq(h.key)}, ${h.value.startsWith('\u0000') ? h.value.slice(1) : dq(h.value)})`)
    lines.push('')

    const clientFields: string[] = []
    if (!p.followRedirects) clientFields.push('\tCheckRedirect: func(req *http.Request, via []*http.Request) error {\n\t\treturn http.ErrUseLastResponse\n\t},')
    if (!p.verifyTls) {
      imports.add('crypto/tls')
      clientFields.push('\tTransport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},')
    }
    lines.push(clientFields.length ? `client := &http.Client{\n${clientFields.join('\n')}\n}` : 'client := &http.Client{}')
    lines.push('resp, err := client.Do(req)', 'if err != nil {', '\tpanic(err)', '}', 'defer resp.Body.Close()', '', 'data, err := io.ReadAll(resp.Body)', 'if err != nil {', '\tpanic(err)', '}', 'fmt.Println(resp.StatusCode)', 'fmt.Println(string(data))')

    const importLines = [...imports].sort().map((i) => `\t"${i}"`)
    return `package main\n\nimport (\n${importLines.join('\n')}\n)\n\nfunc main() {\n${lines.map((l) => (l ? `\t${l}` : l)).join('\n')}\n}\n`
  }
}
