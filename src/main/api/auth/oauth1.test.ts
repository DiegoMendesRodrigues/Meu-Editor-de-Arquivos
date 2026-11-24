// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHmac, generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { percentEncode, signatureBaseString, signOAuth1 } from './oauth1'

const sigOf = (list: [string, string][] | undefined): string => list!.find(([k]) => k === 'oauth_signature')![1]

// Exemplo da RFC 5849, seção 3.4.1.1 (base string esperada).
const RFC_BASE =
  'POST&http%3A%2F%2Fexample.com%2Frequest&a2%3Dr%2520b%26a3%3D2%2520q%26a3%3Da%26b5%3D%253D%25253D%26c%2540%3D%26c2%3D%26oauth_consumer_key%3D9djdj82h48djs9d2%26oauth_nonce%3D7d8f3e4a%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D137131201%26oauth_token%3Dkkk9d7dh3k39sjv7'

describe('OAuth 1.0a', () => {
  it('codifica em percent como a RFC 3986', () => {
    expect(percentEncode("a b!'()*~-._é")).toBe('a%20b%21%27%28%29%2A~-._%C3%A9')
  })

  it('monta a base string do exemplo da RFC 5849 (seção 3.4.1)', () => {
    const base = signatureBaseString('POST', 'http://example.com/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b', [
      ['b5', '=%3D'], ['a3', 'a'], ['c@', ''], ['a2', 'r b'], ['c2', ''], ['a3', '2 q'],
      ['oauth_consumer_key', '9djdj82h48djs9d2'], ['oauth_token', 'kkk9d7dh3k39sjv7'],
      ['oauth_signature_method', 'HMAC-SHA1'], ['oauth_timestamp', '137131201'], ['oauth_nonce', '7d8f3e4a']
    ])
    expect(base).toBe(RFC_BASE)
  })

  it('lê a query da URL e o corpo ao assinar (mesma base string da RFC)', () => {
    const r = signOAuth1({
      method: 'POST',
      url: 'HTTP://Example.com:80/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b',
      bodyParams: [['c2', ''], ['a3', '2 q']],
      consumerKey: '9djdj82h48djs9d2',
      consumerSecret: 'j49sk3j29djd',
      token: 'kkk9d7dh3k39sjv7',
      tokenSecret: 'dh893hdasih9',
      signature: 'HMAC-SHA1',
      placement: 'query',
      nonce: '7d8f3e4a',
      timestamp: '137131201'
    })
    // Com oauth_version=1.0 a base muda em relação à RFC; confere o HMAC contra a base montada à mão.
    const base = RFC_BASE.replace(/%26oauth_token%3Dkkk9d7dh3k39sjv7$/, '%26oauth_token%3Dkkk9d7dh3k39sjv7%26oauth_version%3D1.0')
    expect(sigOf(r.queryParams)).toBe(createHmac('sha1', 'j49sk3j29djd&dh893hdasih9').update(base).digest('base64'))
  })

  it('assina o exemplo da especificação OAuth 1.0 (photos.example.net) com HMAC-SHA1', () => {
    const r = signOAuth1({
      method: 'GET',
      url: 'http://photos.example.net/photos?file=vacation.jpg&size=original',
      bodyParams: [],
      consumerKey: 'dpf43f3p2l4k3l03',
      consumerSecret: 'kd94hf93k423kf44',
      token: 'nnch734d00sl2jdk',
      tokenSecret: 'pfkkdhi9sl3r4s00',
      signature: 'HMAC-SHA1',
      placement: 'header',
      nonce: 'kllo9940pd9333jh',
      timestamp: '1191242096'
    })
    expect(r.header).toContain(`oauth_signature="${percentEncode('tR3+Ty81lMeYAr/Fid0kMTYa/WM=')}"`)
  })

  it('HMAC-SHA256 confere com o cálculo direto', () => {
    const url = 'https://api.exemplo.com.br/x'
    const r = signOAuth1({ method: 'GET', url, bodyParams: [], consumerKey: 'k', consumerSecret: 's', signature: 'HMAC-SHA256', placement: 'body', nonce: 'n', timestamp: '1' })
    const base = signatureBaseString('GET', url, [
      ['oauth_consumer_key', 'k'], ['oauth_nonce', 'n'], ['oauth_signature_method', 'HMAC-SHA256'], ['oauth_timestamp', '1'], ['oauth_version', '1.0']
    ])
    expect(sigOf(r.bodyParams)).toBe(createHmac('sha256', 's&').update(base).digest('base64'))
  })

  it('PLAINTEXT usa as chaves codificadas', () => {
    const r = signOAuth1({ method: 'GET', url: 'https://a.exemplo.com.br/', bodyParams: [], consumerKey: 'k', consumerSecret: 'a&b', tokenSecret: 'c d', signature: 'PLAINTEXT', placement: 'query' })
    expect(sigOf(r.queryParams)).toBe('a%26b&c%20d')
  })

  it('RSA-SHA1 produz uma assinatura que a chave pública confere', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string
    const input = { method: 'GET', url: 'https://api.exemplo.com.br/r?x=1', bodyParams: [] as [string, string][], consumerKey: 'k', consumerSecret: '', signature: 'RSA-SHA1' as const, privateKey: pem, placement: 'query' as const, nonce: 'n', timestamp: '1' }
    const r = signOAuth1(input)
    const base = signatureBaseString('GET', input.url, [
      ['x', '1'], ['oauth_consumer_key', 'k'], ['oauth_nonce', 'n'], ['oauth_signature_method', 'RSA-SHA1'], ['oauth_timestamp', '1'], ['oauth_version', '1.0']
    ])
    expect(verify('RSA-SHA1', Buffer.from(base), publicKey, Buffer.from(sigOf(r.queryParams), 'base64'))).toBe(true)
    expect(() => signOAuth1({ ...input, privateKey: undefined })).toThrow()
  })

  it('o realm vai no cabeçalho e fora da assinatura', () => {
    const base = { method: 'GET', url: 'https://a.exemplo.com.br/', bodyParams: [], consumerKey: 'k', consumerSecret: 's', signature: 'HMAC-SHA1' as const, placement: 'header' as const, nonce: 'n', timestamp: '1' }
    const a = signOAuth1({ ...base, realm: 'Fotos' }).header!
    const b = signOAuth1(base).header!
    expect(a.startsWith('OAuth realm="Fotos", ')).toBe(true)
    expect(a.replace('realm="Fotos", ', '')).toBe(b)
  })
})
