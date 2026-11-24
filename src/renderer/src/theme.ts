// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Tema claro ou escuro. Sem escolha do usuário, o app segue o sistema operacional (e acompanha
 * quando ele muda); a escolha feita em Exibir fica guardada na sessão.
 */
import { useEffect } from 'react'
import { create } from 'zustand'
import type { Theme } from '@shared/ipc'
import { useView } from '@/store/view'

const darkQuery = (): MediaQueryList => window.matchMedia('(prefers-color-scheme: dark)')

/** Tema do sistema operacional (só vale enquanto o usuário não escolheu um). */
const useSystemTheme = create<{ dark: boolean }>(() => ({ dark: darkQuery().matches }))

export const effectiveTheme = (choice: Theme | null, systemDark: boolean): Theme => choice ?? (systemDark ? 'dark' : 'light')

/** Tema em uso agora. */
export function useTheme(): Theme {
  const choice = useView((s) => s.theme)
  const systemDark = useSystemTheme((s) => s.dark)
  return effectiveTheme(choice, systemDark)
}

/** Alterna entre o claro e o escuro e guarda a escolha. */
export function toggleTheme(): void {
  const current = effectiveTheme(useView.getState().theme, useSystemTheme.getState().dark)
  useView.getState().setTheme(current === 'dark' ? 'light' : 'dark')
}

/** Aplica o tema à página (classe "dark" no <html>) e à janela (barra de título e diálogos nativos). */
export function useApplyTheme(): void {
  const choice = useView((s) => s.theme)
  const theme = useTheme()

  useEffect(() => {
    const query = darkQuery()
    const update = (): void => useSystemTheme.setState({ dark: query.matches })
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  // Com um tema fixo, o Main também fixa o prefers-color-scheme; com "system", volta a seguir o sistema.
  useEffect(() => {
    void window.api.setTheme(choice ?? 'system')
  }, [choice])
}
