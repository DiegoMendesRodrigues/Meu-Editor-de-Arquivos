import { realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

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

export function isInside(root: string, target: string): boolean {
  const rel = relative(norm(root), norm(target))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Resolve links simbólicos para que um link dentro da pasta não aponte para fora dela. */
async function real(p: string): Promise<string> {
  try {
    return await realpath(p)
  } catch {
    return resolve(p)
  }
}

export async function isAuthorized(target: string): Promise<boolean> {
  if (authorizedFiles.has(norm(target))) return true
  const realTarget = await real(target)
  for (const root of authorizedRoots) {
    if (isInside(root, target) && isInside(await real(root), realTarget)) return true
  }
  return false
}

export async function assertAuthorized(target: string): Promise<string> {
  const abs = resolve(target)
  if (!(await isAuthorized(abs))) throw new Error('Acesso negado: o caminho não foi aberto pelo usuário.')
  return abs
}
