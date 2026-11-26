// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }))

import { parseImport } from '@shared/api/import'
import { resolveWsdlLocation, WSDL_FILE_LIMITS } from '@shared/api/import/wsdlFiles'
import { collectWsdlFiles } from './wsdlFiles'

const T = 'http://exemplo.com.br/loja'
const XS = 'http://www.w3.org/2001/XMLSchema'

const wsdl = (imports: string): string => `<?xml version="1.0"?>
<wsdl:definitions name="Loja" targetNamespace="${T}" xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xs="${XS}" xmlns:tns="${T}">
  <wsdl:types><xs:schema targetNamespace="${T}">${imports}</xs:schema></wsdl:types>
  <wsdl:message name="In"><wsdl:part name="parameters" element="tns:Pedido"/></wsdl:message>
  <wsdl:portType name="P"><wsdl:operation name="Fazer"><wsdl:input message="tns:In"/></wsdl:operation></wsdl:portType>
  <wsdl:binding name="B" type="tns:P"><soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="Fazer"><soap:operation soapAction="fazer"/><wsdl:input><soap:body use="literal"/></wsdl:input></wsdl:operation></wsdl:binding>
  <wsdl:service name="S"><wsdl:port name="p" binding="tns:B"><soap:address location="http://127.0.0.1:9/loja"/></wsdl:port></wsdl:service>
</wsdl:definitions>`

const importXsd = (loc: string): string => `<xs:import namespace="${T}" schemaLocation="${loc}"/>`

// Pedido (pedido.xsd) usa Cliente (tipos/cliente.xsd), que inclui pedido.xsd de volta: ciclo.
const PEDIDO = `<xs:schema xmlns:xs="${XS}" xmlns:tns="${T}" targetNamespace="${T}" elementFormDefault="qualified">
  <xs:include schemaLocation="tipos/cliente.xsd"/>
  <xs:element name="Pedido"><xs:complexType><xs:sequence><xs:element name="cliente" type="tns:Cliente"/><xs:element name="obs" type="xs:string"/></xs:sequence></xs:complexType></xs:element>
</xs:schema>`
const CLIENTE = `<xs:schema xmlns:xs="${XS}" xmlns:tns="${T}" targetNamespace="${T}">
  <xs:include schemaLocation="../pedido.xsd"/>
  <xs:complexType name="Cliente"><xs:sequence><xs:element name="nome" type="xs:string"/></xs:sequence></xs:complexType>
</xs:schema>`

let dir = ''
let outside = ''

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'wsdl-'))
  outside = mkdtempSync(join(tmpdir(), 'wsdl-fora-'))
  mkdirSync(join(dir, 'tipos'))
  writeFileSync(join(dir, 'pedido.xsd'), PEDIDO)
  writeFileSync(join(dir, 'tipos', 'cliente.xsd'), CLIENTE)
  writeFileSync(join(outside, 'segredo.xsd'), `<xs:schema xmlns:xs="${XS}"/>`)
})
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

async function importFile(name: string, text: string) {
  const path = join(dir, name)
  writeFileSync(path, text)
  const opt = await collectWsdlFiles(path, text)
  return { opt, result: parseImport(text, 'wsdl', opt) }
}

describe('resolveWsdlLocation', () => {
  it('resolve relativo ao arquivo de origem e recusa o que sai da pasta base', () => {
    expect(resolveWsdlLocation('a.wsdl', 'tipos/x.xsd')).toBe('tipos/x.xsd')
    expect(resolveWsdlLocation('tipos/x.xsd', '../pedido.xsd')).toBe('pedido.xsd')
    expect(resolveWsdlLocation('a.wsdl', '../fora.xsd')).toBeNull()
    expect(resolveWsdlLocation('tipos/x.xsd', '../../fora.xsd')).toBeNull()
    expect(resolveWsdlLocation('a.wsdl', 'http://x/y.xsd')).toBeNull()
    expect(resolveWsdlLocation('a.wsdl', 'file:///etc/passwd')).toBeNull()
    expect(resolveWsdlLocation('a.wsdl', 'C:\\x.xsd')).toBeNull()
    expect(resolveWsdlLocation('a.wsdl', '/etc/passwd')).toBeNull()
  })
})

describe('WSDL com import/include', () => {
  it('usa os tipos do XSD importado (com include e ciclo) no envelope modelo', async () => {
    const { opt, result } = await importFile('loja.wsdl', wsdl(importXsd('pedido.xsd')))
    expect(Object.keys(opt.files).sort()).toEqual(['loja.wsdl', 'pedido.xsd', 'tipos/cliente.xsd'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warnings).toEqual([])
    const env = (result.items[0]!.request.body as { envelope: string }).envelope
    expect(env).toContain('<nome>?</nome>')
    expect(env).toContain('<ns1:obs>?</ns1:obs>')
  })

  it('segue wsdl:import e junta mensagens e bindings do arquivo importado', async () => {
    writeFileSync(join(dir, 'parte.wsdl'), wsdl(importXsd('pedido.xsd')))
    const principal = `<wsdl:definitions name="Raiz" targetNamespace="${T}" xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"><wsdl:import namespace="${T}" location="parte.wsdl"/></wsdl:definitions>`
    const { result } = await importFile('raiz.wsdl', principal)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.items).toHaveLength(1)
    expect((result.items[0]!.request.body as { envelope: string }).envelope).toContain('<nome>?</nome>')
  })

  it('recusa URLs e caminhos que saem da pasta, com aviso, sem erro', async () => {
    const refs = ['http://exemplo.com.br/a.xsd', 'file:///etc/passwd', `../${outside.split(/[\\/]/).pop()}/segredo.xsd`, 'nao-existe.xsd']
    const { opt, result } = await importFile('ruim.wsdl', wsdl(refs.map((r) => `<xs:import schemaLocation="${r}"/>`).join('')))
    expect(Object.keys(opt.files)).toEqual(['ruim.wsdl'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warnings).toEqual(expect.arrayContaining(['wsdlImportRemote', 'wsdlImportNotFound']))
  })

  it('não segue link simbólico que aponta para fora da pasta', async () => {
    try {
      symlinkSync(join(outside, 'segredo.xsd'), join(dir, 'link.xsd'))
    } catch {
      return // sem permissão para criar links (Windows comum)
    }
    const { opt } = await importFile('link.wsdl', wsdl('<xs:import schemaLocation="link.xsd"/>'))
    expect(Object.keys(opt.files)).toEqual(['link.wsdl'])
  })

  it('respeita os limites de profundidade e de arquivos', async () => {
    const chain = mkdtempSync(join(tmpdir(), 'wsdl-cadeia-'))
    try {
      for (let i = 1; i <= 15; i++) {
        const next = i < 15 ? `<xs:include schemaLocation="c${i + 1}.xsd"/>` : ''
        writeFileSync(join(chain, `c${i}.xsd`), `<xs:schema xmlns:xs="${XS}">${next}</xs:schema>`)
      }
      const text = wsdl('<xs:include schemaLocation="c1.xsd"/>')
      writeFileSync(join(chain, 'cadeia.wsdl'), text)
      const opt = await collectWsdlFiles(join(chain, 'cadeia.wsdl'), text)
      expect(Object.keys(opt.files)).toHaveLength(WSDL_FILE_LIMITS.depth + 1)
      const r = parseImport(text, 'wsdl', opt)
      expect(r.ok && r.warnings).toContain('wsdlImportLimit')

      const many = Array.from({ length: 60 }, (_, i) => {
        writeFileSync(join(chain, `m${i}.xsd`), `<xs:schema xmlns:xs="${XS}"/>`)
        return `<xs:include schemaLocation="m${i}.xsd"/>`
      }).join('')
      const t2 = wsdl(many)
      writeFileSync(join(chain, 'muitos.wsdl'), t2)
      const o2 = await collectWsdlFiles(join(chain, 'muitos.wsdl'), t2)
      expect(Object.keys(o2.files)).toHaveLength(WSDL_FILE_LIMITS.files)
      expect(o2.warnings).toContain('wsdlImportLimit')
    } finally {
      rmSync(chain, { recursive: true, force: true })
    }
  })

  it('WSDL colado como texto: imports viram aviso', () => {
    const r = parseImport(wsdl('<xs:import schemaLocation="pedido.xsd"/>'), 'wsdl')
    expect(r.ok && r.warnings).toContain('wsdlImportNoBase')
  })
})
