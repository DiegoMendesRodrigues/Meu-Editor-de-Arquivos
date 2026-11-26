// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { describe, expect, it } from 'vitest'
import { buildApp, type Mailer } from '../src/app.js'
import { createMemoryStore } from '../src/db/memory.js'
import { hashToken } from '../src/security.js'
import { formatExpiryDate, manageUrl, sendPlanExpiryEmails } from '../src/expiry.js'

const SITE_KEY = 'chave-do-site-com-mais-de-32-caracteres-123456'
const PASSWORD = 'uma-senha-forte-123'
const DAY_MS = 24 * 3600 * 1000
const silent = { error() {}, info() {}, warn() {} } as never

function setup() {
  const store = createMemoryStore()
  const sent: { to: string; subject: string; text: string }[] = []
  const mailer: Mailer = {
    async sendPasswordReset() {},
    async sendPlanExpiring(to, mail) {
      sent.push({ to, ...mail })
    }
  }
  const app = buildApp({ store, mailer, siteKey: SITE_KEY })
  const register = async (email: string) => {
    const r = await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email, name: 'Ana', password: PASSWORD } })
    return r.json() as { token: string; user: { id: string } }
  }
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` })
  const me = async (token: string) => (await app.inject({ method: 'GET', url: '/v1/me', headers: bearer(token) })).json().user
  return { store, app, sent, mailer, register, bearer, me }
}

const inDays = (days: number) => new Date(Date.now() + days * DAY_MS)

describe('aviso no aplicativo: plano que não renova, faltando 7 dias ou menos', () => {
  it('aparece para assinatura cancelada ou com cobrança recusada, uma vez por data de fim', async () => {
    const ctx = setup()
    const u = await ctx.register('ana@exemplo.com')
    // Renovação automática: sem aviso.
    await ctx.store.updateSubscription(u.user.id, { usersGroupsId: 3, active: true, status: 'active', nextPaymentAt: inDays(5) })
    expect((await ctx.me(u.token)).planExpiry).toBeNull()
    // Cancelada, mas ainda com 10 dias: sem aviso.
    await ctx.store.updateSubscription(u.user.id, { status: 'canceled', nextPaymentAt: inDays(10) }, { exact: true })
    expect((await ctx.me(u.token)).planExpiry).toBeNull()
    // 6,5 dias: aviso com 7 dias (arredondado para cima) e o nome do plano.
    await ctx.store.updateSubscription(u.user.id, { nextPaymentAt: inDays(6.5) }, { exact: true })
    expect((await ctx.me(u.token)).planExpiry).toMatchObject({ days: 7, plan: 'Criador' })
    // Confirmado: não volta para a mesma data.
    expect((await ctx.app.inject({ method: 'POST', url: '/v1/me/plan-expiry-notice', headers: ctx.bearer(u.token) })).statusCode).toBe(204)
    expect((await ctx.me(u.token)).planExpiry).toBeNull()
    // Nova data de fim (cobrança recusada noutro período): avisa de novo.
    await ctx.store.updateSubscription(u.user.id, { status: 'payment_failed', nextPaymentAt: inDays(3) }, { exact: true })
    expect((await ctx.me(u.token)).planExpiry).toMatchObject({ days: 3 })
  })

  it('não aparece no plano Gratuito nem depois do fim do período', async () => {
    const ctx = setup()
    const u = await ctx.register('livre@exemplo.com')
    expect((await ctx.me(u.token)).planExpiry).toBeNull()
    await ctx.store.updateSubscription(u.user.id, { usersGroupsId: 2, active: true, status: 'canceled', nextPaymentAt: new Date(Date.now() - 1000) }, { exact: true })
    expect((await ctx.me(u.token)).planExpiry).toBeNull()
  })

  it('grava o idioma do aplicativo e recusa idioma desconhecido', async () => {
    const ctx = setup()
    const u = await ctx.register('idioma@exemplo.com')
    const put = (locale: string) => ctx.app.inject({ method: 'PUT', url: '/v1/me/locale', headers: ctx.bearer(u.token), payload: { locale } })
    expect((await put('fr')).statusCode).toBe(204)
    expect((await put('it')).statusCode).toBe(400)
    expect((await ctx.app.inject({ method: 'PUT', url: '/v1/me/locale', payload: { locale: 'fr' } })).statusCode).toBe(401)
  })
})

describe('e-mail faltando 2 dias', () => {
  it('envia um e-mail no idioma do aplicativo, com link de uso único (48 h) para a página de gestão', async () => {
    const ctx = setup()
    const u = await ctx.register('ana@exemplo.com')
    await ctx.app.inject({ method: 'PUT', url: '/v1/me/locale', headers: ctx.bearer(u.token), payload: { locale: 'pt-PT' } })
    const end = inDays(1.9)
    await ctx.store.updateSubscription(u.user.id, { usersGroupsId: 2, active: true, status: 'canceled', nextPaymentAt: end })
    const now = new Date()

    expect(await sendPlanExpiryEmails(ctx.store, ctx.mailer, silent, now, 'https://site.exemplo')).toBe(1)
    expect(ctx.sent).toHaveLength(1)
    const mail = ctx.sent[0]
    expect(mail.to).toBe('ana@exemplo.com')
    expect(mail.subject).toContain('o seu plano expira')
    expect(mail.text).toContain('Faltam 2 dia(s) para o seu plano Explorador expirar')
    expect(mail.text).toContain(formatExpiryDate(end, 'pt-PT'))
    const link = new URL(mail.text.match(/https:\/\/\S+/)![0])
    expect(link.origin + link.pathname).toBe('https://site.exemplo/assinatura.php')
    expect(link.searchParams.get('lang')).toBe('pt')

    // O token do e-mail funciona uma vez na página de gestão.
    const token = link.searchParams.get('token')!
    const exchange = () => ctx.app.inject({ method: 'POST', url: '/v1/site/manage-token', headers: { 'x-site-key': SITE_KEY, 'x-client-ip': '203.0.113.9' }, payload: { token } })
    expect((await exchange()).statusCode).toBe(200)
    expect((await exchange()).statusCode).toBe(400)

    // Um só e-mail por data de fim.
    expect(await sendPlanExpiryEmails(ctx.store, ctx.mailer, silent, new Date(), 'https://site.exemplo')).toBe(0)
  })

  it('não envia para quem renova automaticamente nem com mais de 2 dias; sem idioma, vai em inglês', async () => {
    const ctx = setup()
    const auto = await ctx.register('auto@exemplo.com')
    await ctx.store.updateSubscription(auto.user.id, { usersGroupsId: 2, active: true, status: 'active', nextPaymentAt: inDays(1) })
    const longe = await ctx.register('longe@exemplo.com')
    await ctx.store.updateSubscription(longe.user.id, { usersGroupsId: 2, active: true, status: 'canceled', nextPaymentAt: inDays(3) })
    const semIdioma = await ctx.register('sem@exemplo.com')
    await ctx.store.updateSubscription(semIdioma.user.id, { usersGroupsId: 4, active: true, status: 'payment_failed', nextPaymentAt: inDays(1.5) })

    expect(await sendPlanExpiryEmails(ctx.store, ctx.mailer, silent, new Date(), 'https://site.exemplo')).toBe(1)
    expect(ctx.sent[0].to).toBe('sem@exemplo.com')
    expect(ctx.sent[0].text).toContain('Your Mestre plan expires in 2 day(s)')
    expect(ctx.sent[0].text).toContain('lang=en')
  })

  it('falha no envio libera a reserva: a próxima rodada tenta de novo', async () => {
    const ctx = setup()
    const u = await ctx.register('falha@exemplo.com')
    await ctx.store.updateSubscription(u.user.id, { usersGroupsId: 2, active: true, status: 'canceled', nextPaymentAt: inDays(1) })
    let fail = true
    const flaky: Mailer = {
      async sendPasswordReset() {},
      async sendPlanExpiring() {
        if (fail) throw new Error('SMTP fora do ar')
      }
    }
    expect(await sendPlanExpiryEmails(ctx.store, flaky, silent, new Date(), 'https://site.exemplo')).toBe(0)
    fail = false
    expect(await sendPlanExpiryEmails(ctx.store, flaky, silent, new Date(), 'https://site.exemplo')).toBe(1)
  })

  it('o link da página de gestão do aplicativo continua valendo depois do e-mail (tokens independentes)', async () => {
    const ctx = setup()
    const u = await ctx.register('dois@exemplo.com')
    const appLink = (await ctx.app.inject({ method: 'POST', url: '/v1/me/manage-link', headers: ctx.bearer(u.token), payload: {} })).json().token as string
    await ctx.store.createManageToken(u.user.id, hashToken('token-do-email'), inDays(2))
    expect(await ctx.store.consumeManageToken(hashToken(appLink))).toBe(u.user.id)
    expect(await ctx.store.consumeManageToken(hashToken('token-do-email'))).toBe(u.user.id)
    expect(manageUrl('https://site.exemplo', 'fr', 'abc')).toBe('https://site.exemplo/assinatura.php?token=abc&lang=fr-FR')
  })
})
