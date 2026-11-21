// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
// Entrada CommonJS para hospedagens que carregam o arquivo com require() (ex.: LiteSpeed/Hostinger).
// O código da API é ESM com await no nível superior, então é carregado por import().
import('./dist/index.js').catch((err) => {
  console.error(err)
  process.exit(1)
})
