// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Transformações de texto do menu Editar (letras e espaços), sem dependência dos editores. */

export type CaseMode = 'upper' | 'lower' | 'sentence'

const LETTER = /\p{L}/u
const SENTENCE_END = /[.!?…]/
/** Fecham a frase junto com a pontuação: aspas, parênteses e colchetes ("Fim." ou (Fim.)). */
const CLOSERS = /["'”’»)\]]/

/**
 * Modo Título (como em uma frase): tudo em minúsculas e só a primeira letra de cada frase em
 * maiúscula. Uma frase começa no início do texto, depois de uma quebra de linha ou depois de
 * ".", "!", "?" ou "…" seguido de espaço. Devolve uma função que pode receber o texto em partes
 * (os trechos da visualização formatada), mantendo o estado entre elas.
 */
export function sentenceCaser(): (chunk: string) => string {
  let atStart = true
  let afterEnd = false
  return (chunk) => {
    let out = ''
    for (const ch of chunk) {
      if (LETTER.test(ch)) {
        const upper = ch.toUpperCase()
        // Mantém o tamanho do texto (ß viraria "SS"), para não deslocar posições.
        out += atStart && upper.length === ch.length ? upper : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch
        atStart = false
        afterEnd = false
      } else {
        out += ch
        if (ch === '\n' || ch === '\r') atStart = true
        else if (SENTENCE_END.test(ch)) afterEnd = true
        else if (/\s/.test(ch)) {
          if (afterEnd) atStart = true
        } else if (!CLOSERS.test(ch)) afterEnd = false
      }
    }
    return out
  }
}

export function convertCaseText(text: string, mode: CaseMode): string {
  if (mode === 'upper') return text.toUpperCase()
  if (mode === 'lower') return text.toLowerCase()
  return sentenceCaser()(text)
}

export type TrimMode = 'right' | 'left' | 'both'

/** Remove espaços e tabulações à direita, à esquerda ou dos dois lados de uma linha. */
export function trimLine(line: string, mode: TrimMode): string {
  let out = line
  if (mode !== 'left') out = out.replace(/[ \t]+$/, '')
  if (mode !== 'right') out = out.replace(/^[ \t]+/, '')
  return out
}

/**
 * Troca espaços repetidos por um único espaço. A indentação do começo de cada linha é
 * preservada: em código, listas aninhadas do Markdown ou YAML ela faz parte do conteúdo.
 */
export function collapseDoubleSpaces(text: string): string {
  return text.replace(/^([ \t]*)(.*)$/gm, (_m, indent: string, rest: string) => indent + rest.replace(/ {2,}/g, ' '))
}

/**
 * Codifica ou decodifica o texto no formato de endereços web (URL). Texto com sequências %XX válidas é
 * decodificado; os demais são codificados. Um endereço completo (https://…) mantém a estrutura
 * (: / ? & = #); um trecho solto tem todos os caracteres especiais codificados.
 */
export function toggleUrlEncoding(text: string): { text: string; mode: 'encoded' | 'decoded' } {
  if (/%[0-9a-f]{2}/i.test(text)) {
    try {
      return { text: decodeURIComponent(text), mode: 'decoded' }
    } catch {
      // "%" solto ou sequência UTF-8 inválida: trata como texto comum e codifica.
    }
  }
  const encoded = /^[a-z][a-z0-9+.-]*:\/\//i.test(text.trim()) ? encodeURI(text) : encodeURIComponent(text)
  return { text: encoded, mode: 'encoded' }
}
