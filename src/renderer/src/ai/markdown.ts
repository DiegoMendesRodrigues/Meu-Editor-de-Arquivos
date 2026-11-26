// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/

/** Trecho de uma resposta: texto corrido ou bloco de código (cercado por ```). */
export type AiBlock = { type: 'text'; text: string } | { type: 'code'; lang: string; text: string; closed: boolean }

/**
 * Separa a resposta em texto e blocos de código. Durante o streaming o último bloco pode estar aberto
 * (`closed: false`). Nada vira HTML: quem renderiza usa só elementos do React.
 */
export function splitBlocks(source: string): AiBlock[] {
  const blocks: AiBlock[] = []
  const lines = source.split('\n')
  let text: string[] = []
  let code: string[] | null = null
  let lang = ''
  let fence = ''
  const flushText = (): void => {
    const joined = text.join('\n')
    if (joined.trim() !== '') blocks.push({ type: 'text', text: joined.replace(/^\n+|\n+$/g, '') })
    text = []
  }
  for (const line of lines) {
    if (code === null) {
      const open = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)[^`]*$/.exec(line)
      if (open) {
        flushText()
        fence = open[1]!
        lang = open[2] ?? ''
        code = []
      } else text.push(line)
    } else {
      const close = new RegExp(`^\\s{0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`).test(line)
      if (close) {
        blocks.push({ type: 'code', lang, text: code.join('\n'), closed: true })
        code = null
      } else code.push(line)
    }
  }
  if (code !== null) blocks.push({ type: 'code', lang, text: code.join('\n'), closed: false })
  else flushText()
  return blocks
}

/** Pedaço de texto em linha: normal, `código` ou **negrito**. */
export type InlinePart = { kind: 'text' | 'code' | 'bold'; text: string }

export function splitInline(line: string): InlinePart[] {
  const parts: InlinePart[] = []
  const re = /`([^`\n]+)`|\*\*([^*\n]+)\*\*/g
  let last = 0
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) parts.push({ kind: 'text', text: line.slice(last, m.index) })
    if (m[1] !== undefined) parts.push({ kind: 'code', text: m[1] })
    else parts.push({ kind: 'bold', text: m[2]! })
    last = m.index + m[0].length
  }
  if (last < line.length) parts.push({ kind: 'text', text: line.slice(last) })
  return parts
}
