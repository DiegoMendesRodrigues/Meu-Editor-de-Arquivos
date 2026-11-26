// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { readFile, realpath, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { listWsdlReferences, resolveWsdlLocation, isRemoteOrAbsolute, WSDL_FILE_LIMITS, type WsdlFilesOption } from '@shared/api/import/wsdlFiles'
import { parseXmlSafe } from '@shared/api/xmlSafe'
import { isInside } from '../ipc/access'

/**
 * Lê os arquivos que um WSDL do disco referencia (wsdl:import, xsd:import, xsd:include). O WSDL inicial foi
 * escolhido em diálogo; só valem arquivos locais na pasta dele ou abaixo (conferido com realpath), e a
 * autorização vale só para esta leitura. A thread de análise recebe o mapa de textos e não toca o disco.
 */
export async function collectWsdlFiles(wsdlPath: string, text: string): Promise<WsdlFilesOption> {
  const baseReal = await realpath(dirname(wsdlPath))
  const mainKey = basename(wsdlPath)
  const files: Record<string, string> = { [mainKey]: text }
  const warnings = new Set<string>()
  const seen = new Set<string>([mainKey])

  const readKey = async (key: string): Promise<string | null> => {
    const real = await realpath(join(baseReal, ...key.split('/'))).catch(() => null)
    // Link simbólico que aponta para fora da pasta base é recusado.
    if (!real || !isInside(baseReal, real)) return null
    const st = await stat(real).catch(() => null)
    if (!st?.isFile() || st.size > WSDL_FILE_LIMITS.fileBytes) return null
    return readFile(real, 'utf8').catch(() => null)
  }

  let level: { key: string; text: string }[] = [{ key: mainKey, text }]
  for (let depth = 0; depth < WSDL_FILE_LIMITS.depth && level.length > 0; depth++) {
    const next: { key: string; text: string }[] = []
    for (const cur of level) {
      let refs: string[]
      try {
        refs = listWsdlReferences(parseXmlSafe(cur.text).documentElement)
      } catch {
        continue
      }
      for (const loc of refs) {
        if (isRemoteOrAbsolute(loc.trim())) continue // quem avisa é a análise
        const key = resolveWsdlLocation(cur.key, loc)
        if (key === null || seen.has(key)) continue
        if (Object.keys(files).length >= WSDL_FILE_LIMITS.files) {
          warnings.add('wsdlImportLimit')
          continue
        }
        seen.add(key)
        const body = await readKey(key)
        if (body === null) continue // a análise avisa que não achou
        files[key] = body
        next.push({ key, text: body })
      }
    }
    level = next
  }
  return { mainKey, files, warnings: [...warnings] }
}
