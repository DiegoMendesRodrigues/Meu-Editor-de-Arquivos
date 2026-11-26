// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Importar WSDL 1.1: uma requisição SOAP por operação, com o envelope modelo montado a partir da
 * mensagem de entrada (elementos do schema com "?" como valor de exemplo) e o soap:address como URL.
 */
import { parseXmlSafe } from '../xmlSafe'
import { API_LIMITS as L } from '../limits'
import { ImportError, Warnings, clip, makeRequest, type ParsedImport } from './common'
import { WSDL_FILE_LIMITS, isRemoteOrAbsolute, listWsdlReferences, resolveWsdlLocation, type WsdlFilesOption } from './wsdlFiles'

// Os tipos DOM vêm do próprio xmldom (o tsconfig do Main não inclui a lib DOM).
type El = ReturnType<typeof parseXmlSafe>['documentElement']

const NS_SOAP11 = 'http://schemas.xmlsoap.org/wsdl/soap/'
const NS_SOAP12 = 'http://schemas.xmlsoap.org/wsdl/soap12/'
const ENV_NS = { '1.1': 'http://schemas.xmlsoap.org/soap/envelope/', '1.2': 'http://www.w3.org/2003/05/soap-envelope' } as const
const XSD_NS = 'http://www.w3.org/2001/XMLSchema'
const MAX_OPERATIONS = 2000
const MAX_DEPTH = 6
const MAX_NODES = 400

const allKids = (el: El): El[] => {
  const out: El[] = []
  for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n as El)
  return out
}
const kids = (el: El, local: string): El[] => allKids(el).filter((n) => n.localName === local)
const attr = (el: El, name: string): string => el.getAttribute(name) ?? ''

/** "prefixo:local" -> { ns, local }, resolvendo o prefixo pelos xmlns do próprio documento. */
function qname(el: El, value: string): { ns: string; local: string } {
  const i = value.indexOf(':')
  const prefix = i < 0 ? null : value.slice(0, i)
  return { ns: el.lookupNamespaceURI(prefix) ?? '', local: i < 0 ? value : value.slice(i + 1) }
}

interface SchemaInfo { tns: string; qualified: boolean }
interface Indexed { el: El; schema: SchemaInfo }
interface TreeNode { name: string; ns: string; children: TreeNode[]; text: boolean }

class SchemaIndex {
  elements = new Map<string, Indexed>()
  types = new Map<string, Indexed>()
  constructor(schemas: { el: El; tns: string }[]) {
    for (const { el: schema, tns } of schemas) {
      const info = { tns, qualified: attr(schema, 'elementFormDefault') === 'qualified' }
      for (const e of kids(schema, 'element')) this.elements.set(`${info.tns}|${attr(e, 'name')}`, { el: e, schema: info })
      for (const t of [...kids(schema, 'complexType'), ...kids(schema, 'simpleType')]) this.types.set(`${info.tns}|${attr(t, 'name')}`, { el: t, schema: info })
    }
  }

  /** Árvore de um elemento, com limite de profundidade e de nós contra ciclos. */
  build(e: Indexed, nodes: { n: number }, depth: number, global: boolean): TreeNode | null {
    if (nodes.n++ > MAX_NODES) return null
    const ref = attr(e.el, 'ref')
    if (ref) {
      const q = qname(e.el, ref)
      const target = this.elements.get(`${q.ns}|${q.local}`)
      return target ? this.build(target, nodes, depth, true) : { name: q.local, ns: q.ns, children: [], text: true }
    }
    const node: TreeNode = { name: attr(e.el, 'name'), ns: global || e.schema.qualified || attr(e.el, 'form') === 'qualified' ? e.schema.tns : '', children: [], text: true }
    let complex: Indexed | null = null
    const inline = kids(e.el, 'complexType')[0]
    if (inline) complex = { el: inline, schema: e.schema }
    else if (attr(e.el, 'type')) {
      const q = qname(e.el, attr(e.el, 'type'))
      const t = q.ns === XSD_NS ? undefined : this.types.get(`${q.ns}|${q.local}`)
      if (t && t.el.localName === 'complexType') complex = t
    }
    if (complex && depth < MAX_DEPTH) {
      this.collect(complex, node, nodes, depth)
      if (node.children.length > 0) node.text = false
    }
    return node
  }

  private collect(ct: Indexed, into: TreeNode, nodes: { n: number }, depth: number): void {
    for (const c of allKids(ct.el)) {
      switch (c.localName) {
        case 'sequence':
        case 'all':
        case 'choice':
        case 'complexContent':
          this.collect({ el: c, schema: ct.schema }, into, nodes, depth)
          break
        case 'extension': {
          const q = qname(c, attr(c, 'base'))
          const base = this.types.get(`${q.ns}|${q.local}`)
          if (base && base.el.localName === 'complexType' && depth < MAX_DEPTH) this.collect(base, into, nodes, depth + 1)
          this.collect({ el: c, schema: ct.schema }, into, nodes, depth)
          break
        }
        case 'element': {
          const child = this.build({ el: c, schema: ct.schema }, nodes, depth + 1, false)
          if (child) into.children.push(child)
          break
        }
        default:
          break
      }
    }
  }
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Serializa a árvore com prefixos ns1, ns2... declarados no Envelope. */
function envelope(version: '1.1' | '1.2', body: TreeNode[]): string {
  const prefixes = new Map<string, string>()
  const pref = (ns: string): string => {
    if (!ns) return ''
    if (!prefixes.has(ns)) prefixes.set(ns, `ns${prefixes.size + 1}`)
    return prefixes.get(ns)!
  }
  const render = (n: TreeNode, ind: string): string => {
    const p = pref(n.ns)
    const name = n.name.replace(/[^\p{L}\p{N}_.-]/gu, '_') // o nome vem de atributo do WSDL: não deixa virar marcação
    const tag = p ? `${p}:${name}` : name
    if (n.children.length === 0) return `${ind}<${tag}>${n.text ? '?' : ''}</${tag}>`
    return `${ind}<${tag}>\n${n.children.map((c) => render(c, ind + '  ')).join('\n')}\n${ind}</${tag}>`
  }
  const inner = body.map((n) => render(n, '    ')).join('\n')
  const decl = [...prefixes].map(([ns, p]) => ` xmlns:${p}="${esc(ns)}"`).join('')
  return `<soap:Envelope xmlns:soap="${ENV_NS[version]}"${decl}>\n  <soap:Header/>\n  <soap:Body>\n${inner}\n  </soap:Body>\n</soap:Envelope>`
}

interface BindingOp { name: string; action: string; style: string; inputNs: string }

const isSoapNs = (ns: string | null): boolean => ns === NS_SOAP11 || ns === NS_SOAP12

export function parseWsdl(text: string, opts?: WsdlFilesOption): ParsedImport {
  let root: El
  try {
    root = parseXmlSafe(text, L.importChars).documentElement
  } catch {
    throw new ImportError('invalid')
  }
  if (root.localName !== 'definitions') throw new ImportError('invalid') // inclui WSDL 2.0 ("description")
  const warnings = new Warnings()
  for (const w of opts?.warnings ?? []) warnings.add(w)
  const tns = attr(root, 'targetNamespace')

  // Documentos (WSDL principal + wsdl:import) e schemas (inline + xsd:import/include), lidos do mapa de arquivos.
  const defs: El[] = []
  const schemaList: { el: El; tns: string }[] = []
  const mainKey = opts?.mainKey ?? ''
  const visited = new Set<string>([mainKey])
  const parsed = new Map<string, El | null>()
  const load = (key: string): El | null => {
    if (parsed.has(key)) return parsed.get(key) ?? null
    const src = opts?.files[key]
    let el: El | null = null
    if (src !== undefined) {
      try {
        el = parseXmlSafe(src, L.importChars).documentElement
      } catch {
        el = null
      }
    }
    parsed.set(key, el)
    return el
  }
  /** Segue uma referência: avisa o que não pode ser lido e entrega o documento novo (sem repetir nem ciclar). */
  const follow = (fromKey: string, location: string, depth: number, use: (doc: El, key: string) => void): void => {
    if (!opts) {
      warnings.add('wsdlImportNoBase')
      return
    }
    if (isRemoteOrAbsolute(location.trim())) return void warnings.add('wsdlImportRemote')
    const key = resolveWsdlLocation(fromKey, location)
    if (key === null) return void warnings.add('wsdlImportNotFound')
    if (visited.has(key)) return
    if (depth > WSDL_FILE_LIMITS.depth) return void warnings.add('wsdlImportLimit')
    const doc = load(key)
    if (!doc) return void warnings.add('wsdlImportNotFound')
    visited.add(key)
    use(doc, key)
  }
  const gatherSchema = (schema: El, key: string, depth: number, inherited: string): void => {
    // include de schema sem targetNamespace herda o de quem incluiu.
    const stns = attr(schema, 'targetNamespace') || inherited
    schemaList.push({ el: schema, tns: stns })
    for (const tag of ['import', 'include', 'redefine']) {
      for (const ref of kids(schema, tag)) {
        const loc = attr(ref, 'schemaLocation')
        if (loc.trim() === '') continue
        follow(key, loc, depth + 1, (doc, k) => {
          if (doc.localName === 'schema') gatherSchema(doc, k, depth + 1, tag === 'import' ? '' : stns)
          else warnings.add('wsdlImportNotFound')
        })
      }
    }
  }
  const gatherDefs = (def: El, key: string, depth: number): void => {
    defs.push(def)
    for (const types of kids(def, 'types')) for (const schema of kids(types, 'schema')) gatherSchema(schema, key, depth, '')
    for (const imp of kids(def, 'import')) {
      const loc = attr(imp, 'location')
      if (loc.trim() === '') continue
      follow(key, loc, depth + 1, (doc, k) => {
        if (doc.localName === 'definitions') gatherDefs(doc, k, depth + 1)
        else if (doc.localName === 'schema') gatherSchema(doc, k, depth + 1, '')
        else warnings.add('wsdlImportNotFound')
      })
    }
  }
  gatherDefs(root, mainKey, 0)
  if (!opts && listWsdlReferences(root).length > 0) warnings.add('wsdlImportNoBase')

  const schemas = new SchemaIndex(schemaList)
  const all = (local: string): El[] => defs.flatMap((d) => kids(d, local))
  const messages = new Map(all('message').map((m) => [attr(m, 'name'), m]))
  const portTypes = new Map(all('portType').map((p) => [attr(p, 'name'), p]))
  const bindings = all('binding')

  // Corpo de entrada de uma operação do portType.
  const inputBody = (portType: El | undefined, opName: string, style: string, inputNs: string): TreeNode[] => {
    const op = portType ? kids(portType, 'operation').find((o) => attr(o, 'name') === opName) : undefined
    const input = op ? kids(op, 'input')[0] : undefined
    const msg = input ? messages.get(qname(input, attr(input, 'message')).local) : undefined
    const nodes = { n: 0 }
    const out: TreeNode[] = []
    const rpc = style === 'rpc'
    const wrapper: TreeNode = { name: opName, ns: inputNs || tns, children: [], text: false }
    for (const part of msg ? kids(msg, 'part') : []) {
      let node: TreeNode | null
      if (attr(part, 'element')) {
        const q = qname(part, attr(part, 'element'))
        const e = schemas.elements.get(`${q.ns}|${q.local}`)
        node = e ? schemas.build(e, nodes, 0, true) : { name: q.local, ns: q.ns, children: [], text: true }
      } else {
        node = { name: attr(part, 'name'), ns: '', children: [], text: true }
      }
      if (node) (rpc ? wrapper.children : out).push(node)
    }
    return rpc ? [wrapper] : out
  }

  const bindingOps = new Map<string, { version: '1.1' | '1.2'; ops: BindingOp[]; portType: El | undefined }>()
  for (const b of bindings) {
    const sbs = kids(b, 'binding').filter((x) => isSoapNs(x.namespaceURI))
    const sb = sbs.find((x) => x.namespaceURI === NS_SOAP12) ?? sbs[0]
    if (!sb) {
      warnings.add('wsdlUnsupported')
      continue
    }
    const defaultStyle = attr(sb, 'style') || 'document'
    const ops: BindingOp[] = kids(b, 'operation').map((o) => {
      const so = allKids(o).find((x) => x.localName === 'operation' && isSoapNs(x.namespaceURI))
      const input = kids(o, 'input')[0]
      const bodyEl = input ? allKids(input).find((x) => x.localName === 'body') : undefined
      return { name: attr(o, 'name'), action: so ? attr(so, 'soapAction') : '', style: (so && attr(so, 'style')) || defaultStyle, inputNs: bodyEl ? attr(bodyEl, 'namespace') : '' }
    })
    bindingOps.set(attr(b, 'name'), { version: sb.namespaceURI === NS_SOAP12 ? '1.2' : '1.1', ops, portType: portTypes.get(qname(b, attr(b, 'type')).local) })
  }

  // Cada porta SOAP (service/port) liga um binding a um endereço.
  const targets: { service: string; binding: string; url: string; version: '1.1' | '1.2' }[] = []
  for (const s of all('service')) {
    for (const p of kids(s, 'port')) {
      const addr = allKids(p).find((x) => x.localName === 'address' && isSoapNs(x.namespaceURI))
      const binding = qname(p, attr(p, 'binding')).local
      if (addr && bindingOps.has(binding)) targets.push({ service: attr(s, 'name'), binding, url: attr(addr, 'location'), version: addr.namespaceURI === NS_SOAP12 ? '1.2' : '1.1' })
    }
  }
  const used = new Set(targets.map((t) => t.binding))
  for (const [name, b] of bindingOps) {
    if (!used.has(name)) {
      warnings.add('wsdlNoAddress')
      targets.push({ service: '', binding: name, url: '', version: b.version })
    }
  }
  if (targets.length === 0) throw new ImportError('invalid')

  const items: ParsedImport['items'] = []
  const names = new Map<string, number>()
  const services = new Set(targets.map((t) => t.service))
  for (const t of targets) {
    const b = bindingOps.get(t.binding)!
    for (const op of b.ops) {
      if (items.length >= MAX_OPERATIONS) {
        warnings.add('truncated')
        break
      }
      const base = clip(op.name, L.nameChars)
      const count = (names.get(`${t.service}|${base}`) ?? 0) + 1
      names.set(`${t.service}|${base}`, count)
      const name = count > 1 ? clip(`${base} (SOAP ${t.version})`, L.nameChars) : base
      const envelopeText = clip(envelope(t.version, inputBody(b.portType, op.name, op.style, op.inputNs)), L.bodyChars)
      items.push({
        folder: services.size > 1 ? t.service.replace(/[\\/:*?"<>|]+/g, '-') : '',
        request: makeRequest({ name, method: 'POST', url: t.url, body: { type: 'soap', version: t.version, action: clip(op.action, L.valueChars), envelope: envelopeText } }, warnings)
      })
    }
  }
  const name = attr(root, 'name') || [...services].find(Boolean) || 'WSDL'
  return { name: clip(name, L.nameChars), items, environments: [], variables: [], warnings: warnings.list() }
}
