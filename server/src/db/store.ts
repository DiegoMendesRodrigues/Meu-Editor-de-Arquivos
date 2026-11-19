// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Acesso a dados da API. Há uma implementação em memória (testes/desenvolvimento) e uma MySQL/MariaDB. */

export interface User {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: Date
}

export interface RemoteFile {
  id: string
  path: string
  content: string
  encoding: 'UTF-8' | 'UTF-8 BOM'
  version: number
  size: number
  updatedAt: Date
}

export type FileMeta = Omit<RemoteFile, 'content'>

export interface UpsertFileInput {
  path: string
  content: string
  encoding: 'UTF-8' | 'UTF-8 BOM'
  /** Versão que o cliente tinha ao editar; null = o cliente acredita que o arquivo ainda não existe. */
  baseVersion: number | null
  /** Ignora a checagem de versão (o usuário escolheu sobrescrever). */
  force: boolean
}

export type UpsertResult = { ok: true; file: FileMeta } | { ok: false; current: FileMeta }

export interface Store {
  createUser(user: { email: string; name: string; passwordHash: string }): Promise<User | null> // null = e-mail já existe
  findUserByEmail(email: string): Promise<User | null>
  findUserById(id: string): Promise<User | null>
  updateUserName(id: string, name: string): Promise<void>
  setPassword(id: string, passwordHash: string): Promise<void>

  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>
  findSession(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | null>
  deleteSession(tokenHash: string): Promise<void>
  /** Encerra as sessões do usuário, exceto a informada (ou todas, se null). */
  deleteSessionsExcept(userId: string, keepTokenHash: string | null): Promise<void>

  createReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void>
  /** Consome o token de redefinição (uso único) e devolve o usuário; null se inválido, usado ou expirado. */
  consumeReset(tokenHash: string): Promise<string | null>

  listFiles(userId: string): Promise<FileMeta[]>
  getFile(userId: string, id: string): Promise<RemoteFile | null>
  upsertFile(userId: string, input: UpsertFileInput): Promise<UpsertResult>
  deleteFile(userId: string, id: string): Promise<boolean>

  close(): Promise<void>
}
