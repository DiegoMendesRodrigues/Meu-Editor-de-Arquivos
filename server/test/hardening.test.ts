// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildApp, type Mailer } from '../src/app.js'
import { createMemoryStore } from '../src/db/memory.js'

const WHSEC = 'whsec_teste_123'
const PASSWORD = 'uma-senha-forte-123'
const DAY_MS = 24 * 3600 * 1000
const mailer: Mailer = { async sendPasswordReset() {} }

function setup(allowRegister?: boolean) {
  const store = createMemoryStore()
  const app = buildApp({ store, mailer, stripeWebhookSecret: WHSEC, allowRegister })
  const webhook = async (event: object) => {
    const payload = JSON.stringify(event)
    const t = Math.floor(Date.now() / 1000)
    const v1 = createHmac('sha256', WHSEC).update(`${t}.${payload}`).digest('hex')
    const res = await app.inject({ method: 'POST', url: '/v1/billing/stripe-webhook', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` }, payload })
    return res.statusCode
  }
  return { store, app, webhook }
}

describe('webhook: fim da assinatura e eventos repetidos', () => {
  it('assinatura apagada com o período vencido guarda o plano anterior e marca o último acesso (sem limpeza imediata)', async () => {
    const ctx = setup()
    const user = (await ctx.store.createUser({ email: 'a@exemplo.com', name: 'A', passwordHash: 'x' }))!
    // Último acesso há 40 dias (mais que o prazo de 30 dias do Gratuito).
    ;(await ctx.store.findUserById(user.id))!.lastAccess = new Date(Date.now() - 40 * DAY_MS)
    await ctx.store.updateSubscription(user.id, { usersGroupsId: 4, active: true, status: 'canceled', nextPaymentAt: new Date(Date.now() - 1000), stripeSubscriptionId: 'sub_X' })

    expect(await ctx.webhook({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_X', status: 'canceled' } } })).toBe(200)
    expect(await ctx.store.getSubscription(user.id)).toMatchObject({ usersGroupsId: 1, active: false, status: 'ended' })
    // last_access = agora: a limpeza não apaga os arquivos na próxima rodada.
    expect(await ctx.store.purgeInactiveUsers(new Date())).toBe(0)
    expect(await ctx.store.purgeInactiveUsers(new Date(Date.now() + 31 * DAY_MS))).toBe(1)
  })

  it('checkout.session.completed repetido de uma assinatura encerrada não religa o plano', async () => {
    const ctx = setup()
    const user = (await ctx.store.createUser({ email: 'b@exemplo.com', name: 'B', passwordHash: 'x' }))!
    await ctx.store.updateSubscription(user.id, { usersGroupsId: 2, active: true, status: 'canceled', nextPaymentAt: new Date(Date.now() - 1000), stripeSubscriptionId: 'sub_Y' })
    await ctx.store.endSubscription(user.id, new Date())
    const replay = {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', client_reference_id: user.id, customer: 'cus_Y', subscription: 'sub_Y', payment_status: 'paid', created: 1, metadata: { users_groups_id: '2', period: 'mensal' } } }
    }
    expect(await ctx.webhook(replay)).toBe(200)
    expect(await ctx.store.getSubscription(user.id)).toMatchObject({ usersGroupsId: 1, active: false, status: 'ended' })
    // Fatura antiga reenviada (período vencido): também não religa.
    const oldInvoice = {
      type: 'invoice.paid',
      data: { object: { customer: 'cus_Y', created: 1, parent: { subscription_details: { subscription: 'sub_Y', metadata: { user_id: user.id, users_groups_id: '2', period: 'mensal' } } }, lines: { data: [{ period: { start: 1, end: 2 } }] } } }
    }
    expect(await ctx.webhook(oldInvoice)).toBe(200)
    expect(await ctx.store.getSubscription(user.id)).toMatchObject({ usersGroupsId: 1, active: false })
  })
})

describe('cadastro direto na API', () => {
  it('desligado (produção): 403 register_disabled; ligado: cria a conta', async () => {
    const off = setup(false)
    const r = await off.app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'c@exemplo.com', name: 'C', password: PASSWORD } })
    expect(r.statusCode).toBe(403)
    expect(r.json().error.code).toBe('register_disabled')
    const on = setup(true)
    expect((await on.app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'c@exemplo.com', name: 'C', password: PASSWORD } })).statusCode).toBe(201)
  })
})

describe('limites', () => {
  it('link de gestão: no máximo 10 por janela por usuário', async () => {
    const ctx = setup()
    const reg = await ctx.app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'd@exemplo.com', name: 'D', password: PASSWORD } })
    const headers = { authorization: `Bearer ${reg.json().token}` }
    const codes: number[] = []
    for (let i = 0; i < 11; i++) codes.push((await ctx.app.inject({ method: 'POST', url: '/v1/me/manage-link', headers, payload: {} })).statusCode)
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true)
    expect(codes[10]).toBe(429)
  })

  it('login: tentativas em paralelo não passam do limite por IP e e-mail', async () => {
    const ctx = setup()
    await ctx.app.inject({ method: 'POST', url: '/v1/auth/register', payload: { email: 'e@exemplo.com', name: 'E', password: PASSWORD } })
    const tries = await Promise.all(
      Array.from({ length: 12 }, () => ctx.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'e@exemplo.com', password: 'senha-errada-123' } }))
    )
    const wrong = tries.filter((r) => r.statusCode === 401).length
    expect(wrong).toBeLessThanOrEqual(5)
    // A senha certa, depois do bloqueio, também espera a janela.
    expect((await ctx.app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email: 'e@exemplo.com', password: PASSWORD } })).statusCode).toBe(429)
  })
})
