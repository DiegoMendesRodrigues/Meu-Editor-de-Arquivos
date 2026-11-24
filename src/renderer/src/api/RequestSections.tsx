// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import type { Auth, Body, RequestSettings } from '@shared/api/schema'
import { API_LIMITS } from '@shared/api/limits'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'
import { KeyValueTable } from './KeyValueTable'

const fieldClass = 'w-full rounded border border-border bg-surface px-2 py-1 font-mono text-[12.5px] outline-none focus:border-accent'
const selectClass = 'rounded border border-border bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-accent'
const labelClass = 'text-[12.5px] text-zinc-600'

/** Senhas e tokens literais ficam mascarados; uma referência a variável ({{token}}) continua visível. */
const secretType = (v: string): 'text' | 'password' => (v === '' || /^\s*\{\{[^{}]+\}\}\s*$/.test(v) ? 'text' : 'password')

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="contents">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

/* ------------------------------------------------------------------ autorização */

/** Tipos editáveis nesta fase; OAuth 1.0 e 2.0 chegam na fase 3 (o arquivo já os aceita). */
const AUTH_TYPES: { type: Auth['type']; label: MessageKey | string }[] = [
  { type: 'inherit', label: 'apiClient.auth.inherit' },
  { type: 'none', label: 'apiClient.auth.none' },
  { type: 'apiKey', label: 'API Key' },
  { type: 'basic', label: 'Basic Auth' },
  { type: 'bearer', label: 'Bearer Token' }
]

const defaultAuth = (type: Auth['type']): Auth => {
  switch (type) {
    case 'apiKey':
      return { type, key: 'X-Api-Key', value: '', in: 'header' }
    case 'basic':
      return { type, username: '', password: '' }
    case 'bearer':
      return { type, token: '{{token}}', prefix: 'Bearer' }
    case 'none':
      return { type }
    default:
      return { type: 'inherit' }
  }
}

export function AuthEditor({ auth, onChange }: { auth: Auth; onChange: (auth: Auth) => void }) {
  const t = useT()
  const label = (l: string): string => (l.startsWith('apiClient.') ? t(l as MessageKey) : l)
  const known = AUTH_TYPES.some((a) => a.type === auth.type)
  const value = (v: string): string => v.slice(0, API_LIMITS.valueChars)

  return (
    <div className="grid max-w-3xl grid-cols-[160px_1fr] items-center gap-x-3 gap-y-2 py-1">
      <Row label={t('apiClient.auth.type')}>
        <select value={auth.type} onChange={(e) => onChange(defaultAuth(e.target.value as Auth['type']))} className={`${selectClass} justify-self-start`}>
          {AUTH_TYPES.map((a) => (
            <option key={a.type} value={a.type}>
              {label(a.label)}
            </option>
          ))}
          {!known && <option value={auth.type}>{auth.type === 'oauth1' ? 'OAuth 1.0' : 'OAuth 2.0'}</option>}
        </select>
      </Row>

      {auth.type === 'inherit' && <p className="col-start-2 text-[12.5px] text-zinc-500">{t('apiClient.auth.inheritHint')}</p>}
      {!known && <p className="col-start-2 text-[12.5px] text-zinc-500">{t('apiClient.soon')}</p>}

      {auth.type === 'apiKey' && (
        <>
          <Row label={t('apiClient.auth.keyName')}>
            <input value={auth.key} onChange={(e) => onChange({ ...auth, key: e.target.value.slice(0, API_LIMITS.keyChars) })} spellCheck={false} className={fieldClass} />
          </Row>
          <Row label={t('apiClient.auth.value')}>
            <input type={secretType(auth.value)} autoComplete="off" value={auth.value} onChange={(e) => onChange({ ...auth, value: value(e.target.value) })} spellCheck={false} placeholder="{{apiKey}}" className={fieldClass} />
          </Row>
          <Row label={t('apiClient.auth.addTo')}>
            <select value={auth.in} onChange={(e) => onChange({ ...auth, in: e.target.value as 'header' | 'query' })} className={`${selectClass} justify-self-start`}>
              <option value="header">{t('apiClient.auth.header')}</option>
              <option value="query">{t('apiClient.auth.query')}</option>
            </select>
          </Row>
        </>
      )}

      {auth.type === 'basic' && (
        <>
          <Row label={t('apiClient.auth.username')}>
            <input value={auth.username} onChange={(e) => onChange({ ...auth, username: value(e.target.value) })} spellCheck={false} className={fieldClass} />
          </Row>
          <Row label={t('apiClient.auth.password')}>
            <input type={secretType(auth.password)} autoComplete="off" value={auth.password} onChange={(e) => onChange({ ...auth, password: value(e.target.value) })} spellCheck={false} placeholder="{{senha}}" className={fieldClass} />
          </Row>
        </>
      )}

      {auth.type === 'bearer' && (
        <>
          <Row label={t('apiClient.auth.token')}>
            <input type={secretType(auth.token)} autoComplete="off" value={auth.token} onChange={(e) => onChange({ ...auth, token: value(e.target.value) })} spellCheck={false} placeholder="{{token}}" className={fieldClass} />
          </Row>
          <Row label={t('apiClient.auth.prefix')}>
            <input value={auth.prefix} onChange={(e) => onChange({ ...auth, prefix: e.target.value.slice(0, 50) })} spellCheck={false} className={`${fieldClass} max-w-40`} />
          </Row>
        </>
      )}

      {(auth.type === 'apiKey' || auth.type === 'basic' || auth.type === 'bearer') && (
        <p className="col-start-2 text-xs leading-5 text-zinc-500">{t('apiClient.auth.secretHint')}</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ corpo */

/** Opções do seletor de corpo: os corpos de texto ficam juntos (JSON, XML, texto, HTML). */
type BodyChoice = 'none' | 'json' | 'xml' | 'text' | 'html' | 'urlencoded' | 'multipart' | 'binary' | 'graphql' | 'soap'
const BODY_CHOICES: { id: BodyChoice; label: MessageKey | string }[] = [
  { id: 'none', label: 'apiClient.body.none' },
  { id: 'json', label: 'JSON' },
  { id: 'xml', label: 'XML' },
  { id: 'text', label: 'apiClient.body.text' },
  { id: 'html', label: 'HTML' },
  { id: 'urlencoded', label: 'apiClient.body.urlencoded' },
  { id: 'multipart', label: 'apiClient.body.multipart' },
  { id: 'binary', label: 'apiClient.body.binary' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'soap', label: 'SOAP' }
]

const choiceOf = (body: Body): BodyChoice => (body.type === 'raw' ? body.language : body.type)

function bodyFor(choice: BodyChoice, current: Body): Body {
  const text = current.type === 'raw' ? current.text : ''
  switch (choice) {
    case 'json':
    case 'xml':
    case 'text':
    case 'html':
      return { type: 'raw', language: choice, text }
    case 'urlencoded':
      return { type: 'urlencoded', fields: current.type === 'urlencoded' ? current.fields : [] }
    case 'multipart':
      return { type: 'multipart', parts: [] }
    case 'binary':
      return { type: 'binary', path: '' }
    case 'graphql':
      return { type: 'graphql', query: '', variables: '' }
    case 'soap':
      return { type: 'soap', version: '1.1', action: '', envelope: '' }
    default:
      return { type: 'none' }
  }
}

export function BodyEditor({ body, onChange }: { body: Body; onChange: (body: Body) => void }) {
  const t = useT()
  const label = (l: string): string => (l.startsWith('apiClient.') ? t(l as MessageKey) : l)
  return (
    <div className="flex h-full flex-col gap-2 py-1">
      <label className="flex items-center gap-2">
        <span className={labelClass}>{t('apiClient.body.type')}</span>
        <select value={choiceOf(body)} onChange={(e) => onChange(bodyFor(e.target.value as BodyChoice, body))} className={selectClass}>
          {BODY_CHOICES.map((c) => (
            <option key={c.id} value={c.id}>
              {label(c.label)}
            </option>
          ))}
        </select>
      </label>
      {body.type === 'none' && <p className="text-zinc-500">{t('apiClient.body.noBody')}</p>}
      {body.type === 'raw' && (
        // Fase 0: caixa de texto simples; na fase 1, o Monaco com realce e formatação.
        <textarea
          value={body.text}
          onChange={(e) => onChange({ ...body, text: e.target.value })}
          aria-label={t('apiClient.body.content')}
          spellCheck={false}
          className="min-h-32 flex-1 resize-none rounded border border-border bg-surface p-2 font-mono text-[12.5px] outline-none focus:border-accent"
        />
      )}
      {body.type === 'urlencoded' && (
        <KeyValueTable label={t('apiClient.body.fields')} rows={body.fields} onChange={(fields) => onChange({ ...body, fields })} showDescription={false} />
      )}
      {(body.type === 'multipart' || body.type === 'binary' || body.type === 'graphql' || body.type === 'soap') && (
        <p className="text-zinc-500">{t('apiClient.soon')}</p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ configurações */

/**
 * Campo numérico que aceita ficar vazio enquanto se digita: o valor só é conferido e limitado ao sair
 * do campo ou com Enter (num campo controlado, apagar "30" para digitar "5" virava "15").
 */
function NumberField({
  value,
  min,
  max,
  disabled,
  onCommit
}: {
  value: number
  min: number
  max: number
  disabled?: boolean
  onCommit: (n: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = (): void => {
    const n = Number(draft)
    if (draft.trim() === '' || !Number.isFinite(n)) setDraft(String(value))
    else {
      const clamped = Math.min(max, Math.max(min, n))
      setDraft(String(clamped))
      if (clamped !== value) onCommit(clamped)
    }
  }
  return (
    <input
      type="number"
      min={min}
      max={max}
      disabled={disabled}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className={`${fieldClass} w-28 disabled:opacity-50`}
    />
  )
}

export function SettingsEditor({ settings, onChange }: { settings: RequestSettings; onChange: (settings: RequestSettings) => void }) {
  const t = useT()
  const set = (patch: Partial<RequestSettings>): void => onChange({ ...settings, ...patch })
  const check = (key: 'followRedirects' | 'verifyTls' | 'encodeUrl' | 'sendCookies', text: MessageKey) => (
    <label className="col-span-2 flex items-center gap-2 text-[12.5px]">
      <input type="checkbox" checked={settings[key]} onChange={(e) => set({ [key]: e.target.checked })} className="size-3.5 accent-accent" />
      {t(text)}
    </label>
  )
  return (
    <div className="grid max-w-xl grid-cols-[220px_1fr] items-center gap-x-3 gap-y-2 py-1">
      <Row label={t('apiClient.settings.timeout')}>
        <NumberField
          value={settings.timeoutMs / 1000}
          min={API_LIMITS.timeoutMinMs / 1000}
          max={API_LIMITS.timeoutMaxMs / 1000}
          onCommit={(s) => set({ timeoutMs: Math.round(s * 1000) })}
        />
      </Row>
      {check('followRedirects', 'apiClient.settings.followRedirects')}
      <Row label={t('apiClient.settings.maxRedirects')}>
        <NumberField
          value={settings.maxRedirects}
          min={0}
          max={API_LIMITS.maxRedirects}
          disabled={!settings.followRedirects}
          onCommit={(n) => set({ maxRedirects: Math.round(n) })}
        />
      </Row>
      {check('verifyTls', 'apiClient.settings.verifyTls')}
      {!settings.verifyTls && (
        <p role="alert" className="col-span-2 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs leading-5 text-amber-700">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          {t('apiClient.settings.verifyTlsOff')}
        </p>
      )}
      <Row label={t('apiClient.settings.minTls')}>
        <select value={settings.minTlsVersion} onChange={(e) => set({ minTlsVersion: e.target.value as RequestSettings['minTlsVersion'] })} className={`${selectClass} justify-self-start`}>
          <option value="TLSv1.2">TLS 1.2</option>
          <option value="TLSv1.3">TLS 1.3</option>
        </select>
      </Row>
      {check('encodeUrl', 'apiClient.settings.encodeUrl')}
      {check('sendCookies', 'apiClient.settings.sendCookies')}
    </div>
  )
}
