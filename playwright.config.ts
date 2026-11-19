import { defineConfig } from '@playwright/test'

/** Testes de interface do app Electron. Antes de rodar: npm run build. */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1, // cada teste abre o app inteiro
  retries: 0,
  reporter: [['list']]
})
