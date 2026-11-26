// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import log from 'electron-log/main'

/**
 * Hosts confirmados pelo usuário para receber segredos de cada escopo do cofre (ambiente, coleção ou
 * "globals"), em userData/api-trust.json. Um .apireq de terceiros não consegue mandar {{token}} para um
 * host qualquer: o primeiro envio para um host novo pede confirmação.
 */
const trustPath = (): string => join(app.getPath('userData'), 'api-trust.json')

const MAX_HOSTS_PER_SCOPE = 500
const MAX_SCOPES = 500

let cache: Map<string, Set<string>> | null = null
let loading: Promise<Map<string, Set<string>>> | null = null
let writing: Promise<void> = Promise.resolve()

const normalize = (host: string): string => host.trim().toLowerCase()

function load(): Promise<Map<string, Set<string>>> {
  // Leituras simultâneas compartilham a mesma promessa (senão cada uma criaria um mapa próprio).
  if (cache) return Promise.resolve(cache)
  return (loading ??= read())
}

async function read(): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>()
  try {
    const data = JSON.parse(await readFile(trustPath(), 'utf8')) as { scopes?: unknown }
    if (data.scopes && typeof data.scopes === 'object') {
      for (const [scope, hosts] of Object.entries(data.scopes as Record<string, unknown>).slice(0, MAX_SCOPES)) {
        if (scope === '__proto__' || !Array.isArray(hosts)) continue
        map.set(scope, new Set(hosts.filter((h): h is string => typeof h === 'string' && h.length <= 255).slice(0, MAX_HOSTS_PER_SCOPE).map(normalize)))
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') log.warn('Cliente de API: lista de hosts confiáveis ilegível, começando vazia')
  }
  cache = map
  loading = null
  return map
}

/** Gravação atômica (arquivo temporário e rename), em fila: a última sempre vence. */
function persist(): Promise<void> {
  const scopes: Record<string, string[]> = {}
  for (const [scope, hosts] of cache ?? []) scopes[scope] = [...hosts]
  const text = JSON.stringify({ version: 1, scopes })
  writing = writing
    .then(async () => {
      const tmp = `${trustPath()}.tmp`
      await writeFile(tmp, text, 'utf8')
      await rename(tmp, trustPath())
    })
    .catch(() => log.warn('Cliente de API: falha ao gravar os hosts confiáveis'))
  return writing
}

/** Todos os escopos já confirmaram o host? (Sem escopos, não há o que confirmar.) */
export async function isHostTrusted(scopes: Iterable<string>, host: string): Promise<boolean> {
  const map = await load()
  const h = normalize(host)
  for (const scope of scopes) if (!map.get(scope)?.has(h)) return false
  return true
}

/** Grava a confirmação do host para os escopos. */
export async function trustHost(scopes: Iterable<string>, host: string): Promise<void> {
  const map = await load()
  const h = normalize(host)
  if (!h) return
  for (const scope of scopes) {
    let set = map.get(scope)
    if (!set) {
      if (map.size >= MAX_SCOPES) continue
      map.set(scope, (set = new Set()))
    }
    if (set.size < MAX_HOSTS_PER_SCOPE) set.add(h)
  }
  await persist()
}

/** Só para os testes: esquece o cache em memória. */
export const resetTrustCache = (): void => {
  cache = null
  loading = null
}
