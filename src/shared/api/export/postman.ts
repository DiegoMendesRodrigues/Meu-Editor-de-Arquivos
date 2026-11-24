// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Exportar como Postman Collection v2.1. */
import type { ApiRequest, Auth } from '../schema'
import { folderParts, type ExportInput } from './types'

type Json = Record<string, unknown>

const kvOut = (rows: { key: string; value: string; enabled: boolean; description?: string }[]): Json[] =>
  rows.map((r) => ({ key: r.key, value: r.value, ...(r.enabled ? {} : { disabled: true }), ...(r.description ? { description: r.description } : {}) }))

const pairs = (entries: [string, string][]): Json[] => entries.map(([key, value]) => ({ key, value, type: 'string' }))

function authOut(auth: Auth): Json | undefined {
  switch (auth.type) {
    case 'bearer': return { type: 'bearer', bearer: pairs([['token', auth.token]]) }
    case 'basic': return { type: 'basic', basic: pairs([['username', auth.username], ['password', auth.password]]) }
    case 'apiKey': return { type: 'apikey', apikey: pairs([['key', auth.key], ['value', auth.value], ['in', auth.in]]) }
    case 'none': return { type: 'noauth' }
    default: return undefined
  }
}

function urlOut(request: ApiRequest): Json {
  // A URL do .apireq já traz a query; a tabela Params (sem os path params) vira o "query" do Postman.
  const query = request.params.filter((p) => p.key !== '' && !p.key.startsWith(':'))
  const raw = request.url
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i.exec(request.url)
  const out: Json = { raw }
  if (m) {
    out.protocol = m[1]
    out.host = m[2]!.split('.')
    out.path = m[3]!.split('/').filter(Boolean)
  } else {
    const [host, ...path] = request.url.split('/').filter(Boolean)
    if (host) {
      out.host = [host]
      out.path = path
    }
  }
  if (query.length > 0) out.query = kvOut(query)
  return out
}

function bodyOut(request: ApiRequest): Json | undefined {
  const b = request.body
  switch (b.type) {
    case 'raw': return { mode: 'raw', raw: b.text, options: { raw: { language: b.language } } }
    case 'urlencoded': return { mode: 'urlencoded', urlencoded: kvOut(b.fields) }
    case 'multipart':
      return { mode: 'formdata', formdata: b.parts.map((p) => (p.kind === 'file' ? { key: p.key, type: 'file', src: p.path, ...(p.enabled ? {} : { disabled: true }) } : { key: p.key, value: p.value, type: 'text', ...(p.enabled ? {} : { disabled: true }) })) }
    case 'graphql': return { mode: 'graphql', graphql: { query: b.query, variables: b.variables } }
    case 'binary': return { mode: 'file', file: { src: b.path } }
    case 'soap': return { mode: 'raw', raw: b.envelope, options: { raw: { language: 'xml' } } }
    default: return undefined
  }
}

function itemOut(request: ApiRequest): Json {
  const req: Json = { method: request.method, header: kvOut(request.headers), url: urlOut(request) }
  const body = bodyOut(request)
  if (body) req.body = body
  const auth = authOut(request.auth)
  if (auth) req.auth = auth
  if (request.description) req.description = request.description
  const item: Json = { name: request.name || request.url, request: req }
  const events: Json[] = []
  if (request.scripts?.pre) events.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: request.scripts.pre.split('\n') } })
  if (request.scripts?.post) events.push({ listen: 'test', script: { type: 'text/javascript', exec: request.scripts.post.split('\n') } })
  if (events.length > 0) item.event = events
  return item
}

interface FolderNode {
  name: string
  folders: Map<string, FolderNode>
  requests: ApiRequest[]
}

export function exportPostman(input: ExportInput): string {
  const root: FolderNode = { name: '', folders: new Map(), requests: [] }
  for (const { folder, request } of input.items) {
    let node = root
    for (const part of folderParts(folder)) {
      let next = node.folders.get(part)
      if (!next) {
        next = { name: part, folders: new Map(), requests: [] }
        node.folders.set(part, next)
      }
      node = next
    }
    node.requests.push(request)
  }
  const toItems = (node: FolderNode): Json[] => [
    ...[...node.folders.values()].map((f) => ({ name: f.name, item: toItems(f) })),
    ...node.requests.map(itemOut)
  ]
  const collection: Json = {
    info: {
      _postman_id: globalThis.crypto.randomUUID(),
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: toItems(root)
  }
  if (input.variables.length > 0) collection.variable = input.variables.map((v) => ({ key: v.key, value: v.value, type: 'string' }))
  return `${JSON.stringify(collection, null, 2)}\n`
}
