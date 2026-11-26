// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { DATA_FILE_LIMITS, parseDataFile } from './dataFile'

describe('arquivo de dados', () => {
  it('lê CSV com vírgula, cabeçalho e aspas', () => {
    const r = parseDataFile('nome,cidade\r\n"Silva, Ana","São ""Paulo"""\nBia,Rio\n')
    expect(r).toMatchObject({ ok: true, format: 'csv', columns: ['nome', 'cidade'] })
    expect(r.ok && r.rows).toEqual([
      { nome: 'Silva, Ana', cidade: 'São "Paulo"' },
      { nome: 'Bia', cidade: 'Rio' }
    ])
  })

  it('detecta ponto e vírgula e tabulação', () => {
    expect(parseDataFile('a;b\n1;2')).toMatchObject({ ok: true, rows: [{ a: '1', b: '2' }] })
    expect(parseDataFile('a\tb\n1\t2')).toMatchObject({ ok: true, rows: [{ a: '1', b: '2' }] })
  })

  it('aceita quebra de linha dentro de aspas, BOM e linhas vazias', () => {
    const r = parseDataFile('﻿a,b\n"x\ny",2\n\n3,4\n')
    expect(r.ok && r.rows).toEqual([
      { a: 'x\ny', b: '2' },
      { a: '3', b: '4' }
    ])
  })

  it('completa colunas faltantes e ignora nomes inválidos de variável', () => {
    const r = parseDataFile('ok,nome ruim\n1\n')
    expect(r.ok && r.rows).toEqual([{ ok: '1' }])
    expect(r.ok && r.skippedColumns).toEqual(['nome ruim'])
  })

  it('recusa aspas sem fechar, vazio e sem colunas válidas', () => {
    expect(parseDataFile('a,b\n"x,1')).toEqual({ ok: false, code: 'invalidCsv' })
    expect(parseDataFile('  \n ')).toEqual({ ok: false, code: 'empty' })
    expect(parseDataFile('a b,c d\n1,2')).toEqual({ ok: false, code: 'noColumns' })
  })

  it('lê JSON como array de objetos, convertendo valores em texto', () => {
    const r = parseDataFile('[{"id":1,"ok":true,"n":null,"o":{"x":1}}]', 'dados.json')
    expect(r.ok && r.rows).toEqual([{ id: '1', ok: 'true', n: '', o: '{"x":1}' }])
  })

  it('recusa JSON inválido ou que não é lista de objetos', () => {
    expect(parseDataFile('[1,2]')).toEqual({ ok: false, code: 'notArrayOfObjects' })
    expect(parseDataFile('{"a":1}')).toEqual({ ok: false, code: 'notArrayOfObjects' })
    expect(parseDataFile('[{', 'x.json')).toEqual({ ok: false, code: 'invalidJson' })
    expect(parseDataFile('[]')).toEqual({ ok: false, code: 'empty' })
  })

  it('respeita os limites de linhas, colunas e tamanho', () => {
    const rows = 'a\n' + '1\n'.repeat(DATA_FILE_LIMITS.rows + 1)
    expect(parseDataFile(rows)).toEqual({ ok: false, code: 'tooManyRows' })
    const cols = Array.from({ length: DATA_FILE_LIMITS.columns + 1 }, (_, i) => `c${i}`).join(',')
    expect(parseDataFile(`${cols}\n`)).toEqual({ ok: false, code: 'tooManyColumns' })
    expect(parseDataFile('a'.repeat(DATA_FILE_LIMITS.chars + 1))).toEqual({ ok: false, code: 'tooLarge' })
  })

  it('não deixa __proto__ virar variável', () => {
    const r = parseDataFile('[{"__proto__":"x","a":"1"}]')
    expect(r.ok && r.rows).toEqual([{ a: '1' }])
  })
})
