// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { CookieJar, defaultPath, parseSetCookie, pathMatches } from './cookies'

const u = (s: string): URL => new URL(s)

describe('cookies: sufixo público', () => {
  it('recusa Domain= de sufixo público ou de um só rótulo', () => {
    const url = new URL('https://app.exemplo.com.br/')
    for (const d of ['com.br', 'br', 'com', 'co.uk', 'github.io']) {
      expect(parseSetCookie(`a=1; Domain=${d}`, new URL(`https://x.${d}/`)), d).toBeNull()
    }
    expect(parseSetCookie('a=1; Domain=exemplo.com.br', url)).not.toBeNull()
  })
})

describe('cookies (RFC 6265)', () => {
  it('guarda e devolve cookie simples só para o mesmo host', () => {
    const jar = new CookieJar()
    jar.store(['sid=abc; Path=/'], u('http://api.exemplo.com.br/login'))
    expect(jar.header(u('http://api.exemplo.com.br/x'))).toBe('sid=abc')
    expect(jar.header(u('http://outro.exemplo.com.br/x'))).toBeUndefined()
  })

  it('Domain vale também para subdomínios; rejeita domínio de outro site', () => {
    const jar = new CookieJar()
    jar.store(['a=1; Domain=exemplo.com.br'], u('http://api.exemplo.com.br/'))
    expect(jar.header(u('http://www.exemplo.com.br/'))).toBe('a=1')
    expect(parseSetCookie('b=1; Domain=outro.com', u('http://api.exemplo.com.br/'))).toBeNull()
    expect(parseSetCookie('b=1; Domain=br', u('http://api.exemplo.com.br/'))).toBeNull()
  })

  it('Path: usa o caminho padrão e só envia nos caminhos que casam', () => {
    expect(defaultPath('/a/b/c')).toBe('/a/b')
    expect(defaultPath('/a')).toBe('/')
    expect(pathMatches('/a/b', '/a')).toBe(true)
    expect(pathMatches('/ab', '/a')).toBe(false)
    const jar = new CookieJar()
    jar.store(['p=1; Path=/admin'], u('http://127.0.0.1/'))
    expect(jar.header(u('http://127.0.0.1/admin/x'))).toBe('p=1')
    expect(jar.header(u('http://127.0.0.1/publico'))).toBeUndefined()
  })

  it('Max-Age tem precedência sobre Expires e zero remove o cookie', () => {
    const jar = new CookieJar()
    const now = Date.now()
    jar.store(['a=1; Max-Age=60; Expires=Wed, 01 Jan 2000 00:00:00 GMT'], u('http://127.0.0.1/'), now)
    expect(jar.header(u('http://127.0.0.1/'), now + 1000)).toBe('a=1')
    expect(jar.header(u('http://127.0.0.1/'), now + 61_000)).toBeUndefined()
    jar.store(['b=2'], u('http://127.0.0.1/'), now)
    jar.store(['b=; Max-Age=0'], u('http://127.0.0.1/'), now)
    expect(jar.header(u('http://127.0.0.1/'), now)).toBeUndefined()
  })

  it('Secure só vai em https e os atributos aparecem na lista', () => {
    const jar = new CookieJar()
    jar.store(['s=1; Secure; HttpOnly; SameSite=Strict'], u('https://api.exemplo.com.br/'))
    expect(jar.header(u('http://api.exemplo.com.br/'))).toBeUndefined()
    expect(jar.header(u('https://api.exemplo.com.br/'))).toBe('s=1')
    expect(jar.list()[0]).toMatchObject({ name: 's', secure: true, httpOnly: true, sameSite: 'Strict', domain: 'api.exemplo.com.br' })
  })

  it('mesmo nome/domínio/caminho substitui; clear apaga por domínio e nome', () => {
    const jar = new CookieJar()
    jar.store(['a=1', 'b=2'], u('http://127.0.0.1/'))
    jar.store(['a=3'], u('http://127.0.0.1/'))
    expect(jar.header(u('http://127.0.0.1/'))).toBe('a=3; b=2')
    jar.clear('127.0.0.1', 'a')
    expect(jar.header(u('http://127.0.0.1/'))).toBe('b=2')
    jar.clear()
    expect(jar.list()).toEqual([])
  })
})
