// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useRef, useState } from 'react'
import { Loader2, Radio, Square, TriangleAlert } from 'lucide-react'
import { parseApiRequest, type Body } from '@shared/api/schema'
import type { MessageKey } from '@shared/i18n'
import { Modal, buttonClass, primaryButtonClass } from '@/components/Modal'
import { useT } from '@/i18n'
import { getSendContext } from '@/store/api'
import type { EditorDocument } from '@/store/documents'
import { listenWs, prettyJson, wsErrorKey } from '../wsEvents'

type GraphqlBody = Extract<Body, { type: 'graphql' }>

const MAX_EVENTS = 500
const ACK_TIMEOUT_MS = 10_000
const SUB_ID = '1'

interface SubEvent {
  n: number
  kind: 'next' | 'error' | 'complete'
  at: string
  text: string
}

/** http→ws e https→wss; ws/wss ficam como estão; o resto (ex.: {{variável}}) segue para o Main resolver. */
export function toWsUrl(url: string): string {
  return url.trim().replace(/^http(s?):/i, (_m, s: string) => `ws${s}:`)
}

/**
 * Assinatura GraphQL (protocolo graphql-transport-ws) por WebSocket aberto no Main. O envio normal da
 * barra da requisição não serve para uma subscription: aqui o fluxo é connection_init, connection_ack,
 * subscribe, e os `next` chegam numa lista.
 */
export function SubscriptionPanel({ body, doc }: { body: GraphqlBody; doc: EditorDocument }) {
  const t = useT()
  const [status, setStatus] = useState<'idle' | 'connecting' | 'active'>('idle')
  const [events, setEvents] = useState<SubEvent[]>([])
  const [error, setError] = useState<{ key: string; params?: Record<string, string | number> } | null>(null)
  const [confirmHost, setConfirmHost] = useState<string | null>(null)
  const connRef = useRef<string | null>(null)
  const offRef = useRef<(() => void) | null>(null)
  const ackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const counter = useRef(0)

  const cleanup = (close: boolean): void => {
    if (ackTimer.current) clearTimeout(ackTimer.current)
    ackTimer.current = null
    const id = connRef.current
    if (id && close) void window.api.apiWsClose(id).catch(() => undefined)
    offRef.current?.()
    offRef.current = null
    connRef.current = null
    setStatus('idle')
  }
  // Fecha a assinatura ao sair da aba.
  useEffect(() => () => cleanup(true), []) // eslint-disable-line react-hooks/exhaustive-deps

  const push = (kind: SubEvent['kind'], at: string, text: string): void =>
    setEvents((cur) => [...cur, { n: ++counter.current, kind, at, text }].slice(-MAX_EVENTS))

  const send = (id: string, payload: unknown): void => void window.api.apiWsSend(id, { data: JSON.stringify(payload) }).catch(() => undefined)

  const start = async (confirmSecretHost?: string): Promise<void> => {
    if (connRef.current) return
    setError(null)
    const parsed = parseApiRequest(doc.content)
    if (!parsed.ok) return setError({ key: 'apiClient.graphql.error.invalidRequest' })
    let variables: unknown
    try {
      variables = body.variables.trim() === '' ? undefined : (JSON.parse(body.variables) as unknown)
    } catch {
      return setError({ key: 'apiClient.graphql.subError.invalid' })
    }
    const url = toWsUrl(parsed.request.url)
    if (!/^(wss?:|\{\{)/i.test(url)) return setError({ key: 'apiClient.graphql.subError.url' })

    const connId = crypto.randomUUID()
    connRef.current = connId
    setStatus('connecting')
    offRef.current = listenWs(connId, (e) => {
      if (e.type === 'close') {
        if (connRef.current === connId) {
          push('complete', e.at, t('apiClient.graphql.subStatus.complete'))
          cleanup(false)
        }
        return
      }
      if (e.type === 'error') {
        setError({ key: wsErrorKey(String(e.code ?? 'unknown')) })
        return
      }
      if (e.type !== 'message' || e.direction !== 'in' || e.data === undefined || e.truncated) return
      let msg: { type?: unknown; payload?: unknown; id?: unknown }
      try {
        msg = JSON.parse(e.data) as typeof msg
      } catch {
        return
      }
      if (msg.type === 'connection_ack') {
        if (ackTimer.current) clearTimeout(ackTimer.current)
        ackTimer.current = null
        setStatus('active')
        send(connId, { id: SUB_ID, type: 'subscribe', payload: { query: body.query, variables, operationName: body.operationName || undefined } })
      } else if (msg.type === 'next') {
        push('next', e.at, JSON.stringify(msg.payload, null, 2))
      } else if (msg.type === 'error') {
        push('error', e.at, JSON.stringify(msg.payload, null, 2))
      } else if (msg.type === 'complete') {
        push('complete', e.at, t('apiClient.graphql.subEvent.complete'))
        cleanup(true)
      } else if (msg.type === 'ping') {
        send(connId, { type: 'pong' })
      }
    })

    try {
      const ctx = await getSendContext(doc)
      const result = await window.api.apiWsConnect({
        connId,
        url,
        headers: parsed.request.headers,
        protocols: ['graphql-transport-ws'],
        environment: ctx.environment,
        collection: ctx.collection,
        verifyTls: parsed.request.settings.verifyTls,
        ...(confirmSecretHost ? { confirmSecretHost } : {})
      })
      if (connRef.current !== connId) return // parou enquanto conectava
      if (!result.ok) {
        cleanup(false)
        if (result.code === 'secretHostNotConfirmed' && result.host) return setConfirmHost(result.host)
        return setError({ key: wsErrorKey(result.code), ...(result.status ? { params: { status: result.status } } : {}) })
      }
      send(connId, { type: 'connection_init' })
      ackTimer.current = setTimeout(() => {
        if (connRef.current !== connId) return
        setError({ key: 'apiClient.graphql.subError.ack' })
        cleanup(true)
      }, ACK_TIMEOUT_MS)
    } catch {
      if (connRef.current === connId) {
        cleanup(false)
        setError({ key: 'apiClient.error.unknown' })
      }
    }
  }

  const stop = (): void => {
    const id = connRef.current
    if (id) send(id, { id: SUB_ID, type: 'complete' })
    // O complete precisa sair antes do fechamento: o Main enfileira os dois pela ordem das chamadas.
    cleanup(true)
  }

  const active = status !== 'idle'
  return (
    <div className="flex flex-col gap-2" data-testid="gql-subscription">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[12.5px] text-zinc-600">{t('apiClient.graphql.subscriptionHint')}</p>
        {!active ? (
          <button type="button" className={primaryButtonClass} onClick={() => void start()} data-testid="gql-subscribe">
            <Radio size={14} className="mr-1 inline" /> {t('apiClient.graphql.subscribe')}
          </button>
        ) : (
          <button type="button" className={buttonClass} onClick={stop} data-testid="gql-unsubscribe">
            {status === 'connecting' ? <Loader2 size={14} className="mr-1 inline animate-spin" /> : <Square size={14} className="mr-1 inline" />}
            {t('apiClient.graphql.unsubscribe')}
          </button>
        )}
        <span role="status" data-testid="gql-sub-status" data-state={status} className="text-[12.5px] text-zinc-500">
          {status === 'connecting' ? t('apiClient.graphql.subStatus.connecting') : status === 'active' ? t('apiClient.graphql.subStatus.active') : ''}
        </span>
      </div>
      {error && (
        <div role="alert" className="flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2 py-1 text-[12.5px] text-red-700">
          <TriangleAlert size={14} /> {t(error.key as MessageKey, error.params)}
        </div>
      )}
      <div className="text-[12.5px] font-medium">{t('apiClient.graphql.subEvents')}</div>
      <ol aria-label={t('apiClient.graphql.subEvents')} className="max-h-72 overflow-auto rounded border border-border font-mono text-[12px]" data-testid="gql-events">
        {events.length === 0 && <li className="p-2 font-sans text-[12.5px] text-zinc-500">{t('apiClient.graphql.subEmpty')}</li>}
        {events.map((e) => (
          <li key={e.n} data-kind={e.kind} className="border-b border-border/50 px-2 py-1">
            <div className={`text-[11px] ${e.kind === 'error' ? 'text-red-600' : 'text-zinc-500'}`}>
              {new Date(e.at).toLocaleTimeString()} · {e.kind === 'error' ? t('apiClient.graphql.subEvent.error') : e.kind === 'next' ? t('apiClient.graphql.subEvent.next') : ''}
            </div>
            <pre className="select-text whitespace-pre-wrap break-all">{prettyJson(e.text) ?? e.text}</pre>
          </li>
        ))}
      </ol>
      {confirmHost && (
        <Modal title={t('apiClient.secretHost.title', { host: confirmHost })} description={t('apiClient.secretHost.body', { host: confirmHost })} onClose={() => setConfirmHost(null)} size="sm">
          <div className="flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={() => setConfirmHost(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              data-testid="api-secret-host-confirm"
              onClick={() => {
                const host = confirmHost
                setConfirmHost(null)
                void start(host)
              }}
            >
              {t('apiClient.secretHost.confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
