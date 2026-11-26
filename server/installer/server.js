// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
// Arquivo de entrada da API (usado por hospedagens que procuram server.js ou o campo "main").
// Carrega por import() dinâmico: assim o arquivo também funciona quando a hospedagem o abre com require()
// (LiteSpeed/Hostinger), já que o código da API tem await no nível superior.
import('./dist/index.js').catch((err) => {
  console.error(err)
  process.exit(1)
})
