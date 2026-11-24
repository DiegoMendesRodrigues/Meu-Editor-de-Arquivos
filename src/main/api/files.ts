// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { assertAuthorized } from '../ipc/access'
import { ApiFail } from './errors'

/** Caminho do usuário: relativo vale em relação à pasta do documento (.apireq); sem documento, é recusado. */
export function resolveUserPath(path: string, documentPath: string | null): string {
  if (isAbsolute(path)) return path
  if (!documentPath) throw new ApiFail('fileNotFound')
  return resolve(dirname(documentPath), path)
}

/** Confere a autorização (diálogo ou pasta aberta) antes de tocar no arquivo. */
export async function authorizedPath(path: string, documentPath: string | null): Promise<string> {
  const abs = resolveUserPath(path, documentPath)
  try {
    return await assertAuthorized(abs)
  } catch {
    throw new ApiFail('fileNotAuthorized')
  }
}

const mapFsError = (err: unknown): never => {
  const code = (err as NodeJS.ErrnoException)?.code
  throw new ApiFail(code === 'ENOENT' || code === 'EISDIR' || code === 'ENOTDIR' ? 'fileNotFound' : 'unknown')
}

export async function readAuthorizedFile(path: string, documentPath: string | null): Promise<Buffer> {
  const abs = await authorizedPath(path, documentPath)
  try {
    return await readFile(abs)
  } catch (err) {
    return mapFsError(err)
  }
}

export async function statAuthorizedFile(path: string, documentPath: string | null): Promise<{ path: string; size: number }> {
  const abs = await authorizedPath(path, documentPath)
  try {
    const s = await stat(abs)
    if (!s.isFile()) throw new ApiFail('fileNotFound')
    return { path: abs, size: s.size }
  } catch (err) {
    if (err instanceof ApiFail) throw err
    return mapFsError(err)
  }
}
