// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from './fixtures'

const RESPOSTA =
  '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:m="http://exemplo.com.br/loja"><s:Body><m:SomarPedidoResponse><m:Total>42</m:Total></m:SomarPedidoResponse></s:Body></s:Envelope>'

let server: Server
let base = ''
let seen: { headers: IncomingHttpHeaders; body: string } | null = null

test.beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      seen = { headers: req.headers, body: Buffer.concat(chunks).toString() }
      res.setHeader('Content-Type', 'text/xml; charset=utf-8')
      res.end(RESPOSTA)
    })
  })
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

test.afterAll(() => {
  server.close()
})

const WSDL = (): string => `<?xml version="1.0"?>
<wsdl:definitions name="Loja" targetNamespace="http://exemplo.com.br/loja" xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:tns="http://exemplo.com.br/loja">
  <wsdl:types><xs:schema targetNamespace="http://exemplo.com.br/loja" elementFormDefault="qualified">
    <xs:element name="SomarPedido"><xs:complexType><xs:sequence><xs:element name="cliente" type="xs:string"/></xs:sequence></xs:complexType></xs:element>
  </xs:schema></wsdl:types>
  <wsdl:message name="SomarIn"><wsdl:part name="parameters" element="tns:SomarPedido"/></wsdl:message>
  <wsdl:portType name="LojaPort"><wsdl:operation name="SomarPedido"><wsdl:input message="tns:SomarIn"/></wsdl:operation></wsdl:portType>
  <wsdl:binding name="LojaSoap" type="tns:LojaPort"><soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <wsdl:operation name="SomarPedido"><soap:operation soapAction="http://exemplo.com.br/loja/SomarPedido"/><wsdl:input><soap:body use="literal"/></wsdl:input></wsdl:operation></wsdl:binding>
  <wsdl:service name="LojaService"><wsdl:port name="LojaSoap" binding="tns:LojaSoap"><soap:address location="${base}/loja"/></wsdl:port></wsdl:service>
</wsdl:definitions>`

test.describe('Cliente de API: SOAP', () => {
  test('envia um envelope SOAP e confere a resposta com uma asserção XPath', async ({ page }) => {
    await page.keyboard.press('Control+Shift+A')
    const view = page.getByTestId('api-request')
    await expect(view).toBeVisible()
    await view.getByLabel('Método').selectOption('POST')
    await view.getByLabel('URL da requisição').fill(`${base}/loja`)

    await view.getByRole('tab', { name: /^Corpo/ }).click()
    await view.getByLabel('Tipo do corpo').selectOption('soap')
    await view.getByLabel('SOAPAction').fill('http://exemplo.com.br/loja/SomarPedido')
    await view.getByRole('button', { name: 'Modelo de envelope' }).click()

    // Asserção XPath com o prefixo declarado na resposta.
    await view.getByRole('tab', { name: /^Testes/ }).first().click()
    await view.getByRole('button', { name: 'Adicionar asserção' }).click()
    await view.getByLabel('Alvo 1').selectOption('xPath')
    await view.getByLabel('Caminho ou nome 1').fill('//m:Total')
    await view.getByLabel('Esperado 1').fill('42')

    await page.getByTestId('api-send').click()
    await expect(page.getByTestId('api-status')).toContainText('200')
    expect(seen?.headers['content-type']).toBe('text/xml; charset=utf-8')
    expect(seen?.headers.soapaction).toBe('"http://exemplo.com.br/loja/SomarPedido"')
    expect(seen?.body).toContain('http://schemas.xmlsoap.org/soap/envelope/')

    await expect(page.getByTestId('api-response')).toContainText('Total')
    await page.getByTestId('api-response').getByRole('tab', { name: /^Testes/ }).click()
    await expect(page.locator('li[data-passed=true]')).toHaveCount(1)
  })

  test('importa um WSDL e gera a requisição SOAP', async ({ page }) => {
    await page.getByRole('button', { name: 'Ferramentas' }).click()
    await page.getByRole('menuitem', { name: 'Testar requisições e APIs' }).click()
    await page.getByRole('menuitem', { name: /Importar requisições/ }).click()
    await page.getByLabel(/Cole o texto/).fill(WSDL())
    await page.getByRole('button', { name: 'Analisar' }).click()
    await expect(page.getByTestId('import-preview')).toContainText('SomarPedido')
    await page.getByRole('button', { name: 'Abrir em abas' }).click()

    const view = page.getByTestId('api-request')
    await expect(view.getByLabel('URL da requisição')).toHaveValue(`${base}/loja`)
    await expect(view.getByLabel('Método')).toHaveValue('POST')
    await view.getByRole('tab', { name: /^Corpo/ }).click()
    await expect(view.getByLabel('Tipo do corpo')).toHaveValue('soap')
    await expect(view.getByLabel('SOAPAction')).toHaveValue('http://exemplo.com.br/loja/SomarPedido')
    await expect(view.getByTestId('api-body-editor')).toContainText('cliente')
  })
})
