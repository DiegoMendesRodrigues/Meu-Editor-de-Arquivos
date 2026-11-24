// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHash, randomBytes } from 'node:crypto'

/** Valor aleatório em base64url (sem "=" nem caracteres especiais), para state e code_verifier. */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url')

/** code_verifier (RFC 7636, 4.1): 43 a 128 caracteres; 32 bytes aleatórios dão 43. */
export const createCodeVerifier = (): string => randomToken(32)

/** code_challenge do método S256 (RFC 7636, 4.2): BASE64URL(SHA256(verifier)). */
export const codeChallengeS256 = (verifier: string): string => createHash('sha256').update(verifier, 'ascii').digest('base64url')
