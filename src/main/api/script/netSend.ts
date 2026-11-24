// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Envio de pm.sendRequest, do lado do Main: recebe o pedido que o sandbox montou (texto não confiável),
 * resolve as {{variáveis}} e manda pelo mesmo cliente HTTP do envio principal. Regras próprias:
 * só http/https, segredo só para host já confirmado (sem pedir confirmação no meio do script), sem
 * scripts aninhados e sem gravar cookies. Erros voltam como código, nunca como mensagem crua.
 */
import { app } from 'electron'
import { z } from 'zod'
import { API_LIMITS } from '@shared/api/limits'
import type { Body, KeyValue } from '@shared/api/schema'
import { buildBody } from '../body'
import { ApiFail, toApiErrorCode } from '../errors'
import { sendHttp } from '../http'
import { chooseProxy } from '../proxy'
import type { Resolver } from '../resolve'
import { isHostTrusted } from '../trust'
import type { ScriptSendFn } from './types'

const L = API_LIMITS
const pair = z.tuple([z.string().max(L.keyChars), z.string().max(L.bodyChars)])
const specSchema = z.object({
  read: z.array(z.string().max(L.keyChars)).max(500).optional(),
  url: z.string().max(L.urlChars),
  method: z.string().regex(/^[A-Za-z]{1,32}$/),
  headers: z.array(pair).max(L.keyValueRows),
  body: z.object({
    mode: z.enum(['none', 'raw', 'urlencoded', 'formdata']),
    raw: z.string().max(L.bodyChars).optional(),
    fields: z.array(pair).max(L.keyValueRows).optional()
  })
})

const fail = (code: string): string => JSON.stringify({ ok: false, code })
const hasHeader = (list: [string, string][], name: string): boolean => list.some(([k]) => k.toLowerCase() === name)

function toUrl(text: string): URL {
  const t = text.trim().split('#')[0]!
  let base = t
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) {
    if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(t)) throw new ApiFail('schemeNotAllowed')
    base = `http://${t}`
  }
  let url: URL
  try {
    url = new URL(base)
  } catch {
    throw new ApiFail('badUrl')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ApiFail('schemeNotAllowed')
  if (!url.hostname) throw new ApiFail('badUrl')
  return url
}

/**
 * Cria a função que atende os pedidos de rede de um script. `signal` cancela tudo (o envio principal
 * foi cancelado). O resolvedor é o do envio: variáveis e segredos nos mesmos escopos.
 */
export function createScriptSender(r: Resolver, signal?: AbortSignal): ScriptSendFn {
  return async (json) => {
    try {
      if (signal?.aborted) return fail('cancelled')
      const spec = specSchema.parse(JSON.parse(json))
      const headers: [string, string][] = spec.headers.filter(([k]) => k.trim() !== '').map(([k, v]) => [r.resolve(k).trim(), r.resolve(v)])
      const url = toUrl(r.resolve(spec.url))
      const method = spec.method.toUpperCase()

      let body: Body = { type: 'none' }
      const fields = (spec.body.fields ?? []).map(([key, value]): KeyValue => ({ key: r.resolve(key), value: r.resolve(value), enabled: true }))
      if (spec.body.mode === 'raw') {
        const text = r.resolve(spec.body.raw ?? '')
        body = { type: 'raw', language: /^\s*[{[]/.test(text) ? 'json' : 'text', text }
      } else if (spec.body.mode === 'urlencoded') body = { type: 'urlencoded', fields }
      else if (spec.body.mode === 'formdata') body = { type: 'multipart', parts: fields.map((f) => ({ kind: 'text' as const, key: f.key, value: f.value, enabled: true })) }
      const built = await buildBody({ body, documentPath: null })
      if (built.contentType && !hasHeader(headers, 'content-type')) headers.push(['Content-Type', built.contentType])
      if (!hasHeader(headers, 'user-agent')) headers.push(['User-Agent', `MeuEditorDeArquivos/${app.getVersion()}`])
      if (!hasHeader(headers, 'accept')) headers.push(['Accept', '*/*'])
      if (!hasHeader(headers, 'accept-encoding')) headers.push(['Accept-Encoding', 'gzip, deflate, br'])

      // O script pode ter montado o pedido com um segredo lido por env.get: o valor literal também conta.
      const snap = r.snapshot()
      // Segredo que o script já leu (env.get) conta, mesmo transformado (base64, fatias): o host precisa estar confirmado.
      for (const name of spec.read ?? []) if (snap.secretNames.includes(name)) r.lookup(name)
      const texts = [url.href, ...headers.flat(), ...fields.flatMap((f) => [f.key, f.value]), body.type === 'raw' ? body.text : '']
      for (const name of snap.secretNames) {
        const v = snap.values[name]
        if (v && texts.some((t) => t.includes(v))) r.lookup(name)
      }
      if (r.secretScopes.size > 0 && !(await isHostTrusted(r.secretScopes, url.host.toLowerCase()))) return JSON.stringify({ ok: false, code: 'secretHostNotConfirmed', host: url.host.toLowerCase() })

      const stripOnRedirect = new Set<string>(['authorization', 'cookie', 'proxy-authorization', 'x-api-key'])
      const secretValues = [...r.secrets].filter((v) => v.length > 0)
      for (const [k, v] of headers) if (secretValues.some((sv) => v.includes(sv))) stripOnRedirect.add(k.toLowerCase())

      const result = await sendHttp({
        method,
        url,
        headers,
        body: built,
        settings: { timeoutMs: L.scriptSendTimeoutMs, followRedirects: true, maxRedirects: 5, verifyTls: true, minTlsVersion: 'TLSv1.2', http2: false },
        proxy: (u) => chooseProxy({ proxy: 'system', proxyUrl: '' }, u),
        signal,
        stripOnRedirect: [...stripOnRedirect]
      })
      const slice = result.body.length > L.displayBytes ? result.body.subarray(0, L.displayBytes) : result.body
      // Binário não vira texto para o script.
      const text = slice.subarray(0, 8000).includes(0) ? '' : slice.toString('utf8')
      return JSON.stringify({ ok: true, res: { code: result.status, status: result.statusText, headers: result.headers, body: text, responseTime: Math.round(result.timings.total) } })
    } catch (err) {
      if (err instanceof z.ZodError || err instanceof SyntaxError) return fail('invalidRequest')
      return fail(toApiErrorCode(err))
    }
  }
}
