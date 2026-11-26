// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { tm } from '../i18n'
import { lstat, readlink, realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'

/**
 * Controle de acesso ao disco. O Renderer só lê ou grava:
 * - arquivos escolhidos pelo usuário num diálogo nativo (ou já usados antes, nos recentes);
 * - arquivos dentro de uma pasta que o usuário abriu pelo diálogo nativo.
 * Assim, um conteúdo malicioso no Renderer não alcança caminhos arbitrários.
 */
const authorizedFiles = new Set<string>()
const authorizedRoots = new Set<string>()

/** No Windows o sistema de arquivos ignora maiúsculas/minúsculas. */
const norm = (p: string): string => {
  const abs = resolve(p)
  return process.platform === 'win32' ? abs.toLowerCase() : abs
}

export const authorizeFile = (p: string): void => void authorizedFiles.add(norm(p))
export const authorizeRoot = (p: string): void => void authorizedRoots.add(norm(p))

/**
 * Arquivos que só o Main lê (chaves privadas, certificados, PKCS#12 escolhidos no Cliente de API). Não entram em
 * `authorizedFiles`: o `readFile` genérico do Renderer não os devolve, e o material das chaves fica no Main.
 */
const mainOnlyFiles = new Set<string>()
export const authorizeMainOnlyFile = (p: string): void => void mainOnlyFiles.add(norm(p))

/** A pasta foi aberta pelo usuário (é exatamente uma das pastas autorizadas)? */
export const isAuthorizedRoot = (p: string): boolean => authorizedRoots.has(norm(p))

export function isInside(root: string, target: string): boolean {
  const rel = relative(norm(root), norm(target))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/**
 * Resolve links simbólicos para que um link dentro da pasta não aponte para fora dela.
 * Se o destino ainda não existe, resolve o ancestral existente mais próximo e reanexa o resto
 * (assim `pasta/link/novo.txt` com `link` apontando para fora é reconhecido como fora). Um link
 * pendente (destino inexistente) como último componente também é seguido.
 */
export async function real(p: string, depth = 0): Promise<string> {
  const abs = resolve(p)
  try {
    return await realpath(abs)
  } catch {
    // segue adiante
  }
  if (depth > 16) return abs
  try {
    if ((await lstat(abs)).isSymbolicLink()) {
      const alvo = resolve(dirname(abs), await readlink(abs))
      return await real(alvo, depth + 1)
    }
  } catch {
    // não existe
  }
  const pai = dirname(abs)
  if (pai === abs) return abs
  return join(await real(pai, depth + 1), basename(abs))
}

/** No Windows, `:` depois da letra da unidade indica fluxo alternativo de dados (NTFS). */
const hasAlternateStream = (p: string): boolean =>
  process.platform === 'win32' && resolve(p).slice(2).includes(':')

export async function isAuthorized(target: string): Promise<boolean> {
  if (hasAlternateStream(target)) return false
  if (authorizedFiles.has(norm(target))) return true
  const realTarget = await real(target)
  for (const root of authorizedRoots) {
    if (isInside(root, target) && isInside(await real(root), realTarget)) return true
  }
  return false
}

export async function assertAuthorized(target: string): Promise<string> {
  const abs = resolve(target)
  if (!(await isAuthorized(abs))) throw new Error(tm('err.notAuthorized'))
  return abs
}

/** Para leituras feitas só no Main (envio do Cliente de API): aceita também os arquivos de `authorizeMainOnlyFile`. */
export async function assertAuthorizedForMain(target: string): Promise<string> {
  const abs = resolve(target)
  if (!hasAlternateStream(abs) && mainOnlyFiles.has(norm(abs))) return abs
  return assertAuthorized(abs)
}
