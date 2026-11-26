// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { dirOfPath, relativizeProtoPaths, toRelativeProtoPath } from './grpcPaths'

describe('caminhos dos .proto relativos ao .apigrpc', () => {
  it('pasta do documento, no Windows e no Linux', () => {
    expect(dirOfPath('C:\\colecao\\api\\chamada.apigrpc')).toBe('C:/colecao/api')
    expect(dirOfPath('/home/ana/c/chamada.apigrpc')).toBe('/home/ana/c')
  })

  it('converte para relativo, com "/", só quando o arquivo está na pasta ou abaixo dela', () => {
    expect(toRelativeProtoPath('C:/colecao/api', 'C:\\colecao\\api\\protos\\eco.proto')).toBe('protos/eco.proto')
    expect(toRelativeProtoPath('C:\\colecao\\api', 'c:\\COLECAO\\api\\eco.proto')).toBe('eco.proto')
    expect(toRelativeProtoPath('/home/ana/c', '/home/ana/c/p/eco.proto')).toBe('p/eco.proto')
    expect(toRelativeProtoPath('/home/ana/c', '/home/ana/outra/eco.proto')).toBe('/home/ana/outra/eco.proto')
    expect(toRelativeProtoPath('/home/ana/c', '/home/ana/c2/eco.proto')).toBe('/home/ana/c2/eco.proto')
    expect(toRelativeProtoPath('C:/colecao/api', 'D:\\x\\eco.proto')).toBe('D:\\x\\eco.proto')
    expect(toRelativeProtoPath('/home/ana/c', 'protos/eco.proto')).toBe('protos/eco.proto')
    expect(toRelativeProtoPath('', '/x/eco.proto')).toBe('/x/eco.proto')
  })

  it('a lista só muda (nova referência) quando algo foi convertido', () => {
    const same = ['/fora/a.proto']
    expect(relativizeProtoPaths('/home/c', same)).toBe(same)
    expect(relativizeProtoPaths('/home/c', ['/home/c/a.proto', '/fora/b.proto'])).toEqual(['a.proto', '/fora/b.proto'])
  })
})
