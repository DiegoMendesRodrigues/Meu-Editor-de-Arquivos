// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import nodemailer from 'nodemailer'
import type { Mailer } from './app.js'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

/** Lê SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM. Devolve null se faltar algum dado. */
export function smtpConfigFromEnv(env: NodeJS.ProcessEnv): SmtpConfig | null {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  return { host: SMTP_HOST, port: Number(env.SMTP_PORT ?? 465), user: SMTP_USER, pass: SMTP_PASS, from: env.SMTP_FROM ?? SMTP_USER }
}

/** Mailer real por SMTP (porta 465 = TLS direto). O código nunca é escrito no log. */
export function createSmtpMailer(cfg: SmtpConfig): Mailer {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    requireTLS: cfg.port !== 465,
    auth: { user: cfg.user, pass: cfg.pass }
  })
  return {
    async sendPasswordReset(to, token) {
      await transport.sendMail({
        from: `Meu Editor de Arquivos <${cfg.from}>`,
        to,
        subject: 'Meu Editor de Arquivos - redefinição de senha / password reset',
        text:
          `Seu código de redefinição de senha: ${token}\n` +
          'Ele expira em breve. Se não foi você, ignore este e-mail.\n\n' +
          `Your password reset code: ${token}\n` +
          'It expires soon. If this was not you, ignore this message.\n'
      })
    }
  }
}
