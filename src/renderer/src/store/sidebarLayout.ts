// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { create } from 'zustand'

/** Áreas da barra lateral. A ordem aqui é a padrão; áreas novas entram no fim da ordem guardada. */
export const SIDEBAR_SECTIONS = ['openDocs', 'apiEnv', 'apiCollections', 'apiHistory', 'cloud', 'explorer', 'recent'] as const
export type SidebarSectionId = (typeof SIDEBAR_SECTIONS)[number]

const STORAGE_KEY = 'sidebar.layout'

interface StoredLayout {
  order: SidebarSectionId[]
  collapsed: SidebarSectionId[]
}

const isSection = (v: unknown): v is SidebarSectionId => typeof v === 'string' && (SIDEBAR_SECTIONS as readonly string[]).includes(v)

/** Completa e limpa a ordem guardada: sem repetidos, sem ids desconhecidos e com as áreas que faltarem no fim. */
export function normalizeOrder(order: unknown): SidebarSectionId[] {
  const list = Array.isArray(order) ? order.filter(isSection) : []
  const unique = [...new Set(list)]
  return [...unique, ...SIDEBAR_SECTIONS.filter((id) => !unique.includes(id))]
}

/** Move `id` para antes (ou depois) de `target`. Mover para si mesmo não muda nada. */
export function moveSection(order: SidebarSectionId[], id: SidebarSectionId, target: SidebarSectionId, after: boolean): SidebarSectionId[] {
  if (id === target) return order
  const rest = order.filter((x) => x !== id)
  const at = rest.indexOf(target)
  if (at < 0) return order
  rest.splice(after ? at + 1 : at, 0, id)
  return rest
}

function load(): StoredLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const data = raw ? (JSON.parse(raw) as Partial<StoredLayout>) : {}
    return { order: normalizeOrder(data.order), collapsed: Array.isArray(data.collapsed) ? data.collapsed.filter(isSection) : [] }
  } catch {
    return { order: [...SIDEBAR_SECTIONS], collapsed: [] }
  }
}

function save(layout: StoredLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
  } catch {
    // Sem armazenamento (janela privada, cota): a ordem vale só até fechar o app.
  }
}

interface SidebarLayoutState extends StoredLayout {
  toggle: (id: SidebarSectionId) => void
  move: (id: SidebarSectionId, target: SidebarSectionId, after: boolean) => void
  /** Sobe (-1) ou desce (+1) uma posição entre as áreas visíveis agora. */
  step: (id: SidebarSectionId, delta: -1 | 1, visible: SidebarSectionId[]) => void
}

/** Ordem e áreas recolhidas da barra lateral, guardadas neste computador. */
export const useSidebarLayout = create<SidebarLayoutState>((set, get) => {
  const commit = (patch: Partial<StoredLayout>): void => {
    set(patch)
    const { order, collapsed } = get()
    save({ order, collapsed })
  }
  return {
    ...load(),
    toggle: (id) => {
      const { collapsed } = get()
      commit({ collapsed: collapsed.includes(id) ? collapsed.filter((x) => x !== id) : [...collapsed, id] })
    },
    move: (id, target, after) => commit({ order: moveSection(get().order, id, target, after) }),
    step: (id, delta, visible) => {
      const shown = get().order.filter((x) => visible.includes(x))
      const target = shown[shown.indexOf(id) + delta]
      if (target) commit({ order: moveSection(get().order, id, target, delta > 0) })
    }
  }
})
