// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { ApiCollectionPayload, ApiEnvironmentPayload } from '@shared/api/protocol'
import { layeredLookup, resolveTemplate } from '@shared/api/variables'
import { secretVault } from '../vault'

/**
 * Resolve {{variáveis}} dos campos do OAuth no Main: ambiente ativo, depois coleção. Variáveis secretas
 * vêm do cofre (escopo do ambiente ou da coleção). Os valores só existem aqui; nada volta ao Renderer.
 */
export async function buildOAuthResolver(
  environment: ApiEnvironmentPayload | null,
  collection: ApiCollectionPayload | null
): Promise<(text: string) => string> {
  const layer = async (scope: string, vars: { key: string; value?: string; secret: boolean }[]): Promise<Record<string, string>> => {
    const out: Record<string, string> = {}
    for (const v of vars) {
      const value = v.secret ? await secretVault.get(scope, v.key) : v.value
      if (value !== undefined) out[v.key] = value
    }
    return out
  }
  const env = environment ? await layer(environment.id, environment.variables) : {}
  const col = collection ? await layer(collection.id, collection.variables) : {}
  const globals: Record<string, string> = {}
  // Segredos do escopo global ("globals") ficam por último.
  for (const name of await secretVault.names('globals')) {
    const v = await secretVault.get('globals', name)
    if (v !== undefined) globals[name] = v
  }
  const lookup = layeredLookup(env, col, globals)
  return (text) => resolveTemplate(text, lookup).text
}
