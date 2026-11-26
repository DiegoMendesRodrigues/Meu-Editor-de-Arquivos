// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Literais de texto por linguagem. */

/** Literal entre aspas duplas de JS, Python, Go, Java e C# (as sequências do JSON são válidas nelas). */
export const dq = (s: string): string => JSON.stringify(s)

/** Rust não aceita \uXXXX: usa \u{XXXX}. */
export const rustStr = (s: string): string => JSON.stringify(s).replace(/\\u([0-9a-fA-F]{4})/g, '\\u{$1}')

/** Bash: aspas simples, com a aspa simples interna fechando e reabrindo o texto. */
export const bashStr = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

/** PowerShell: aspas simples, duplicando a aspa interna. */
export const psStr = (s: string): string => `'${s.replace(/'/g, "''")}'`

/** PHP: aspas simples (não interpola nada, então {{variável}} e $ saem como estão). */
export const phpStr = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
