// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Importar arquivos .http (REST Client do VS Code e JetBrains): blocos separados por "###". */
import type { Body, KeyValue } from '../schema'
import {
  ImportError, Warnings, authFromHeaders, cleanVariables, defaultName, findHeader, kv, looksLikeForm, makeRequest, parseForm, rawBody, removeHeader, splitUrl,
  type ParsedImport
} from './common'

const REQUEST_LINE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT)\s+(\S.*?)(?:\s+HTTP\/[\d.]+)?\s*$/i

export function parseHttp(text: string): ParsedImport {
  const warnings = new Warnings()
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const blocks: { title: string; lines: string[] }[] = [{ title: '', lines: [] }]
  const fileVars: { key: string; value: string }[] = []
  for (const line of lines) {
    if (/^###/.test(line)) {
      blocks.push({ title: line.replace(/^#+\s*/, '').trim(), lines: [] })
      continue
    }
    const v = /^@([A-Za-z_$][\w.$-]*)\s*=\s*(.*)$/.exec(line)
    if (v && blocks[blocks.length - 1]!.lines.every((l) => l.trim() === '' || /^\s*(#|\/\/)/.test(l))) {
      fileVars.push({ key: v[1]!, value: v[2]!.trim() })
      continue
    }
    blocks[blocks.length - 1]!.lines.push(line)
  }

  const items: ParsedImport['items'] = []
  for (const block of blocks) {
    let name = block.title
    const ls = [...block.lines]
    // Comentários antes da linha da requisição: "# @name x" ou "// @name x" dá o nome.
    while (ls.length > 0 && (ls[0]!.trim() === '' || /^\s*(#|\/\/)/.test(ls[0]!))) {
      const m = /^\s*(?:#|\/\/)\s*@name\s+(.+)$/.exec(ls[0]!)
      if (m) name = m[1]!.trim()
      ls.shift()
    }
    const first = ls.shift()
    if (first === undefined) continue
    const rl = REQUEST_LINE.exec(first.trim())
    // Linha só com a URL é um GET.
    const method = rl ? rl[1]!.toUpperCase() : /^https?:\/\/|^\{\{/.test(first.trim()) ? 'GET' : ''
    const urlRaw = rl ? rl[2]! : first.trim()
    if (!method) {
      if (first.trim() !== '') warnings.add('invalidItem')
      continue
    }
    let url = urlRaw
    // Continuação da query em linhas que começam com "?" ou "&".
    while (ls.length > 0 && /^\s*[?&]/.test(ls[0]!)) url += ls.shift()!.trim()
    let headers: KeyValue[] = []
    while (ls.length > 0 && ls[0]!.trim() !== '' && !/^\s*(#|\/\/)/.test(ls[0]!)) {
      const h = ls.shift()!
      const i = h.indexOf(':')
      if (i > 0) headers.push(kv(h.slice(0, i).trim(), h.slice(i + 1).trim()))
    }
    while (ls.length > 0 && ls[0]!.trim() === '') ls.shift()
    while (ls.length > 0 && ls[ls.length - 1]!.trim() === '') ls.pop()
    const bodyText = ls.join('\n')
    const contentType = findHeader(headers, 'Content-Type')

    let body: Body = { type: 'none' }
    const fileRef = /^<\s+(\S+)\s*$/.exec(bodyText.trim())
    if (fileRef) body = { type: 'binary', path: fileRef[1]! }
    else if (bodyText !== '') {
      // Corpo em várias linhas "a=1" / "&b=2" é um formulário.
      const joined = bodyText.split('\n').map((l) => l.trim()).join('')
      if (contentType?.toLowerCase().includes('x-www-form-urlencoded') || (!contentType && looksLikeForm(joined))) {
        body = { type: 'urlencoded', fields: parseForm(joined) }
        headers = removeHeader(headers, 'Content-Type')
      } else body = rawBody(bodyText, contentType)
    }
    const { url: baseUrl, params } = splitUrl(url)
    const withAuth = authFromHeaders(headers)
    items.push({
      folder: '',
      request: makeRequest({ name: name || defaultName(method, baseUrl), method, url: baseUrl, params, headers: withAuth.headers, auth: withAuth.auth ?? undefined, body }, warnings)
    })
  }
  if (items.length === 0) throw new ImportError('invalid')
  return { name: 'HTTP', items, environments: [], variables: cleanVariables(fileVars, warnings), warnings: warnings.list() }
}
