// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { assertionSchema, extractionSchema, type Assertion, type Extraction } from '@shared/api/schema'
import { evaluateAll, type ResponseForAssertions } from './evaluate'

const resp: ResponseForAssertions = {
  status: 200,
  timeMs: 120,
  sizeBytes: 512,
  headers: [{ key: 'Content-Type', value: 'application/json' }, { key: 'X-Id', value: 'abc-123' }],
  cookies: [{ name: 'sessao', value: 'tok42' }],
  body: JSON.stringify({ nome: 'Ana', idade: 30, ativo: true, tags: ['x', 'y'], obj: { k: 1 }, nulo: null, itens: [{ id: 1 }, { id: 2 }] }),
  contentType: 'application/json'
}

const A = (a: Partial<Assertion> & Pick<Assertion, 'target' | 'op'>): Assertion => assertionSchema.parse(a)
const run = (a: Assertion, r = resp) => evaluateAll([a], [], r).tests[0]
const ok = (a: Assertion): boolean => run(a).passed

describe('alvos', () => {
  it('status, time e size', () => {
    expect(ok(A({ target: 'status', op: 'eq', expected: 200 }))).toBe(true)
    expect(ok(A({ target: 'status', op: 'eq', expected: '200' }))).toBe(true)
    expect(ok(A({ target: 'time', op: 'lt', expected: 500 }))).toBe(true)
    expect(ok(A({ target: 'size', op: 'gte', expected: 512 }))).toBe(true)
  })
  it('header sem diferenciar maiúsculas e cookie pelo nome', () => {
    expect(ok(A({ target: 'header', name: 'content-type', op: 'contains', expected: 'json' }))).toBe(true)
    expect(ok(A({ target: 'header', name: 'x-nao', op: 'notExists' }))).toBe(true)
    expect(ok(A({ target: 'cookie', name: 'sessao', op: 'eq', expected: 'tok42' }))).toBe(true)
    expect(ok(A({ target: 'cookie', name: 'Sessao', op: 'exists' }))).toBe(false)
  })
  it('body inteiro', () => {
    expect(ok(A({ target: 'body', op: 'contains', expected: 'Ana' }))).toBe(true)
    expect(ok(A({ target: 'body', op: 'startsWith', expected: '{"nome"' }))).toBe(true)
  })
  it('jsonPath, com lista nos curingas', () => {
    expect(ok(A({ target: 'jsonPath', path: '$.nome', op: 'eq', expected: 'Ana' }))).toBe(true)
    expect(ok(A({ target: 'jsonPath', path: '$.itens[*].id', op: 'eq', expected: '[1,2]' }))).toBe(true)
    expect(ok(A({ target: 'jsonPath', path: '$.itens[*].id', op: 'lengthEq', expected: 2 }))).toBe(true)
    expect(ok(A({ target: 'jsonPath', path: '$.itens[?(@.id == 2)]', op: 'lengthEq', expected: 1 }))).toBe(true)
  })
  it('jsonPath inexistente e valor nulo', () => {
    expect(ok(A({ target: 'jsonPath', path: '$.nada', op: 'notExists' }))).toBe(true)
    expect(ok(A({ target: 'jsonPath', path: '$.nulo', op: 'exists' }))).toBe(true)
    expect(ok(A({ target: 'jsonPath', path: '$.nulo', op: 'isType', expected: 'null' }))).toBe(true)
  })
})

describe('xPath', () => {
  const soap =
    '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:m="http://exemplo.com.br/m"><s:Body><m:Resp><m:Id>7</m:Id><m:Item>a</m:Item><m:Item>b</m:Item><m:Ativo>true</m:Ativo></m:Resp></s:Body></s:Envelope>'
  const xr: ResponseForAssertions = { ...resp, body: soap, contentType: 'text/xml' }
  const X = (path: string, op: Assertion['op'], expected?: Assertion['expected'], r = xr) => run(A({ target: 'xPath', path, op, expected }), r)
  it('usa os prefixos declarados no documento', () => {
    expect(X('//m:Id', 'eq', 7).passed).toBe(true)
    expect(X('/s:Envelope/s:Body/m:Resp/m:Ativo', 'eq', 'true').passed).toBe(true)
    expect(X('//m:Nada', 'notExists').passed).toBe(true)
  })
  it('local-name() funciona sem prefixo', () => {
    expect(X("//*[local-name()='Id']", 'eq', '7').passed).toBe(true)
  })
  it('vários nós viram lista; funções devolvem número', () => {
    expect(X('//m:Item', 'lengthEq', 2).passed).toBe(true)
    expect(X('//m:Item', 'contains', 'b').passed).toBe(true)
    expect(X('count(//m:Item)', 'eq', 2).passed).toBe(true)
  })
  it('atributo e texto', () => {
    const r = { ...xr, body: '<a id="9"><b>oi</b></a>' }
    expect(X('/a/@id', 'eq', 9, r).passed).toBe(true)
    expect(X('//b/text()', 'eq', 'oi', r).passed).toBe(true)
  })
  it('XML inválido, DOCTYPE e XPath inválido têm código próprio', () => {
    expect(X('//a', 'exists', undefined, { ...xr, body: '{"a":1}' }).error).toBe('notXml')
    expect(X('//a', 'exists', undefined, { ...xr, body: '<a><b></a>' }).error).toBe('notXml')
    expect(X('//a', 'exists', undefined, { ...xr, body: '<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>' }).error).toBe('notXml')
    expect(X('//[', 'exists').error).toBe('badXPath')
  })
})

describe('operadores', () => {
  const jp = (path: string, op: Assertion['op'], expected?: Assertion['expected']) => A({ target: 'jsonPath', path, op, expected })
  it('eq e neq com coerção', () => {
    expect(ok(jp('$.idade', 'eq', 30))).toBe(true)
    expect(ok(jp('$.idade', 'eq', '30'))).toBe(true)
    expect(ok(jp('$.idade', 'neq', 31))).toBe(true)
    expect(ok(jp('$.ativo', 'eq', 'true'))).toBe(true)
    expect(ok(jp('$.obj', 'eq', '{"k":1}'))).toBe(true)
    expect(ok(jp('$.nome', 'neq', 'Ana'))).toBe(false)
  })
  it('contains, notContains e startsWith', () => {
    expect(ok(jp('$.tags', 'contains', 'x'))).toBe(true)
    expect(ok(jp('$.tags', 'notContains', 'z'))).toBe(true)
    expect(ok(jp('$.nome', 'contains', 'n'))).toBe(true)
    expect(ok(jp('$.nome', 'notContains', 'n'))).toBe(false)
    expect(ok(jp('$.nome', 'startsWith', 'An'))).toBe(true)
    expect(ok(jp('$.nome', 'startsWith', 'na'))).toBe(false)
  })
  it('matches com /padrão/flags e texto puro', () => {
    expect(ok(jp('$.nome', 'matches', '/^ana$/i'))).toBe(true)
    expect(ok(jp('$.nome', 'matches', '^An'))).toBe(true)
    expect(ok(jp('$.nome', 'matches', '^Zé'))).toBe(false)
  })
  it('regex inválida dá badRegex', () => {
    expect(run(jp('$.nome', 'matches', '(')).error).toBe('badRegex')
    expect(run(jp('$.nome', 'matches', '/(/g')).error).toBe('badRegex')
  })
  it('gt, gte, lt e lte', () => {
    expect(ok(jp('$.idade', 'gt', 29))).toBe(true)
    expect(ok(jp('$.idade', 'gt', 30))).toBe(false)
    expect(ok(jp('$.idade', 'gte', 30))).toBe(true)
    expect(ok(jp('$.idade', 'lt', 31))).toBe(true)
    expect(ok(jp('$.idade', 'lte', 29))).toBe(false)
    expect(ok(jp('$.nome', 'gt', 1))).toBe(false)
    expect(run(jp('$.idade', 'gt', 'abc')).error).toBe('badExpected')
  })
  it('exists e notExists', () => {
    expect(ok(jp('$.nome', 'exists'))).toBe(true)
    expect(ok(jp('$.nome', 'notExists'))).toBe(false)
    expect(ok(jp('$.zzz', 'exists'))).toBe(false)
  })
  it('isType', () => {
    expect(ok(jp('$.nome', 'isType', 'string'))).toBe(true)
    expect(ok(jp('$.idade', 'isType', 'number'))).toBe(true)
    expect(ok(jp('$.ativo', 'isType', 'boolean'))).toBe(true)
    expect(ok(jp('$.tags', 'isType', 'array'))).toBe(true)
    expect(ok(jp('$.obj', 'isType', 'object'))).toBe(true)
    expect(ok(jp('$.tags', 'isType', 'object'))).toBe(false)
    expect(run(jp('$.nome', 'isType', 'xyz')).error).toBe('badExpected')
  })
  it('lengthEq, lengthGt e lengthLt', () => {
    expect(ok(jp('$.nome', 'lengthEq', 3))).toBe(true)
    expect(ok(jp('$.tags', 'lengthGt', 1))).toBe(true)
    expect(ok(jp('$.tags', 'lengthLt', 2))).toBe(false)
    expect(ok(jp('$.idade', 'lengthEq', 2))).toBe(false)
  })
  it('in', () => {
    expect(ok(jp('$.nome', 'in', ['Ana', 'Bia']))).toBe(true)
    expect(ok(jp('$.idade', 'in', [1, 30]))).toBe(true)
    expect(ok(jp('$.nome', 'in', ['Bia']))).toBe(false)
    expect(run(jp('$.nome', 'in', 'Ana')).error).toBe('badExpected')
  })
  it('esperado ausente dá badExpected', () => {
    expect(run(jp('$.nome', 'eq')).error).toBe('badExpected')
  })
})

describe('JSON Schema', () => {
  const schema = JSON.stringify({ type: 'object', required: ['nome'], properties: { nome: { type: 'string' }, idade: { type: 'integer' } } })
  it('válido e inválido', () => {
    expect(ok(A({ target: 'jsonSchema', op: 'matchesSchema', expected: schema }))).toBe(true)
    const bad = JSON.stringify({ type: 'object', required: ['inexistente'] })
    expect(ok(A({ target: 'jsonSchema', op: 'matchesSchema', expected: bad }))).toBe(false)
  })
  it('em um valor do jsonPath', () => {
    expect(ok(A({ target: 'jsonPath', path: '$.idade', op: 'matchesSchema', expected: '{"type":"string"}' }))).toBe(false)
    expect(ok(A({ target: 'jsonPath', path: '$.tags', op: 'matchesSchema', expected: '{"type":"array","items":{"type":"string"}}' }))).toBe(true)
  })
  it('erros', () => {
    expect(run(A({ target: 'jsonSchema', op: 'matchesSchema', expected: '{nao json' })).error).toBe('badSchema')
    expect(run(A({ target: 'jsonSchema', op: 'matchesSchema', expected: '{"type":"nada"}' })).error).toBe('badSchema')
    expect(run(A({ target: 'jsonSchema', op: 'matchesSchema', path: 'schemas/x.json' })).error).toBe('schemaFileUnsupported')
  })
})

describe('erros e casos especiais', () => {
  it('corpo que não é JSON dá notJson', () => {
    const r = { ...resp, body: '<html>' }
    expect(run(A({ target: 'jsonPath', path: '$.a', op: 'exists' }), r).error).toBe('notJson')
  })
  it('jsonPath inválido dá badJsonPath', () => {
    expect(run(A({ target: 'jsonPath', path: 'nome', op: 'exists' })).error).toBe('badJsonPath')
  })
  it('asserção desligada passa sem actual', () => {
    const r = run(A({ target: 'status', op: 'eq', expected: 500, enabled: false }))
    expect(r).toEqual({ index: 0, passed: true })
  })
  it('actual resumido em até 200 caracteres', () => {
    const r = run(A({ target: 'body', op: 'exists' }), { ...resp, body: 'x'.repeat(1000) })
    expect(r.actual?.length).toBeLessThanOrEqual(200)
  })
})

describe('extrações', () => {
  const ex = (e: Partial<Extraction> & Pick<Extraction, 'from' | 'path'>): string | undefined =>
    evaluateAll([], [extractionSchema.parse({ to: 'v', ...e })], resp).extracted[0]
  it('jsonPath como texto; objeto vira JSON', () => {
    expect(ex({ from: 'jsonPath', path: '$.idade' })).toBe('30')
    expect(ex({ from: 'jsonPath', path: '$.obj' })).toBe('{"k":1}')
    expect(ex({ from: 'jsonPath', path: '$.nada' })).toBeUndefined()
  })
  it('header e cookie', () => {
    expect(ex({ from: 'header', path: 'x-id' })).toBe('abc-123')
    expect(ex({ from: 'cookie', path: 'sessao' })).toBe('tok42')
    expect(ex({ from: 'header', path: 'nada' })).toBeUndefined()
  })
  it('regex: grupo 1 ou trecho inteiro', () => {
    expect(ex({ from: 'regex', path: '"idade":(\\d+)' })).toBe('30')
    expect(ex({ from: 'regex', path: 'Ana' })).toBe('Ana')
    expect(ex({ from: 'regex', path: '/(/' })).toBeUndefined()
  })
  it('xPath: primeiro valor, ou undefined se não achar ou não for XML', () => {
    const r = { ...resp, body: '<r xmlns:m="urn:m"><m:t>tk</m:t><m:t>outro</m:t></r>' }
    expect(evaluateAll([], [extractionSchema.parse({ from: 'xPath', path: '//m:t', to: 'v' })], r).extracted[0]).toBe('tk')
    expect(evaluateAll([], [extractionSchema.parse({ from: 'xPath', path: '//m:x', to: 'v' })], r).extracted[0]).toBeUndefined()
    expect(ex({ from: 'xPath', path: '//a' })).toBeUndefined()
  })
})
