// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { apiRequestSchema, newApiRequest, type ApiRequest } from '../schema'
import { CODEGEN_TARGETS, generateCode } from './index'

const base = newApiRequest('x')
const make = (patch: Partial<ApiRequest>): ApiRequest => apiRequestSchema.parse({ ...base, ...patch })

const jsonPost = make({
  method: 'POST',
  url: 'https://api.exemplo.com.br/itens?v=1',
  params: [{ key: 'v', value: '1', enabled: true }, { key: 'off', value: 'x', enabled: false }],
  headers: [{ key: 'X-Id', value: 'a"b', enabled: true }],
  auth: { type: 'bearer', token: '{{token}}', prefix: 'Bearer' },
  body: { type: 'raw', language: 'json', text: '{"nome":"caneta"}' }
})

describe('gerar código', () => {
  it('lista os 11 alvos', () => {
    expect(CODEGEN_TARGETS.map((t) => t.id)).toEqual([
      'curlBash', 'curlPowerShell', 'invokeRestMethod', 'pythonRequests', 'jsFetch', 'nodeAxios',
      'csharpHttpClient', 'javaHttpClient', 'goNetHttp', 'phpCurl', 'rustReqwest'
    ])
  })

  it('curl bash', () => {
    const c = generateCode(jsonPost, 'curlBash')
    expect(c).toContain("curl 'https://api.exemplo.com.br/itens?v=1' \\")
    expect(c).toContain("-H 'Authorization: Bearer {{token}}'")
    expect(c).toContain("-H 'Content-Type: application/json'")
    expect(c).toContain(`--data-raw '{"nome":"caneta"}'`)
    expect(c).not.toContain('off=')
  })

  it('curl PowerShell', () => {
    const c = generateCode(make({ method: 'PUT', url: 'https://127.0.0.1/a', headers: [{ key: 'X', value: "it's", enabled: true }] }), 'curlPowerShell')
    expect(c).toContain("curl.exe -X PUT 'https://127.0.0.1/a' `")
    expect(c).toContain("-H 'X: it''s'")
  })

  it('Invoke-RestMethod', () => {
    const c = generateCode(jsonPost, 'invokeRestMethod')
    expect(c).toContain("$headers = @{")
    expect(c).toContain("'Authorization' = 'Bearer {{token}}'")
    expect(c).toContain('Invoke-RestMethod -Method Post')
    expect(c).toContain("-ContentType 'application/json'")
    expect(c).toContain('-Body $body')
  })

  it('Python requests', () => {
    const c = generateCode(jsonPost, 'pythonRequests')
    expect(c).toContain('import requests')
    expect(c).toContain('requests.request(')
    expect(c).toContain('"POST",')
    expect(c).toContain('"X-Id": "a\\"b"')
    expect(c).toContain('data="{\\"nome\\":\\"caneta\\"}".encode("utf-8")')
  })

  it('JavaScript fetch', () => {
    const c = generateCode(jsonPost, 'jsFetch')
    expect(c).toContain('await fetch("https://api.exemplo.com.br/itens?v=1", {')
    expect(c).toContain('method: "POST"')
    expect(c).toContain('"Authorization": "Bearer {{token}}"')
    expect(c).toContain('body: "{\\"nome\\":\\"caneta\\"}"')
  })

  it('Node axios', () => {
    const c = generateCode(make({ method: 'POST', url: 'https://127.0.0.1/f', body: { type: 'urlencoded', fields: [{ key: 'a', value: '1', enabled: true }] }, settings: { ...base.settings, verifyTls: false } }), 'nodeAxios')
    expect(c).toContain('import axios from "axios";')
    expect(c).toContain('method: "post"')
    expect(c).toContain('data: new URLSearchParams({')
    expect(c).toContain('rejectUnauthorized: false')
  })

  it('C# HttpClient', () => {
    const c = generateCode(jsonPost, 'csharpHttpClient')
    expect(c).toContain('new HttpRequestMessage(new HttpMethod("POST"), "https://api.exemplo.com.br/itens?v=1")')
    expect(c).toContain('request.Headers.TryAddWithoutValidation("Authorization", "Bearer {{token}}");')
    expect(c).toContain('new StringContent("{\\"nome\\":\\"caneta\\"}", Encoding.UTF8, "application/json")')
    expect(c).toContain('client.SendAsync(request)')
  })

  it('Java HttpClient', () => {
    const c = generateCode(jsonPost, 'javaHttpClient')
    expect(c).toContain('import java.net.http.HttpClient;')
    expect(c).toContain('.uri(URI.create("https://api.exemplo.com.br/itens?v=1"))')
    expect(c).toContain('.header("Content-Type", "application/json")')
    expect(c).toContain('.method("POST", HttpRequest.BodyPublishers.ofString(')
  })

  it('Java multipart monta o boundary', () => {
    const c = generateCode(make({ method: 'POST', url: 'https://127.0.0.1/up', body: { type: 'multipart', parts: [{ kind: 'text', key: 'n', value: 'v', enabled: true }, { kind: 'file', key: 'f', path: '/tmp/a.txt', enabled: true }] } }), 'javaHttpClient')
    expect(c).toContain('.header("Content-Type", "multipart/form-data; boundary=" + boundary)')
    expect(c).toContain('Files.readAllBytes(Path.of("/tmp/a.txt"))')
  })

  it('Go net/http', () => {
    const c = generateCode(jsonPost, 'goNetHttp')
    expect(c).toContain('package main')
    expect(c).toContain('http.NewRequest("POST", "https://api.exemplo.com.br/itens?v=1", strings.NewReader(')
    expect(c).toContain('req.Header.Add("Authorization", "Bearer {{token}}")')
    expect(c).toContain('"strings"')
  })

  it('PHP cURL', () => {
    const c = generateCode(jsonPost, 'phpCurl')
    expect(c.startsWith('<?php')).toBe(true)
    expect(c).toContain("CURLOPT_URL => 'https://api.exemplo.com.br/itens?v=1',")
    expect(c).toContain("CURLOPT_CUSTOMREQUEST => 'POST',")
    expect(c).toContain("'Authorization: Bearer {{token}}'")
    expect(c).toContain(`CURLOPT_POSTFIELDS => '{"nome":"caneta"}',`)
  })

  it('Rust reqwest', () => {
    const c = generateCode(jsonPost, 'rustReqwest')
    expect(c).toContain('#[tokio::main]')
    expect(c).toContain('.request(reqwest::Method::POST, "https://api.exemplo.com.br/itens?v=1")')
    expect(c).toContain('.header("Authorization", "Bearer {{token}}")')
    expect(c).toContain('.body("{\\"nome\\":\\"caneta\\"}")')
  })

  it('autorização básica com variáveis vira -u no curl e cabeçalho nos demais; nada é resolvido', () => {
    const r = make({ url: 'https://127.0.0.1/a', auth: { type: 'basic', username: '{{usuario}}', password: '{{senha}}' } })
    expect(generateCode(r, 'curlBash')).toContain("-u '{{usuario}}:{{senha}}'")
    expect(generateCode(r, 'jsFetch')).toContain('{{senha}}')
    const lit = make({ url: 'https://127.0.0.1/a', auth: { type: 'basic', username: 'u', password: 'p' } })
    expect(generateCode(lit, 'jsFetch')).toContain(`"Basic ${btoa('u:p')}"`)
  })

  it('chave de API na query entra na URL e OAuth 2 vira a variável do token', () => {
    const k = make({ url: 'https://127.0.0.1/a', auth: { type: 'apiKey', key: 'k', value: '{{chave}}', in: 'query' } })
    expect(generateCode(k, 'curlBash')).toContain("'https://127.0.0.1/a?k={{chave}}'")
    const o = make({ url: 'https://127.0.0.1/a', auth: { type: 'oauth2', flow: 'clientCredentials', tokenUrl: 'https://127.0.0.1/t', clientId: 'c', scopes: [], pkce: true, tokenVar: 'meuToken', autoRefresh: true } })
    expect(generateCode(o, 'curlBash')).toContain('Authorization: Bearer {{meuToken}}')
  })

  it('corpo GraphQL, multipart e arquivo geram os formatos esperados', () => {
    const g = make({ method: 'POST', url: 'https://127.0.0.1/g', body: { type: 'graphql', query: '{ a }', variables: '{"x":1}' } })
    expect(generateCode(g, 'curlBash')).toContain(`--data-raw '{"query":"{ a }","variables":{"x":1}}'`)
    const m = make({ method: 'POST', url: 'https://127.0.0.1/u', body: { type: 'multipart', parts: [{ kind: 'text', key: 'n', value: 'v', enabled: true }, { kind: 'file', key: 'f', path: '/tmp/a.txt', enabled: true }] } })
    const curl = generateCode(m, 'curlBash')
    expect(curl).toContain("-F 'n=v'")
    expect(curl).toContain("-F 'f=@/tmp/a.txt'")
    expect(generateCode(m, 'pythonRequests')).toContain('open("/tmp/a.txt", "rb")')
    expect(generateCode(m, 'phpCurl')).toContain("new CURLFile('/tmp/a.txt')")
    expect(generateCode(m, 'rustReqwest')).toContain('.file("f", "/tmp/a.txt").await?')
    const f = make({ method: 'POST', url: 'https://127.0.0.1/b', body: { type: 'binary', path: '/tmp/b.bin' } })
    expect(generateCode(f, 'curlBash')).toContain("--data-binary '@/tmp/b.bin'")
  })

  it('todos os alvos geram texto para qualquer tipo de corpo, sem lançar', () => {
    const bodies: ApiRequest['body'][] = [
      { type: 'none' }, { type: 'raw', language: 'xml', text: '<a/>' }, { type: 'urlencoded', fields: [{ key: 'a', value: 'b c', enabled: true }] },
      { type: 'multipart', parts: [{ kind: 'text', key: 'a', value: 'b', enabled: true }] }, { type: 'binary', path: 'x.bin' },
      { type: 'graphql', query: '{a}', variables: '' }, { type: 'soap', version: '1.2', action: 'urn:a', envelope: '<e/>' }
    ]
    for (const body of bodies) {
      for (const t of CODEGEN_TARGETS) expect(t.generate(make({ method: 'POST', url: 'https://127.0.0.1/a', body })).length).toBeGreaterThan(20)
    }
  })

  it('alvo desconhecido lança erro', () => {
    expect(() => generateCode(jsonPost, 'cobol')).toThrow()
  })
})
