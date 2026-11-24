// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { randomBytes } from 'node:crypto'
import { basename, extname } from 'node:path'
import type { Body } from '@shared/api/schema'
import { ApiFail } from './errors'
import { statAuthorizedFile } from './files'

/** Pedaço do corpo: bytes em memória ou um arquivo lido em streaming na hora de enviar. */
export type BodyChunk = Buffer | { path: string; size: number }

export interface BuiltBody {
  chunks: BodyChunk[]
  length: number
  /** Content-Type padrão do tipo de corpo (o usuário pode sobrescrever nos cabeçalhos). */
  contentType?: string
  /** Cabeçalhos extras do tipo de corpo (SOAPAction). */
  headers: [string, string][]
}

const RAW_TYPES = { json: 'application/json', xml: 'application/xml', text: 'text/plain', html: 'text/html' } as const

const MIME: Record<string, string> = {
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.zip': 'application/zip'
}

export const mimeFor = (path: string): string => MIME[extname(path).toLowerCase()] ?? 'application/octet-stream'

const lengthOf = (chunks: BodyChunk[]): number => chunks.reduce((n, c) => n + (Buffer.isBuffer(c) ? c.length : c.size), 0)

const text = (s: string): BuiltBody => {
  const buf = Buffer.from(s, 'utf8')
  return { chunks: buf.length ? [buf] : [], length: buf.length, headers: [] }
}

/** Codificação de formulário (application/x-www-form-urlencoded): espaço vira "+". */
export const formEncode = (s: string): string =>
  encodeURIComponent(s).replace(/%20/g, '+').replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

/** Nome de campo/arquivo dentro do cabeçalho Content-Disposition: sem aspas nem quebras de linha soltas. */
const quoteName = (s: string): string => s.replace(/[\r\n]/g, ' ').replace(/"/g, '%22')

export interface ResolvedBodyInput {
  body: Body
  documentPath: string | null
}

/** Monta o corpo já resolvido (sem {{variáveis}}). Os arquivos passam por assertAuthorized. */
export async function buildBody({ body, documentPath }: ResolvedBodyInput): Promise<BuiltBody> {
  switch (body.type) {
    case 'none':
      return { chunks: [], length: 0, headers: [] }
    case 'raw':
      return { ...text(body.text), contentType: RAW_TYPES[body.language] }
    case 'urlencoded': {
      const s = body.fields
        .filter((f) => f.enabled && f.key !== '')
        .map((f) => `${formEncode(f.key)}=${formEncode(f.value)}`)
        .join('&')
      return { ...text(s), contentType: 'application/x-www-form-urlencoded' }
    }
    case 'multipart': {
      const boundary = `----MeuEditorBoundary${randomBytes(16).toString('hex')}`
      const chunks: BodyChunk[] = []
      for (const part of body.parts) {
        if (!part.enabled || part.key === '') continue
        if (part.kind === 'text') {
          chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${quoteName(part.key)}"\r\n\r\n${part.value}\r\n`))
        } else {
          if (!part.path) throw new ApiFail('fileNotFound')
          const file = await statAuthorizedFile(part.path, documentPath)
          chunks.push(
            Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="${quoteName(part.key)}"; filename="${quoteName(basename(file.path))}"\r\nContent-Type: ${mimeFor(file.path)}\r\n\r\n`
            ),
            file,
            Buffer.from('\r\n')
          )
        }
      }
      chunks.push(Buffer.from(`--${boundary}--\r\n`))
      return { chunks, length: lengthOf(chunks), contentType: `multipart/form-data; boundary=${boundary}`, headers: [] }
    }
    case 'binary': {
      if (!body.path) return { chunks: [], length: 0, headers: [] }
      const file = await statAuthorizedFile(body.path, documentPath)
      return { chunks: [file], length: file.size, contentType: 'application/octet-stream', headers: [] }
    }
    case 'graphql': {
      let variables: unknown
      if (body.variables.trim() !== '') {
        try {
          variables = JSON.parse(body.variables)
        } catch {
          throw new ApiFail('invalidRequest')
        }
      }
      const payload: Record<string, unknown> = { query: body.query }
      if (variables !== undefined) payload.variables = variables
      if (body.operationName) payload.operationName = body.operationName
      return { ...text(JSON.stringify(payload)), contentType: 'application/json' }
    }
    case 'soap': {
      const built = text(body.envelope)
      // SOAP 1.1: SOAPAction é um cabeçalho (entre aspas). SOAP 1.2: a ação vai no parâmetro do Content-Type.
      if (body.version === '1.2') return { ...built, contentType: `application/soap+xml; charset=utf-8${body.action ? `; action="${body.action}"` : ''}` }
      return { ...built, contentType: 'text/xml; charset=utf-8', headers: [['SOAPAction', `"${body.action}"`]] }
    }
  }
}
