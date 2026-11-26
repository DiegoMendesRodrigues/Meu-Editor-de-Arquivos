// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Gerar código: só texto, no Renderer. Segredos e variáveis saem como {{nome}}; nada é resolvido aqui. */
import type { ApiRequest } from '../schema'
import { csharpHttpClient } from './csharpHttpClient'
import { curlBash } from './curlBash'
import { curlPowerShell } from './curlPowerShell'
import { goNetHttp } from './goNetHttp'
import { invokeRestMethod } from './invokeRestMethod'
import { javaHttpClient } from './javaHttpClient'
import { jsFetch } from './jsFetch'
import { nodeAxios } from './nodeAxios'
import { phpCurl } from './phpCurl'
import { pythonRequests } from './pythonRequests'
import { rustReqwest } from './rustReqwest'
import type { CodegenTarget } from './types'

export type { CodegenTarget } from './types'

export const CODEGEN_TARGETS: readonly CodegenTarget[] = [
  curlBash,
  curlPowerShell,
  invokeRestMethod,
  pythonRequests,
  jsFetch,
  nodeAxios,
  csharpHttpClient,
  javaHttpClient,
  goNetHttp,
  phpCurl,
  rustReqwest
]

export function generateCode(request: ApiRequest, targetId: string): string {
  const target = CODEGEN_TARGETS.find((t) => t.id === targetId)
  if (!target) throw new Error(`unknown codegen target: ${targetId}`)
  return target.generate(request)
}
