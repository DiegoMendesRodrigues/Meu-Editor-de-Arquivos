// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { LOCALES } from './i18n'
import { supportUrl } from './support'

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

  it('cobre todos os idiomas da interface', () => {
    for (const { code } of LOCALES) expect(supportUrl(code)).toMatch(/\?lang=[A-Za-z-]+$/)
  })
})
