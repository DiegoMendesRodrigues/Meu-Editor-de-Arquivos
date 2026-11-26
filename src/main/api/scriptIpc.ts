// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { scriptTrustInputSchema } from '@shared/api/protocol'
import { IpcChannels } from '@shared/ipc'
import { assertAuthorized } from '../ipc/access'
import { handle } from '../ipc/secure'
import { collectionKeyOf, collectionScriptHashes, isScriptTrusted, requestKeyOf, scriptHash, trustHashes } from './scriptTrust'

/**
 * Canais da confiança em scripts (fase 5). O Renderer só diz "confio nestes scripts"; quem lê as
 * requisições da coleção é o Main (e só numa pasta autorizada), então um Renderer comprometido não
 * consegue registrar o hash de um texto que o usuário nunca viu... além do que o próprio usuário digitou.
 */
export function registerScriptHandlers(): void {
  handle(IpcChannels.apiScriptTrust, async (_e, raw: unknown): Promise<void> => {
    const input = scriptTrustInputSchema.parse(raw)
    const current = scriptHash(input.pre, input.post)
    const dir = input.collectionDir?.trim() ? input.collectionDir : undefined
    if (input.wholeCollection && dir) {
      const abs = await assertAuthorized(dir)
      // A lista da pasta passa a ser exatamente os scripts atuais dela (mais o que está aberto no editor).
      const hashes = await collectionScriptHashes(abs)
      if (input.pre.trim() !== '' || input.post.trim() !== '') hashes.push(current)
      await trustHashes(collectionKeyOf(abs), hashes, true)
      return
    }
    if (input.pre.trim() === '' && input.post.trim() === '') return
    // Script digitado no editor (ou confiança só nesta requisição).
    await trustHashes(dir && !input.wholeCollection ? collectionKeyOf(dir) : requestKeyOf(input.requestKey), [current])
    if (dir && !input.wholeCollection) await trustHashes(requestKeyOf(input.requestKey), [current])
  })

  handle(IpcChannels.apiScriptIsTrusted, (_e, raw: unknown): Promise<boolean> => {
    const input = scriptTrustInputSchema.parse(raw)
    return isScriptTrusted({ pre: input.pre, post: input.post, keys: { dir: input.collectionDir?.trim() || null, request: [input.requestKey] } })
  })
}
