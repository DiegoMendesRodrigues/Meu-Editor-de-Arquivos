// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Caminhos dos .proto no .apigrpc: relativos à pasta do documento quando o arquivo está nela ou abaixo
 * dela (sempre com "/", também no Windows), absolutos nos demais casos. Funções puras de texto.
 */

export const isAbsolutePath = (p: string): boolean => /^[a-z]:[\\/]/i.test(p) || /^[\\/]/.test(p)

const slashes = (p: string): string => p.replace(/\\/g, '/')

/** Pasta de um caminho de arquivo (sem a barra final); '' quando não há pasta. */
export function dirOfPath(file: string): string {
  const n = slashes(file)
  const i = n.lastIndexOf('/')
  return i <= 0 ? (i === 0 ? '/' : '') : n.slice(0, i)
}

/** Converte para relativo só se `file` for absoluto e estiver dentro de `baseDir`; senão devolve igual. */
export function toRelativeProtoPath(baseDir: string, file: string): string {
  if (!isAbsolutePath(file) || baseDir === '') return file
  const base = slashes(baseDir).replace(/\/+$/, '')
  const f = slashes(file)
  // Unidade do Windows (C:) e UNC não diferenciam maiúsculas.
  const insensitive = /^[a-z]:/i.test(base) || base.startsWith('//')
  const a = insensitive ? base.toLowerCase() : base
  const b = insensitive ? f.toLowerCase() : f
  return b.startsWith(`${a}/`) && f.length > base.length + 1 ? f.slice(base.length + 1) : file
}

/** Converte a lista; devolve a mesma lista (mesma referência) quando nada muda. */
export function relativizeProtoPaths(baseDir: string, files: string[]): string[] {
  const out = files.map((f) => toRelativeProtoPath(baseDir, f))
  return out.some((p, i) => p !== files[i]) ? out : files
}
