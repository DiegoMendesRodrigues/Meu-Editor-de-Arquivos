// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { buildApp, type Mailer } from './app.js'
import { createMemoryStore } from './db/memory.js'
import { createMysqlStore } from './db/mysql.js'

/**
 * Configuração por variáveis de ambiente:
 *   DATABASE_URL  mysql://usuario:senha@host:3306/banco   (sem ela, usa memória: só para testes locais!)
 *   HOST / PORT   endereço de escuta (padrão 127.0.0.1:3000). Em produção, coloque atrás de HTTPS (proxy reverso).
 *   TRUST_PROXY   "true" quando estiver atrás de um proxy reverso de confiança (usa o IP real do cliente nos limites).
 *   NODE_ENV      "production" exige DATABASE_URL e não aceita o envio de e-mail simulado.
 */
const databaseUrl = process.env.DATABASE_URL
const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 3000)

const production = process.env.NODE_ENV === 'production'

// Protótipo: o código de redefinição aparece no console, só fora de produção. Troque por um serviço de e-mail real.
// O e-mail do usuário não é escrito no log (dado pessoal).
const consoleMailer: Mailer = {
  async sendPasswordReset(_to, token) {
    console.log(`[e-mail simulado] Código de redefinição de senha: ${token}`)
  }
}

if (production && !databaseUrl) throw new Error('Em produção, defina DATABASE_URL.')
if (production) throw new Error('Em produção, configure um serviço de e-mail real (o envio simulado mostra o código no console).')
if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.warn(`Atenção: o servidor escuta em ${host} sem HTTPS. Use um proxy reverso com HTTPS na frente dele.`)
}

const store = databaseUrl ? createMysqlStore(databaseUrl) : createMemoryStore()
if (!databaseUrl) console.warn('DATABASE_URL não definida: usando armazenamento em MEMÓRIA (os dados somem ao parar o servidor).')

const app = buildApp({ store, mailer: consoleMailer, logger: true, trustProxy: process.env.TRUST_PROXY === 'true' })

const shutdown = async (): Promise<void> => {
  await app.close()
  await store.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

await app.listen({ host, port })
