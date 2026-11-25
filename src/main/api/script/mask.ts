// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { MASK } from '@shared/api/protocol'
import type { ScriptOutput } from './types'

/** Troca os valores secretos conhecidos por MASK (os mais longos primeiro). */
export function maskText(text: string, secrets: string[]): string {
  let out = text
  for (const s of [...new Set(secrets)].filter((v) => v.length > 0).sort((a, b) => b.length - a.length)) out = out.split(s).join(MASK)
  return out
}

/** Console, nomes e mensagens dos testes saem sem os valores secretos. */
export function maskOutput(out: ScriptOutput, secrets: string[]): ScriptOutput {
  // Script que leu algum segredo: a saída pode conter o valor transformado (base64, fatias), o que a troca
  // literal não pega. Console e testes viram o marcador e todo env.set vai para o cofre.
  if (out.secretsRead.length > 0) {
    return {
      ...out,
      logs: out.logs.map((l) => ({ ...l, text: MASK })),
      tests: out.tests.map((t) => ({ ...t, name: MASK, ...(t.error !== undefined ? { error: MASK } : {}) })),
      envSets: out.envSets.map((e) => ({ ...e, secret: true }))
    }
  }
  const m = (t: string): string => maskText(t, secrets)
  return {
    ...out,
    logs: out.logs.map((l) => ({ ...l, text: m(l.text) })),
    tests: out.tests.map((t) => ({ ...t, name: m(t.name), ...(t.error !== undefined ? { error: m(t.error) } : {}) }))
  }
}
