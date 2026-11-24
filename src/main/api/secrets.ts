// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Cofre de segredos do Cliente de API (tokens, senhas, client secrets).
 *
 * Os valores ficam cifrados pelo cofre do sistema (safeStorage) num arquivo da pasta de dados, separados
 * por escopo (o id do ambiente, da coleção ou "globals"). Nunca vão para os arquivos .apienv/.apireq,
 * para a nuvem, para a sessão nem para os logs. Sem o cofre do sistema (Linux sem chaveiro), os
 * segredos ficam só na memória até o app fechar.
 *
 * Este módulo não depende do Electron, para poder ser testado: a cifra e o disco são injetados.
 */

export interface Cipher {
  /** O sistema oferece cifra persistente? */
  available(): boolean
  encrypt(plain: string): string
  decrypt(encoded: string): string
}

export interface VaultStorage {
  read(): Promise<string | null>
  write(text: string): Promise<void>
}

interface StoredVault {
  version: 1
  /** escopo → nome → valor cifrado (base64). */
  scopes: Record<string, Record<string, string>>
}

export class SecretVault {
  /** Valores em texto puro, carregados sob demanda; também é o único lugar quando não há cifra. */
  private values = new Map<string, Map<string, string>>()
  /** Carga em andamento ou concluída: chamadas simultâneas esperam a mesma leitura do disco. */
  private loading: Promise<void> | null = null
  /**
   * Entradas que não puderam ser decifradas (outro usuário ou computador). Não aparecem como segredos
   * guardados, mas são regravadas como estão, para que uma falha passageira não destrua o segredo.
   */
  private undecryptable = new Map<string, Map<string, string>>()
  private writing: Promise<void> = Promise.resolve()

  constructor(
    private readonly cipher: Cipher,
    private readonly storage: VaultStorage,
    private readonly onError: (message: string) => void = () => {}
  ) {}

  /** Os segredos sobrevivem ao fechar o app? */
  get persistent(): boolean {
    return this.cipher.available()
  }

  private load(): Promise<void> {
    this.loading ??= this.readFromDisk()
    return this.loading
  }

  private async readFromDisk(): Promise<void> {
    if (!this.cipher.available()) return
    let text: string | null
    try {
      text = await this.storage.read()
    } catch (err) {
      this.onError(`cofre ilegível: ${String(err)}`)
      return
    }
    if (!text) return
    try {
      const data = JSON.parse(text) as Partial<StoredVault>
      if (data.version !== 1 || !data.scopes || typeof data.scopes !== 'object') return
      for (const [scope, entries] of Object.entries(data.scopes)) {
        if (!entries || typeof entries !== 'object') continue
        const map = new Map<string, string>()
        const kept = new Map<string, string>()
        for (const [name, encoded] of Object.entries(entries)) {
          if (typeof encoded !== 'string') continue
          try {
            map.set(name, this.cipher.decrypt(encoded))
          } catch {
            // Cifrado em outro usuário ou computador: o segredo precisa ser informado de novo.
            kept.set(name, encoded)
          }
        }
        if (map.size > 0) this.values.set(scope, map)
        if (kept.size > 0) this.undecryptable.set(scope, kept)
      }
    } catch (err) {
      this.onError(`cofre inválido: ${String(err)}`)
    }
  }

  private persist(): Promise<void> {
    if (!this.cipher.available()) return Promise.resolve()
    // Object.fromEntries cria propriedades próprias (um escopo ou nome "__proto__" não vira protótipo).
    const scopes = new Set([...this.values.keys(), ...this.undecryptable.keys()])
    const data: StoredVault = {
      version: 1,
      scopes: Object.fromEntries(
        [...scopes].map((scope) => [
          scope,
          Object.fromEntries([
            ...(this.undecryptable.get(scope) ?? []),
            ...[...(this.values.get(scope) ?? [])].map(([name, value]) => [name, this.cipher.encrypt(value)])
          ])
        ])
      )
    }
    const text = JSON.stringify(data)
    // Gravações em fila: a última sempre vence, sem duas escritas simultâneas no mesmo arquivo.
    this.writing = this.writing.then(() => this.storage.write(text)).catch((err) => this.onError(`falha ao gravar o cofre: ${String(err)}`))
    return this.writing
  }

  async set(scope: string, name: string, value: string): Promise<void> {
    await this.load()
    let map = this.values.get(scope)
    if (!map) this.values.set(scope, (map = new Map()))
    map.set(name, value)
    this.forgetUndecryptable(scope, name)
    await this.persist()
  }

  async has(scope: string, name: string): Promise<boolean> {
    await this.load()
    return this.values.get(scope)?.has(name) ?? false
  }

  /** Nomes dos segredos guardados no escopo (nunca os valores). */
  async names(scope: string): Promise<string[]> {
    await this.load()
    return [...(this.values.get(scope)?.keys() ?? [])].sort()
  }

  async delete(scope: string, name: string): Promise<void> {
    await this.load()
    const map = this.values.get(scope)
    const removedValue = map?.delete(name) ?? false
    const removedKept = this.forgetUndecryptable(scope, name)
    if (map?.size === 0) this.values.delete(scope)
    if (removedValue || removedKept) await this.persist()
  }

  /** Apaga todos os segredos de um escopo (ambiente excluído). */
  async deleteScope(scope: string): Promise<void> {
    await this.load()
    const removedValues = this.values.delete(scope)
    const removedKept = this.undecryptable.delete(scope)
    if (removedValues || removedKept) await this.persist()
  }

  private forgetUndecryptable(scope: string, name: string): boolean {
    const kept = this.undecryptable.get(scope)
    if (!kept?.delete(name)) return false
    if (kept.size === 0) this.undecryptable.delete(scope)
    return true
  }

  /**
   * Valor do segredo, para uso exclusivo do Main na hora de enviar uma requisição.
   * Não existe canal IPC que devolva este valor ao Renderer.
   */
  async get(scope: string, name: string): Promise<string | undefined> {
    await this.load()
    return this.values.get(scope)?.get(name)
  }
}
