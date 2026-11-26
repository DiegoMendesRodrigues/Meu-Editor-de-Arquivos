// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Assinaturas dos planos pagos pela Stripe: conferência da assinatura do webhook e aplicação dos eventos
 * na tabela users (plano, período, datas de pagamento e se está no período pago).
 * Sem SDK: a verificação é o HMAC-SHA256 documentado pela Stripe (cabeçalho Stripe-Signature).
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Store, SubscriptionPeriod, SubscriptionUpdate } from './db/store.js'

/** Diferença máxima entre o horário do evento e o do servidor (proteção contra reenvio). */
const SIGNATURE_TOLERANCE_S = 300

/** Confere o cabeçalho Stripe-Signature ("t=...,v1=...") com o segredo do endpoint (whsec_...). */
export function verifyStripeSignature(rawBody: string, header: string | undefined, secret: string, nowMs = Date.now()): boolean {
  if (!header) return false
  let timestamp = 0
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2).map((s) => s?.trim() ?? '')
    if (k === 't' && /^\d+$/.test(v)) timestamp = Number(v)
    else if (k === 'v1' && /^[0-9a-f]{64}$/.test(v)) signatures.push(v)
  }
  if (!timestamp || signatures.length === 0) return false
  if (Math.abs(nowMs / 1000 - timestamp) > SIGNATURE_TOLERANCE_S) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest()
  return signatures.some((sig) => {
    const got = Buffer.from(sig, 'hex')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 255 ? v : null)
/** Id de um objeto da Stripe: texto ou objeto expandido com "id". */
const idOf = (v: unknown): string | null => str(v) ?? str(obj(v).id)
const date = (seconds: unknown): Date | null => (typeof seconds === 'number' && seconds > 0 ? new Date(seconds * 1000) : null)
const PERIODS: SubscriptionPeriod[] = ['mensal', 'semestral', 'anual']
const periodOf = (v: unknown): SubscriptionPeriod | undefined => (PERIODS.includes(v as SubscriptionPeriod) ? (v as SubscriptionPeriod) : undefined)

/** Metadados que o site grava na assinatura: user_id, users_groups_id e period. */
interface PlanMetadata {
  userId: string | null
  usersGroupsId: number | null
  period: SubscriptionPeriod | undefined
}
const planMetadata = (metadata: unknown): PlanMetadata => {
  const m = obj(metadata)
  const group = Number(m.users_groups_id)
  return { userId: str(m.user_id), usersGroupsId: Number.isInteger(group) && group > 1 ? group : null, period: periodOf(m.period) }
}

export interface BillingLog {
  info(obj: object, msg: string): void
  warn(obj: object, msg: string): void
}

/**
 * Aplica um evento da Stripe. Eventos de outros tipos, ou de assinaturas que não são deste sistema, são
 * ignorados. As gravações são absolutas (e a data do próximo pagamento só avança), então repetir um evento
 * ou recebê-los fora de ordem não estraga o cadastro.
 */
export async function applyStripeEvent(store: Store, event: unknown, log: BillingLog, now = new Date()): Promise<void> {
  const e = obj(event)
  const type = str(e.type) ?? ''
  const data = obj(obj(e.data).object)

  /** Usuário dono da assinatura: pelo id gravado; senão, pelo user_id dos metadados (se existir). */
  const findUser = async (subscriptionId: string | null, metaUserId: string | null): Promise<string | null> => {
    const bySub = subscriptionId ? await store.findUserIdByStripeSubscription(subscriptionId) : null
    if (bySub) return bySub
    if (metaUserId && (await store.findUserById(metaUserId))) return metaUserId
    return null
  }
  const validGroup = async (id: number | null): Promise<number | undefined> => (id !== null && (await store.planExists(id)) ? id : undefined)

  switch (type) {
    case 'checkout.session.completed': {
      if (data.mode !== 'subscription') return
      const meta = planMetadata(data.metadata)
      const userId = await findUser(null, str(data.client_reference_id) ?? meta.userId)
      if (!userId) return log.warn({ type }, `Stripe: ${type} sem usuário conhecido`)
      const update: SubscriptionUpdate = {
        stripeCustomerId: idOf(data.customer),
        stripeSubscriptionId: idOf(data.subscription),
        period: meta.period
      }
      if (data.payment_status === 'paid') {
        Object.assign(update, { usersGroupsId: await validGroup(meta.usersGroupsId), active: true, status: 'active', lastPaymentAt: date(data.created) ?? now })
      }
      await store.updateSubscription(userId, update)
      return log.info({ type }, 'Stripe: checkout concluído')
    }

    case 'invoice.paid': {
      const details = obj(obj(data.parent).subscription_details)
      const subscriptionId = idOf(details.subscription) ?? idOf(data.subscription)
      if (!subscriptionId) return
      const meta = planMetadata(Object.keys(obj(details.metadata)).length ? details.metadata : obj(data.subscription_details).metadata)
      const userId = await findUser(subscriptionId, meta.userId)
      if (!userId) return log.warn({ type }, `Stripe: ${type} de assinatura desconhecida`)
      // Fim do período pago: o maior "period.end" das linhas da fatura.
      const lines = Array.isArray(obj(data.lines).data) ? (obj(data.lines).data as unknown[]) : []
      const ends = lines.map((l) => date(obj(obj(l).period).end)).filter((d): d is Date => d !== null)
      const periodEnd = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null
      await store.updateSubscription(userId, {
        usersGroupsId: await validGroup(meta.usersGroupsId),
        period: meta.period,
        active: true,
        status: 'active',
        lastPaymentAt: date(obj(data.status_transitions).paid_at) ?? date(data.created) ?? now,
        nextPaymentAt: periodEnd ?? undefined,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: idOf(data.customer) ?? undefined
      })
      return log.info({ type }, 'Stripe: pagamento registrado')
    }

    case 'invoice.payment_failed': {
      const details = obj(obj(data.parent).subscription_details)
      const subscriptionId = idOf(details.subscription) ?? idOf(data.subscription)
      const userId = subscriptionId ? await store.findUserIdByStripeSubscription(subscriptionId) : null
      const sub = userId ? await store.getSubscription(userId) : null
      // O plano continua até o fim do período pago; só o estado muda.
      if (userId && sub?.active) await store.updateSubscription(userId, { status: 'payment_failed' })
      return
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscriptionId = idOf(data.id)
      const meta = planMetadata(data.metadata)
      const userId = await findUser(subscriptionId, meta.userId)
      if (!userId) return
      const sub = await store.getSubscription(userId)
      if (!sub?.active) return
      const items = Array.isArray(obj(data.items).data) ? (obj(data.items).data as unknown[]) : []
      const periodEnd = date(obj(items[0]).current_period_end) ?? date(data.current_period_end)
      if (type === 'customer.subscription.deleted') {
        // Encerrada: vale até o fim do período pago; se ele já passou, volta ao Gratuito agora.
        const end = sub.nextPaymentAt ?? periodEnd
        if (!end || end <= now) await store.updateSubscription(userId, { usersGroupsId: 1, active: false, status: 'ended' })
        else await store.updateSubscription(userId, { status: 'canceled' })
        return log.info({ type }, 'Stripe: assinatura encerrada')
      }
      const status = data.cancel_at_period_end === true || typeof data.cancel_at === 'number'
        ? 'canceled'
        : data.status === 'active' || data.status === 'trialing'
          ? 'active'
          : data.status === 'past_due' || data.status === 'unpaid'
            ? 'payment_failed'
            : undefined
      await store.updateSubscription(userId, { status, nextPaymentAt: periodEnd ?? undefined })
      return
    }

    default:
      return
  }
}
