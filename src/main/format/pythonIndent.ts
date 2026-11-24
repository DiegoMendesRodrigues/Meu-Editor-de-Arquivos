// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Deduz a indentação de um código Python que chegou sem ela (ou com ela quebrada). Em Python a
 * indentação define os blocos, então isto é um palpite, usado só quando o formatador recusa o código:
 *
 * - Depois de uma linha que termina com ":", o bloco abre um nível.
 * - Blocos de controle (if, for, while, with, try…) ficam só com a linha seguinte, a menos que ela
 *   abra outro bloco; else, elif, except e finally voltam ao nível do bloco a que pertencem.
 * - Corpos de def ficam abertos até uma linha em branco ou um return; corpos de class, até duas
 *   linhas em branco seguidas.
 * - Linhas dentro de parênteses, colchetes e chaves, ou depois de "\", continuam um nível adiante;
 *   o texto de strings com três aspas fica como está.
 */

interface Frame {
  kind: 'def' | 'class' | 'ctrl'
}

const INDENT = '    '
const CONTINUES = /^(elif|else|except|finally)\b/
const OPENS_DEF = /^(async\s+)?def\b/
const OPENS_CLASS = /^class\b/

/** Estado do analisador entre linhas: profundidade de parênteses e string de três aspas em aberto. */
interface ScanState {
  depth: number
  triple: '"""' | "'''" | null
}

/** Percorre a linha, atualizando o estado; devolve o código sem o comentário final. */
function scan(line: string, state: ScanState): string {
  let code = ''
  let i = 0
  while (i < line.length) {
    if (state.triple) {
      const end = line.indexOf(state.triple, i)
      if (end < 0) return code
      i = end + 3
      state.triple = null
      code += '""'
      continue
    }
    const ch = line[i]
    if (ch === '#') break
    if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
      state.triple = line.slice(i, i + 3) as '"""' | "'''"
      i += 3
      continue
    }
    if (ch === '"' || ch === "'") {
      // String de uma linha: pula até a aspa de fechamento (respeitando a barra invertida).
      let j = i + 1
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1
      code += '""'
      i = j + 1
      continue
    }
    if ('([{'.includes(ch)) state.depth++
    else if (')]}'.includes(ch)) state.depth = Math.max(0, state.depth - 1)
    code += ch
    i++
  }
  return code
}

export function guessPythonIndentation(text: string): string {
  const out: string[] = []
  const stack: Frame[] = []
  /** Blocos em volta de cada cabeçalho de controle ainda "alcançável" por um else/elif/except/finally. */
  const ctrlHeaders: Frame[][] = []
  const state: ScanState = { depth: 0, triple: null }
  let continuation = false
  let blankRun = 0

  for (const raw of text.split(/\r\n|\n|\r/)) {
    // Dentro de uma string de três aspas, o texto é conteúdo: fica como está.
    if (state.triple) {
      out.push(raw)
      scan(raw, state)
      continue
    }
    const line = raw.trim()

    if (line === '') {
      out.push('')
      if (state.depth > 0 || continuation) continue
      blankRun++
      // Uma linha em branco fecha o def mais interno (e o que estiver aberto dentro dele);
      // duas seguidas fecham também a class.
      const closeTo = blankRun >= 2 ? stack.findIndex((f) => f.kind === 'class') : stack.map((f) => f.kind).lastIndexOf('def')
      if (closeTo >= 0) stack.length = closeTo
      else if (blankRun >= 2) stack.length = 0
      ctrlHeaders.length = 0
      continue
    }
    blankRun = 0

    // Continuação de uma expressão: um nível adiante, sem abrir nem fechar blocos.
    if (state.depth > 0 || continuation) {
      out.push(INDENT.repeat(stack.length + 1) + line)
      continuation = scan(line, state).trimEnd().endsWith('\\')
      continue
    }

    if (line.startsWith('#')) {
      out.push(INDENT.repeat(stack.length) + line)
      continue
    }

    // else/elif/except/finally voltam ao nível do if/for/try a que pertencem.
    if (CONTINUES.test(line) && ctrlHeaders.length > 0) {
      const around = ctrlHeaders.pop()!
      stack.length = 0
      stack.push(...around)
    }

    const level = stack.length
    out.push(INDENT.repeat(level) + line)
    const code = scan(line, state).trimEnd()
    continuation = code.endsWith('\\')
    if (state.depth > 0 || continuation || state.triple) continue

    if (code.endsWith(':')) {
      const kind: Frame['kind'] = OPENS_DEF.test(line) ? 'def' : OPENS_CLASS.test(line) ? 'class' : 'ctrl'
      if (kind === 'ctrl') {
        while (ctrlHeaders.length > 0 && ctrlHeaders[ctrlHeaders.length - 1].length >= level) ctrlHeaders.pop()
        ctrlHeaders.push([...stack])
      }
      stack.push({ kind })
      continue
    }

    // Instrução simples: fecha os blocos de controle abertos (cada um fica com uma linha).
    while (stack.length > 0 && stack[stack.length - 1].kind === 'ctrl') stack.pop()
    // Depois de um return, o def termina.
    if (/^return\b/.test(line) && stack.length > 0 && stack[stack.length - 1].kind === 'def') stack.pop()
  }
  return out.join('\n')
}
