// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Variáveis do Cliente de API: a sintaxe {{nome}}, a resolução por escopos e as variáveis dinâmicas
 * ({{$guid}}, {{$timestamp}}...). O Renderer usa só para destacar e listar; a resolução com segredos
 * acontece apenas no Main.
 */

/** Nome de variável: começa com letra, "_" ou "$"; depois letras, números, ".", "_", "-" ou "$". */
export const VARIABLE_NAME_RE = /^[A-Za-z_$][\w.$-]{0,99}$/

const TOKEN_RE = /\{\{\s*([A-Za-z_$][\w.$-]{0,99})\s*\}\}/g

export interface VariableToken {
  name: string
  /** Posição de "{{" e logo depois de "}}" no texto. */
  start: number
  end: number
}

export function findVariables(text: string): VariableToken[] {
  const tokens: VariableToken[] = []
  for (const m of text.matchAll(TOKEN_RE)) tokens.push({ name: m[1]!, start: m.index, end: m.index + m[0].length })
  return tokens
}

/** Nomes das variáveis usadas no texto, sem repetição, na ordem em que aparecem. */
export const variableNames = (text: string): string[] => [...new Set(findVariables(text).map((t) => t.name))]

export type VariableLookup = (name: string) => string | undefined
export type VariableLayer = Readonly<Record<string, string | undefined>> | VariableLookup

/**
 * Junta escopos, do mais forte para o mais fraco (temporárias → ambiente → coleção → globais).
 * O primeiro escopo que tiver a variável define o valor.
 */
export function layeredLookup(...layers: VariableLayer[]): VariableLookup {
  return (name) => {
    for (const layer of layers) {
      const value = typeof layer === 'function' ? layer(name) : Object.hasOwn(layer, name) ? layer[name] : undefined
      if (value !== undefined) return value
    }
    return undefined
  }
}

const randomInt = (max: number): number => {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0]! % max
}

/** Variáveis dinâmicas: um valor novo a cada uso. */
export const DYNAMIC_VARIABLES: Readonly<Record<string, () => string>> = {
  $guid: () => globalThis.crypto.randomUUID(),
  $timestamp: () => String(Math.floor(Date.now() / 1000)),
  $isoDate: () => new Date().toISOString(),
  $randomInt: () => String(randomInt(1001)),
  $randomEmail: () => `usuario${randomInt(1_000_000)}@exemplo.com`
}

export interface ResolveResult {
  text: string
  /** Variáveis sem valor (ficam como {{nome}} no texto). */
  missing: string[]
}

/** Profundidade máxima de variáveis dentro de variáveis (evita ciclos como a → b → a). */
const MAX_DEPTH = 5

/** Troca as {{variáveis}} pelos valores. Valores podem conter outras variáveis, até 5 níveis. */
export function resolveTemplate(text: string, lookup: VariableLookup): ResolveResult {
  const missing = new Set<string>()
  const resolve = (input: string, depth: number): string =>
    input.replace(TOKEN_RE, (whole, name: string) => {
      const dynamic = DYNAMIC_VARIABLES[name]
      if (dynamic) return dynamic()
      const value = lookup(name)
      if (value === undefined || depth >= MAX_DEPTH) {
        missing.add(name)
        return whole
      }
      return resolve(value, depth + 1)
    })
  const resolved = resolve(text, 0)
  return { text: resolved, missing: [...missing] }
}
