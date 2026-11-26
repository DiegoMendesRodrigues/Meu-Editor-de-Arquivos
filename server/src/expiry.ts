// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { FastifyBaseLogger } from 'fastify'
import type { Mailer } from './app.js'
import type { AppLocale, PlanExpiryEmail, Store } from './db/store.js'
import { hashToken, newToken } from './security.js'

/**
 * Avisos de plano perto de expirar (só planos pagos que não vão renovar: cancelados ou com cobrança recusada).
 *   - Aplicativo: faltando 7 dias ou menos, uma caixa de aviso, uma vez por data de fim (GET /v1/me → planExpiry).
 *   - E-mail: faltando 2 dias, um e-mail no idioma do aplicativo com o link da página de gestão da assinatura.
 */
export const EXPIRY_NOTICE_MS = 7 * 24 * 3600 * 1000
export const EXPIRY_EMAIL_MS = 2 * 24 * 3600 * 1000
/** O link do e-mail é lido depois: vale 48 horas (uso único), em vez dos 15 minutos do link aberto pelo aplicativo. */
export const EXPIRY_EMAIL_TOKEN_MS = 48 * 3600 * 1000

const DAY_MS = 24 * 3600 * 1000
/** Dias que faltam, arredondados para cima (no mínimo 1). */
export const daysLeft = (at: Date, now: Date): number => Math.max(1, Math.ceil((at.getTime() - now.getTime()) / DAY_MS))

export const DEFAULT_SITE_URL = 'https://meueditordearquivos.aplicativoia.online'
/** Código de idioma que o site espera em ?lang= (o mesmo de src/shared/support.ts do aplicativo). */
const SITE_LANG: Record<AppLocale, string> = { 'pt-BR': 'pt-BR', 'pt-PT': 'pt', en: 'en', es: 'es', fr: 'fr-FR', de: 'de' }

export function manageUrl(siteUrl: string, locale: AppLocale, token: string): string {
  const url = new URL('/assinatura.php', siteUrl)
  url.searchParams.set('token', token)
  url.searchParams.set('lang', SITE_LANG[locale])
  return url.href
}

interface Texts {
  subject: string
  body: (v: { name: string; plan: string; days: number; date: string; url: string }) => string
}

const TEXTS: Record<AppLocale, Texts> = {
  'pt-BR': {
    subject: 'Meu Editor de Arquivos: seu plano expira em breve',
    body: (v) =>
      `Olá, ${v.name}.\n\nFaltam ${v.days} dia(s) para o seu plano ${v.plan} expirar (${v.date}). Depois disso, a conta volta ao plano Gratuito.\n\n` +
      `Recomendamos renovar o plano no site do Meu Editor de Arquivos:\n${v.url}\n\n` +
      'O link vale por 48 horas e só pode ser usado uma vez. Depois, abra o aplicativo e use Conta → Gerenciar assinatura.\n'
  },
  'pt-PT': {
    subject: 'Meu Editor de Arquivos: o seu plano expira em breve',
    body: (v) =>
      `Olá, ${v.name}.\n\nFaltam ${v.days} dia(s) para o seu plano ${v.plan} expirar (${v.date}). Depois disso, a conta volta ao plano Gratuito.\n\n` +
      `Recomendamos que renove o plano no site do Meu Editor de Arquivos:\n${v.url}\n\n` +
      'A ligação é válida durante 48 horas e só pode ser usada uma vez. Depois, abra a aplicação e use Conta → Gerir subscrição.\n'
  },
  en: {
    subject: 'Meu Editor de Arquivos: your plan expires soon',
    body: (v) =>
      `Hello, ${v.name}.\n\nYour ${v.plan} plan expires in ${v.days} day(s) (${v.date}). After that, the account goes back to the Gratuito plan.\n\n` +
      `We recommend renewing your plan on the Meu Editor de Arquivos website:\n${v.url}\n\n` +
      'The link is valid for 48 hours and can be used only once. After that, open the app and use Account → Manage subscription.\n'
  },
  es: {
    subject: 'Meu Editor de Arquivos: tu plan vence pronto',
    body: (v) =>
      `Hola, ${v.name}.\n\nFaltan ${v.days} día(s) para que venza tu plan ${v.plan} (${v.date}). Después, la cuenta vuelve al plan Gratuito.\n\n` +
      `Te recomendamos renovar el plan en el sitio web de Meu Editor de Arquivos:\n${v.url}\n\n` +
      'El enlace es válido durante 48 horas y solo se puede usar una vez. Después, abre la aplicación y usa Cuenta → Gestionar suscripción.\n'
  },
  fr: {
    subject: 'Meu Editor de Arquivos : votre offre expire bientôt',
    body: (v) =>
      `Bonjour ${v.name},\n\nVotre offre ${v.plan} expire dans ${v.days} jour(s) (${v.date}). Ensuite, le compte revient à l'offre Gratuito.\n\n` +
      `Nous vous recommandons de renouveler votre offre sur le site de Meu Editor de Arquivos :\n${v.url}\n\n` +
      "Le lien est valable 48 heures et ne peut être utilisé qu'une seule fois. Ensuite, ouvrez l'application et utilisez Compte → Gérer l'abonnement.\n"
  },
  de: {
    subject: 'Meu Editor de Arquivos: Ihr Tarif läuft bald ab',
    body: (v) =>
      `Hallo ${v.name},\n\nIhr Tarif ${v.plan} läuft in ${v.days} Tag(en) ab (${v.date}). Danach wechselt das Konto zum Tarif Gratuito.\n\n` +
      `Wir empfehlen, den Tarif auf der Website von Meu Editor de Arquivos zu verlängern:\n${v.url}\n\n` +
      'Der Link ist 48 Stunden gültig und kann nur einmal verwendet werden. Danach öffnen Sie die App und wählen Konto → Abonnement verwalten.\n'
  }
}

/** Data do fim do plano no idioma do usuário, em UTC (o servidor não sabe o fuso de quem lê). */
export function formatExpiryDate(at: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format(at) + ' UTC'
}

export function planExpiryEmail(item: PlanExpiryEmail, now: Date, url: string): { subject: string; text: string } {
  const locale = item.locale ?? 'en'
  const t = TEXTS[locale]
  const text = t.body({ name: item.name, plan: item.planName, days: daysLeft(item.at, now), date: formatExpiryDate(item.at, locale), url })
  return { subject: t.subject, text }
}

/**
 * Tarefa de hora em hora: e-mail para quem tem plano que não renova e termina em até 2 dias (um por data de fim).
 * Cada e-mail leva um token de uso único (48 h) para a página de gestão. Falha no envio libera a reserva, e a
 * próxima rodada tenta de novo. Devolve quantos e-mails foram enviados. Sem envio de e-mail configurado, não faz nada.
 */
export async function sendPlanExpiryEmails(store: Store, mailer: Mailer, log: FastifyBaseLogger, now: Date, siteUrl: string): Promise<number> {
  if (!mailer.sendPlanExpiring) return 0
  let sent = 0
  for (const item of await store.claimPlanExpiryEmails(now, EXPIRY_EMAIL_MS)) {
    try {
      const token = newToken()
      await store.createManageToken(item.userId, hashToken(token), new Date(now.getTime() + EXPIRY_EMAIL_TOKEN_MS))
      await mailer.sendPlanExpiring(item.email, planExpiryEmail(item, now, manageUrl(siteUrl, item.locale ?? 'en', token)))
      sent++
    } catch (err) {
      // O e-mail do usuário não vai para o log (dado pessoal).
      log.error({ err }, 'Falha ao enviar o e-mail de plano perto de expirar')
      await store.releasePlanExpiryEmail(item.userId).catch(() => undefined)
    }
  }
  return sent
}
