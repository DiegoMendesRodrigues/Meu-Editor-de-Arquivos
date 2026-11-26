// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Total de MB (bytes / 1024 / 1024) dos arquivos da nuvem, com 2 casas decimais no idioma dado. */
export function formatTotalMb(files: { size: number }[], locale?: string): string {
  const mb = files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024
  return mb.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
