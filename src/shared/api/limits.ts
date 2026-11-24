// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Limites do Cliente de API, usados nos schemas (Zod) do Main e do Renderer.
 * Ficam num só lugar para que as duas camadas recusem exatamente as mesmas entradas.
 */
export const API_LIMITS = {
  /** Tamanho máximo da URL (com a query). */
  urlChars: 8 * 1024,
  /** Linhas de params, cabeçalhos ou campos de formulário por requisição. */
  keyValueRows: 100,
  /** Nome de params, cabeçalhos e variáveis. */
  keyChars: 256,
  /** Valor de um param, cabeçalho ou variável. */
  valueChars: 8 * 1024,
  /** Descrição de uma linha. */
  descriptionChars: 1024,
  /** Corpo em linha no arquivo .apireq (maiores, só como arquivo anexado). */
  bodyChars: 20 * 1024 * 1024,
  /** Nome e descrição da requisição. */
  nameChars: 200,
  requestDescriptionChars: 20 * 1024,
  /** Testes e extrações por requisição. */
  assertions: 100,
  /** Variáveis por ambiente ou coleção. */
  variables: 500,
  /** Tempo limite configurável de uma requisição. */
  timeoutMinMs: 1_000,
  timeoutMaxMs: 10 * 60_000,
  timeoutDefaultMs: 30_000,
  connectTimeoutMs: 10_000,
  maxRedirects: 20,
  defaultMaxRedirects: 10,
  /** Valor de um segredo guardado no cofre. */
  secretChars: 64 * 1024,
  /** Tamanho máximo do texto de um arquivo .apireq ao abrir no construtor. */
  requestFileChars: 25 * 1024 * 1024,
  /** Corpo da resposta guardado na memória do Main (acima disso, só "Enviar e baixar para arquivo"). */
  responseMemoryBytes: 50 * 1024 * 1024,
  /** Teto do corpo gravado em arquivo (saveToFile), depois de descomprimir. */
  responseFileBytes: 2 * 1024 * 1024 * 1024,
  /** O Renderer recebe no máximo isto do corpo para exibir. */
  displayBytes: 10 * 1024 * 1024,
  /** Requisições simultâneas por janela. */
  concurrentRequests: 20,
  /** Histórico: entradas guardadas. */
  historyEntries: 200,
  /** Avaliação dos testes da resposta (thread), por requisição. */
  assertTimeoutMs: 2_000,
  /** Arquivos importados (Postman, OpenAPI, HAR...). */
  importChars: 20 * 1024 * 1024,
  importTimeoutMs: 15_000,
  /** OAuth: tempo máximo esperando o navegador ou o Device Code. */
  oauthTimeoutMs: 5 * 60_000,
  /** WebSocket: conexões abertas por janela e tamanho exibido de cada mensagem. */
  wsConnections: 10,
  wsMessageBytes: 1024 * 1024,
  /** Registro de mensagens do painel WebSocket. */
  wsLogMessages: 5000,
  wsLogBytes: 50 * 1024 * 1024,
  /** Servidor mock: servidores abertos, corpo recebido e conexões simultâneas. */
  mocks: 5,
  mockBodyBytes: 1024 * 1024,
  mockConnections: 100,
  /** O mock para sozinho depois deste tempo sem chamadas. */
  /** gRPC: chamadas abertas por janela, tamanho de uma mensagem e arquivos .proto. */
  grpcCalls: 10,
  grpcMessageBytes: 4 * 1024 * 1024,
  /** Streaming: mensagens por segundo enviadas ao Renderer por chamada; o excesso é descartado e contado. */
  grpcEventsPerSecond: 200,
  /** Fila curta do que passou do limite na janela, e descartes numa janela que pausam o stream até a próxima. */
  grpcEventQueue: 100,
  grpcPauseDropped: 1000,
  protoFileBytes: 2 * 1024 * 1024,
  /** Monitores: quantos ao mesmo tempo e quantas execuções o gráfico guarda. */
  monitors: 20,
  monitorRuns: 100,
  /** Scripts QuickJS: CPU padrão e máxima, memória, linhas do console. */
  scriptCpuMs: 1000,
  scriptCpuMaxMs: 10_000,
  scriptMemoryBytes: 32 * 1024 * 1024,
  scriptConsoleLines: 1000,
  /** pm.sendRequest: chamadas por script e tempo limite de cada uma (a rede não conta como CPU do script). */
  scriptSendRequests: 10,
  scriptSendTimeoutMs: 15_000,
  mockIdleMs: 8 * 3600_000
} as const

/** Métodos oferecidos no seletor (o arquivo aceita também um método personalizado). */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

/** Esquemas de URL aceitos pelo Cliente de API. */
export const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'ws:', 'wss:'] as const
