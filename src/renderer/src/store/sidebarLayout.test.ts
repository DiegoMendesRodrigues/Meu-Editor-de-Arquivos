// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { moveSection, normalizeOrder, SIDEBAR_SECTIONS } from './sidebarLayout'

describe('ordem das áreas da barra lateral', () => {
  it('completa a ordem guardada com as áreas novas e descarta ids desconhecidos e repetidos', () => {
    expect(normalizeOrder(['recent', 'x', 'recent', 'openDocs'])).toEqual(['recent', 'openDocs', ...SIDEBAR_SECTIONS.filter((id) => id !== 'recent' && id !== 'openDocs')])
    expect(normalizeOrder('lixo')).toEqual([...SIDEBAR_SECTIONS])
  })

  it('move para antes ou depois do alvo', () => {
    const order = normalizeOrder([])
    expect(moveSection(order, 'recent', 'openDocs', false)[0]).toBe('recent')
    const after = moveSection(order, 'openDocs', 'recent', true)
    expect(after.at(-1)).toBe('openDocs')
    expect(moveSection(order, 'explorer', 'explorer', true)).toBe(order)
  })
})
