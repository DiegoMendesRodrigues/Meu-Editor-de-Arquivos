// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Nome de arquivo ou pasta (só o nome, sem o caminho) aceito ao renomear pela barra lateral.
 * As regras valem nos dois sistemas: sem separadores, sem os caracteres proibidos no Windows,
 * sem caracteres de controle, sem "." ou ".." e sem terminar em ponto ou espaço.
 */
export const MAX_NAME_LENGTH = 255

export type NameProblem = 'empty' | 'invalid' | 'tooLong'

const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/
/** Nomes reservados no Windows (CON, NUL, COM1...), com ou sem extensão. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i

export function checkName(raw: string): NameProblem | null {
  const name = raw.trim()
  if (name === '') return 'empty'
  if (name.length > MAX_NAME_LENGTH) return 'tooLong'
  if (FORBIDDEN.test(name) || name === '.' || name === '..' || /[. ]$/.test(name) || RESERVED.test(name)) return 'invalid'
  return null
}
