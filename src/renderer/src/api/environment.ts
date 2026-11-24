// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { apiCollectionSchema, apiEnvironmentSchema, type ApiCollection, type ApiEnvironment } from '@shared/api/schema'
import { API_LIMITS } from '@shared/api/limits'

/** Texto do .apienv: JSON com 2 espaços, chaves na ordem do schema e quebra de linha no fim. */
export function serializeEnvironment(env: ApiEnvironment): string {
  return `${JSON.stringify(apiEnvironmentSchema.parse(env), null, 2)}\n`
}

/** Lê o texto de um .apienv; null se não for um ambiente válido. */
export function parseEnvironment(text: string): ApiEnvironment | null {
  if (text.length > API_LIMITS.requestFileChars) return null
  try {
    const parsed = apiEnvironmentSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Ambiente novo e válido, sem variáveis. */
export function newEnvironment(name: string): ApiEnvironment {
  return apiEnvironmentSchema.parse({
    $schema: 'meu-editor/api-environment@1',
    id: globalThis.crypto.randomUUID(),
    name,
    production: false,
    variables: []
  })
}

/** Texto do collection.apicol (ou folder.apicol): JSON com 2 espaços e quebra de linha no fim. */
export function serializeCollection(col: ApiCollection): string {
  return `${JSON.stringify(apiCollectionSchema.parse(col), null, 2)}\n`
}

export function parseCollection(text: string): ApiCollection | null {
  if (text.length > API_LIMITS.requestFileChars) return null
  try {
    const parsed = apiCollectionSchema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Coleção (ou pasta) nova e válida. */
export function newCollection(name: string, auth: ApiCollection['auth'] = { type: 'none' }): ApiCollection {
  return apiCollectionSchema.parse({
    $schema: 'meu-editor/api-collection@1',
    id: globalThis.crypto.randomUUID(),
    name,
    auth,
    variables: [],
    order: [],
    syncResponses: false
  })
}
