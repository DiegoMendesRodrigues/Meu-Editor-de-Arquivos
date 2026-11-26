// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { buildApp, type Mailer } from './app.js'
import { createMemoryStore } from './db/memory.js'
import { readFile } from 'node:fs/promises'
import { createMysqlStore, migrate } from './db/mysql.js'
import { createSmtpMailer, smtpConfigFromEnv } from './mailer.js'

/**
 * Configuração por variáveis de ambiente:
 *   DATABASE_URL  mysql://usuario:senha@host:3306/banco   (sem ela, usa memória: só para testes locais!)
 *   HOST / PORT   endereço de escuta (padrão 127.0.0.1:3000). Em produção, coloque atrás de HTTPS (proxy reverso).
 *   TRUST_PROXY   proxy reverso de confiança: número de proxies na frente (ex.: 1, o mais seguro), lista de IPs/CIDRs
 *                 separados por vírgula, ou "true" (confia em todos: só se o proxy substituir o X-Forwarded-For).
 *   MEA_DEV       "true" mostra no console o código de redefinição quando não há SMTP (só desenvolvimento).
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM   envio real de e-mail (porta padrão 465).
 *   AUTO_MIGRATE  "true" aplica o esquema (CREATE TABLE IF NOT EXISTS) ao iniciar; útil em hospedagem sem shell.
 *   NODE_ENV      "production" exige DATABASE_URL e SMTP configurado (não aceita o envio simulado).
 *   SITE_API_KEY  chave secreta compartilhada com o site (cadastro pela página de planos); sem ela, a rota fica desligada.
 *   STRIPE_WEBHOOK_SECRET  segredo do endpoint de webhook da Stripe (whsec_...); sem ele, o webhook fica desligado.
 *   SITE_URL      endereço https do site, usado nos links dos e-mails (padrão: https://meueditordearquivos.aplicativoia.online).
 */
const databaseUrl = process.env.DATABASE_URL
const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 3000)

const production = process.env.NODE_ENV === 'production'

// Sem SMTP: o código de redefinição só aparece no console com MEA_DEV=true (desenvolvimento). Fora disso, nada vai
// para o log (quem lesse o log poderia tomar a conta). O e-mail do usuário também não é escrito (dado pessoal).
const devMailer = process.env.MEA_DEV === 'true'
const consoleMailer: Mailer = {
  async sendPasswordReset(_to, token) {
    if (devMailer) console.log(`[e-mail simulado] Código de redefinição de senha: ${token}`)
    else console.warn('Pedido de redefinição de senha recebido, mas o SMTP não está configurado: nenhum e-mail foi enviado.')
  },
  async sendPlanExpiring(_to, mail) {
    // O texto leva um link de uso único: só aparece no console em desenvolvimento.
    if (devMailer) console.log(`[e-mail simulado] ${mail.subject}\n${mail.text}`)
    else console.warn('Aviso de plano perto de expirar não enviado: o SMTP não está configurado.')
  }
}

/** SITE_URL: só https (ou http em loopback, para testes); sem ela, o endereço público do site. */
function siteUrlFromEnv(value: string | undefined): string | undefined {
  if (!value) return undefined
  const url = new URL(value)
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('SITE_URL precisa ser https.')
  return url.origin
}

/** TRUST_PROXY: "true", número de saltos ou lista de IPs/CIDRs. */
function trustProxyFromEnv(value: string | undefined): boolean | number | string[] {
  if (!value || value === 'false') return false
  if (value === 'true') return true
  if (/^\d+$/.test(value)) return Number(value)
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

if (production && !databaseUrl) throw new Error('Em produção, defina DATABASE_URL.')
const smtp = smtpConfigFromEnv(process.env)
if (production && !smtp) throw new Error('Em produção, configure o SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS).')
// Chave curta demais seria fácil de adivinhar: a rota do site fica desligada.
const siteKey = (process.env.SITE_API_KEY ?? '').length >= 32 ? process.env.SITE_API_KEY : undefined
if (process.env.SITE_API_KEY && !siteKey) console.warn('SITE_API_KEY tem menos de 32 caracteres: o cadastro pelo site fica desligado.')
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.warn(`Atenção: o servidor escuta em ${host} sem HTTPS. Use um proxy reverso com HTTPS na frente dele.`)
}

if (databaseUrl && process.env.AUTO_MIGRATE === 'true') {
  await migrate(databaseUrl, await readFile(new URL('./db/schema.sql', import.meta.url), 'utf8'))
}

const store = databaseUrl ? createMysqlStore(databaseUrl) : createMemoryStore()
if (!databaseUrl) console.warn('DATABASE_URL não definida: usando armazenamento em MEMÓRIA (os dados somem ao parar o servidor).')

const app = buildApp({
  store,
  mailer: smtp ? createSmtpMailer(smtp) : consoleMailer,
  logger: true,
  trustProxy: trustProxyFromEnv(process.env.TRUST_PROXY),
  siteKey,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || undefined,
  siteUrl: siteUrlFromEnv(process.env.SITE_URL)
})

const shutdown = async (): Promise<void> => {
  await app.close()
  await store.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

await app.listen({ host, port })
