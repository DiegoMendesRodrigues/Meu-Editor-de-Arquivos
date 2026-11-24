// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Certificado autoassinado para 127.0.0.1 gerado com o openssl da máquina; null se não houver openssl. */
export function selfSigned(): { key: string; cert: string } | null {
  try {
    const dir = mkdtempSync(join(tmpdir(), 'apicert-'))
    const key = join(dir, 'k.pem')
    const cert = join(dir, 'c.pem')
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' })
    return { key: readFileSync(key, 'utf8'), cert: readFileSync(cert, 'utf8') }
  } catch {
    return null
  }
}
