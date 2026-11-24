// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { beforeEach, describe, expect, it } from 'vitest'
import { buildApp, type Mailer } from '../src/app.js'
import { createMemoryStore } from '../src/db/memory.js'

const PASSWORD = 'uma-senha-forte-123'

function setup(overrides: { loginAttempts?: number; authRequestsPerWindow?: number } = {}) {
  const sent: { to: string; token: string }[] = []
  const mailer: Mailer = { async sendPasswordReset(to, token) { sent.push({ to, token }) } }
  const app = buildApp({ store: createMemoryStore(), mailer, ...overrides })
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, opts: { token?: string; body?: unknown } = {}) => {
    const res = await app.inject({
      method,
      url,
      headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
      ...(opts.body !== undefined ? { payload: opts.body as object } : {})
    })
    return { status: res.statusCode, body: res.body ? res.json() : null }
  }
  const register = async (email = 'ana@exemplo.com', name = 'Ana') => {
    const r = await call('POST', '/v1/auth/register', { body: { email, name, password: PASSWORD } })
    return r.body.token as string
  }
  return { app, call, register, sent }
}

describe('contas', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => { ctx = setup() })

  it('cadastra, devolve sessão e não revela o hash da senha', async () => {
    const r = await ctx.call('POST', '/v1/auth/register', { body: { email: 'Ana@Exemplo.com ', name: ' Ana ', password: PASSWORD } })
    expect(r.status).toBe(201)
    expect(r.body.user).toMatchObject({ email: 'ana@exemplo.com', name: 'Ana' })
    expect(JSON.stringify(r.body)).not.toMatch(/hash|scrypt/i)
    const me = await ctx.call('GET', '/v1/me', { token: r.body.token })
    expect(me.body.user.email).toBe('ana@exemplo.com')
  })

  it('recusa e-mail repetido, senha curta e e-mail inválido', async () => {
    await ctx.register()
    expect((await ctx.call('POST', '/v1/auth/register', { body: { email: 'ANA@exemplo.com', name: 'X', password: PASSWORD } })).status).toBe(409)
    expect((await ctx.call('POST', '/v1/auth/register', { body: { email: 'b@exemplo.com', name: 'B', password: 'curta' } })).status).toBe(400)
    expect((await ctx.call('POST', '/v1/auth/register', { body: { email: 'nao-e-email', name: 'B', password: PASSWORD } })).status).toBe(400)
  })

  it('login correto e incorreto; a mensagem não diz se o e-mail existe', async () => {
    await ctx.register()
    const ok = await ctx.call('POST', '/v1/auth/login', { body: { email: 'ana@exemplo.com', password: PASSWORD } })
    expect(ok.status).toBe(200)
    const wrongPass = await ctx.call('POST', '/v1/auth/login', { body: { email: 'ana@exemplo.com', password: 'errada-errada' } })
    const noUser = await ctx.call('POST', '/v1/auth/login', { body: { email: 'ninguem@exemplo.com', password: 'errada-errada' } })
    expect(wrongPass.status).toBe(401)
    expect(noUser.status).toBe(401)
    expect(wrongPass.body.error.message).toBe(noUser.body.error.message)
  })

  it('bloqueia após várias tentativas erradas', async () => {
    const c = setup({ loginAttempts: 3 })
    await c.register()
    for (let i = 0; i < 3; i++) await c.call('POST', '/v1/auth/login', { body: { email: 'ana@exemplo.com', password: 'errada-errada' } })
    const r = await c.call('POST', '/v1/auth/login', { body: { email: 'ana@exemplo.com', password: PASSWORD } })
    expect(r.status).toBe(429)
  })

  it('limita por IP as rotas de conta, mesmo com e-mails diferentes', async () => {
    const c = setup({ authRequestsPerWindow: 3 })
    for (let i = 0; i < 3; i++) {
      const r = await c.call('POST', '/v1/auth/login', { body: { email: `pessoa${i}@exemplo.com`, password: 'errada-errada' } })
      expect(r.status).toBe(401)
    }
    const r = await c.call('POST', '/v1/auth/password-reset/request', { body: { email: 'outra@exemplo.com' } })
    expect(r.status).toBe(429)
  })

  it('envia cabeçalhos de segurança', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/v1/health' })
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('exige sessão válida e logout a encerra', async () => {
    const token = await ctx.register()
    expect((await ctx.call('GET', '/v1/me')).status).toBe(401)
    expect((await ctx.call('GET', '/v1/me', { token: 'invalido' })).status).toBe(401)
    expect((await ctx.call('POST', '/v1/auth/logout', { token })).status).toBe(204)
    expect((await ctx.call('GET', '/v1/me', { token })).status).toBe(401)
  })

  it('altera o nome do perfil', async () => {
    const token = await ctx.register()
    const r = await ctx.call('PATCH', '/v1/me', { token, body: { name: 'Ana Maria' } })
    expect(r.body.user.name).toBe('Ana Maria')
    expect((await ctx.call('GET', '/v1/me', { token })).body.user.name).toBe('Ana Maria')
  })

  it('troca de senha exige a atual e desconecta as outras sessões', async () => {
    const t1 = await ctx.register()
    const t2 = (await ctx.call('POST', '/v1/auth/login', { body: { email: 'ana@exemplo.com', password: PASSWORD } })).body.token
    const novo = 'outra-senha-forte-456'
    expect((await ctx.call('POST', '/v1/me/password', { token: t1, body: { currentPassword: 'errada-errada', newPassword: novo } })).status).toBe(403)
    expect((await ctx.call('POST', '/v1/me/password', { token: t1, body: { currentPassword: PASSWORD, newPassword: novo } })).status).toBe(204)
    expect((await ctx.call('GET', '/v1/me', { token: t1 })).status).toBe(200)
    expect((await ctx.call('GET', '/v1/me', { token: t2 })).status).toBe(401)
    expect((await ctx.call('POST', '/v1/auth/login', { body: { email: 'ana@exemplo.com', password: PASSWORD } })).status).toBe(401)
    expect((await ctx.call('POST', '/v1/auth/login', { body: { email: 'ana@exemplo.com', password: novo } })).status).toBe(200)
  })

  it('recuperação de senha: resposta igual para e-mails inexistentes, código de uso único', async () => {
    const token = await ctx.register()
    const ghost = await ctx.call('POST', '/v1/auth/password-reset/request', { body: { email: 'ninguem@exemplo.com' } })
    const real = await ctx.call('POST', '/v1/auth/password-reset/request', { body: { email: 'ana@exemplo.com' } })
    expect(ghost.status).toBe(202)
    expect(real.status).toBe(202)
    expect(ctx.sent).toHaveLength(1)
    const code = ctx.sent[0].token
    const novo = 'senha-redefinida-789'
    expect((await ctx.call('POST', '/v1/auth/password-reset/confirm', { body: { token: 'codigo-invalido-xyz', newPassword: novo } })).status).toBe(400)
    expect((await ctx.call('POST', '/v1/auth/password-reset/confirm', { body: { token: code, newPassword: novo } })).status).toBe(204)
    expect((await ctx.call('POST', '/v1/auth/password-reset/confirm', { body: { token: code, newPassword: novo } })).status).toBe(400)
    expect((await ctx.call('GET', '/v1/me', { token })).status).toBe(401)
    expect((await ctx.call('POST', '/v1/auth/login', { body: { email: 'ana@exemplo.com', password: novo } })).status).toBe(200)
  })
})

describe('arquivos na nuvem', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => { ctx = setup() })
  const put = (token: string, body: object) => ctx.call('PUT', '/v1/files', { token, body: { encoding: 'UTF-8', force: false, ...body } })

  it('cria, lista, lê, atualiza com versão e exclui', async () => {
    const token = await ctx.register()
    const created = await put(token, { path: 'notas/a.md', content: '# Olá', baseVersion: null })
    expect(created.status).toBe(200)
    expect(created.body.file).toMatchObject({ path: 'notas/a.md', version: 1, size: 6 })
    const id = created.body.file.id

    const list = await ctx.call('GET', '/v1/files', { token })
    expect(list.body.files).toHaveLength(1)
    expect(list.body.files[0]).not.toHaveProperty('content')

    expect((await ctx.call('GET', `/v1/files/${id}`, { token })).body.file.content).toBe('# Olá')

    const updated = await put(token, { path: 'notas/a.md', content: '# Olá 2', baseVersion: 1 })
    expect(updated.body.file.version).toBe(2)

    expect((await ctx.call('DELETE', `/v1/files/${id}`, { token })).status).toBe(200)
    expect((await ctx.call('GET', `/v1/files/${id}`, { token })).status).toBe(404)
  })

  it('detecta conflito de versão e permite sobrescrever de propósito', async () => {
    const token = await ctx.register()
    await put(token, { path: 'a.txt', content: 'v1', baseVersion: null })
    await put(token, { path: 'a.txt', content: 'v2 (outro computador)', baseVersion: 1 })
    const stale = await put(token, { path: 'a.txt', content: 'v2 (meu)', baseVersion: 1 })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('conflict')
    expect(stale.body.current.version).toBe(2)
    const forced = await put(token, { path: 'a.txt', content: 'v2 (meu)', baseVersion: 1, force: true })
    expect(forced.status).toBe(200)
    expect(forced.body.file.version).toBe(3)
  })

  it('criar um arquivo que já existe sem baseVersion é conflito', async () => {
    const token = await ctx.register()
    await put(token, { path: 'a.txt', content: 'x', baseVersion: null })
    expect((await put(token, { path: 'a.txt', content: 'y', baseVersion: null })).status).toBe(409)
  })

  it('isola os arquivos de cada usuário', async () => {
    const ana = await ctx.register('ana@exemplo.com')
    const bia = await ctx.register('bia@exemplo.com', 'Bia')
    const f = await put(ana, { path: 'segredo.md', content: 'só da Ana', baseVersion: null })
    const id = f.body.file.id
    expect((await ctx.call('GET', '/v1/files', { token: bia })).body.files).toHaveLength(0)
    expect((await ctx.call('GET', `/v1/files/${id}`, { token: bia })).status).toBe(404)
    expect((await ctx.call('DELETE', `/v1/files/${id}`, { token: bia })).status).toBe(404)
    // O mesmo caminho em outra conta é um arquivo diferente.
    expect((await put(bia, { path: 'segredo.md', content: 'da Bia', baseVersion: null })).status).toBe(200)
  })

  it('recusa caminhos perigosos e sessão ausente', async () => {
    const token = await ctx.register()
    for (const path of ['../fora.txt', '/abs.txt', 'a\\b.txt', 'a//b.txt', './x', '']) {
      expect((await put(token, { path, content: 'x', baseVersion: null })).status, path).toBe(400)
    }
    expect((await ctx.call('GET', '/v1/files')).status).toBe(401)
  })
})

describe('pastas na nuvem', () => {
  let ctx: ReturnType<typeof setup>
  let token: string
  beforeEach(async () => {
    ctx = setup()
    token = await ctx.register()
  })
  const put = (path: string) =>
    ctx.call('PUT', '/v1/files', { token, body: { path, content: 'x', encoding: 'UTF-8', baseVersion: null } })

  it('cria pastas (com as de cima), lista e só exclui pasta vazia', async () => {
    expect((await ctx.call('POST', '/v1/folders', { token, body: { path: 'a/b' } })).status).toBe(201)
    expect((await ctx.call('GET', '/v1/folders', { token })).body.folders).toEqual(['a', 'a/b'])
    expect((await ctx.call('DELETE', '/v1/folders?path=a', { token })).status).toBe(409)
    expect((await ctx.call('DELETE', '/v1/folders?path=a%2Fb', { token })).status).toBe(204)
    expect((await ctx.call('DELETE', '/v1/folders?path=a', { token })).status).toBe(204)
    expect((await ctx.call('DELETE', '/v1/folders?path=a', { token })).status).toBe(404)
  })

  it('move o arquivo para outra pasta e recusa destino ocupado', async () => {
    const a = (await put('nota.md')).body.file
    await put('docs/nota.md')
    expect((await ctx.call('PATCH', `/v1/files/${a.id}`, { token, body: { path: 'docs/nota.md' } })).status).toBe(409)
    const moved = await ctx.call('PATCH', `/v1/files/${a.id}`, { token, body: { path: 'outra/nota.md' } })
    expect(moved.status).toBe(200)
    expect(moved.body.file.path).toBe('outra/nota.md')
    expect(moved.body.file.version).toBe(2)
    expect((await ctx.call('PATCH', `/v1/files/${a.id}`, { token, body: { path: '../fora.md' } })).status).toBe(400)
  })

  it('renomeia a pasta com os arquivos e as subpastas', async () => {
    await ctx.call('POST', '/v1/folders', { token, body: { path: 'docs/vazia' } })
    const a = (await put('docs/nota.md')).body.file
    await put('docs/sub/b.md')
    await put('documentos.md') // começa igual, mas não está na pasta
    const res = await ctx.call('PATCH', '/v1/folders', { token, body: { from: 'docs', to: 'textos' } })
    expect(res.status).toBe(200)
    expect((await ctx.call('GET', '/v1/folders', { token })).body.folders).toEqual(['textos', 'textos/vazia'])
    const paths = (await ctx.call('GET', '/v1/files', { token })).body.files.map((f: { path: string }) => f.path).sort()
    expect(paths).toEqual(['documentos.md', 'textos/nota.md', 'textos/sub/b.md'])
    const moved = (await ctx.call('GET', `/v1/files/${a.id}`, { token })).body.file
    expect(moved.version).toBe(2)
    // Só maiúsculas/minúsculas: permitido.
    expect((await ctx.call('PATCH', '/v1/folders', { token, body: { from: 'textos', to: 'Textos' } })).status).toBe(200)
  })

  it('renomear pasta: destino ocupado, pasta inexistente e caminhos inválidos', async () => {
    await put('a/x.md')
    await put('b/y.md')
    await put('c.md')
    const rename = (from: string, to: string) => ctx.call('PATCH', '/v1/folders', { token, body: { from, to } })
    expect((await rename('a', 'b')).status).toBe(409)
    expect((await rename('a', 'c.md')).status).toBe(409)
    expect((await rename('nada', 'z')).status).toBe(404)
    expect((await rename('a', 'a/dentro')).status).toBe(400)
    expect((await rename('a', '../fora')).status).toBe(400)
    const other = await ctx.register('bia@exemplo.com', 'Bia')
    expect((await ctx.call('PATCH', '/v1/folders', { token: other, body: { from: 'a', to: 'z' } })).status).toBe(404)
  })

  it('pastas e arquivos de um usuário não aparecem para outro', async () => {
    await ctx.call('POST', '/v1/folders', { token, body: { path: 'privada' } })
    const a = (await put('privada/x.md')).body.file
    const other = await ctx.register('bia@exemplo.com', 'Bia')
    expect((await ctx.call('GET', '/v1/folders', { token: other })).body.folders).toEqual([])
    expect((await ctx.call('PATCH', `/v1/files/${a.id}`, { token: other, body: { path: 'y.md' } })).status).toBe(404)
  })
})

describe('área de trabalho sincronizada', () => {
  it('grava com versão, recusa versão antiga e é separada por usuário', async () => {
    const ctx = setup()
    const token = await ctx.register()
    expect((await ctx.call('GET', '/v1/workspace', { token })).body).toEqual({ data: null, version: 0, updatedAt: null })
    expect((await ctx.call('PUT', '/v1/workspace', { token, body: { data: '{"a":1}', baseVersion: 0 } })).body.version).toBe(1)
    expect((await ctx.call('PUT', '/v1/workspace', { token, body: { data: '{"a":2}', baseVersion: 0 } })).status).toBe(409)
    expect((await ctx.call('PUT', '/v1/workspace', { token, body: { data: '{"a":2}', baseVersion: 1 } })).body.version).toBe(2)
    expect((await ctx.call('GET', '/v1/workspace', { token })).body.data).toBe('{"a":2}')
    const other = await ctx.register('bia@exemplo.com', 'Bia')
    expect((await ctx.call('GET', '/v1/workspace', { token: other })).body.version).toBe(0)
    expect((await ctx.call('GET', '/v1/workspace')).status).toBe(401)
  })
})

describe('espaço usado na nuvem', () => {
  it('soma os arquivos e os textos não salvos, por usuário, e acompanha cada gravação', async () => {
    const ctx = setup()
    const token = await ctx.register()
    const storage = async (t = token) => (await ctx.call('GET', '/v1/me/storage', { token: t })).body.storageBytes as number
    expect(await storage()).toBe(0)

    // "ç" tem 2 bytes em UTF-8: conta bytes, não caracteres.
    const a = await ctx.call('PUT', '/v1/files', { token, body: { path: 'a.txt', content: 'açúcar', encoding: 'UTF-8', baseVersion: null, force: false } })
    expect(a.body.storageBytes).toBe(8)
    const b = await ctx.call('PUT', '/v1/files', { token, body: { path: 'b.txt', content: 'x'.repeat(100), encoding: 'UTF-8', baseVersion: null, force: false } })
    expect(b.body.storageBytes).toBe(108)

    const ws = await ctx.call('PUT', '/v1/workspace', { token, body: { data: '{"t":"não salvo"}', baseVersion: 0 } })
    expect(ws.body.storageBytes).toBe(108 + Buffer.byteLength('{"t":"não salvo"}'))

    // Regravar troca o tamanho antigo pelo novo; excluir tira o arquivo da soma.
    await ctx.call('PUT', '/v1/files', { token, body: { path: 'a.txt', content: 'ab', encoding: 'UTF-8', baseVersion: 1, force: false } })
    const del = await ctx.call('DELETE', `/v1/files/${b.body.file.id}`, { token })
    expect(del.body.storageBytes).toBe(2 + Buffer.byteLength('{"t":"não salvo"}'))
    expect(await storage()).toBe(del.body.storageBytes)

    // Outro usuário não soma os arquivos do primeiro; sem sessão, não há resposta.
    expect(await storage(await ctx.register('bia@exemplo.com', 'Bia'))).toBe(0)
    expect((await ctx.call('GET', '/v1/me/storage')).status).toBe(401)
  })

  it('conflito não muda o espaço usado', async () => {
    const ctx = setup()
    const token = await ctx.register()
    await ctx.call('PUT', '/v1/files', { token, body: { path: 'a.txt', content: 'abc', encoding: 'UTF-8', baseVersion: null, force: false } })
    const conflict = await ctx.call('PUT', '/v1/files', { token, body: { path: 'a.txt', content: 'muito maior', encoding: 'UTF-8', baseVersion: 7, force: false } })
    expect(conflict.status).toBe(409)
    expect((await ctx.call('GET', '/v1/me/storage', { token })).body.storageBytes).toBe(3)
  })
})

describe('espaço usado na nuvem com falha no banco', () => {
  it('a gravação continua valendo mesmo se o recálculo falhar', async () => {
    const store = createMemoryStore()
    store.refreshStorageBytes = async () => {
      throw new Error('coluna storage_bytes ausente')
    }
    const app = buildApp({ store, mailer: { async sendPasswordReset() {} } })
    const reg = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'ana@exemplo.com', name: 'Ana', password: PASSWORD } })
    const token = reg.json().token as string
    const res = await app.inject({
      method: 'PUT',
      url: '/v1/files',
      headers: { authorization: `Bearer ${token}` },
      payload: { path: 'a.txt', content: 'abc', encoding: 'UTF-8', baseVersion: null, force: false }
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().file.version).toBe(1)
    expect(res.json().storageBytes).toBeUndefined()
  })
})
