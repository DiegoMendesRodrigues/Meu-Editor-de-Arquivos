// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Extração das palavras a verificar pelo corretor ortográfico. Funções puras (sem Monaco nem worker),
 * para poderem ser testadas e usadas dentro do worker.
 */

/** Linguagens do editor em que o corretor atua: textos, não código. */
export const SPELL_LANGUAGES = ['markdown', 'plaintext', 'latex'] as const

export const isSpellLanguage = (language: string): boolean => (SPELL_LANGUAGES as readonly string[]).includes(language)

/** Troca cada caractere do trecho por espaço, preservando as quebras de linha (e, assim, as posições). */
const blank = (s: string): string => s.replace(/[^\r\n]/g, ' ')

/** Trechos que nunca são texto corrido: endereços, e-mails e caminhos. */
const COMMON_SKIP = [
  /\b(?:https?|ftp|file):\/\/\S+/gi,
  /\bwww\.\S+/gi,
  /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /(?:[A-Za-z]:)?(?:[\\/][\w.-]+){2,}/g
]

/** Trechos de Markdown que não são texto: código, front matter, HTML e destinos de links. */
const MARKDOWN_SKIP = [
  /^ {0,3}(`{3,}|~{3,})[^\r\n]*\r?\n[\s\S]*?(?:\r?\n {0,3}\1[^\r\n]*|$(?![\s\S]))/gm, // blocos de código
  /(`+)[^`\r\n][^\r\n]*?\1/g, // código em linha
  /<!--[\s\S]*?-->/g, // comentários HTML
  /<\/?[A-Za-z][^>\r\n]*>/g, // tags HTML
  /\]\([^)\r\n]*\)/g, // destino de link/imagem: [texto](destino)
  /^ {0,3}\[[^\]\r\n]+\]:[^\r\n]*/gm, // definição de link: [ref]: destino
  /\{\{[^}\r\n]*\}\}/g // marcações de modelo, ex.: {{chave}}
]

/** Trechos de LaTeX que não são texto: comandos, matemática e comentários. */
const LATEX_SKIP = [/%[^\r\n]*/g, /\$\$[\s\S]*?\$\$|\$[^$\r\n]*\$/g, /\\[A-Za-z@]+\*?(?:\[[^\]\r\n]*\])?/g]

/**
 * Devolve o texto com os trechos que não devem ser verificados trocados por espaços,
 * mantendo o mesmo tamanho (os deslocamentos das palavras continuam valendo no texto original).
 */
export function maskNonProse(text: string, language: string): string {
  let out = text
  const apply = (re: RegExp): void => {
    out = out.replace(re, blank)
  }
  if (language === 'markdown') {
    // Front matter só conta se estiver no início do arquivo.
    const fm = /^---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?=\r?\n|$)/.exec(out)
    if (fm) out = blank(fm[0]) + out.slice(fm[0].length)
    MARKDOWN_SKIP.forEach(apply)
  } else if (language === 'latex') {
    LATEX_SKIP.forEach(apply)
  }
  COMMON_SKIP.forEach(apply)
  return out
}

export interface WordRange {
  word: string
  /** Deslocamento (em unidades UTF-16) do início da palavra no texto. */
  offset: number
}

const WORD = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*(?:-[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*)*/gu

/** A palavra merece verificação? Ignora siglas, palavras de uma letra e as coladas a números ou "_". */
export function shouldCheck(word: string, before: string, after: string): boolean {
  if ([...word].length < 2) return false
  if (word === word.toUpperCase()) return false // siglas: HTML, ONU, API
  if (/[\p{Ll}][\p{Lu}]/u.test(word)) return false // camelCase e nomes como iPhone, JavaScript
  if (/[\d_]/.test(before) || /[\d_]/.test(after)) return false // identificadores e códigos: v2beta, x_valor
  return true
}

/** Palavras do texto (já mascarado) que devem ir para o dicionário. */
export function extractWords(masked: string): WordRange[] {
  const words: WordRange[] = []
  for (const m of masked.matchAll(WORD)) {
    const offset = m.index
    const word = m[0]
    if (shouldCheck(word, masked[offset - 1] ?? '', masked[offset + word.length] ?? '')) words.push({ word, offset })
  }
  return words
}

/** Normaliza o apóstrofo tipográfico para o reto, que é o usado nos dicionários. */
export const normalizeWord = (word: string): string => word.replace(/’/g, "'")
