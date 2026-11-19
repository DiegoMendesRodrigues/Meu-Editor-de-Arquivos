// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { buildApp, type Mailer } from './app.js'
import { createMemoryStore } from './db/memory.js'
import { createMysqlStore } from './db/mysql.js'

/**
 * Configuração por variáveis de ambiente:
 *   DATABASE_URL  mysql://usuario:senha@host:3306/banco   (sem ela, usa memória: só para testes locais!)
 *   HOST / PORT   endereço de escuta (padrão 127.0.0.1:3000). Em produção, coloque atrás de HTTPS (proxy reverso).
 */
const databaseUrl = process.env.DATABASE_URL
const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? 3000)

// Protótipo: o código de redefinição é escrito no log do servidor. Troque por um serviço de e-mail real.
const consoleMailer: Mailer = {
  async sendPasswordReset(to, token) {
    console.log(`[e-mail simulado] Redefinição de senha para ${to}. Código: ${token}`)
  }
}

const store = databaseUrl ? createMysqlStore(databaseUrl) : createMemoryStore()
if (!databaseUrl) console.warn('DATABASE_URL não definida: usando armazenamento em MEMÓRIA (os dados somem ao parar o servidor).')

const app = buildApp({ store, mailer: consoleMailer, logger: true })

const shutdown = async (): Promise<void> => {
  await app.close()
  await store.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

await app.listen({ host, port })
