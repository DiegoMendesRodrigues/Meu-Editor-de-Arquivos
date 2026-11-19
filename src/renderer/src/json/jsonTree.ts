// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Funções puras do JSON Viewer (sem React), testáveis isoladamente.
 */
import { t } from '@/i18n'

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type PathSegment = string | number

export type ParseResult =
  | { ok: true; value: JsonValue }
  | { ok: false; message: string; line?: number; column?: number }

/** Interpreta o texto e, em caso de erro, informa linha e coluna para o usuário. */
export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue }
  } catch (err) {
    const found = locateJsonError(text.replace(/^﻿/, ''))
    if (!found) return { ok: false, message: err instanceof Error ? err.message : String(err) }
    const before = text.slice(0, found.offset).split(/\r?\n/)
    return { ok: false, message: found.message, line: before.length, column: before[before.length - 1].length + 1 }
  }
}

/**
 * Percorre o texto seguindo a gramática JSON e devolve a posição do primeiro erro.
 * Usado só quando JSON.parse falha, porque as mensagens do motor nem sempre trazem a posição.
 */
export function locateJsonError(text: string): { offset: number; message: string } | null {
  let i = 0
  class Fail {
    constructor(public message: string, public offset = i) {}
  }
  const ws = () => {
    while (i < text.length && ' \t\n\r'.includes(text[i])) i++
  }
  const describe = () => (i >= text.length ? t('json.err.endOfFile') : `"${text[i]}"`)
  const expect = (ch: string) => {
    if (text[i] !== ch) throw new Fail(t('json.err.expected', { ch, found: describe() }))
    i++
  }
  const string = () => {
    expect('"')
    while (i < text.length && text[i] !== '"') {
      if (text[i] === '\\') {
        i++
        if (text[i] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) throw new Fail(t('json.err.badUnicode'))
          i += 4
        } else if (!'"\\/bfnrt'.includes(text[i] ?? '')) throw new Fail(t('json.err.badEscape'))
      } else if (text.charCodeAt(i) < 0x20) throw new Fail(t('json.err.control'))
      i++
    }
    if (i >= text.length) throw new Fail(t('json.err.unterminated'))
    i++
  }
  const value = (): void => {
    ws()
    const ch = text[i]
    if (ch === '{') {
      i++
      ws()
      if (text[i] === '}') return void i++
      for (;;) {
        ws()
        if (text[i] !== '"') throw new Fail(t('json.err.expectedKey', { found: describe() }))
        string()
        ws()
        expect(':')
        value()
        ws()
        if (text[i] === ',') {
          i++
          ws()
          if (text[i] === '}') throw new Fail(t('json.err.commaObj'))
          continue
        }
        expect('}')
        return
      }
    }
    if (ch === '[') {
      i++
      ws()
      if (text[i] === ']') return void i++
      for (;;) {
        value()
        ws()
        if (text[i] === ',') {
          i++
          ws()
          if (text[i] === ']') throw new Fail(t('json.err.commaArr'))
          continue
        }
        expect(']')
        return
      }
    }
    if (ch === '"') return string()
    const literal = /^(true|false|null|-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?)/.exec(text.slice(i, i + 400))
    if (literal) return void (i += literal[0].length)
    throw new Fail(t('json.err.unexpected', { found: describe() }))
  }
  try {
    value()
    ws()
    if (i < text.length) throw new Fail(t('json.err.trailing', { found: describe() }))
    return null
  } catch (e) {
    if (e instanceof Fail) return { offset: e.offset, message: e.message }
    throw e
  }
}

export const isContainer = (v: JsonValue): v is JsonValue[] | { [key: string]: JsonValue } =>
  v !== null && typeof v === 'object'

export function childEntries(v: JsonValue): [PathSegment, JsonValue][] {
  if (Array.isArray(v)) return v.map((item, i) => [i, item])
  if (isContainer(v)) return Object.entries(v)
  return []
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** Caminho no formato JSONPath simplificado: $.usuarios[0]["nome completo"] */
export function formatPath(path: PathSegment[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === 'number') return `${acc}[${seg}]`
    return IDENTIFIER.test(seg) ? `${acc}.${seg}` : `${acc}[${JSON.stringify(seg)}]`
  }, '$')
}

/** Chave estável de um nó, usada para guardar o estado aberto/fechado. */
export const pathKey = (path: PathSegment[]): string => JSON.stringify(path)

export function getAtPath(root: JsonValue, path: PathSegment[]): JsonValue | undefined {
  let cur: JsonValue | undefined = root
  for (const seg of path) {
    if (cur === undefined || !isContainer(cur)) return undefined
    cur = Array.isArray(cur) ? cur[seg as number] : cur[seg as string]
  }
  return cur
}

/** Resumo exibido ao lado de um nó recolhido. */
export function summary(v: JsonValue): string {
  if (Array.isArray(v)) return t('json.items', { n: v.length })
  if (isContainer(v)) {
    const n = Object.keys(v).length
    return t('json.keys', { n })
  }
  return ''
}
