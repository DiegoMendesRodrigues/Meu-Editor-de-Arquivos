// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { MASK, type ApiCollectionPayload, type ApiEnvironmentPayload } from '@shared/api/protocol'
import type { EnvironmentVariable } from '@shared/api/schema'
import { layeredLookup, resolveTemplate } from '@shared/api/variables'
import { secretVault } from './vault'

/** Escopo do cofre das variáveis secretas globais. */
export const GLOBALS_SCOPE = 'globals'

export interface Resolver {
  /** Troca as {{variáveis}} pelos valores (segredos inclusive); o que falta fica como está e vai para `missing`. */
  resolve(text: string): string
  /** Variáveis usadas e sem valor em nenhum escopo. */
  readonly missing: Set<string>
  /** Valores secretos que entraram em algum texto resolvido (para mascarar). */
  readonly secrets: Set<string>
  /** Escopos do cofre (ambiente, coleção, "globals") de onde saiu algum valor secreto usado. */
  readonly secretScopes: Set<string>
  /** Valor de uma variável pelo nome, nos mesmos escopos (usado para a senha do certificado). */
  lookup(name: string): string | undefined
  /** Troca os valores secretos usados (e a forma codificada na URL) por MASK. */
  mask(text: string): string
  /** Registra um valor derivado de segredo (token do OAuth, por exemplo) para ser mascarado. */
  addSecret(value: string): void
  /** Escopo do cofre para gravar extrações e tokens: o ambiente, ou "globals". */
  readonly scope: string
  /**
   * Foto dos valores que um script enxerga (escopos em camadas), sem marcar nenhum segredo como usado:
   * quem usa o valor de um segredo chama lookup(nome) depois, e só então o escopo vira "usado".
   */
  snapshot(): { values: Record<string, string>; secretNames: string[] }
  /** Define uma variável temporária (a mais forte), como as de um script ou do executor. */
  setTemporary(name: string, value: string): void
}

const secretNames = (vars: EnvironmentVariable[]): string[] => vars.filter((v) => v.secret).map((v) => v.key)

async function loadSecrets(scope: string, names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const name of names) {
    const value = await secretVault.get(scope, name)
    if (value !== undefined) map.set(name, value)
  }
  return map
}

/**
 * Monta o resolvedor com os escopos, do mais forte para o mais fraco: temporárias, ambiente, coleção e
 * globais (só segredos). Segredos vêm do cofre pelo id do ambiente ou da coleção; só existe no Main.
 */
export async function buildResolver(input: {
  environment: ApiEnvironmentPayload | null
  collection: ApiCollectionPayload | null
  temporary: Record<string, string>
}): Promise<Resolver> {
  const { environment, collection, temporary } = input
  const envSecrets = environment ? await loadSecrets(environment.id, secretNames(environment.variables)) : new Map<string, string>()
  const colSecrets = collection ? await loadSecrets(collection.id, secretNames(collection.variables)) : new Map<string, string>()
  const globalSecrets = await loadSecrets(GLOBALS_SCOPE, await secretVault.names(GLOBALS_SCOPE))

  const secrets = new Set<string>()
  const secretScopes = new Set<string>()
  const plain = (vars: EnvironmentVariable[] | undefined): Map<string, string> =>
    new Map((vars ?? []).filter((v) => !v.secret).map((v) => [v.key, v.value ?? ''] as const))
  const envPlain = plain(environment?.variables)
  const colPlain = plain(collection?.variables)

  const fromSecrets = (map: Map<string, string>, scopeId: string) => (name: string): string | undefined => {
    const value = map.get(name)
    if (value !== undefined) {
      secrets.add(value)
      secretScopes.add(scopeId)
    }
    return value
  }
  const tempMap = new Map(Object.entries(temporary))

  const lookup = layeredLookup(
    (n) => tempMap.get(n),
    (n) => envPlain.get(n) ?? fromSecrets(envSecrets, environment?.id ?? GLOBALS_SCOPE)(n),
    (n) => colPlain.get(n) ?? fromSecrets(colSecrets, collection?.id ?? GLOBALS_SCOPE)(n),
    fromSecrets(globalSecrets, GLOBALS_SCOPE)
  )

  const missing = new Set<string>()
  const encoded = (): string[] => [...secrets].flatMap((s) => [s, encodeURIComponent(s)])

  return {
    resolve(text) {
      const r = resolveTemplate(text, lookup)
      for (const m of r.missing) missing.add(m)
      return r.text
    },
    missing,
    secrets,
    secretScopes,
    lookup,
    mask(text) {
      let out = text
      // Os mais longos primeiro, para um segredo contido noutro não deixar sobras.
      for (const s of [...new Set(encoded())].filter((v) => v.length > 0).sort((a, b) => b.length - a.length)) out = out.split(s).join(MASK)
      return out
    },
    snapshot() {
      const values: Record<string, string> = Object.create(null)
      const secretNames = new Set<string>()
      // Do escopo mais fraco para o mais forte (como em layeredLookup, ao contrário).
      const put = (name: string, value: string, secret: boolean): void => {
        values[name] = value
        if (secret) secretNames.add(name)
        else secretNames.delete(name)
      }
      for (const [n, v] of globalSecrets) put(n, v, true)
      for (const [n, v] of colSecrets) put(n, v, true)
      for (const [n, v] of colPlain) put(n, v, false)
      for (const [n, v] of envSecrets) put(n, v, true)
      for (const [n, v] of envPlain) put(n, v, false)
      for (const [n, v] of tempMap) put(n, v, false)
      return { values: { ...values }, secretNames: [...secretNames] }
    },
    setTemporary(name, value) {
      tempMap.set(name, value)
    },
    addSecret(value) {
      if (!value) return
      secrets.add(value)
      secretScopes.add(environment?.id ?? GLOBALS_SCOPE)
    },
    scope: environment?.id ?? GLOBALS_SCOPE
  }
}
