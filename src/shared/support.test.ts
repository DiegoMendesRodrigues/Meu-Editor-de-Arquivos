// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { LOCALES } from './i18n'
import { cloudPlansUrl, manageSubscriptionUrl, supportUrl } from './support'

describe('página de suporte no idioma do aplicativo', () => {
  it('usa o código de idioma do site para cada idioma', () => {
    const base = 'https://meueditordearquivos.aplicativoia.online/suporte.php?lang='
    expect(supportUrl('de')).toBe(base + 'de')
    expect(supportUrl('es')).toBe(base + 'es')
    expect(supportUrl('fr')).toBe(base + 'fr-FR')
    expect(supportUrl('en')).toBe(base + 'en')
    expect(supportUrl('pt-BR')).toBe(base + 'pt-BR')
    expect(supportUrl('pt-PT')).toBe(base + 'pt')
  })

  it('monta o link de gerenciar assinatura com token e idioma', () => {
    const url = new URL(manageSubscriptionUrl('fr', 'a b&c=d'))
    expect(url.origin + url.pathname).toBe('https://meueditordearquivos.aplicativoia.online/assinatura.php')
    expect(url.searchParams.get('token')).toBe('a b&c=d')
    expect(url.searchParams.get('lang')).toBe('fr-FR')
    expect(new URL(manageSubscriptionUrl('pt-PT', 't')).searchParams.get('lang')).toBe('pt')
  })

  it('abre os planos da nuvem (criar conta) no idioma do aplicativo', () => {
    const base = 'https://meueditordearquivos.aplicativoia.online/nuvem.php?lang='
    expect(cloudPlansUrl('pt-BR')).toBe(base + 'pt-BR')
    expect(cloudPlansUrl('pt-PT')).toBe(base + 'pt')
    expect(cloudPlansUrl('fr')).toBe(base + 'fr-FR')
    expect(cloudPlansUrl('de')).toBe(base + 'de')
  })

  it('cobre todos os idiomas da interface', () => {
    for (const { code } of LOCALES) expect(supportUrl(code)).toMatch(/\?lang=[A-Za-z-]+$/)
  })
})
