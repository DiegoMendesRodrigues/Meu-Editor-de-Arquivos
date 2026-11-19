/**
 * Transformações de texto Markdown, sem dependência do Monaco (testáveis isoladamente).
 */

const HEADING = /^(\s{0,3})#{1,6}\s+/
const BULLET = /^(\s*)[-*+]\s+/
const NUMBERED = /^(\s*)\d+[.)]\s+/
const QUOTE = /^(\s*)>\s?/

/** Aplica um nível de título (1 a 6) à linha; 0 transforma em texto normal. */
export function setHeading(line: string, level: number): string {
  const body = line.replace(HEADING, '$1')
  if (level <= 0) return body
  const indent = body.match(/^\s*/)![0]
  return `${indent}${'#'.repeat(Math.min(level, 6))} ${body.trimStart()}`
}

/** Liga ou desliga a lista com marcadores. Linhas em branco são preservadas. */
export function toggleBulletList(lines: string[]): string[] {
  const content = lines.filter((l) => l.trim() !== '')
  const allBullets = content.length > 0 && content.every((l) => BULLET.test(l))
  return lines.map((l) => {
    if (l.trim() === '') return l
    if (allBullets) return l.replace(BULLET, '$1')
    return l.replace(NUMBERED, '$1').replace(BULLET, '$1').replace(/^(\s*)/, '$1- ')
  })
}

/** Liga ou desliga a lista numerada, renumerando a partir de 1. */
export function toggleNumberedList(lines: string[]): string[] {
  const content = lines.filter((l) => l.trim() !== '')
  const allNumbered = content.length > 0 && content.every((l) => NUMBERED.test(l))
  let n = 0
  return lines.map((l) => {
    if (l.trim() === '') return l
    if (allNumbered) return l.replace(NUMBERED, '$1')
    n += 1
    return l.replace(BULLET, '$1').replace(NUMBERED, '$1').replace(/^(\s*)/, `$1${n}. `)
  })
}

/** Envolve o texto com o marcador (ex.: "**"), ou remove se já estiver envolvido. */
export function toggleWrap(text: string, marker: string): string {
  const m = marker.length
  if (text.length >= m * 2 && text.startsWith(marker) && text.endsWith(marker)) {
    const inner = text.slice(m, -m)
    // "*" não deve desfazer um "**negrito**".
    if (!(marker === '*' && inner.startsWith('*') && inner.endsWith('*') && !text.startsWith('***'))) return inner
  }
  return `${marker}${text}${marker}`
}

export function makeLink(text: string): string {
  const label = text.trim() || 'texto do link'
  return /^https?:\/\//.test(label) ? `[${label}](${label})` : `[${label}](https://)`
}

export function tableTemplate(columns = 3, rows = 2): string {
  const header = Array.from({ length: columns }, (_, i) => `Coluna ${i + 1}`)
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`
  return [
    line(header),
    line(header.map(() => '---')),
    ...Array.from({ length: rows }, () => line(header.map(() => '   ')))
  ].join('\n')
}

/** Remove formatação Markdown: títulos, listas, citações, ênfases, código e links. */
export function stripFormatting(text: string): string {
  return text
    .split(/(\r?\n)/)
    .map((part) =>
      /\r?\n/.test(part)
        ? part
        : part
            .replace(HEADING, '$1')
            .replace(QUOTE, '$1')
            .replace(BULLET, '$1')
            .replace(NUMBERED, '$1')
            .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/(\*\*|__)(.+?)\1/g, '$2')
            .replace(/~~(.+?)~~/g, '$1')
            .replace(/(\*|_)(.+?)\1/g, '$2')
            .replace(/`([^`]+)`/g, '$1')
    )
    .join('')
}
