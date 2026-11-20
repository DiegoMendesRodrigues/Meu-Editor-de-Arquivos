// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/// <reference types="vite/client" />

// Build CommonJS do hunspell-asm (usado no worker do corretor): mesma API do pacote.
declare module 'hunspell-asm/dist/cjs/index.js' {
  export { loadModule } from 'hunspell-asm'
}
