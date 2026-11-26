// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { BookOpen, DatabaseZap, Loader2, TriangleAlert } from 'lucide-react'
import { parseApiRequest, type Body } from '@shared/api/schema'
import { extractOperations, fieldPlainText, parseIntrospectionResponse, INTROSPECTION_QUERY, type GqlField, type GqlType } from '@shared/api/graphql'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'
import { useTheme } from '@/theme'
import { getSendContext } from '@/store/api'
import type { EditorDocument } from '@/store/documents'
import { acquireGraphqlCompletion, ensureGraphqlLanguage, graphqlModelPath } from './graphql/completion'
import { DocsExplorer } from './graphql/DocsExplorer'
import { useGraphqlSchemas } from './graphql/schemaStore'
import { SubscriptionPanel } from './graphql/SubscriptionPanel'

type GraphqlBody = Extract<Body, { type: 'graphql' }>

const selectClass = 'rounded border border-border bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-accent'
const buttonClass = 'inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 text-[12.5px] hover:bg-zinc-100 disabled:opacity-50'
const FONT = "'Cascadia Code', 'Consolas', 'DejaVu Sans Mono', 'Ubuntu Mono', monospace"
/** Códigos de envio que têm texto próprio do GraphQL; os demais usam os erros de rede (apiClient.error.*). */
const OWN_ERRORS = new Set(['invalidRequest'])

/** Valida o JSON das variáveis; vazio é válido. */
export function checkVariables(text: string): 'ok' | 'invalid' | 'notObject' {
  if (text.trim() === '') return 'ok'
  try {
    const v: unknown = JSON.parse(text)
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? 'ok' : 'notObject'
  } catch {
    return 'invalid'
  }
}

/** Corpo GraphQL: query, variáveis, operationName, introspecção e explorador. */
export function GraphqlEditor({ body, onChange, doc }: { body: GraphqlBody; onChange: (body: GraphqlBody) => void; doc: EditorDocument }) {
  const t = useT()
  const theme = useTheme()
  const entry = useGraphqlSchemas((s) => s.byDoc[doc.id])
  const [docsOpen, setDocsOpen] = useState(true)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const releaseRef = useRef<(() => void) | null>(null)
  const runIdRef = useRef<string | null>(null)

  // Libera o autocompletar e cancela uma introspecção pendente ao sair da aba.
  useEffect(
    () => () => {
      releaseRef.current?.()
      releaseRef.current = null
      if (runIdRef.current) void window.api.apiCancel(runIdRef.current).catch(() => undefined)
    },
    []
  )

  const operations = useMemo(() => extractOperations(body.query).filter((o) => o.name), [body.query])
  // Operação escolhida (ou a única do documento) do tipo subscription: o envio normal não serve, vale "Assinar".
  const allOperations = useMemo(() => extractOperations(body.query), [body.query])
  const selectedOp = body.operationName ? allOperations.find((o) => o.name === body.operationName) : allOperations.length === 1 ? allOperations[0] : undefined
  const isSubscription = selectedOp?.type === 'subscription'
  const variablesState = checkVariables(body.variables)
  const model = entry?.model ?? null
  const loading = entry?.status === 'loading'
  const monacoTheme = theme === 'dark' ? 'meu-escuro' : 'meu-claro'

  const fail = (key: string, params?: Record<string, string | number>): void => {
    useGraphqlSchemas.getState().set(doc.id, { status: 'error', model: null, error: { key, params } })
  }

  const loadSchema = async (): Promise<void> => {
    const parsed = parseApiRequest(doc.content)
    if (!parsed.ok) return fail('apiClient.graphql.error.invalidRequest')
    // A requisição do documento, só com o corpo trocado pela introspecção (nada é gravado no arquivo).
    const request = {
      ...parsed.request,
      method: 'POST' as const,
      body: { type: 'graphql' as const, query: INTROSPECTION_QUERY, variables: '', operationName: 'IntrospectionQuery' }
    }
    const runId = crypto.randomUUID()
    runIdRef.current = runId
    useGraphqlSchemas.getState().set(doc.id, { status: 'loading', model: null, error: null })
    try {
      const ctx = await getSendContext(doc)
      const result = await window.api.apiSend({ runId, request, environment: ctx.environment, collection: ctx.collection, documentPath: doc.path, productionConfirmed: true }) // introspecção só lê o schema
      if (runIdRef.current !== runId) return
      if (!result.ok) {
        if (result.code === 'cancelled') return useGraphqlSchemas.getState().clear(doc.id)
        return fail(OWN_ERRORS.has(result.code) ? `apiClient.graphql.error.${result.code}` : `apiClient.error.${result.code}`)
      }
      if (result.body.truncated) return fail('apiClient.graphql.error.truncated')
      const out = result.body.encoding === 'utf8' ? parseIntrospectionResponse(result.body.text) : ({ ok: false, code: 'notGraphql' } as const)
      if (out.ok) {
        useGraphqlSchemas.getState().set(doc.id, { status: 'loaded', model: out.model, error: null })
      } else if (out.code === 'notGraphql' && result.status >= 400) {
        fail('apiClient.graphql.error.httpStatus', { status: result.status })
      } else {
        fail(`apiClient.graphql.error.${out.code}`)
      }
    } catch {
      if (runIdRef.current === runId) fail('apiClient.graphql.error.unknown')
    } finally {
      if (runIdRef.current === runId) runIdRef.current = null
    }
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    releaseRef.current?.()
    releaseRef.current = acquireGraphqlCompletion(monaco)
  }

  /** Insere o campo no cursor; com a query vazia, monta a operação completa pelo tipo raiz. */
  const insertField = (field: GqlField, owner: GqlType): void => {
    const text = fieldPlainText(model, field)
    if (body.query.trim() === '') {
      const op = model?.mutationType === owner.name ? 'mutation' : model?.subscriptionType === owner.name ? 'subscription' : 'query'
      const isRoot = [model?.queryType, model?.mutationType, model?.subscriptionType].includes(owner.name)
      const indented = text.split('\n').map((l) => `  ${l}`).join('\n')
      onChange({ ...body, query: isRoot ? `${op} {\n${indented}\n}\n` : text })
      return
    }
    const editor = editorRef.current
    const selection = editor?.getSelection()
    if (!editor || !selection) return
    editor.executeEdits('graphql-docs', [{ range: selection, text, forceMoveMarkers: true }])
    editor.focus()
  }

  const errorText = entry?.error ? t(entry.error.key as MessageKey, entry.error.params) : null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} disabled={loading} onClick={() => void loadSchema()}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <DatabaseZap size={14} />}
          {loading ? t('apiClient.graphql.loading') : model ? t('apiClient.graphql.reloadSchema') : t('apiClient.graphql.loadSchema')}
        </button>
        {model && <span className="text-[12.5px] text-zinc-500">{t('apiClient.graphql.schemaLoaded', { count: Object.keys(model.types).length })}</span>}
        <label className="ml-auto flex items-center gap-1.5 text-[12.5px] text-zinc-600">
          {t('apiClient.graphql.operation')}
          <select className={selectClass} value={body.operationName ?? ''} onChange={(e) => onChange({ ...body, operationName: e.target.value || undefined })}>
            <option value="">{t('apiClient.graphql.operationAuto')}</option>
            {operations.map((o) => (
              <option key={o.name} value={o.name!}>
                {o.name}
              </option>
            ))}
            {body.operationName && !operations.some((o) => o.name === body.operationName) && <option value={body.operationName}>{body.operationName}</option>}
          </select>
        </label>
        <button type="button" className={buttonClass} aria-pressed={docsOpen} onClick={() => setDocsOpen((v) => !v)}>
          <BookOpen size={14} />
          {docsOpen ? t('apiClient.graphql.hideDocs') : t('apiClient.graphql.showDocs')}
        </button>
      </div>

      {errorText && (
        <div role="alert" className="flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2 py-1 text-[12.5px] text-red-700">
          <TriangleAlert size={14} /> {errorText}
        </div>
      )}
      {!model && !errorText && !loading && <p className="text-[12.5px] text-zinc-500">{t('apiClient.graphql.noSchema')}</p>}

      {isSubscription && <SubscriptionPanel body={body} doc={doc} />}

      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="text-[12.5px] text-zinc-600">{t('apiClient.graphql.query')}</div>
          <div className="h-64 overflow-hidden rounded border border-border" role="group" aria-label={t('apiClient.graphql.queryLabel')}>
            <Editor
              path={graphqlModelPath(doc.id)}
              language="graphql"
              theme={monacoTheme}
              value={body.query}
              beforeMount={(monaco) => ensureGraphqlLanguage(monaco)}
              onMount={handleMount}
              onChange={(v) => onChange({ ...body, query: v ?? '' })}
              options={{ automaticLayout: true, fontSize: 13, fontFamily: FONT, minimap: { enabled: false }, scrollBeyondLastLine: false, quickSuggestions: true, folding: true, lineNumbersMinChars: 3 }}
            />
          </div>
          <div className="text-[12.5px] text-zinc-600">{t('apiClient.graphql.variables')}</div>
          <div className="h-28 overflow-hidden rounded border border-border" role="group" aria-label={t('apiClient.graphql.variablesLabel')}>
            <Editor
              path={`inmemory://api-graphql/${doc.id}.variables.json`}
              language="json"
              theme={monacoTheme}
              value={body.variables}
              onChange={(v) => onChange({ ...body, variables: v ?? '' })}
              options={{ automaticLayout: true, fontSize: 13, fontFamily: FONT, minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'off', folding: false }}
            />
          </div>
          {variablesState !== 'ok' && (
            <div role="alert" className="flex items-center gap-1.5 text-[12.5px] text-amber-700">
              <TriangleAlert size={14} />
              {variablesState === 'invalid' ? t('apiClient.graphql.variablesInvalid') : t('apiClient.graphql.variablesNotObject')}
            </div>
          )}
        </div>
        {docsOpen && (
          <aside aria-label={t('apiClient.graphql.docs')} className="h-[26rem] w-72 shrink-0 overflow-hidden rounded border border-border bg-surface">
            {model ? <DocsExplorer model={model} onInsert={insertField} /> : <p className="p-2 text-[12.5px] text-zinc-500">{t('apiClient.graphql.noSchema')}</p>}
          </aside>
        )}
      </div>
    </div>
  )
}
