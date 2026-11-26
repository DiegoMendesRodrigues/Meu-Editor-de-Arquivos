// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHash } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getLocale: () => 'pt-BR', getPath: () => '.' },
  safeStorage: { isAsyncEncryptionAvailable: async () => false },
  shell: { openExternal: vi.fn() }
}))
vi.mock('electron-log/main', () => ({ default: { warn: vi.fn() } }))
// Cofre em memória (sem cifra do sistema): é o mesmo SecretVault, só sem o Electron.
vi.mock('../vault', async () => {
  const { SecretVault } = await import('../secrets')
  return { secretVault: new SecretVault({ available: async () => false, encrypt: async (s) => s, decrypt: async (s) => s }, { read: async () => null, write: async () => {} }) }
})

import { secretVault } from '../vault'
import { startLoopback } from './loopback'
import { authorizeOAuth2, clearOAuthToken, getOAuth2AccessToken, oauthTokenInfo, type OAuth2Auth } from './oauth2'
import { codeChallengeS256, createCodeVerifier } from './pkce'

const servers: Server[] = []
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => (s.closeAllConnections(), s.close(() => r())))
})

interface Captured {
  headers: IncomingMessage['headers']
  url: string
  form: URLSearchParams
}

/** Servidor de token local: cada resposta vem do handler, que também vê o que foi enviado. */
async function tokenServer(handler: (req: Captured, n: number) => { status?: number; body: unknown }): Promise<{ url: string; calls: Captured[] }> {
  const calls: Captured[] = []
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const captured: Captured = { headers: req.headers, url: req.url ?? '', form: new URLSearchParams(Buffer.concat(chunks).toString('utf8')) }
      calls.push(captured)
      const { status = 200, body } = handler(captured, calls.length)
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    })
  })
  servers.push(server)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls }
}

const baseAuth = (patch: Partial<OAuth2Auth>): OAuth2Auth => ({
  type: 'oauth2',
  flow: 'clientCredentials',
  tokenUrl: '',
  clientId: 'app',
  scopes: [],
  pkce: true,
  tokenVar: 'token',
  autoRefresh: true,
  ...patch
})
const opts = { verifyTls: true, resolve: (t: string) => t }

describe('PKCE (RFC 7636)', () => {
  it('gera o code_challenge S256 do vetor do apêndice B', () => {
    expect(codeChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('o verifier tem entre 43 e 128 caracteres do alfabeto permitido', () => {
    const v = createCodeVerifier()
    expect(v).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/)
    expect(createCodeVerifier()).not.toBe(v)
  })
})

describe('servidor de loopback', () => {
  const pages = { success: 'ok', failure: 'falha' }

  it('aceita uma única chamada e se fecha', async () => {
    const loop = await startLoopback({ state: 's1', timeoutMs: 5000, pages })
    expect(loop.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/)
    const res = await fetch(`${loop.redirectUri}?code=abc&state=s1`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
    expect(await loop.result).toEqual({ ok: true, code: 'abc' })
    // Já fechado: uma segunda chamada não é atendida.
    await new Promise((r) => setTimeout(r, 50))
    await expect(fetch(`${loop.redirectUri}?code=outro&state=s1`)).rejects.toThrow()
  })

  it('recusa um state errado', async () => {
    const loop = await startLoopback({ state: 's1', timeoutMs: 5000, pages })
    const res = await fetch(`${loop.redirectUri}?code=abc&state=falso`)
    expect(res.status).toBe(400)
    expect(await loop.result).toEqual({ ok: false, code: 'stateMismatch' })
  })

  it('responde 404 a outros caminhos sem consumir a chamada', async () => {
    const loop = await startLoopback({ state: 's1', timeoutMs: 5000, pages })
    const other = loop.redirectUri.replace('/callback', '/outro')
    expect((await fetch(other)).status).toBe(404)
    await fetch(`${loop.redirectUri}?code=c&state=s1`)
    expect(await loop.result).toEqual({ ok: true, code: 'c' })
  })

  it('o erro do provedor vira "denied"; tempo limite e cancelamento fecham', async () => {
    const a = await startLoopback({ state: 's', timeoutMs: 5000, pages })
    await fetch(`${a.redirectUri}?error=access_denied&state=s`)
    expect(await a.result).toEqual({ ok: false, code: 'denied' })

    const b = await startLoopback({ state: 's', timeoutMs: 30, pages })
    expect(await b.result).toEqual({ ok: false, code: 'timeout' })

    const ctl = new AbortController()
    const c = await startLoopback({ state: 's', timeoutMs: 5000, signal: ctl.signal, pages })
    ctl.abort()
    expect(await c.result).toEqual({ ok: false, code: 'cancelled' })
  })
})

describe('Client Credentials e refresh', () => {
  it('obtém o token com client_secret_basic e guarda no cofre', async () => {
    const srv = await tokenServer(() => ({ body: { access_token: 'AT1', expires_in: 3600, token_type: 'Bearer' } }))
    const auth = baseAuth({ tokenUrl: `${srv.url}/token`, clientSecret: '{{segredo}}', scopes: ['a', 'b'], audience: 'https://api.exemplo.com.br' })
    const r = await authorizeOAuth2('env1', auth, { ...opts, resolve: (t) => t.replace('{{segredo}}', 's3gr3d0'), openExternal: vi.fn() })
    expect(r).toMatchObject({ ok: true, tokenVar: 'token', hasRefreshToken: false })
    const call = srv.calls[0]!
    expect(call.headers.authorization).toBe(`Basic ${Buffer.from('app:s3gr3d0').toString('base64')}`)
    expect(call.form.get('grant_type')).toBe('client_credentials')
    expect(call.form.get('scope')).toBe('a b')
    expect(call.form.get('audience')).toBe('https://api.exemplo.com.br')
    expect(call.form.has('client_secret')).toBe(false)
    expect(await secretVault.get('env1', 'token')).toBe('AT1')
    expect(await oauthTokenInfo('env1', 'token')).toMatchObject({ exists: true, hasRefreshToken: false })
  })

  it('token endpoint em http só vale em loopback', async () => {
    const auth = baseAuth({ tokenUrl: 'http://api.exemplo.com.br/token' })
    expect(await authorizeOAuth2('env3', auth, { ...opts, openExternal: vi.fn() })).toEqual({ ok: false, code: 'invalidConfig' })
  })

  it('variável sem valor é configuração inválida, e o erro do servidor não vaza', async () => {
    const auth = baseAuth({ tokenUrl: 'http://127.0.0.1:1/token', clientId: '{{semValor}}' })
    expect(await authorizeOAuth2('env2', auth, { ...opts, openExternal: vi.fn() })).toEqual({ ok: false, code: 'invalidConfig' })

    const srv = await tokenServer(() => ({ status: 401, body: { error: 'invalid_client', error_description: 'segredo interno' } }))
    const r = await authorizeOAuth2('env2', baseAuth({ tokenUrl: `${srv.url}/t` }), { ...opts, openExternal: vi.fn() })
    expect(r).toEqual({ ok: false, code: 'denied' })
    expect(JSON.stringify(r)).not.toContain('interno')
  })

  it('renova com o refresh token quando expirado e mantém o refresh antigo se o servidor não mandar outro', async () => {
    await secretVault.set('env3', 'token', 'velho')
    await secretVault.set('env3', 'token.__expiresAt', new Date(Date.now() - 1000).toISOString())
    await secretVault.set('env3', 'token.__refresh', 'RT1')
    const srv = await tokenServer(() => ({ body: { access_token: 'novo', expires_in: 60 } }))
    const auth = baseAuth({ flow: 'authorizationCode', tokenUrl: `${srv.url}/t` })
    expect(await getOAuth2AccessToken('env3', auth, opts)).toBe('novo')
    expect(srv.calls[0]!.form.get('grant_type')).toBe('refresh_token')
    expect(srv.calls[0]!.form.get('refresh_token')).toBe('RT1')
    expect(await secretVault.get('env3', 'token.__refresh')).toBe('RT1')
    // Agora vale: sem nova chamada.
    expect(await getOAuth2AccessToken('env3', auth, opts)).toBe('novo')
    expect(srv.calls).toHaveLength(1)
  })

  it('sem autoRefresh o token vencido não é usado; sem token, devolve undefined', async () => {
    await secretVault.set('env4', 'token', 'velho')
    await secretVault.set('env4', 'token.__expiresAt', new Date(Date.now() - 1000).toISOString())
    const auth = baseAuth({ flow: 'authorizationCode', autoRefresh: false, tokenUrl: 'http://127.0.0.1:1/t' })
    expect(await getOAuth2AccessToken('env4', auth, opts)).toBeUndefined()
    expect(await getOAuth2AccessToken('env-vazio', auth, opts)).toBeUndefined()
  })

  it('Client Credentials pede outro token sozinho quando não há nenhum', async () => {
    const srv = await tokenServer(() => ({ body: { access_token: 'auto', expires_in: 60 } }))
    expect(await getOAuth2AccessToken('env5', baseAuth({ tokenUrl: `${srv.url}/t` }), opts)).toBe('auto')
  })

  it('limpar remove token, expiração e refresh', async () => {
    await secretVault.set('env6', 'token', 'x')
    await secretVault.set('env6', 'token.__refresh', 'r')
    await clearOAuthToken('env6', 'token')
    expect(await oauthTokenInfo('env6', 'token')).toEqual({ exists: false, hasRefreshToken: false })
    expect(await secretVault.names('env6')).toEqual([])
  })
})

describe('Authorization Code com PKCE', () => {
  it('abre o navegador, confere o state e troca o código com o code_verifier', async () => {
    const srv = await tokenServer(() => ({ body: { access_token: 'AC', refresh_token: 'RR', expires_in: 100 } }))
    let challenge = ''
    const openExternal = vi.fn(async (url: string) => {
      const u = new URL(url)
      challenge = u.searchParams.get('code_challenge') ?? ''
      expect(u.searchParams.get('code_challenge_method')).toBe('S256')
      expect(u.searchParams.get('response_type')).toBe('code')
      expect(u.searchParams.get('scope')).toBe('openid email')
      // O "navegador": volta para o loopback com o state recebido.
      void fetch(`${u.searchParams.get('redirect_uri')}?code=CODIGO&state=${u.searchParams.get('state')}`)
    })
    const auth = baseAuth({ flow: 'authorizationCode', authUrl: 'https://auth.exemplo.com.br/authorize?tenant=1', tokenUrl: `${srv.url}/t`, scopes: ['openid', 'email'] })
    const r = await authorizeOAuth2('env7', auth, { ...opts, openExternal })
    expect(r).toMatchObject({ ok: true, hasRefreshToken: true })
    const form = srv.calls[0]!.form
    expect(form.get('grant_type')).toBe('authorization_code')
    expect(form.get('code')).toBe('CODIGO')
    expect(createHash('sha256').update(form.get('code_verifier')!).digest('base64url')).toBe(challenge)
    expect(form.get('client_id')).toBe('app')
    expect(await secretVault.get('env7', 'token.__refresh')).toBe('RR')
  })

  it('state divergente no retorno do navegador não troca o código', async () => {
    const srv = await tokenServer(() => ({ body: { access_token: 'x' } }))
    const openExternal = vi.fn((url: string) => {
      const u = new URL(url)
      void fetch(`${u.searchParams.get('redirect_uri')}?code=C&state=outro`)
    })
    const auth = baseAuth({ flow: 'authorizationCode', authUrl: 'https://auth.exemplo.com.br/a', tokenUrl: `${srv.url}/t` })
    expect(await authorizeOAuth2('env8', auth, { ...opts, openExternal })).toEqual({ ok: false, code: 'stateMismatch' })
    expect(srv.calls).toHaveLength(0)
  })

  it('o cancelamento e o tempo limite encerram a espera', async () => {
    const auth = baseAuth({ flow: 'authorizationCode', authUrl: 'https://auth.exemplo.com.br/a', tokenUrl: 'http://127.0.0.1:1/t' })
    expect(await authorizeOAuth2('env9', auth, { ...opts, openExternal: vi.fn(), timeoutMs: 40 })).toEqual({ ok: false, code: 'timeout' })
    const ctl = new AbortController()
    const p = authorizeOAuth2('env9', auth, { ...opts, openExternal: () => void setTimeout(() => ctl.abort(), 20), signal: ctl.signal })
    expect(await p).toEqual({ ok: false, code: 'cancelled' })
  })
})

describe('Device Code (RFC 8628)', () => {
  it('mostra o código, espera em authorization_pending e respeita slow_down', async () => {
    let polls = 0
    const srv = await tokenServer((req) => {
      if (req.url === '/device') return { body: { device_code: 'DC', user_code: 'WDJB-MJHT', verification_uri: 'https://auth.exemplo.com.br/device', expires_in: 600, interval: 2 } }
      polls++
      if (polls === 1) return { status: 400, body: { error: 'authorization_pending' } }
      if (polls === 2) return { status: 400, body: { error: 'slow_down' } }
      return { body: { access_token: 'DEV', expires_in: 60 } }
    })
    const waits: number[] = []
    const progress = vi.fn()
    const auth = baseAuth({ flow: 'deviceCode', authUrl: `${srv.url}/device`, tokenUrl: `${srv.url}/token` })
    const r = await authorizeOAuth2('env10', auth, { ...opts, openExternal: vi.fn(), onProgress: progress, sleep: async (ms) => void waits.push(ms) })
    expect(r).toMatchObject({ ok: true })
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ userCode: 'WDJB-MJHT', verificationUri: 'https://auth.exemplo.com.br/device' }))
    expect(waits).toEqual([2000, 2000, 7000])
    expect(srv.calls.at(-1)!.form.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:device_code')
    expect(srv.calls.at(-1)!.form.get('device_code')).toBe('DC')
    expect(await secretVault.get('env10', 'token')).toBe('DEV')
  })

  it('access_denied e expired_token viram códigos', async () => {
    const mk = async (error: string, status = 400) =>
      tokenServer((req) =>
        req.url === '/device'
          ? { body: { device_code: 'D', user_code: 'U', verification_uri: 'https://auth.exemplo.com.br/d', expires_in: 600 } }
          : { status, body: { error } }
      )
    const run = async (error: string) => {
      const srv = await mk(error)
      return authorizeOAuth2('env11', baseAuth({ flow: 'deviceCode', authUrl: `${srv.url}/device`, tokenUrl: `${srv.url}/token` }), { ...opts, openExternal: vi.fn(), sleep: async () => {} })
    }
    expect(await run('access_denied')).toEqual({ ok: false, code: 'denied' })
    expect(await run('expired_token')).toEqual({ ok: false, code: 'timeout' })
  })
})

describe('Password (legado)', () => {
  it('envia usuário e senha e exige os dois', async () => {
    const srv = await tokenServer(() => ({ body: { access_token: 'PW', expires_in: 10 } }))
    const auth = baseAuth({ flow: 'password', tokenUrl: `${srv.url}/t`, username: 'ana', password: 'p@ss' })
    expect(await authorizeOAuth2('env12', auth, { ...opts, openExternal: vi.fn() })).toMatchObject({ ok: true })
    expect(srv.calls[0]!.form.get('grant_type')).toBe('password')
    expect(srv.calls[0]!.form.get('username')).toBe('ana')
    expect(await authorizeOAuth2('env12', { ...auth, username: undefined }, { ...opts, openExternal: vi.fn() })).toEqual({ ok: false, code: 'invalidConfig' })
  })
})

describe('confirmação de host para segredos', () => {
  it('host não confirmado: devolve secretHostNotConfirmed com o host e não envia nada', async () => {
    const srv = await tokenServer(() => ({ body: { access_token: 'X', expires_in: 3600 } }))
    const guardHosts = vi.fn(async (hosts: string[]) => hosts[0])
    const auth = baseAuth({ tokenUrl: `${srv.url}/token`, clientSecret: '{{segredo}}' })
    const r = await authorizeOAuth2('envg1', auth, { ...opts, resolve: (t) => t.replace('{{segredo}}', 's'), guardHosts, openExternal: vi.fn() })
    expect(r).toEqual({ ok: false, code: 'secretHostNotConfirmed', host: new URL(srv.url).host })
    expect(srv.calls).toHaveLength(0)
  })

  it('host confirmado: segue e obtém o token', async () => {
    const srv = await tokenServer(() => ({ body: { access_token: 'OK1', expires_in: 3600 } }))
    const guardHosts = vi.fn(async () => undefined)
    const r = await authorizeOAuth2('envg2', baseAuth({ tokenUrl: `${srv.url}/token` }), { ...opts, guardHosts, openExternal: vi.fn() })
    expect(r).toMatchObject({ ok: true })
    expect(guardHosts).toHaveBeenCalledWith([new URL(srv.url).host], undefined)
    expect(srv.calls).toHaveLength(1)
  })

  it('Device Code confere também o host do endpoint do dispositivo', async () => {
    const srv = await tokenServer(() => ({ body: {} }))
    const guardHosts = vi.fn(async () => undefined)
    await authorizeOAuth2('envg3', baseAuth({ flow: 'deviceCode', authUrl: 'https://auth.exemplo.com.br/device', tokenUrl: `${srv.url}/token` }), { ...opts, guardHosts, openExternal: vi.fn(), sleep: async () => {} })
    expect((guardHosts.mock.calls[0] as unknown as [string[]])[0]).toEqual([new URL(srv.url).host, 'auth.exemplo.com.br'])
  })

  it('renovação com refresh token: passa o escopo do cofre e não envia sem confirmação', async () => {
    const srv = await tokenServer(() => ({ body: { access_token: 'N', expires_in: 3600 } }))
    await secretVault.set('envg4', 'token', 'velho')
    await secretVault.set('envg4', 'token.__expiresAt', new Date(Date.now() - 1000).toISOString())
    await secretVault.set('envg4', 'token.__refresh', 'rt')
    const guardHosts = vi.fn(async (hosts: string[]) => hosts[0])
    const token = await getOAuth2AccessToken('envg4', baseAuth({ flow: 'authorizationCode', tokenUrl: `${srv.url}/t` }), { ...opts, guardHosts })
    expect(token).toBeUndefined()
    expect(guardHosts).toHaveBeenCalledWith([new URL(srv.url).host], 'envg4')
    expect(srv.calls).toHaveLength(0)
  })
})
