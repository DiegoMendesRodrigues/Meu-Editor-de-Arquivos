// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile } from 'node:fs/promises'
import { migrate } from './db/mysql.js'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Defina DATABASE_URL (ex.: mysql://usuario:senha@localhost:3306/meu_editor).')
  process.exit(1)
}
const { adminSaved } = await migrate(url, await readFile(new URL('./db/schema.sql', import.meta.url), 'utf8'))
console.log('Esquema aplicado.')
if (adminSaved) console.log('Administrador cadastrado ou atualizado (ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD).')
