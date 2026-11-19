// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// A versão do aplicativo vem do package.json e é gravada no código do Main na compilação:
// assim ela é a mesma em desenvolvimento, nos testes e no pacote final.
const appVersion = (JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }).version

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __APP_VERSION__: JSON.stringify(appVersion) },
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: { input: resolve('src/renderer/index.html') }
    }
  }
})
