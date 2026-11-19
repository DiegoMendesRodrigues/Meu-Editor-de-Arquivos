// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LOCALES, translate, type MessageKey } from '@shared/i18n'
import { ptBR } from '@shared/i18n/pt-BR'

const ROOT = resolve('docs/manual')
const source = (locale: string): string => readFileSync(join(ROOT, 'src', `${locale}.md`), 'utf8')
const images = (md: string): string[] => [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1])
const headings = (md: string): string[] => [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1])
const placeholders = (md: string): string[] => [...md.matchAll(/\{\{([\w.]+)\}\}/g)].map((m) => m[1])

describe('manual do usuário', () => {
  it('existe um manual para cada idioma do aplicativo', () => {
    for (const { code } of LOCALES) {
      expect(existsSync(join(ROOT, 'src', `${code}.md`)), `texto-fonte de ${code}`).toBe(true)
      expect(existsSync(join(ROOT, code, 'index.html')), `HTML gerado de ${code} (rode npm run manual:build)`).toBe(true)
    }
  })

  it('os seis manuais têm as mesmas seções, as mesmas telas e os mesmos rótulos da interface', () => {
    const reference = source('pt-BR')
    for (const { code } of LOCALES) {
      const md = source(code)
      expect(headings(md), code).toHaveLength(headings(reference).length)
      expect(images(md), code).toEqual(images(reference))
      expect(placeholders(md).sort(), code).toEqual(placeholders(reference).sort())
    }
  })

  it('todo {{rótulo}} citado existe no dicionário e todas as telas existem em cada idioma', () => {
    for (const { code } of LOCALES) {
      const md = source(code)
      for (const key of new Set(placeholders(md))) {
        if (key === 'shortcuts' || key === 'version') continue
        expect(key in ptBR, `${code}: {{${key}}}`).toBe(true)
        expect(translate(code, key as MessageKey).trim(), `${code}: {{${key}}}`).not.toBe('')
      }
      for (const image of images(md)) expect(existsSync(join(ROOT, code, image)), `${code}: ${image}`).toBe(true)
    }
  })

  it('o HTML gerado cita a versão do aplicativo e não deixa marcadores sem preencher', () => {
    const version = (JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }).version
    for (const { code } of LOCALES) {
      const html = readFileSync(join(ROOT, code, 'index.html'), 'utf8')
      expect(html, code).toContain(version)
      expect(html, code).not.toMatch(/\{\{[\w.]+\}\}/)
      expect(html, code).not.toContain('<!--SHORTCUTS-->')
    }
  })
})
