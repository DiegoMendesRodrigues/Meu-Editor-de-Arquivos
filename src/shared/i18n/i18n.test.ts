// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { de } from './de'
import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { detectLocale, LOCALES, translate, untitledNumber } from './index'
import { ptBR } from './pt-BR'
import { ptPT } from './pt-PT'

const all = { 'pt-BR': ptBR, 'pt-PT': ptPT, en, de, es, fr } as Record<string, Record<string, string>>
const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('idiomas', () => {
  it('oferece os seis idiomas pedidos', () => {
    expect(LOCALES.map((l) => l.code)).toEqual(['de', 'es', 'fr', 'en', 'pt-BR', 'pt-PT'])
  })

  it('todos os idiomas têm exatamente as mesmas chaves e os mesmos parâmetros', () => {
    const keys = Object.keys(ptBR).sort()
    for (const [code, dict] of Object.entries(all)) {
      expect(Object.keys(dict).sort(), code).toEqual(keys)
      for (const key of keys) expect(placeholders(dict[key]), `${code} ${key}`).toEqual(placeholders(ptBR[key as keyof typeof ptBR]))
    }
  })

  it('nenhuma tradução está vazia', () => {
    for (const [code, dict] of Object.entries(all)) {
      for (const [key, text] of Object.entries(dict)) expect(text.trim(), `${code} ${key}`).not.toBe('')
    }
  })

  it('os idiomas de fato são diferentes entre si nos textos principais', () => {
    expect(translate('en', 'menu.file')).toBe('File')
    expect(translate('de', 'menu.file')).toBe('Datei')
    expect(translate('es', 'menu.file')).toBe('Archivo')
    expect(translate('fr', 'menu.file')).toBe('Fichier')
    expect(translate('pt-BR', 'menu.file')).toBe('Arquivo')
    expect(translate('pt-PT', 'menu.file')).toBe('Ficheiro')
  })
})

describe('detecção do idioma do sistema', () => {
  it('usa o idioma do sistema quando ele existe na lista', () => {
    expect(detectLocale(['de-DE'])).toBe('de')
    expect(detectLocale(['es-MX'])).toBe('es')
    expect(detectLocale(['fr-CA'])).toBe('fr')
    expect(detectLocale(['en-GB'])).toBe('en')
  })

  it('distingue o português do Brasil do de Portugal', () => {
    expect(detectLocale(['pt-BR'])).toBe('pt-BR')
    expect(detectLocale(['pt'])).toBe('pt-BR')
    expect(detectLocale(['pt-PT'])).toBe('pt-PT')
    expect(detectLocale(['pt-AO'])).toBe('pt-PT')
    expect(detectLocale(['pt_pt'])).toBe('pt-PT')
  })

  it('sem idioma disponível, abre em inglês; respeita a ordem de preferência', () => {
    expect(detectLocale(['ja-JP'])).toBe('en')
    expect(detectLocale([])).toBe('en')
    expect(detectLocale(['ja-JP', 'fr-FR', 'de-DE'])).toBe('fr')
  })
})

describe('tradução', () => {
  it('troca parâmetros e escolhe singular ou plural', () => {
    expect(translate('en', 'search.matches', { n: 1 })).toBe('1 match')
    expect(translate('en', 'search.matches', { n: 3 })).toBe('3 matches')
    expect(translate('pt-BR', 'search.matches', { n: 1 })).toBe('1 ocorrência')
    expect(translate('de', 'menu.account.profile', { name: 'Ana' })).toBe('Mein Profil (Ana)...')
  })

  it('mantém {nome} quando o parâmetro não foi informado', () => {
    expect(translate('en', 'tab.close', {})).toBe('Close {name}')
  })

  it('reconhece documentos sem título de qualquer idioma', () => {
    expect(untitledNumber('Sem título 4.md')).toBe(4)
    expect(untitledNumber('Untitled 7.txt')).toBe(7)
    expect(untitledNumber('Unbenannt 2.py')).toBe(2)
    expect(untitledNumber('Sin título 5.sql')).toBe(5)
    expect(untitledNumber('Sans titre 9.md')).toBe(9)
    expect(untitledNumber('relatorio.md')).toBe(0)
  })
})
