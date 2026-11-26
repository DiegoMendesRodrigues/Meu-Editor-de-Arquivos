// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useApiSidebarVisible } from '@/api/ApiSidebar'
import { useAccount } from '@/store/account'
import { useApiStore } from '@/store/api'
import { useCloud, useStorageMode } from '@/store/cloud'
import { isSectionVisible, useSidebarLayout, type SidebarContext, type SidebarSectionId } from '@/store/sidebarLayout'
import { useView } from '@/store/view'

/** Contexto atual da barra lateral (API ligada? nuvem em uso?). */
export function useSidebarContext(): SidebarContext {
  const apiOn = useApiSidebarVisible()
  const cloudMode = useStorageMode() === 'cloud'
  return { apiOn, cloudMode }
}

/** Diz se cada área está de fato na barra lateral agora; é a mesma regra do `Sidebar` e do menu Exibir. */
export function useSectionVisible(): (id: SidebarSectionId) => boolean {
  const ctx = useSidebarContext()
  const hidden = useSidebarLayout((s) => s.hidden)
  return (id) => isSectionVisible(id, ctx, hidden)
}

/** A nuvem só aparece com a conta conectada: sem ela não há o que ligar por aqui. */
export function useCanShowSection(): (id: SidebarSectionId) => boolean {
  const user = useAccount((s) => s.status.user)
  return (id) => id !== 'cloud' || user !== null
}

/** Faz a área aparecer de verdade: desoculta e liga o que ela precisar. */
export function showSection(id: SidebarSectionId): void {
  useSidebarLayout.getState().setHidden(id, false)
  if (!useView.getState().sidebarVisible) useView.getState().toggle('sidebarVisible')
  if (id === 'apiEnv' || id === 'apiCollections' || id === 'apiHistory') useApiStore.getState().setSidebarOn(true)
  if (id === 'cloud') useCloud.getState().setPreferCloud(true)
}

/** Alterna pelo menu Exibir: marcado oculta (como o X); desmarcado exibe de verdade. */
export function toggleSectionVisible(id: SidebarSectionId, visibleNow: boolean): void {
  if (visibleNow) useSidebarLayout.getState().setHidden(id, true)
  else showSection(id)
}
