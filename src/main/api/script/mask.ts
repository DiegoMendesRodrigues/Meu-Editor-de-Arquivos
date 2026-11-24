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
  const m = (t: string): string => maskText(t, secrets)
  return {
    ...out,
    logs: out.logs.map((l) => ({ ...l, text: m(l.text) })),
    tests: out.tests.map((t) => ({ ...t, name: m(t.name), ...(t.error !== undefined ? { error: m(t.error) } : {}) }))
  }
}
