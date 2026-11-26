// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { t, useLocale } from '@/i18n'
import type { ViewResponse } from '@/api/response/model'
import { bodyKind, bodyText } from '@/api/response/model'
import { buildApiExplainPrompt, buildApiTestsPrompt, buildCollectionDocPrompt, type ApiExchange } from './prompts'
import { useAi } from './store'

/**
 * Pontes entre o Cliente de API e o assistente. Só vai ao modelo o que já está mascarado: `sentRequest` chega
 * do Main com os segredos trocados por máscara, e o cofre nunca é lido aqui.
 */

function toExchange(res: ViewResponse): ApiExchange {
  const kind = bodyKind(res.body)
  const binary = kind === 'image' || kind === 'binary' || !!res.body.file || !!res.body.savedTo
  return {
    request: res.sentRequest,
    status: res.status,
    statusText: res.statusText,
    responseHeaders: res.headers,
    contentType: res.body.contentType,
    bodyText: binary ? '' : bodyText(res.body),
    bodyTruncated: res.body.truncated,
    binary
  }
}

const requestLabel = (res: ViewResponse): string => `${res.sentRequest.method} ${res.sentRequest.url}`.slice(0, 120)

/** "Explicar com IA": abre o assistente com a requisição mascarada e um trecho da resposta. */
export function explainResponseWithAi(res: ViewResponse): void {
  void useAi.getState().ask(buildApiExplainPrompt(toExchange(res)), t('ai.api.explainDisplay', { request: requestLabel(res) }))
}

/** "Sugerir testes": pede asserções no formato do app (campo tests do .apireq). */
export function suggestTestsWithAi(res: ViewResponse): void {
  void useAi.getState().ask(buildApiTestsPrompt(toExchange(res)), t('ai.api.suggestTestsDisplay', { request: requestLabel(res) }))
}

/** "Gerar documentação com IA": parte do Markdown da coleção que o app já gera. */
export function documentCollectionWithAi(name: string, markdown: string): void {
  const locale = useLocale.getState().locale
  void useAi.getState().ask(buildCollectionDocPrompt(markdown, locale), t('ai.api.documentDisplay', { name }))
}
