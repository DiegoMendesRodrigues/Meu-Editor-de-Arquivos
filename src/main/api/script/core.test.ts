// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { maskOutput } from './mask'
import { runScriptCore } from './core'
import type { ScriptInput } from './types'

const base = (code: string, extra: Partial<ScriptInput> = {}): ScriptInput => ({
  phase: 'post',
  code,
  cpuMs: 500,
  memoryBytes: 16 * 1024 * 1024,
  maxLogLines: 1000,
  values: {},
  secretNames: [],
  req: { method: 'GET', url: 'http://127.0.0.1/x', headers: [['Accept', 'application/json']], body: '' },
  res: { status: 200, statusText: 'OK', headers: [['Content-Type', 'application/json'], ['X-Id', '7']], body: JSON.stringify({ id: 7, nome: 'Ana', itens: [1, 2, 3], token: 'abc' }), responseTime: 12 },
  ...extra
})

describe('sandbox QuickJS: limites', () => {
  it('interrompe um laço infinito no tempo de CPU', async () => {
    const t0 = Date.now()
    const out = await runScriptCore(base('while (true) {}', { cpuMs: 200 }))
    expect(out.ok).toBe(false)
    expect(out.error).toBe('scriptTimeout')
    expect(Date.now() - t0).toBeLessThan(5000)
    expect(out.logs.some((l) => l.level === 'error')).toBe(true)
  })

  it('encerra uma alocação sem fim no limite de memória', async () => {
    const out = await runScriptCore(base('var a = []; while (true) { a.push(new Array(10000).fill("x".repeat(100))) }', { memoryBytes: 8 * 1024 * 1024, cpuMs: 5000 }))
    expect(out.ok).toBe(false)
    expect(out.error).toBe('scriptMemory')
  })

  it('erro de execução vira scriptError com a linha no console', async () => {
    const out = await runScriptCore(base('console.log("antes")\n\nnaoExiste()'))
    expect(out.error).toBe('scriptError')
    expect(out.logs.map((l) => l.text)).toContain('antes')
    const last = out.logs[out.logs.length - 1]!
    expect(last.text).toMatch(/^script:3: ReferenceError/)
    expect(last.text).not.toMatch(/[A-Za-z]:\\|node_modules/)
  })

  it('recursão infinita não derruba o sandbox', async () => {
    const out = await runScriptCore(base('function f(){ return f() + 1 } f()'))
    expect(out.error).toBe('scriptError')
  })
})

describe('sandbox QuickJS: isolamento', () => {
  it('não existem require, process, fetch nem módulos do host', async () => {
    const out = await runScriptCore(base('console.log(typeof require, typeof process, typeof fetch, typeof module, typeof Buffer, typeof XMLHttpRequest, typeof setTimeout, typeof __hmac)'))
    expect(out.ok).toBe(true)
    expect(out.logs[0]!.text).toBe('undefined undefined undefined undefined undefined undefined undefined undefined')
  })

  it('require("fs") falha', async () => {
    const out = await runScriptCore(base('require("fs")'))
    expect(out.error).toBe('scriptError')
  })

  it('no script "depois" a requisição não é editável', async () => {
    const out = await runScriptCore(base('req.method = "POST"; console.log(req.method)'))
    expect(out.logs[0]?.text ?? '').not.toBe('POST')
  })
})

describe('sandbox QuickJS: API', () => {
  it('test, expect (estilo Chai) e res', async () => {
    const out = await runScriptCore(
      base(`
      test('status 200', () => { expect(res.status).to.equal(200) })
      test('json', () => {
        const j = res.json()
        expect(j.nome).to.be.a('string')
        expect(j).to.have.property('id', 7)
        expect(j.itens).to.have.lengthOf(3)
        expect(j.itens).to.include(2)
        expect(j.id).to.be.above(1).and.below(10)
        expect(j).to.eql({ id: 7, nome: 'Ana', itens: [1, 2, 3], token: 'abc' })
        expect(j.x).to.not.be.ok
        expect(res).to.have.status(200)
        expect(res.headers.get('content-type')).to.include('json')
      })
      test('reprova', () => { expect(1).to.equal(2) })
      test('negado', () => { expect('a').to.not.equal('a') })
      console.log(res.responseTime, res.text().length > 0)
      `)
    )
    expect(out.ok).toBe(true)
    expect(out.tests.map((t) => [t.name, t.passed])).toEqual([
      ['status 200', true],
      ['json', true],
      ['reprova', false],
      ['negado', false]
    ])
    expect(out.tests[2]!.error).toContain('expected 1 to equal 2')
    expect(out.logs[0]!.text).toBe('12 true')
  })

  it('env.get/set e vars.get/set; segredo lido é registrado', async () => {
    const out = await runScriptCore(
      base(
        `
      env.set('novo', 'v' + env.get('base'))
      env.set('cofre', 'xyz', { secret: true })
      vars.set('tmp', 5)
      test('lê', () => { expect(vars.get('tmp')).to.equal('5'); expect(env.get('chave')).to.equal('S3GR3D0'); expect(env.get('nada')).to.be.undefined })
      `,
        { values: { base: 'A', chave: 'S3GR3D0' }, secretNames: ['chave'] }
      )
    )
    expect(out.ok).toBe(true)
    expect(out.tests[0]!.passed).toBe(true)
    expect(out.envSets).toEqual([
      { name: 'novo', value: 'vA', secret: false },
      { name: 'cofre', value: 'xyz', secret: true }
    ])
    expect(out.varSets).toEqual([{ name: 'tmp', value: '5' }])
    expect(out.secretsRead).toEqual(['chave'])
  })

  it('crypto: hmac, sha256, md5, base64 e uuid', async () => {
    const out = await runScriptCore(
      base(`
      console.log(crypto.hmac('sha256', 'chave', 'texto'))
      console.log(crypto.sha256('abc'))
      console.log(crypto.md5('abc'))
      console.log(crypto.base64.encode('olá'), crypto.base64.decode('b2zDoQ=='))
      console.log(crypto.hmac('sha1', 'k', 'd', 'base64'))
      console.log(uuid().length, crypto.uuid() !== uuid())
      try { crypto.hmac('sha3', 'k', 'd') } catch (e) { console.log('recusado') }
      `)
    )
    expect(out.ok).toBe(true)
    const t = out.logs.map((l) => l.text)
    expect(t[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(t[1]).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(t[2]).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(t[3]).toBe('b2zDoQ== olá')
    expect(t[4]).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(t[5]).toBe('36 true')
    expect(t[6]).toBe('recusado')
  })

  it('limita as linhas do console', async () => {
    const out = await runScriptCore(base('for (let i = 0; i < 50; i++) console.log("l" + i)', { maxLogLines: 10 }))
    expect(out.logs).toHaveLength(10)
  })

  it('console.log de objetos vira JSON', async () => {
    const out = await runScriptCore(base('console.log({ a: 1 }, [1,2], "x")'))
    expect(out.logs[0]!.text).toBe('{"a":1} [1,2] x')
  })

  it('promessas rejeitadas em test assíncrono reprovam o teste', async () => {
    const out = await runScriptCore(base("test('async', async () => { await Promise.resolve(); throw new Error('falhou') })"))
    expect(out.tests[0]).toMatchObject({ name: 'async', passed: false, error: 'falhou' })
  })

  it('script "antes" muda a requisição', async () => {
    const out = await runScriptCore(
      base("req.headers['X-Assinatura'] = crypto.sha256(req.url); req.method = 'POST'; req.url = req.url + '?a=1'; req.body = '{\"k\":1}'", { phase: 'pre', res: undefined })
    )
    expect(out.ok).toBe(true)
    expect(out.req?.method).toBe('POST')
    expect(out.req?.url).toBe('http://127.0.0.1/x?a=1')
    expect(out.req?.body).toBe('{"k":1}')
    expect(out.req?.headers.map(([k]) => k)).toEqual(['Accept', 'X-Assinatura'])
  })
})

describe('scripts de exemplo do Postman (alias pm)', () => {
  it('pm.test, pm.expect, pm.environment.set e pm.response.json', async () => {
    const out = await runScriptCore(
      base(
        `
      pm.test("Status code is 200", function () { pm.response.to.have.status(200); });
      pm.test("Status code", function () { pm.expect(pm.response.code).to.eql(200); pm.expect(pm.response.status).to.equal('OK'); });
      pm.test("Body tem id", function () {
        var jsonData = pm.response.json();
        pm.expect(jsonData.id).to.eql(7);
        pm.expect(jsonData.itens).to.be.an('array').that.has.lengthOf(3);
        pm.environment.set("token", jsonData.token);
        pm.variables.set("id", jsonData.id);
      });
      pm.test("Tempo", () => { pm.expect(pm.response.responseTime).to.be.below(200) });
      pm.test("Cabeçalho", () => { pm.expect(pm.response.headers.get('Content-Type')).to.include('json') });
      pm.test("Corpo de texto", () => { pm.expect(pm.response.text()).to.include('Ana') });
      pm.test("ok", () => { pm.response.to.be.ok; pm.response.to.not.be.error });
      var base = pm.collectionVariables.get('base');
      console.log(base, pm.environment.get('token'));
      `,
        { values: { base: 'http://x' } }
      )
    )
    expect(out.ok).toBe(true)
    expect(out.tests.filter((t) => !t.passed)).toEqual([])
    expect(out.tests).toHaveLength(7)
    expect(out.envSets).toEqual([{ name: 'token', value: 'abc', secret: false }])
    expect(out.varSets).toEqual([{ name: 'id', value: '7' }])
    expect(out.logs[0]!.text).toBe('http://x abc')
  })

  it('pm.request.headers.add no script "antes" e pm.request.url', async () => {
    const out = await runScriptCore(
      base("pm.request.headers.add({ key: 'X-Req', value: '1' }); pm.request.headers.upsert({ key: 'accept', value: 'text/plain' }); console.log(pm.request.url.toString())", { phase: 'pre', res: undefined })
    )
    expect(out.ok).toBe(true)
    expect(Object.fromEntries(out.req!.headers.map(([k, v]) => [k.toLowerCase(), v]))).toEqual({ 'x-req': '1', accept: 'text/plain' })
    expect(out.logs[0]!.text).toBe('http://127.0.0.1/x')
  })
})

describe('máscara de segredos', () => {
  it('o console e os testes não mostram o valor secreto', async () => {
    const input = base("console.log('token=' + env.get('chave')); test('usa ' + env.get('chave'), () => { throw new Error('falhou com ' + env.get('chave')) })", {
      values: { chave: 'S3GR3D0-LONGO' },
      secretNames: ['chave']
    })
    const raw = await runScriptCore(input)
    expect(raw.logs[0]!.text).toContain('S3GR3D0-LONGO')
    const out = maskOutput(raw, ['S3GR3D0-LONGO'])
    expect(JSON.stringify(out)).not.toContain('S3GR3D0')
    expect(out.logs[0]!.text).toBe('token=••••••')
    expect(out.tests[0]!.name).toBe('usa ••••••')
    expect(out.tests[0]!.error).toBe('falhou com ••••••')
  })
})
