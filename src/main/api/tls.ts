// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { rootCertificates, type PeerCertificate, type TLSSocket } from 'node:tls'
import type { ApiTlsInfo } from '@shared/api/protocol'
import type { RequestSettings } from '@shared/api/schema'
import { ApiFail } from './errors'
import { readAuthorizedFile } from './files'

/** Material de TLS já lido do disco (os arquivos passam por assertAuthorized). */
export interface TlsMaterial {
  ca?: (string | Buffer)[]
  cert?: Buffer
  key?: Buffer
  pfx?: Buffer
  passphrase?: string
}

/**
 * Lê a CA própria e o certificado de cliente. A senha vem da variável secreta indicada em passphraseVar
 * (resolvida pelo chamador).
 */
export async function loadTlsMaterial(
  settings: Pick<RequestSettings, 'caPath' | 'clientCert'>,
  documentPath: string | null,
  passphrase: (name: string) => string | undefined
): Promise<TlsMaterial> {
  const material: TlsMaterial = {}
  if (settings.caPath) {
    // Soma às CAs padrão: a CA própria costuma assinar só os servidores internos.
    material.ca = [...rootCertificates, await readAuthorizedFile(settings.caPath, documentPath)]
  }
  const cc = settings.clientCert
  if (cc && (cc.pfxPath || cc.certPath)) {
    if (cc.pfxPath) material.pfx = await readAuthorizedFile(cc.pfxPath, documentPath)
    else {
      if (!cc.keyPath) throw new ApiFail('clientCert')
      material.cert = await readAuthorizedFile(cc.certPath, documentPath)
      material.key = await readAuthorizedFile(cc.keyPath, documentPath)
    }
    if (cc.passphraseVar) material.passphrase = passphrase(cc.passphraseVar)
  }
  return material
}

const dn = (name: PeerCertificate['issuer'] | undefined): string =>
  name
    ? Object.entries(name)
        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : v}`)
        .join(', ')
    : ''

/** Dados do certificado e da sessão TLS para a aba Tempos. */
export function describeTls(socket: TLSSocket): ApiTlsInfo {
  const cert = socket.getPeerCertificate()
  const err = socket.authorizationError as unknown
  const info: ApiTlsInfo = {
    protocol: socket.getProtocol() ?? '',
    cipher: socket.getCipher()?.name,
    issuer: dn(cert?.issuer),
    subject: dn(cert?.subject),
    validFrom: cert?.valid_from ?? '',
    validTo: cert?.valid_to ?? '',
    authorized: socket.authorized
  }
  if (!socket.authorized && err) info.authorizationError = typeof err === 'string' ? err : ((err as { code?: string }).code ?? String(err))
  return info
}
