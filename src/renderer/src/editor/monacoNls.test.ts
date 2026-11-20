// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PT_MESSAGES } from './monacoNls'

// Os textos em português são ligados às mensagens do Monaco pelo índice. Se uma atualização do
// monaco-editor mudar os índices, este teste avisa (cada índice ainda precisa ser um texto da janela de correções).
const EXPECTED: Record<number, RegExp> = {
  904: /Quick Fix\.\.\./, 915: /Hide Disabled/, 916: /Show Disabled/, 917: /More Actions/, 918: /Quick Fix/,
  930: /Run: \{0\}/, 931: /Preferred Quick Fix/, 932: /Show Code Actions \(\{0\}\)/, 933: /Show Code Actions/,
  1195: /View Problem/, 1196: /No quick fixes/, 1197: /Checking for quick fixes/, 1198: /No quick fixes/, 1199: /Quick Fix\.\.\./, 1668: /Quick Fix/
}

/** Texto original de cada índice usado, lido do código do Monaco. */
function originals(indices: number[]): Map<number, string> {
  const found = new Map<number, string>()
  const re = /localize2?\((\d+), (["'])((?:(?!\2).)*)\2/g
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.js')) {
        for (const m of readFileSync(full, 'utf8').matchAll(re)) {
          const index = Number(m[1])
          if (indices.includes(index)) found.set(index, m[3])
        }
      }
    }
  }
  walk('node_modules/monaco-editor/esm/vs')
  return found
}

describe('PT_MESSAGES', () => {
  it('cada índice corresponde ao texto original esperado do Monaco', () => {
    const indices = Object.keys(PT_MESSAGES).map(Number)
    const found = originals(indices)
    for (const index of indices) expect(found.get(index), `índice ${index}`).toMatch(EXPECTED[index])
  })
})
