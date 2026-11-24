// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Params da requisição: sincronia com a query string da URL e path params (/produtos/:id).
 *
 * Convenção (o schema não tem campo para path params): uma linha de `params` cuja chave começa com ":"
 * é um path param (":id" guarda o valor de /:id). Essas linhas ficam fora da query string e são
 * mostradas numa seção própria. As linhas desligadas ficam só na tabela, nunca na URL.
 */
import type { ApiRequest, KeyValue } from './schema'

const VARIABLE_PART = /(\{\{[^{}]*\}\})/

const escapeRe = (text: string): string => text.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')

export const isPathParam = (row: KeyValue): boolean => row.key.startsWith(':')

/** Codifica o texto, deixando as {{variáveis}} como estão (o Main as resolve depois). */
function encodePart(text: string): string {
  return text
    .split(VARIABLE_PART)
    .map((p, i) => (i % 2 ? p : encodeURIComponent(p)))
    .join('')
}

function decodePart(text: string): string {
  if (VARIABLE_PART.test(text)) {
    return text
      .split(VARIABLE_PART)
      .map((p, i) => (i % 2 ? p : decodePart(p)))
      .join('')
  }
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    return text
  }
}

/** Separa a URL em base (até o "?"), query (sem o "?") e fragmento (com o "#"). */
export function splitUrl(url: string): { base: string; query: string | null; hash: string } {
  const hashAt = url.indexOf('#')
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const rest = hashAt >= 0 ? url.slice(0, hashAt) : url
  const q = rest.indexOf('?')
  return q >= 0 ? { base: rest.slice(0, q), query: rest.slice(q + 1), hash } : { base: rest, query: null, hash }
}

export function parseQuery(query: string): { key: string; value: string }[] {
  return query
    .split('&')
    .filter((p) => p !== '')
    .map((pair) => {
      const eq = pair.indexOf('=')
      return eq >= 0 ? { key: decodePart(pair.slice(0, eq)), value: decodePart(pair.slice(eq + 1)) } : { key: decodePart(pair), value: '' }
    })
}

const serializeQuery = (rows: { key: string; value: string }[]): string =>
  rows.map((r) => (`${encodePart(r.key)}=${encodePart(r.value)}`)).join('&')

/** Linhas de query: ligadas, com chave e que não são path params. */
const queryRows = (params: KeyValue[]): KeyValue[] => params.filter((r) => r.enabled && r.key !== '' && !isPathParam(r))

/** URL a partir da tabela: troca só a query, mantendo a base e o fragmento. */
export function urlFromParams(url: string, params: KeyValue[]): string {
  const { base, hash } = splitUrl(url)
  const query = serializeQuery(queryRows(params))
  return `${base}${query ? `?${query}` : ''}${hash}`
}

/** Tabela a partir da URL: as linhas ligadas seguem a query (mantendo a descrição); as desligadas ficam onde estão. */
export function paramsFromUrl(url: string, params: KeyValue[]): KeyValue[] {
  const { query } = splitUrl(url)
  const parsed = query ? parseQuery(query) : []
  const out: KeyValue[] = []
  let next = 0
  for (const row of params) {
    if (!row.enabled || isPathParam(row)) out.push(row)
    else if (next < parsed.length) {
      const p = parsed[next++]!
      out.push({ ...row, key: p.key, value: p.value })
    }
    // Linha ligada que sumiu da URL: removida.
  }
  for (; next < parsed.length; next++) out.push({ key: parsed[next]!.key, value: parsed[next]!.value, enabled: true })
  return out
}

/** Nomes dos path params (:id) no caminho da URL, na ordem, sem repetição. */
export function pathParamNames(url: string): string[] {
  const { base } = splitUrl(url)
  // Só depois de "//host": ":8080" da porta e o "https:" do esquema não contam.
  const afterHost = base.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '')
  const withoutVars = afterHost.replace(/\{\{[^{}]*\}\}/g, '')
  const names: string[] = []
  for (const m of withoutVars.matchAll(/\/:([A-Za-z_][\w-]*)/g)) if (!names.includes(m[1]!)) names.push(m[1]!)
  return names
}

/** Tabela com uma linha ":nome" para cada path param da URL (valores existentes preservados). */
export function withPathParams(url: string, params: KeyValue[]): KeyValue[] {
  const names = pathParamNames(url)
  const kept = params.filter((r) => !isPathParam(r) || names.includes(r.key.slice(1)))
  const have = new Set(kept.filter(isPathParam).map((r) => r.key.slice(1)))
  const added: KeyValue[] = names.filter((n) => !have.has(n)).map((n) => ({ key: `:${n}`, value: '', enabled: true }))
  return added.length || kept.length !== params.length ? [...kept, ...added] : params
}

/**
 * Requisição como vai para o Main: a URL já com os path params trocados e a query igual à tabela; `params`
 * sai vazio para o Main não repetir a query. Se a URL tem query, ela manda (é o que o usuário vê).
 */
export function effectiveRequest(request: ApiRequest): ApiRequest {
  const { base, query, hash } = splitUrl(request.url)
  let path = base
  for (const row of request.params) {
    if (!isPathParam(row) || !row.enabled || row.value === '') continue
    const value = VARIABLE_PART.test(row.value) ? row.value : encodeURIComponent(row.value)
    path = path.replace(new RegExp('(/):' + escapeRe(row.key.slice(1)) + '(?![\\w-])', 'g'), (_m, slash: string) => slash + value)
  }
  // Com query na URL, o texto fica como o usuário escreveu (a codificação é decisão da requisição).
  const q = query ?? serializeQuery(queryRows(request.params))
  return { ...request, url: `${path}${q ? `?${q}` : ''}${hash}`, params: [] }
}
