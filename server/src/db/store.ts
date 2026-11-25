// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Acesso a dados da API. Há uma implementação em memória (testes/desenvolvimento) e uma MySQL/MariaDB. */

export interface User {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: Date
  /** Último acesso (cadastro, login ou qualquer requisição autenticada); ausente em bancos ainda não migrados. */
  lastAccess?: Date
}

/** Uso da nuvem de um usuário. */
export interface Usage {
  storageBytes: number
  storedFiles: number
}

/** Uso da nuvem com os limites do plano (grupo) do usuário. */
export interface UsageWithPlan extends Usage {
  plan: { name: string; maxFiles: number; maxSizeMb: number }
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

export type MoveResult = { ok: true; file: FileMeta } | { ok: false; reason: 'not_found' | 'exists' }

export type DeleteFolderResult = 'ok' | 'not_found' | 'not_empty'
export type RenameFolderResult = 'ok' | 'not_found' | 'exists' | 'too_long'

/** Área de trabalho sincronizada (abas e textos não salvos), em JSON, com versão. */
export interface Workspace {
  data: string
  version: number
  updatedAt: Date
}

export type PutWorkspaceResult = { ok: true; workspace: Workspace } | { ok: false; current: Workspace }

export type UpsertResult = { ok: true; file: FileMeta } | { ok: false; current: FileMeta }

export interface Store {
  createUser(user: { email: string; name: string; passwordHash: string }): Promise<User | null> // null = e-mail já existe
  findUserByEmail(email: string): Promise<User | null>
  findUserById(id: string): Promise<User | null>
  updateUserName(id: string, name: string): Promise<void>
  setPassword(id: string, passwordHash: string): Promise<void>
  /** Grava o instante do último acesso do usuário. */
  touchLastAccess(userId: string, at: Date): Promise<void>

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

  getWorkspace(userId: string): Promise<Workspace | null>
  /** Grava a área de trabalho se a versão do cliente for a atual (0 = ainda não existe). */
  putWorkspace(userId: string, data: string, baseVersion: number): Promise<PutWorkspaceResult>
  /** Muda o caminho (pasta e/ou nome) do arquivo; falha se já houver um arquivo no destino. */
  moveFile(userId: string, id: string, newPath: string): Promise<MoveResult>

  /** Pastas criadas pelo usuário (as pastas dos caminhos dos arquivos também existem, implicitamente). */
  listFolders(userId: string): Promise<string[]>
  /** Cria a pasta (sem erro se já existir). */
  createFolder(userId: string, path: string): Promise<void>
  /** Remove a pasta, só se estiver vazia (sem arquivos nem subpastas). */
  deleteFolder(userId: string, path: string): Promise<DeleteFolderResult>
  /**
   * Renomeia (ou move) a pasta `from` para `to`, levando os arquivos e as subpastas.
   * Falha se a pasta não existir, se já houver algo em `to` ou se algum caminho passar de 512 caracteres.
   */
  renameFolder(userId: string, from: string, to: string): Promise<RenameFolderResult>

  /** Uso gravado para o usuário (bytes e número de arquivos) com os limites do plano dele. */
  getUsage(userId: string): Promise<UsageWithPlan>
  /**
   * Recalcula e grava o uso: espaço (soma dos arquivos + área de trabalho, isto é, textos dos
   * documentos não salvos) e número de arquivos. Recalculado, nunca somado aos poucos.
   * Chamado depois de cada gravação ou exclusão; devolve os novos totais.
   */
  refreshUsage(userId: string): Promise<Usage>

  /** Remove sessões e códigos de redefinição vencidos (ou já usados). */
  purgeExpired(now: Date): Promise<void>

  close(): Promise<void>
}
