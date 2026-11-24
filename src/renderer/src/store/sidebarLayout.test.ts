// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { beforeEach, describe, expect, it } from 'vitest'
import { isSectionVisible, moveSection, normalizeOrder, SIDEBAR_SECTIONS, useSidebarLayout, type SidebarSectionId } from './sidebarLayout'

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

describe('áreas ocultas da barra lateral', () => {
  beforeEach(() => useSidebarLayout.setState({ hidden: [], order: normalizeOrder([]) }))

  it('oculta e exibe sem mexer na ordem', () => {
    const order = useSidebarLayout.getState().order
    useSidebarLayout.getState().setHidden('cloud', true)
    useSidebarLayout.getState().setHidden('cloud', true)
    expect(useSidebarLayout.getState().hidden).toEqual(['cloud'])
    useSidebarLayout.getState().toggleHidden('cloud')
    expect(useSidebarLayout.getState().hidden).toEqual([])
    expect(useSidebarLayout.getState().order).toEqual(order)
  })

  it('alterna pelo toggleHidden', () => {
    useSidebarLayout.getState().toggleHidden('openDocs')
    expect(useSidebarLayout.getState().hidden).toContain('openDocs')
  })
})

describe('visibilidade de cada área da barra lateral', () => {
  const visibles = (ctx: { apiOn: boolean; cloudMode: boolean }, hidden: SidebarSectionId[] = []) => SIDEBAR_SECTIONS.filter((id) => isSectionVisible(id, ctx, hidden))

  it('sem a parte de API ligada, as áreas de API não estão visíveis', () => {
    expect(visibles({ apiOn: false, cloudMode: false })).toEqual(['openDocs', 'explorer', 'recent'])
  })

  it('com a API ligada, as três áreas de API aparecem', () => {
    expect(visibles({ apiOn: true, cloudMode: false })).toEqual(['openDocs', 'apiEnv', 'apiCollections', 'apiHistory', 'explorer', 'recent'])
  })

  it('no modo nuvem entra a Nuvem e saem o explorador e os recentes', () => {
    expect(visibles({ apiOn: false, cloudMode: true })).toEqual(['openDocs', 'cloud'])
  })

  it('uma área oculta pelo usuário nunca está visível', () => {
    expect(visibles({ apiOn: true, cloudMode: false }, ['apiEnv', 'openDocs'])).not.toContain('apiEnv')
    expect(isSectionVisible('openDocs', { apiOn: false, cloudMode: false }, ['openDocs'])).toBe(false)
  })
})
