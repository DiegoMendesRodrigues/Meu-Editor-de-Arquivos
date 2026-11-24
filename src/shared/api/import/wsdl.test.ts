// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { apiRequestSchema } from '../schema'
import { detectFormat, parseImport } from './index'

const T = 'http://exemplo.com.br/loja'

/** WSDL 1.1 fictício: document/literal em SOAP 1.1 (SomarPedido) e uma porta SOAP 1.2. */
const WSDL = `<?xml version="1.0" encoding="UTF-8"?>
<wsdl:definitions name="Loja" targetNamespace="${T}"
  xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:soap12="http://schemas.xmlsoap.org/wsdl/soap12/" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:tns="${T}">
  <wsdl:types>
    <xs:schema targetNamespace="${T}" elementFormDefault="qualified">
      <xs:element name="SomarPedido">
        <xs:complexType><xs:sequence>
          <xs:element name="cliente" type="xs:string"/>
          <xs:element name="itens" type="tns:Itens"/>
        </xs:sequence></xs:complexType>
      </xs:element>
      <xs:complexType name="Itens"><xs:sequence><xs:element name="codigo" type="xs:int" maxOccurs="unbounded"/></xs:sequence></xs:complexType>
      <xs:element name="SomarPedidoResponse"><xs:complexType><xs:sequence><xs:element name="total" type="xs:decimal"/></xs:sequence></xs:complexType></xs:element>
    </xs:schema>
  </wsdl:types>
  <wsdl:message name="SomarIn"><wsdl:part name="parameters" element="tns:SomarPedido"/></wsdl:message>
  <wsdl:message name="SomarOut"><wsdl:part name="parameters" element="tns:SomarPedidoResponse"/></wsdl:message>
  <wsdl:portType name="LojaPort">
    <wsdl:operation name="SomarPedido"><wsdl:input message="tns:SomarIn"/><wsdl:output message="tns:SomarOut"/></wsdl:operation>
  </wsdl:portType>
  <wsdl:binding name="LojaSoap" type="tns:LojaPort">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="SomarPedido"><soap:operation soapAction="${T}/SomarPedido"/><wsdl:input><soap:body use="literal"/></wsdl:input><wsdl:output><soap:body use="literal"/></wsdl:output></wsdl:operation>
  </wsdl:binding>
  <wsdl:binding name="LojaSoap12" type="tns:LojaPort">
    <soap12:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="SomarPedido"><soap12:operation soapAction="${T}/SomarPedido12"/><wsdl:input><soap12:body use="literal"/></wsdl:input><wsdl:output><soap12:body use="literal"/></wsdl:output></wsdl:operation>
  </wsdl:binding>
  <wsdl:service name="LojaService">
    <wsdl:port name="LojaSoap" binding="tns:LojaSoap"><soap:address location="http://127.0.0.1:8080/loja"/></wsdl:port>
    <wsdl:port name="LojaSoap12" binding="tns:LojaSoap12"><soap12:address location="http://127.0.0.1:8080/loja12"/></wsdl:port>
  </wsdl:service>
</wsdl:definitions>`

const RPC = `<definitions name="Eco" targetNamespace="urn:eco" xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:tns="urn:eco">
  <message name="EcoIn"><part name="texto" type="xsd:string"/></message>
  <portType name="EcoPort"><operation name="Ecoar"><input message="tns:EcoIn"/></operation></portType>
  <binding name="EcoB" type="tns:EcoPort"><soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="Ecoar"><soap:operation soapAction="ecoar"/><input><soap:body use="literal" namespace="urn:eco"/></input></operation></binding>
  <service name="EcoService"><port name="p" binding="tns:EcoB"><soap:address location="http://127.0.0.1:9/eco"/></port></service>
</definitions>`

describe('importar WSDL', () => {
  it('detecta o formato pelo conteúdo', () => {
    expect(detectFormat(WSDL)).toBe('wsdl')
    expect(detectFormat('<html></html>')).toBeNull()
  })

  it('gera uma requisição por operação e porta, com versão, SOAPAction, URL e envelope', () => {
    const r = parseImport(WSDL, 'auto')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.format).toBe('wsdl')
    expect(r.items).toHaveLength(2)
    const [a, b] = r.items.map((i) => i.request)
    expect(a!.method).toBe('POST')
    expect(a!.url).toBe('http://127.0.0.1:8080/loja')
    expect(a!.body).toMatchObject({ type: 'soap', version: '1.1', action: `${T}/SomarPedido` })
    expect(b!.url).toBe('http://127.0.0.1:8080/loja12')
    expect(b!.body).toMatchObject({ type: 'soap', version: '1.2', action: `${T}/SomarPedido12` })
    expect(b!.name).toBe('SomarPedido (SOAP 1.2)')
    const env = (a!.body as { envelope: string }).envelope
    expect(env).toContain('xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"')
    expect(env).toContain(`xmlns:ns1="${T}"`)
    expect(env).toContain('<ns1:cliente>?</ns1:cliente>')
    expect(env).toContain('<ns1:codigo>?</ns1:codigo>')
    expect((b!.body as { envelope: string }).envelope).toContain('http://www.w3.org/2003/05/soap-envelope')
    for (const i of r.items) expect(apiRequestSchema.safeParse(i.request).success).toBe(true)
  })

  it('rpc: o elemento da operação envolve as partes', () => {
    const r = parseImport(RPC, 'wsdl')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const body = r.items[0]!.request.body as { envelope: string; action: string }
    expect(body.action).toBe('ecoar')
    expect(body.envelope).toContain('<ns1:Ecoar>')
    expect(body.envelope).toContain('<texto>?</texto>')
  })

  it('XML inválido, DOCTYPE e WSDL 2.0 viram erro, sem lançar', () => {
    expect(parseImport('<a><b></a>', 'wsdl')).toEqual({ ok: false, code: 'invalid' })
    expect(parseImport('<!DOCTYPE a [<!ENTITY x "y">]><definitions/>', 'wsdl')).toEqual({ ok: false, code: 'invalid' })
    expect(parseImport('<description xmlns="http://www.w3.org/ns/wsdl"/>', 'wsdl')).toEqual({ ok: false, code: 'invalid' })
  })
})
