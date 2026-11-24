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
  requestFileChars: 25 * 1024 * 1024
} as const

/** Métodos oferecidos no seletor (o arquivo aceita também um método personalizado). */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

/** Esquemas de URL aceitos pelo Cliente de API. */
export const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'ws:', 'wss:'] as const
