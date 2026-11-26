// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyRound, ShieldAlert } from 'lucide-react'
import { API_LIMITS } from '@shared/api/limits'
import type { ApiOAuthProgress, ApiOAuthTokenInfo } from '@shared/api/protocol'
import { parseApiRequest, type Auth } from '@shared/api/schema'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'
import { Modal, primaryButtonClass } from '@/components/Modal'
import { useDocuments } from '@/store/documents'
import { getSendContext, type SendContext } from '@/store/api'

type OAuth1 = Extract<Auth, { type: 'oauth1' }>
type OAuth2 = Extract<Auth, { type: 'oauth2' }>

const fieldClass = 'w-full rounded border border-border bg-surface px-2 py-1 font-mono text-[12.5px] outline-none focus:border-accent'
const selectClass = 'rounded border border-border bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-accent'
const buttonClass = 'rounded border border-border bg-surface px-2.5 py-1 text-[12.5px] hover:bg-zinc-100 disabled:opacity-50'
const primaryClass = 'rounded bg-accent px-2.5 py-1 text-[12.5px] text-white hover:opacity-90 disabled:opacity-50'

/** Segredos literais ficam mascarados; uma referência a variável ({{x}}) continua visível. */
const secretType = (v: string | undefined): 'text' | 'password' => (!v || /^\s*\{\{[^{}]+\}\}\s*$/.test(v) ? 'text' : 'password')

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="contents">
      <span className="text-[12.5px] text-zinc-600">{label}</span>
      {children}
    </label>
  )
}

const clip = (v: string): string => v.slice(0, API_LIMITS.valueChars)

/* ------------------------------------------------------------------ OAuth 1.0a */

const SIGNATURES: OAuth1['signature'][] = ['HMAC-SHA1', 'HMAC-SHA256', 'RSA-SHA1', 'PLAINTEXT']

/** Editor da autorização OAuth 1.0a (RFC 5849). */
export function OAuth1Editor({ auth, onChange }: { auth: OAuth1; onChange: (auth: OAuth1) => void }) {
  const t = useT()
  const secretField = (label: string, value: string | undefined, key: 'consumerSecret' | 'tokenSecret', placeholder: string) => (
    <Row label={label}>
      <input
        type={secretType(value)}
        autoComplete="off"
        spellCheck={false}
        value={value ?? ''}
        onChange={(e) => onChange({ ...auth, [key]: clip(e.target.value) })}
        placeholder={placeholder}
        className={fieldClass}
      />
    </Row>
  )
  const pickKey = async (): Promise<void> => {
    const [path] = await window.api.apiPickFiles('privateKey').catch(() => [] as string[])
    if (path) onChange({ ...auth, privateKeyPath: path })
  }

  return (
    <div className="grid max-w-3xl grid-cols-[160px_1fr] items-center gap-x-3 gap-y-2 py-1">
      <Row label={t('apiClient.oauth.consumerKey')}>
        <input value={auth.consumerKey} onChange={(e) => onChange({ ...auth, consumerKey: clip(e.target.value) })} spellCheck={false} autoComplete="off" placeholder="{{consumerKey}}" className={fieldClass} />
      </Row>
      {secretField(t('apiClient.oauth.consumerSecret'), auth.consumerSecret, 'consumerSecret', '{{consumerSecret}}')}
      <Row label={t('apiClient.oauth.token')}>
        <input value={auth.token ?? ''} onChange={(e) => onChange({ ...auth, token: clip(e.target.value) || undefined })} spellCheck={false} autoComplete="off" placeholder="{{oauthToken}}" className={fieldClass} />
      </Row>
      {secretField(t('apiClient.oauth.tokenSecret'), auth.tokenSecret, 'tokenSecret', '{{tokenSecret}}')}
      <Row label={t('apiClient.oauth.signature')}>
        <select value={auth.signature} onChange={(e) => onChange({ ...auth, signature: e.target.value as OAuth1['signature'] })} className={`${selectClass} justify-self-start`}>
          {SIGNATURES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Row>
      {auth.signature === 'RSA-SHA1' && (
        <>
          <Row label={t('apiClient.oauth.privateKey')}>
            <span className="flex items-center gap-2">
              <input readOnly value={auth.privateKeyPath ?? ''} aria-label={t('apiClient.oauth.privateKey')} className={fieldClass} />
              <button type="button" onClick={() => void pickKey()} className={`${buttonClass} shrink-0`}>
                {t('apiClient.oauth.choosePrivateKey')}
              </button>
            </span>
          </Row>
          <p className="col-start-2 text-xs leading-5 text-zinc-500">{t('apiClient.oauth.privateKeyHint')}</p>
        </>
      )}
      <Row label={t('apiClient.oauth.realm')}>
        <input value={auth.realm ?? ''} onChange={(e) => onChange({ ...auth, realm: clip(e.target.value) || undefined })} spellCheck={false} className={fieldClass} />
      </Row>
      <Row label={t('apiClient.oauth.placement')}>
        <select value={auth.placement} onChange={(e) => onChange({ ...auth, placement: e.target.value as OAuth1['placement'] })} className={`${selectClass} justify-self-start`}>
          <option value="header">{t('apiClient.auth.header')}</option>
          <option value="query">{t('apiClient.auth.query')}</option>
          <option value="body">{t('apiClient.oauth.placementBody')}</option>
        </select>
      </Row>
      <p className="col-start-2 text-xs leading-5 text-zinc-500">{t('apiClient.auth.secretHint')}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ OAuth 2.0 */

const FLOWS: { id: OAuth2['flow']; label: MessageKey }[] = [
  { id: 'authorizationCode', label: 'apiClient.oauth.flow.authorizationCode' },
  { id: 'clientCredentials', label: 'apiClient.oauth.flow.clientCredentials' },
  { id: 'deviceCode', label: 'apiClient.oauth.flow.deviceCode' },
  { id: 'password', label: 'apiClient.oauth.flow.password' }
]

const formatWhen = (iso: string): string => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/** Editor da autorização OAuth 2.0, com o botão "Obter token" (escopo do cofre = id do ambiente ativo ou "globals"). */
export function OAuth2Editor({ auth, onChange, docId }: { auth: OAuth2; onChange: (auth: OAuth2) => void; docId: string }) {
  const t = useT()
  const doc = useDocuments((s) => s.documents.find((d) => d.id === docId))
  const [ctx, setCtx] = useState<SendContext>({ environment: null, collection: null })
  const [info, setInfo] = useState<ApiOAuthTokenInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmHost, setConfirmHost] = useState<string | null>(null)
  const [device, setDevice] = useState<ApiOAuthProgress | null>(null)
  const runRef = useRef<string | null>(null)
  const [scopesText, setScopesText] = useState(auth.scopes.join(' '))

  const scope = ctx.environment?.id ?? 'globals'
  const tokenVar = auth.tokenVar

  // Ambiente e coleção do documento (mudam quando o usuário troca o ambiente ativo).
  const docRef = doc?.id
  const docContent = doc?.content
  useEffect(() => {
    if (!doc) return
    let alive = true
    void getSendContext(doc).then((c) => alive && setCtx(c), () => undefined)
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docRef, docContent])

  const refreshInfo = useCallback(async () => {
    try {
      setInfo(await window.api.apiOAuthTokenInfo(scope, tokenVar))
    } catch {
      setInfo(null)
    }
  }, [scope, tokenVar])
  useEffect(() => void refreshInfo(), [refreshInfo])

  // Mantém o campo de escopos como o usuário digitou (espaço no fim), sem perder mudanças externas.
  useEffect(() => {
    if (auth.scopes.join(' ') !== scopesText.split(/\s+/).filter(Boolean).join(' ')) setScopesText(auth.scopes.join(' '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.scopes])

  useEffect(() => window.api.onApiOAuthProgress((p) => p.runId === runRef.current && setDevice(p)), [])
  // Ao sair da tela, cancela a obtenção em andamento (fecha o servidor de loopback).
  useEffect(
    () => () => {
      if (runRef.current) void window.api.apiOAuthCancel(runRef.current).catch(() => undefined)
    },
    []
  )

  const obtain = async (confirmSecretHost?: string): Promise<void> => {
    const runId = crypto.randomUUID()
    runRef.current = runId
    setBusy(true)
    setError(null)
    setDevice(null)
    let verifyTls = true
    try {
      const parsed = doc ? parseApiRequest(doc.content) : null
      if (parsed?.ok) verifyTls = parsed.request.settings.verifyTls
    } catch {
      // Documento inválido: mantém a verificação ligada.
    }
    try {
      const result = await window.api.apiOAuthAuthorize({ runId, auth, environment: ctx.environment, collection: ctx.collection, verifyTls, ...(confirmSecretHost ? { confirmSecretHost } : {}) })
      if (!result.ok && result.code === 'secretHostNotConfirmed' && result.host) setConfirmHost(result.host)
      else if (!result.ok) setError(result.code)
    } catch {
      setError('unknown')
    } finally {
      runRef.current = null
      setBusy(false)
      setDevice(null)
      void refreshInfo()
    }
  }
  const cancel = (): void => {
    if (runRef.current) void window.api.apiOAuthCancel(runRef.current).catch(() => undefined)
  }
  const clear = async (): Promise<void> => {
    setError(null)
    await window.api.apiOAuthClear(scope, tokenVar).catch(() => undefined)
    void refreshInfo()
  }

  const text = (label: string, key: 'authUrl' | 'tokenUrl' | 'clientId' | 'audience' | 'username', placeholder?: string) => (
    <Row label={label}>
      <input
        value={auth[key] ?? ''}
        onChange={(e) => {
          const v = e.target.value.slice(0, key.endsWith('Url') ? API_LIMITS.urlChars : API_LIMITS.valueChars)
          onChange({ ...auth, [key]: key === 'authUrl' || key === 'audience' || key === 'username' ? v || undefined : v })
        }}
        spellCheck={false}
        autoComplete="off"
        placeholder={placeholder}
        className={fieldClass}
      />
    </Row>
  )
  const secret = (label: string, key: 'clientSecret' | 'password', placeholder: string) => (
    <Row label={label}>
      <input
        type={secretType(auth[key])}
        autoComplete="off"
        spellCheck={false}
        value={auth[key] ?? ''}
        onChange={(e) => onChange({ ...auth, [key]: clip(e.target.value) || undefined })}
        placeholder={placeholder}
        className={fieldClass}
      />
    </Row>
  )

  const needsAuthUrl = auth.flow === 'authorizationCode' || auth.flow === 'deviceCode'
  const expired = !!info?.expiresAt && Date.parse(info.expiresAt) <= Date.now()

  return (
    <div className="grid max-w-3xl grid-cols-[160px_1fr] items-center gap-x-3 gap-y-2 py-1">
      <Row label={t('apiClient.oauth.flow')}>
        <select value={auth.flow} onChange={(e) => onChange({ ...auth, flow: e.target.value as OAuth2['flow'] })} className={`${selectClass} justify-self-start`}>
          {FLOWS.map((f) => (
            <option key={f.id} value={f.id}>
              {t(f.label)}
            </option>
          ))}
        </select>
      </Row>
      {auth.flow === 'password' && (
        <p className="col-start-2 flex items-start gap-1.5 text-xs leading-5 text-amber-700">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          {t('apiClient.oauth.passwordWarning')}
        </p>
      )}
      {needsAuthUrl && text(t(auth.flow === 'deviceCode' ? 'apiClient.oauth.deviceUrl' : 'apiClient.oauth.authUrl'), 'authUrl', 'https://auth.exemplo.com.br/authorize')}
      {text(t('apiClient.oauth.tokenUrl'), 'tokenUrl', 'https://auth.exemplo.com.br/oauth/token')}
      {text(t('apiClient.oauth.clientId'), 'clientId', '{{clientId}}')}
      {secret(t('apiClient.oauth.clientSecret'), 'clientSecret', '{{clientSecret}}')}
      {auth.flow === 'password' && (
        <>
          {text(t('apiClient.oauth.username'), 'username')}
          {secret(t('apiClient.oauth.password'), 'password', '{{senha}}')}
        </>
      )}
      <Row label={`${t('apiClient.oauth.scopes')} (${t('apiClient.oauth.scopesHint')})`}>
        <input
          value={scopesText}
          onChange={(e) => {
            setScopesText(e.target.value)
            onChange({ ...auth, scopes: e.target.value.split(/\s+/).filter(Boolean).slice(0, 100) })
          }}
          spellCheck={false}
          placeholder="openid profile"
          className={fieldClass}
        />
      </Row>
      {text(t('apiClient.oauth.audience'), 'audience')}
      {auth.flow === 'authorizationCode' && (
        <Row label={t('apiClient.oauth.pkce')}>
          <input type="checkbox" checked={auth.pkce} onChange={(e) => onChange({ ...auth, pkce: e.target.checked })} className="justify-self-start" />
        </Row>
      )}
      <Row label={t('apiClient.oauth.tokenVar')}>
        <input
          value={auth.tokenVar}
          onChange={(e) => onChange({ ...auth, tokenVar: e.target.value.trim().slice(0, 60) || 'token' })}
          spellCheck={false}
          className={`${fieldClass} max-w-60`}
        />
      </Row>
      <p className="col-start-2 text-xs leading-5 text-zinc-500">{t('apiClient.oauth.tokenVarHint')}</p>
      <Row label={t('apiClient.oauth.autoRefresh')}>
        <input type="checkbox" checked={auth.autoRefresh} onChange={(e) => onChange({ ...auth, autoRefresh: e.target.checked })} className="justify-self-start" />
      </Row>
      <p className="col-start-2 text-xs leading-5 text-zinc-500">{t('apiClient.auth.secretHint')}</p>

      <div className="col-span-2 mt-1 flex flex-col gap-2 rounded border border-border p-3" role="group" aria-label={t('apiClient.oauth.getToken')}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void obtain()} className={`${primaryClass} inline-flex items-center gap-1.5`}>
            <KeyRound size={14} />
            {busy ? t('apiClient.oauth.waiting') : t('apiClient.oauth.getToken')}
          </button>
          {busy && (
            <button type="button" onClick={cancel} className={buttonClass}>
              {t('apiClient.oauth.cancel')}
            </button>
          )}
          {info?.exists && !busy && (
            <button type="button" onClick={() => void clear()} className={buttonClass}>
              {t('apiClient.oauth.clear')}
            </button>
          )}
          <span className="text-xs text-zinc-500">{t('apiClient.oauth.scopeLabel', { scope })}</span>
        </div>

        {busy && auth.flow === 'authorizationCode' && <p className="text-xs text-zinc-500">{t('apiClient.oauth.browserHint')}</p>}
        {device?.userCode && (
          <div className="text-[12.5px]" role="status">
            <p>{t('apiClient.oauth.deviceVisit', { url: device.verificationUri ?? '' })}</p>
            <p className="mt-1 select-all font-mono text-lg font-semibold tracking-widest">{device.userCode}</p>
          </div>
        )}
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
                  void obtain(host)
                }}
              >
                {t('apiClient.secretHost.confirm')}
              </button>
            </div>
          </Modal>
        )}
        {error && (
          <p role="alert" className="text-[12.5px] text-red-600">
            {t(`apiClient.oauth.error.${error}` as MessageKey)}
          </p>
        )}
        <p className="text-[12.5px] text-zinc-600" role="status">
          {!info?.exists
            ? t('apiClient.oauth.noToken')
            : [
                t('apiClient.oauth.hasToken'),
                info.expiresAt ? t(expired ? 'apiClient.oauth.expired' : 'apiClient.oauth.expiresAt', { when: formatWhen(info.expiresAt) }) : t('apiClient.oauth.noExpiry'),
                info.hasRefreshToken ? t('apiClient.oauth.withRefresh') : ''
              ]
                .filter(Boolean)
                .join(' ')}
        </p>
      </div>
    </div>
  )
}
