// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Ajustes no texto Markdown que entra e sai da visualização editável. Funções puras. */

/** Separa o front matter (bloco --- ... --- no início do arquivo) do restante do Markdown. */
export function splitFrontMatter(markdown: string): { frontMatter: string; body: string } {
  const m = /^---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/.exec(markdown)
  return m ? { frontMatter: m[0], body: markdown.slice(m[0].length) } : { frontMatter: '', body: markdown }
}

const FENCE = /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:\n {0,3}\1[^\n]*|$(?![\s\S]))/gm

/** Partes do texto fora dos blocos de código (os blocos voltam intactos). */
function outsideCode(markdown: string, fn: (text: string) => string): string {
  let out = ''
  let last = 0
  for (const m of markdown.matchAll(FENCE)) {
    out += fn(markdown.slice(last, m.index)) + m[0]
    last = m.index + m[0].length
  }
  return out + fn(markdown.slice(last))
}

/** O documento tem HTML (fora do código)? O editor formatado não preserva HTML, então ele fica só para leitura. */
export function hasHtml(markdown: string): boolean {
  let found = false
  outsideCode(markdown, (text) => {
    if (/<!--|<\/?[A-Za-z][\w-]*(?:\s[^>\n]*)?\/?>/.test(text.replace(/(`+)[^`\n][^\n]*?\1/g, ''))) found = true
    return text
  })
  return found
}

/**
 * Texto gerado pelo editor formatado, no formato do arquivo: sem linhas em branco duplicadas fora do
 * código, com a quebra de linha final quando o original tinha, e com as quebras de linha do original (CRLF ou LF).
 */
export function finishMarkdown(generated: string, original: string): string {
  let text = outsideCode(generated.replace(/\r\n/g, '\n'), (part) => part.replace(/\n{3,}/g, '\n\n'))
  if (/\n$/.test(original)) text = text.replace(/\n*$/, '\n')
  return original.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text
}
