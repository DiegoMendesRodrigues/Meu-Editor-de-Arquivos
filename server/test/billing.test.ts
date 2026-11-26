// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildApp, type Mailer } from '../src/app.js'
import { verifyStripeSignature } from '../src/billing.js'
import { createMemoryStore } from '../src/db/memory.js'
import type { Store } from '../src/db/store.js'

const SITE_KEY = 'chave-do-site-com-mais-de-32-caracteres-123456'
const WHSEC = 'whsec_teste_123'
const PASSWORD = 'uma-senha-forte-123'
const DAY = 24 * 3600

function sign(payload: string, secret = WHSEC, t = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')
  return `t=${t},v1=${v1}`
}

function setup(opts: { siteKey?: string; stripeWebhookSecret?: string } = { siteKey: SITE_KEY, stripeWebhookSecret: WHSEC }) {
  const store: Store = createMemoryStore()
  const mailer: Mailer = { async sendPasswordReset() {} }
  const app = buildApp({ store, mailer, ...opts })
  const signup = async (body: object, key: string | null = SITE_KEY, ip = '203.0.113.7') => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/site/signup',
      headers: { ...(key ? { 'x-site-key': key } : {}), 'x-client-ip': ip },
      payload: body
    })
    return { status: res.statusCode, body: res.json() }
  }
  const status = async (userId: string) => {
    const res = await app.inject({ method: 'GET', url: `/v1/site/users/${userId}/subscription`, headers: { 'x-site-key': SITE_KEY } })
    return { status: res.statusCode, body: res.json() }
  }
  const webhook = async (event: object, signature?: string) => {
    const payload = JSON.stringify(event)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/billing/stripe-webhook',
      headers: { 'content-type': 'application/json', 'stripe-signature': signature ?? sign(payload) },
      payload
    })
    return { status: res.statusCode }
  }
  return { app, store, signup, status, webhook }
}

const now = () => Math.floor(Date.now() / 1000)
const invoicePaid = (userId: string, sub = 'sub_123', end = now() + 182 * DAY) => ({
  type: 'invoice.paid',
  data: {
    object: {
      customer: 'cus_123',
      created: now(),
      status_transitions: { paid_at: now() },
      parent: { subscription_details: { subscription: sub, metadata: { user_id: userId, users_groups_id: '3', period: 'semestral' } } },
      lines: { data: [{ period: { start: now(), end } }] }
    }
  }
})

describe('assinatura do webhook da Stripe', () => {
  it('aceita a assinatura correta e recusa segredo errado, horário antigo e cabeçalho ausente', () => {
    const body = '{"id":"evt_1"}'
    expect(verifyStripeSignature(body, sign(body), WHSEC)).toBe(true)
    expect(verifyStripeSignature(body, sign(body, 'whsec_outro'), WHSEC)).toBe(false)
    expect(verifyStripeSignature(body, sign(body, WHSEC, now() - 3600), WHSEC)).toBe(false)
    expect(verifyStripeSignature(body + ' ', sign(body), WHSEC)).toBe(false)
    expect(verifyStripeSignature(body, undefined, WHSEC)).toBe(false)
  })
})

describe('cadastro pelo site', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => { ctx = setup() })

  it('fica desligado sem a chave configurada e exige a chave certa', async () => {
    const off = setup({})
    expect((await off.signup({ email: 'a@exemplo.com', name: 'A', password: PASSWORD, plan: 1 })).status).toBe(503)
    expect((await ctx.signup({ email: 'a@exemplo.com', name: 'A', password: PASSWORD, plan: 1 }, null)).status).toBe(401)
    expect((await ctx.signup({ email: 'a@exemplo.com', name: 'A', password: PASSWORD, plan: 1 }, 'errada')).status).toBe(401)
  })

  it('cadastra no Gratuito sem assinatura pendente', async () => {
    const r = await ctx.signup({ email: 'Ana@Exemplo.com', name: 'Ana', password: PASSWORD, plan: 1 })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ created: true, subscription: { plan: { id: 1, name: 'Gratuito' }, active: false, status: null } })
    expect(JSON.stringify(r.body)).not.toMatch(/hash|scrypt/i)
  })

  it('plano pago: cria a conta no Gratuito com a assinatura pendente', async () => {
    const r = await ctx.signup({ email: 'bia@exemplo.com', name: 'Bia', password: PASSWORD, plan: 3, period: 'semestral' })
    expect(r.status).toBe(201)
    expect(r.body.subscription).toMatchObject({ plan: { id: 1 }, period: 'semestral', status: 'pending', active: false })
  })

  it('valida senha curta, período ausente e plano inexistente', async () => {
    expect((await ctx.signup({ email: 'c@exemplo.com', name: 'C', password: 'curta', plan: 1 })).status).toBe(400)
    expect((await ctx.signup({ email: 'c@exemplo.com', name: 'C', password: PASSWORD, plan: 2 })).status).toBe(400)
    expect((await ctx.signup({ email: 'c@exemplo.com', name: 'C', password: PASSWORD, plan: 99, period: 'mensal' })).status).toBe(404)
  })

  it('e-mail existente: liga a assinatura só com a senha certa', async () => {
    await ctx.signup({ email: 'dan@exemplo.com', name: 'Dan', password: PASSWORD, plan: 1 })
    const wrong = await ctx.signup({ email: 'dan@exemplo.com', name: 'Dan', password: 'outra-senha-123', plan: 2, period: 'mensal' })
    expect(wrong.status).toBe(401)
    expect(wrong.body.error.code).toBe('invalid_credentials')
    const ok = await ctx.signup({ email: 'dan@exemplo.com', name: 'Dan', password: PASSWORD, plan: 2, period: 'mensal' })
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ created: false, subscription: { status: 'pending', period: 'mensal' } })
  })

  it('bloqueia tentativas repetidas de senha numa conta existente, por visitante', async () => {
    await ctx.signup({ email: 'eva@exemplo.com', name: 'Eva', password: PASSWORD, plan: 1 })
    for (let i = 0; i < 5; i++) await ctx.signup({ email: 'eva@exemplo.com', name: 'Eva', password: 'errada-errada', plan: 2, period: 'mensal' })
    expect((await ctx.signup({ email: 'eva@exemplo.com', name: 'Eva', password: PASSWORD, plan: 2, period: 'mensal' })).status).toBe(429)
  })
})

describe('webhook e ciclo da assinatura', () => {
  let ctx: ReturnType<typeof setup>
  let userId: string
  beforeEach(async () => {
    ctx = setup()
    userId = (await ctx.signup({ email: 'fia@exemplo.com', name: 'Fia', password: PASSWORD, plan: 3, period: 'semestral' })).body.userId
  })

  it('recusa evento sem assinatura válida e fica desligado sem o segredo', async () => {
    expect((await ctx.webhook(invoicePaid(userId), 't=1,v1=' + '0'.repeat(64))).status).toBe(400)
    const off = setup({ siteKey: SITE_KEY })
    expect((await off.webhook(invoicePaid(userId))).status).toBe(503)
    expect((await ctx.status(userId)).body.subscription.active).toBe(false)
  })

  it('pagamento: muda o plano, grava as datas e marca como ativa; repetir o evento não muda nada', async () => {
    const end = now() + 182 * DAY
    expect((await ctx.webhook(invoicePaid(userId, 'sub_123', end))).status).toBe(200)
    await ctx.webhook(invoicePaid(userId, 'sub_123', end))
    const s = (await ctx.status(userId)).body.subscription
    expect(s).toMatchObject({ plan: { id: 3, name: 'Criador' }, period: 'semestral', status: 'active', active: true })
    expect(new Date(s.nextPaymentAt).getTime()).toBe(end * 1000)
    expect(s.lastPaymentAt).not.toBeNull()
    // O limite do plano passa a valer no uso da nuvem.
    expect((await ctx.store.getUsage(userId)).plan).toMatchObject({ name: 'Criador', maxFiles: 1000 })
  })

  it('checkout concluído liga os ids da Stripe e ativa o plano', async () => {
    await ctx.webhook({
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', client_reference_id: userId, customer: 'cus_9', subscription: 'sub_9', payment_status: 'paid', created: now(), metadata: { users_groups_id: '3', period: 'semestral' } } }
    })
    const sub = await ctx.store.getSubscription(userId)
    expect(sub).toMatchObject({ usersGroupsId: 3, active: true, stripeSubscriptionId: 'sub_9', stripeCustomerId: 'cus_9' })
    expect(await ctx.store.findUserIdByStripeSubscription('sub_9')).toBe(userId)
  })

  it('não abre outra assinatura numa conta com período pago', async () => {
    await ctx.webhook(invoicePaid(userId))
    const r = await ctx.signup({ email: 'fia@exemplo.com', name: 'Fia', password: PASSWORD, plan: 4, period: 'anual' })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('subscription_active')
  })

  it('cancelada: mantém o plano até o fim do período pago e só então volta ao Gratuito', async () => {
    const end = now() + 10 * DAY
    await ctx.webhook(invoicePaid(userId, 'sub_123', end))
    await ctx.webhook({ type: 'customer.subscription.updated', data: { object: { id: 'sub_123', status: 'active', cancel_at_period_end: true, items: { data: [{ current_period_end: end }] } } } })
    await ctx.webhook({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_123', status: 'canceled' } } })
    expect(await ctx.store.getSubscription(userId)).toMatchObject({ usersGroupsId: 3, active: true, status: 'canceled' })
    // Antes do fim: nada muda. Depois do fim: Gratuito.
    expect(await ctx.store.expireSubscriptions(new Date((end - DAY) * 1000), 2 * DAY * 1000)).toBe(0)
    expect(await ctx.store.expireSubscriptions(new Date((end + 60) * 1000), 2 * DAY * 1000)).toBe(1)
    expect(await ctx.store.getSubscription(userId)).toMatchObject({ usersGroupsId: 1, active: false, status: 'ended' })
  })

  it('cobrança falha: continua até o fim do período; assinatura ativa sem renovação espera a tolerância', async () => {
    const end = now() + 5 * DAY
    await ctx.webhook(invoicePaid(userId, 'sub_123', end))
    // Ativa e sem renovação: só expira depois da tolerância.
    expect(await ctx.store.expireSubscriptions(new Date((end + DAY) * 1000), 2 * DAY * 1000)).toBe(0)
    await ctx.webhook({ type: 'invoice.payment_failed', data: { object: { parent: { subscription_details: { subscription: 'sub_123' } } } } })
    expect(await ctx.store.getSubscription(userId)).toMatchObject({ active: true, status: 'payment_failed' })
    expect(await ctx.store.expireSubscriptions(new Date((end + 60) * 1000), 2 * DAY * 1000)).toBe(1)
  })

  it('ignora eventos de outros tipos e de assinaturas desconhecidas', async () => {
    expect((await ctx.webhook({ type: 'charge.succeeded', data: { object: {} } })).status).toBe(200)
    expect((await ctx.webhook(invoicePaid('00000000-0000-4000-8000-000000000000', 'sub_outra'))).status).toBe(200)
    expect((await ctx.store.getSubscription(userId))?.active).toBe(false)
  })
})

describe('confirmação do pagamento pelo site', () => {
  it('libera o plano na hora e recusa assinatura de outra conta ou sem a chave', async () => {
    const ctx = setup()
    const a = (await ctx.signup({ email: 'gil@exemplo.com', name: 'Gil', password: PASSWORD, plan: 2, period: 'mensal' })).body.userId
    const b = (await ctx.signup({ email: 'hel@exemplo.com', name: 'Hel', password: PASSWORD, plan: 2, period: 'mensal' })).body.userId
    const end = now() + 30 * DAY
    const confirm = (body: object, key: string | null = SITE_KEY) =>
      ctx.app.inject({ method: 'POST', url: '/v1/site/subscription/confirm', headers: key ? { 'x-site-key': key } : {}, payload: body })
    const body = { userId: a, plan: 2, period: 'mensal', stripeCustomerId: 'cus_A1', stripeSubscriptionId: 'sub_A1', paidAt: now(), periodEnd: end }
    expect((await confirm(body, null)).statusCode).toBe(401)
    const ok = await confirm(body)
    expect(ok.statusCode).toBe(200)
    expect(ok.json().subscription).toMatchObject({ plan: { id: 2, name: 'Explorador' }, status: 'active', active: true })
    expect(new Date(ok.json().subscription.nextPaymentAt).getTime()).toBe(end * 1000)
    expect((await confirm({ ...body, userId: b })).statusCode).toBe(409)
    expect((await confirm({ ...body, plan: 1 })).statusCode).toBe(400)
    // O webhook que chega depois não estraga nada.
    const late = invoicePaid(a, 'sub_A1', end)
    late.data.object.parent.subscription_details.metadata.users_groups_id = '2'
    await ctx.webhook(late)
    expect(await ctx.store.getSubscription(a)).toMatchObject({ usersGroupsId: 2, active: true, stripeSubscriptionId: 'sub_A1' })
  })
})
