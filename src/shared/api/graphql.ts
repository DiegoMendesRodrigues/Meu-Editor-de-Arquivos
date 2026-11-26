// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Lógica pura do GraphQL do Cliente de API: query de introspecção, modelo simples do schema,
 * autocompletar pela pilha de seleções e extração das operações. Sem dependências de Monaco ou React.
 */

/** Query de introspecção padrão (a mesma que as ferramentas GraphQL costumam enviar). */
export const INTROSPECTION_QUERY = `query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types { ...FullType }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args { ...InputValue }
    type { ...TypeRef }
    isDeprecated
    deprecationReason
  }
  inputFields { ...InputValue }
  interfaces { ...TypeRef }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes { ...TypeRef }
}

fragment InputValue on __InputValue {
  name
  description
  type { ...TypeRef }
  defaultValue
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType { kind name }
            }
          }
        }
      }
    }
  }
}`

/* ------------------------------------------------------------------ modelo */

export type GqlKind = 'SCALAR' | 'OBJECT' | 'INTERFACE' | 'UNION' | 'ENUM' | 'INPUT_OBJECT' | 'LIST' | 'NON_NULL'

/** Referência a um tipo: `display` é a forma escrita (ex.: [User!]!), `base` o tipo nomeado de dentro. */
export interface GqlTypeRef {
  display: string
  base: string
}

export interface GqlArg {
  name: string
  description: string
  type: GqlTypeRef
  defaultValue?: string
  /** Tipo não nulo e sem valor padrão: precisa ser informado. */
  required: boolean
}

export interface GqlField {
  name: string
  description: string
  args: GqlArg[]
  type: GqlTypeRef
  deprecated: boolean
}

export interface GqlEnumValue {
  name: string
  description: string
  deprecated: boolean
}

export interface GqlType {
  name: string
  kind: Exclude<GqlKind, 'LIST' | 'NON_NULL'>
  description: string
  fields: GqlField[]
  inputFields: GqlArg[]
  enumValues: GqlEnumValue[]
  possibleTypes: string[]
  interfaces: string[]
}

export interface GqlSchemaModel {
  queryType: string | null
  mutationType: string | null
  subscriptionType: string | null
  types: Record<string, GqlType>
}

const NAMED_KINDS = new Set(['SCALAR', 'OBJECT', 'INTERFACE', 'UNION', 'ENUM', 'INPUT_OBJECT'])

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Converte o `ofType` aninhado da introspecção em texto e tipo nomeado; null se a cadeia for inválida. */
function readTypeRef(raw: unknown, depth = 0): { ref: GqlTypeRef; base: string } | null {
  if (!isObj(raw) || depth > 12) return null
  const kind = raw.kind
  if (kind === 'NON_NULL' || kind === 'LIST') {
    const inner = readTypeRef(raw.ofType, depth + 1)
    if (!inner) return null
    const display = kind === 'NON_NULL' ? `${inner.ref.display}!` : `[${inner.ref.display}]`
    return { ref: { display, base: inner.base }, base: inner.base }
  }
  if (typeof kind === 'string' && NAMED_KINDS.has(kind) && typeof raw.name === 'string') {
    return { ref: { display: raw.name, base: raw.name }, base: raw.name }
  }
  return null
}

function readArgs(raw: unknown): GqlArg[] {
  if (!Array.isArray(raw)) return []
  const out: GqlArg[] = []
  for (const a of raw) {
    if (!isObj(a) || typeof a.name !== 'string') continue
    const t = readTypeRef(a.type)
    if (!t) continue
    const defaultValue = typeof a.defaultValue === 'string' ? a.defaultValue : undefined
    out.push({
      name: a.name,
      description: str(a.description),
      type: t.ref,
      defaultValue,
      required: t.ref.display.endsWith('!') && defaultValue === undefined
    })
  }
  return out
}

/** Aceita o corpo completo da resposta ({ data: { __schema } }), { data } ou o próprio { __schema }. */
export function parseIntrospection(input: unknown): GqlSchemaModel | null {
  let root: unknown = input
  if (isObj(root) && 'data' in root) root = root.data
  if (!isObj(root) || !isObj(root.__schema)) return null
  const schema = root.__schema
  if (!Array.isArray(schema.types)) return null

  const types: Record<string, GqlType> = {}
  for (const raw of schema.types) {
    if (!isObj(raw) || typeof raw.name !== 'string' || typeof raw.kind !== 'string' || !NAMED_KINDS.has(raw.kind)) continue
    const fields: GqlField[] = []
    if (Array.isArray(raw.fields)) {
      for (const f of raw.fields) {
        if (!isObj(f) || typeof f.name !== 'string') continue
        const t = readTypeRef(f.type)
        if (!t) continue
        fields.push({ name: f.name, description: str(f.description), args: readArgs(f.args), type: t.ref, deprecated: f.isDeprecated === true })
      }
    }
    const names = (list: unknown): string[] =>
      Array.isArray(list) ? list.filter(isObj).map((x) => str(x.name)).filter((n) => n !== '') : []
    const enumValues: GqlEnumValue[] = Array.isArray(raw.enumValues)
      ? raw.enumValues
          .filter(isObj)
          .filter((e) => typeof e.name === 'string')
          .map((e) => ({ name: e.name as string, description: str(e.description), deprecated: e.isDeprecated === true }))
      : []
    types[raw.name] = {
      name: raw.name,
      kind: raw.kind as GqlType['kind'],
      description: str(raw.description),
      fields,
      inputFields: readArgs(raw.inputFields),
      enumValues,
      possibleTypes: names(raw.possibleTypes),
      interfaces: names(raw.interfaces)
    }
  }
  if (Object.keys(types).length === 0) return null

  const rootName = (v: unknown): string | null => (isObj(v) && typeof v.name === 'string' ? v.name : null)
  return {
    queryType: rootName(schema.queryType),
    mutationType: rootName(schema.mutationType),
    subscriptionType: rootName(schema.subscriptionType),
    types
  }
}

export type IntrospectionParseResult = { ok: true; model: GqlSchemaModel } | { ok: false; code: 'notGraphql' | 'introspectionDisabled' | 'invalidSchema' }

/** Lê o texto da resposta HTTP da introspecção e diz, por código, o que deu errado. */
export function parseIntrospectionResponse(text: string): IntrospectionParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, code: 'notGraphql' }
  }
  if (!isObj(data)) return { ok: false, code: 'notGraphql' }
  const payload = data.data
  if (isObj(payload) && '__schema' in payload) {
    const model = parseIntrospection(data)
    return model ? { ok: true, model } : { ok: false, code: 'invalidSchema' }
  }
  // Servidor GraphQL de verdade, mas sem schema: erros no formato padrão ({ errors: [...] }).
  if (Array.isArray(data.errors) || payload === null) return { ok: false, code: 'introspectionDisabled' }
  return { ok: false, code: 'notGraphql' }
}

/* ------------------------------------------------------------------ tokens */

type TokenKind = 'name' | 'punct' | 'value'
interface Token {
  kind: TokenKind
  text: string
}

/** Quebra o texto em nomes, pontuação e valores (strings e números); ignora comentários e vírgulas. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',' || c === '﻿') {
      i++
    } else if (c === '#') {
      while (i < n && text[i] !== '\n' && text[i] !== '\r') i++
    } else if (c === '"') {
      if (text.startsWith('"""', i)) {
        const end = text.indexOf('"""', i + 3)
        i = end === -1 ? n : end + 3
      } else {
        i++
        while (i < n && text[i] !== '"' && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1
        i++
      }
      tokens.push({ kind: 'value', text: '"' })
    } else if (c === '.' && text.startsWith('...', i)) {
      tokens.push({ kind: 'punct', text: '...' })
      i += 3
    } else if (/[_A-Za-z]/.test(c)) {
      let j = i + 1
      while (j < n && /[_0-9A-Za-z]/.test(text[j])) j++
      tokens.push({ kind: 'name', text: text.slice(i, j) })
      i = j
    } else if (/[-0-9]/.test(c)) {
      let j = i + 1
      while (j < n && /[0-9.eE+-]/.test(text[j])) j++
      tokens.push({ kind: 'value', text: text.slice(i, j) })
      i = j
    } else {
      tokens.push({ kind: 'punct', text: c })
      i++
    }
  }
  return tokens
}

/* ------------------------------------------------------------------ operações */

export interface GqlOperation {
  type: 'query' | 'mutation' | 'subscription'
  /** null para operação anônima. */
  name: string | null
}

const OPERATION_KEYWORDS = new Set(['query', 'mutation', 'subscription'])

/** Operações do documento (para escolher o operationName). Só olha o nível mais externo. */
export function extractOperations(text: string): GqlOperation[] {
  const tokens = tokenize(text)
  const ops: GqlOperation[] = []
  let depth = 0
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.kind === 'punct') {
      // `{ ... }` solto no nível externo (início ou depois de outra definição) é uma query anônima.
      if (t.text === '{' && depth === 0 && (i === 0 || tokens[i - 1].text === '}')) ops.push({ type: 'query', name: null })
      if (t.text === '{' || t.text === '(' || t.text === '[') depth++
      else if (t.text === '}' || t.text === ')' || t.text === ']') depth = Math.max(0, depth - 1)
      continue
    }
    if (depth === 0 && t.kind === 'name' && OPERATION_KEYWORDS.has(t.text)) {
      const next = tokens[i + 1]
      const name = next && next.kind === 'name' ? next.text : null
      ops.push({ type: t.text as GqlOperation['type'], name })
    }
  }
  return ops
}

/* ------------------------------------------------------------------ autocompletar */

export type GqlCompletionKind = 'field' | 'argument' | 'type' | 'enum' | 'keyword'

export interface GqlCompletion {
  label: string
  kind: GqlCompletionKind
  /** Tipo do campo ou do argumento, para o detalhe da sugestão. */
  detail?: string
  documentation?: string
  /** Texto a inserir (sintaxe de snippet do Monaco: $0, ${1:x}); sem ele vale o label. */
  insertText?: string
}

type Frame =
  | { kind: 'selection'; type: string | null; lastField: string | null }
  | { kind: 'args'; type: string | null; field: string | null; used: Set<string>; current: string | null; afterColon: boolean }
  | { kind: 'skip'; bracket: string }

const ROOT_KEYWORDS = ['query', 'mutation', 'subscription', 'fragment']

const isComposite = (t: GqlType | undefined): boolean => !!t && (t.kind === 'OBJECT' || t.kind === 'INTERFACE' || t.kind === 'UNION')

/** Texto para inserir um campo (com argumentos obrigatórios e, se for composto, um bloco de seleção). */
export function fieldSnippet(model: GqlSchemaModel | null, field: GqlField): string {
  let out = field.name
  const required = field.args.filter((a) => a.required)
  if (required.length > 0) {
    out += `(${required.map((a, i) => `${a.name}: \${${i + 1}}`).join(', ')})`
  }
  if (isComposite(model?.types[field.type.base])) out += ` {\n  $0\n}`
  return out
}

/** O mesmo texto sem marcadores de snippet, para inserir direto no editor. */
export function fieldPlainText(model: GqlSchemaModel | null, field: GqlField): string {
  return fieldSnippet(model, field).replace(/\$\{\d+\}/g, '').replace(/\$0/g, '')
}

function fieldItems(model: GqlSchemaModel, typeName: string | null): GqlCompletion[] {
  if (!typeName) return []
  const type = model.types[typeName]
  if (!type) return []
  const items: GqlCompletion[] = []
  if (type.kind === 'OBJECT' || type.kind === 'INTERFACE') {
    for (const f of type.fields) {
      items.push({
        label: f.name,
        kind: 'field',
        detail: f.type.display,
        documentation: f.description || undefined,
        insertText: fieldSnippet(model, f)
      })
    }
  }
  if (type.kind === 'OBJECT' || type.kind === 'INTERFACE' || type.kind === 'UNION') {
    items.push({ label: '__typename', kind: 'field', detail: 'String!' })
  }
  if (type.kind === 'INTERFACE' || type.kind === 'UNION') {
    for (const p of type.possibleTypes) {
      items.push({ label: `... on ${p}`, kind: 'type', detail: p, insertText: `... on ${p} {\n  $0\n}` })
    }
  }
  return items
}

function argItems(model: GqlSchemaModel, typeName: string | null, fieldName: string | null, used: Set<string>): GqlCompletion[] {
  if (!typeName || !fieldName) return []
  const field = model.types[typeName]?.fields.find((f) => f.name === fieldName)
  if (!field) return []
  return field.args
    .filter((a) => !used.has(a.name))
    .map((a) => ({
      label: a.name,
      kind: 'argument' as const,
      detail: a.type.display,
      documentation: a.description || undefined,
      insertText: `${a.name}: `
    }))
}

function valueItems(model: GqlSchemaModel, typeName: string | null, fieldName: string | null, argName: string | null): GqlCompletion[] {
  if (!typeName || !fieldName || !argName) return []
  const arg = model.types[typeName]?.fields.find((f) => f.name === fieldName)?.args.find((a) => a.name === argName)
  if (!arg) return []
  const base = model.types[arg.type.base]
  if (base?.kind === 'ENUM') {
    return base.enumValues.map((e) => ({ label: e.name, kind: 'enum' as const, detail: base.name, documentation: e.description || undefined }))
  }
  if (arg.type.base === 'Boolean') {
    return ['true', 'false'].map((v) => ({ label: v, kind: 'enum' as const, detail: 'Boolean' }))
  }
  return []
}

function typeItems(model: GqlSchemaModel, within: string | null): GqlCompletion[] {
  const outer = within ? model.types[within] : undefined
  const names =
    outer && outer.possibleTypes.length > 0
      ? outer.possibleTypes
      : Object.values(model.types)
          .filter((t) => t.kind === 'OBJECT' || t.kind === 'INTERFACE' || t.kind === 'UNION')
          .filter((t) => !t.name.startsWith('__'))
          .map((t) => t.name)
  return names.map((name) => ({ label: name, kind: 'type' as const, documentation: model.types[name]?.description || undefined }))
}

/**
 * Sugestões para a posição `offset` do texto. A palavra parcial à esquerda do cursor é ignorada na
 * análise (o Monaco filtra pelo prefixo); o contexto vem da pilha de seleções, argumentos e blocos.
 */
export function getCompletions(model: GqlSchemaModel | null, text: string, offset: number): GqlCompletion[] {
  const before = text.slice(0, Math.max(0, Math.min(offset, text.length)))
  const tokens = tokenize(before.replace(/[_0-9A-Za-z]*$/, ''))
  const keywordFallback = (): GqlCompletion[] => ROOT_KEYWORDS.map((k) => ({ label: k, kind: 'keyword' as const }))

  const stack: Frame[] = []
  let topOp: GqlOperation['type'] | null = null
  /** Tipo do `fragment X on T` ou `... on T` à espera da chave de abertura. */
  let pendingInline: string | null = null
  let expectType = false
  let spread = false
  let directive = false
  let fragmentTop = false
  let fragmentType: string | null = null

  const rootFor = (op: GqlOperation['type'] | null): string | null => {
    if (!model) return null
    if (op === 'mutation') return model.mutationType
    if (op === 'subscription') return model.subscriptionType
    return model.queryType
  }
  const top = (): Frame | undefined => stack[stack.length - 1]
  /** Depois de um valor completo, o argumento deixa de esperar valor. */
  const valueDone = (): void => {
    const f = top()
    if (f && f.kind === 'args') f.afterColon = false
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const f = top()
    if (t.kind === 'name') {
      if (stack.length === 0) {
        if (OPERATION_KEYWORDS.has(t.text)) {
          topOp = t.text as GqlOperation['type']
          fragmentTop = false
        } else if (t.text === 'fragment') {
          fragmentTop = true
          topOp = null
        } else if (t.text === 'on' && fragmentTop) {
          expectType = true
        } else if (expectType) {
          fragmentType = t.text
          expectType = false
        }
      } else if (f?.kind === 'selection') {
        if (directive) {
          directive = false
        } else if (spread && t.text === 'on') {
          expectType = true
        } else if (expectType) {
          pendingInline = t.text
          expectType = false
          spread = false
        } else if (spread) {
          spread = false // espalhamento de fragmento nomeado (...Nome)
          f.lastField = null
        } else {
          f.lastField = t.text
        }
      } else if (f?.kind === 'args') {
        if (f.afterColon) f.afterColon = false
        else f.current = t.text
      }
      continue
    }
    if (t.kind === 'value') {
      if (f?.kind === 'args') f.afterColon = false
      continue
    }
    // pontuação
    switch (t.text) {
      case '{': {
        if (f?.kind === 'selection') {
          let next: string | null = null
          if (pendingInline) next = pendingInline
          else if (spread) next = f.type // `... {` e `... @dir {`
          else if (f.lastField && f.type) {
            const field = model?.types[f.type]?.fields.find((x) => x.name === f.lastField)
            next = field ? field.type.base : null
          }
          f.lastField = null
          stack.push({ kind: 'selection', type: next, lastField: null })
        } else if (stack.length === 0) {
          stack.push({ kind: 'selection', type: fragmentTop ? fragmentType : rootFor(topOp), lastField: null })
        } else {
          stack.push({ kind: 'skip', bracket: '{' })
        }
        pendingInline = null
        spread = false
        expectType = false
        break
      }
      case '}': {
        const popped = stack.pop()
        if (popped && stack.length === 0) {
          topOp = null
          fragmentTop = false
          fragmentType = null
        }
        valueDone()
        break
      }
      case '(': {
        if (f?.kind === 'selection') {
          const useField = !directive && f.lastField
          stack.push({ kind: 'args', type: useField ? f.type : null, field: useField ? f.lastField : null, used: new Set(), current: null, afterColon: false })
          directive = false
        } else {
          stack.push({ kind: 'skip', bracket: '(' })
        }
        break
      }
      case ')': {
        stack.pop()
        break
      }
      case '[': {
        stack.push({ kind: 'skip', bracket: '[' })
        break
      }
      case ']': {
        stack.pop()
        valueDone()
        break
      }
      case ':': {
        if (f?.kind === 'args') {
          f.afterColon = true
          if (f.current) f.used.add(f.current)
        }
        break
      }
      case '@': {
        directive = true
        break
      }
      case '...': {
        spread = true
        break
      }
      case '$': {
        break
      }
      default:
        break
    }
  }

  if (!model) return stack.length === 0 ? keywordFallback() : []
  const f = top()
  if (!f) {
    if (expectType) return typeItems(model, null)
    return keywordFallback()
  }
  if (f.kind === 'selection') {
    if (expectType) return typeItems(model, f.type)
    return fieldItems(model, f.type)
  }
  if (f.kind === 'args') {
    if (f.afterColon) return valueItems(model, f.type, f.field, f.current)
    return argItems(model, f.type, f.field, f.used)
  }
  return []
}
