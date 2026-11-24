// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// O electron-vite resolve "x?nodeWorker" (thread do Main) só na compilação. Nos testes, a importação vira um
// stub que falha ao criar a thread: quem testa o código com thread troca o módulo por um mock (vi.mock).
const nodeWorkerStub = {
  name: 'node-worker-stub',
  enforce: 'pre' as const,
  resolveId: (id: string) => (id.endsWith('?nodeWorker') ? 'virtual:node-worker-stub' : undefined),
  load: (id: string) => (id === 'virtual:node-worker-stub' ? 'export default function () { throw new Error("thread indisponível nos testes") }' : undefined)
}

export default defineConfig({
  plugins: [nodeWorkerStub],
  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts']
  }
})
