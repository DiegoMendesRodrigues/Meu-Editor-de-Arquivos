// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { RequestSettings } from '@shared/api/schema'
import { ApiFail } from './errors'

/** Resolve o proxy do sistema (PAC/WPAD/variáveis) para uma URL; no Main usa session.defaultSession.resolveProxy. */
export type SystemProxyResolver = (url: string) => Promise<string>

async function defaultSystemResolver(url: string): Promise<string> {
  const { session } = await import('electron')
  return session.defaultSession.resolveProxy(url)
}

/** Lê o resultado do resolveProxy ("PROXY host:porta; DIRECT"): o primeiro item que o cliente sabe usar. */
export function parseProxyList(list: string): URL | null {
  for (const raw of list.split(';')) {
    const item = raw.trim()
    if (!item) continue
    if (/^DIRECT$/i.test(item)) return null
    const m = /^(?:PROXY|HTTP)\s+(\S+)$/i.exec(item)
    if (m) {
      try {
        return new URL(`http://${m[1]}`)
      } catch {
        continue
      }
    }
    // SOCKS e HTTPS não são suportados: tenta o próximo item.
  }
  return null
}

/**
 * Proxy a usar para a URL de destino: null = conexão direta. "manual" recusa endereço inválido (código proxy);
 * "system" que falha ao consultar o sistema cai para conexão direta.
 */
export async function chooseProxy(
  settings: Pick<RequestSettings, 'proxy' | 'proxyUrl'>,
  target: URL,
  systemResolve: SystemProxyResolver = defaultSystemResolver
): Promise<URL | null> {
  if (settings.proxy === 'none') return null
  if (settings.proxy === 'manual') {
    const text = settings.proxyUrl.trim()
    if (!text) throw new ApiFail('proxy')
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`)
      if (url.protocol !== 'http:' || !url.hostname) throw new Error('esquema')
      return url
    } catch {
      throw new ApiFail('proxy')
    }
  }
  try {
    return parseProxyList(await systemResolve(target.href))
  } catch {
    return null
  }
}

/** Cabeçalho Proxy-Authorization para um proxy com usuário e senha na URL. */
export function proxyAuthHeader(proxy: URL): string | undefined {
  if (!proxy.username && !proxy.password) return undefined
  const user = decodeURIComponent(proxy.username)
  const pass = decodeURIComponent(proxy.password)
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}
