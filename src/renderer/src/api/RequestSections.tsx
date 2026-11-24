// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useState } from 'react'
import { FileUp, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { authSchema, type Auth, type Body, type RequestSettings } from '@shared/api/schema'
import { API_LIMITS } from '@shared/api/limits'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'
import type { EditorDocument } from '@/store/documents'
import { BodyMonaco } from './BodyMonaco'
import { GraphqlEditor } from './GraphqlEditor'
import { KeyValueTable } from './KeyValueTable'
import { OAuth1Editor, OAuth2Editor } from './OAuthEditors'

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

const AUTH_TYPES: { type: Auth['type']; label: MessageKey | string }[] = [
  { type: 'inherit', label: 'apiClient.auth.inherit' },
  { type: 'none', label: 'apiClient.auth.none' },
  { type: 'apiKey', label: 'API Key' },
  { type: 'basic', label: 'Basic Auth' },
  { type: 'bearer', label: 'Bearer Token' },
  { type: 'oauth1', label: 'OAuth 1.0' },
  { type: 'oauth2', label: 'OAuth 2.0' }
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
    case 'oauth1':
    case 'oauth2':
      return authSchema.parse({ type })
    default:
      return { type: 'inherit' }
  }
}

export function AuthEditor({ auth, onChange, docId }: { auth: Auth; onChange: (auth: Auth) => void; docId: string }) {
  const t = useT()
  const label = (l: string): string => (l.startsWith('apiClient.') ? t(l as MessageKey) : l)
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
        </select>
      </Row>

      {auth.type === 'inherit' && <p className="col-start-2 text-[12.5px] text-zinc-500">{t('apiClient.auth.inheritHint')}</p>}

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

      {auth.type === 'oauth1' && (
        <div className="col-span-2">
          <OAuth1Editor auth={auth} onChange={onChange} />
        </div>
      )}
      {auth.type === 'oauth2' && (
        <div className="col-span-2">
          <OAuth2Editor auth={auth} onChange={onChange} docId={docId} />
        </div>
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

/** Escolhe um arquivo pelo diálogo nativo (o Main autoriza o caminho escolhido). */
const pickFile = async (purpose: Parameters<typeof window.api.apiPickFiles>[0]): Promise<string | null> => (await window.api.apiPickFiles(purpose, false))[0] ?? null
const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p

function FileRow({ path, onPick, onClear, label }: { path: string; onPick: () => void; onClear?: () => void; label: string }) {
  const t = useT()
  return (
    <span className="flex min-w-0 items-center gap-1">
      <button type="button" onClick={onPick} aria-label={label} className="flex shrink-0 items-center gap-1 rounded border border-border px-2 py-0.5 text-[12.5px] hover:bg-zinc-100">
        <FileUp size={13} /> {t('apiClient.file.choose')}
      </button>
      <span className="min-w-0 truncate font-mono text-[12px] text-zinc-600" title={path}>
        {path ? baseName(path) : t('apiClient.file.none')}
      </span>
      {path && onClear && (
        <button type="button" onClick={onClear} aria-label={t('apiClient.file.clear')} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200">
          <X size={12} />
        </button>
      )}
    </span>
  )
}

type Part = Extract<Body, { type: 'multipart' }>['parts'][number]

function MultipartEditor({ parts, onChange }: { parts: Part[]; onChange: (parts: Part[]) => void }) {
  const t = useT()
  const set = (i: number, part: Part): void => onChange(parts.map((p, j) => (j === i ? part : p)))
  const cell = 'w-full min-w-0 bg-transparent px-2 py-1 font-mono text-[12px] outline-none focus:bg-blue-50'
  return (
    <div>
      {parts.length > 0 && (
        <table aria-label={t('apiClient.body.multipart')} className="w-full table-fixed border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="w-8 border-b border-border py-1" />
              <th className="border-b border-l border-border px-2 py-1 font-semibold">{t('apiClient.kv.key')}</th>
              <th className="w-24 border-b border-l border-border px-2 py-1 font-semibold">{t('apiClient.multipart.kind')}</th>
              <th className="border-b border-l border-border px-2 py-1 font-semibold">{t('apiClient.kv.value')}</th>
              <th className="w-8 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {parts.map((p, i) => {
              const n = i + 1
              return (
                <tr key={i} className={p.enabled ? '' : 'text-zinc-400'}>
                  <td className="border-b border-border text-center">
                    <input type="checkbox" checked={p.enabled} onChange={(e) => set(i, { ...p, enabled: e.target.checked })} aria-label={t('apiClient.kv.enable', { n })} className="size-3.5 accent-accent align-middle" />
                  </td>
                  <td className="border-b border-l border-border p-0">
                    <input value={p.key} maxLength={API_LIMITS.keyChars} aria-label={`${t('apiClient.kv.key')} ${n}`} spellCheck={false} onChange={(e) => set(i, { ...p, key: e.target.value })} className={cell} />
                  </td>
                  <td className="border-b border-l border-border p-0">
                    <select
                      value={p.kind}
                      aria-label={`${t('apiClient.multipart.kind')} ${n}`}
                      onChange={(e) => set(i, e.target.value === 'file' ? { kind: 'file', key: p.key, path: '', enabled: p.enabled } : { kind: 'text', key: p.key, value: '', enabled: p.enabled })}
                      className="w-full bg-transparent px-1 py-1 text-[12px] outline-none"
                    >
                      <option value="text">{t('apiClient.multipart.text')}</option>
                      <option value="file">{t('apiClient.multipart.file')}</option>
                    </select>
                  </td>
                  <td className="border-b border-l border-border px-1 py-0.5">
                    {p.kind === 'text' ? (
                      <input value={p.value} maxLength={API_LIMITS.valueChars} aria-label={`${t('apiClient.kv.value')} ${n}`} spellCheck={false} onChange={(e) => set(i, { ...p, value: e.target.value })} className={cell} />
                    ) : (
                      <FileRow path={p.path} label={`${t('apiClient.file.choose')} ${n}`} onPick={() => void pickFile('body').then((path) => path && set(i, { ...p, path }))} />
                    )}
                  </td>
                  <td className="border-b border-border text-center">
                    <button type="button" onClick={() => onChange(parts.filter((_, j) => j !== i))} title={t('apiClient.kv.remove', { n })} aria-label={t('apiClient.kv.remove', { n })} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <button
        type="button"
        disabled={parts.length >= API_LIMITS.keyValueRows}
        onClick={() => onChange([...parts, { kind: 'text', key: '', value: '', enabled: true }])}
        className="mt-2 flex items-center gap-1 rounded border border-border px-2 py-1 text-[12.5px] hover:bg-zinc-100 disabled:opacity-50"
      >
        <Plus size={13} /> {t('apiClient.multipart.add')}
      </button>
    </div>
  )
}

export function BodyEditor({ body, onChange, doc }: { body: Body; onChange: (body: Body) => void; doc: EditorDocument }) {
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
      {body.type === 'raw' && <BodyMonaco language={body.language} value={body.text} onChange={(text) => onChange({ ...body, text })} label={t('apiClient.body.content')} />}
      {body.type === 'urlencoded' && (
        <KeyValueTable label={t('apiClient.body.fields')} rows={body.fields} onChange={(fields) => onChange({ ...body, fields })} showDescription={false} />
      )}
      {body.type === 'multipart' && <MultipartEditor parts={body.parts} onChange={(parts) => onChange({ ...body, parts })} />}
      {body.type === 'binary' && (
        <FileRow path={body.path} label={t('apiClient.file.choose')} onPick={() => void pickFile('body').then((path) => path && onChange({ ...body, path }))} onClear={() => onChange({ ...body, path: '' })} />
      )}
      {body.type === 'graphql' && <GraphqlEditor body={body} onChange={onChange} doc={doc} />}
      {body.type === 'soap' && <p className="text-zinc-500">{t('apiClient.soon')}</p>}
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
  const cert = { certPath: '', keyPath: '', pfxPath: '', passphraseVar: '', ...settings.clientCert }
  const setCert = (patch: Partial<typeof cert>): void => {
    const next = { ...cert, ...patch }
    // Tudo vazio: o campo some do arquivo.
    set({ clientCert: next.certPath || next.keyPath || next.pfxPath || next.passphraseVar ? next : undefined })
  }
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
      <Row label={t('apiClient.settings.proxy')}>
        <select value={settings.proxy} onChange={(e) => set({ proxy: e.target.value as RequestSettings['proxy'] })} className={`${selectClass} justify-self-start`}>
          <option value="system">{t('apiClient.settings.proxy.system')}</option>
          <option value="none">{t('apiClient.settings.proxy.none')}</option>
          <option value="manual">{t('apiClient.settings.proxy.manual')}</option>
        </select>
      </Row>
      {settings.proxy === 'manual' && (
        <Row label={t('apiClient.settings.proxyUrl')}>
          <input value={settings.proxyUrl} maxLength={API_LIMITS.urlChars} spellCheck={false} placeholder="http://127.0.0.1:8080" onChange={(e) => set({ proxyUrl: e.target.value })} className={fieldClass} />
        </Row>
      )}
      <label className="col-span-2 flex items-center gap-2 text-[12.5px]">
        <input type="checkbox" checked={settings.http2} onChange={(e) => set({ http2: e.target.checked })} className="size-3.5 accent-accent" />
        {t('apiClient.settings.http2')}
      </label>
      <Row label={t('apiClient.settings.ca')}>
        <FileRow path={settings.caPath} label={t('apiClient.settings.ca')} onPick={() => void pickFile('ca').then((caPath) => caPath && set({ caPath }))} onClear={() => set({ caPath: '' })} />
      </Row>
      <p className="col-span-2 mt-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.settings.clientCert')}</p>
      {(
        [
          ['certPath', 'certificate', 'apiClient.settings.cert'],
          ['keyPath', 'privateKey', 'apiClient.settings.certKey'],
          ['pfxPath', 'pfx', 'apiClient.settings.pfx']
        ] as const
      ).map(([field, purpose, text]) => (
        <Row key={field} label={t(text)}>
          <FileRow path={cert[field]} label={t(text)} onPick={() => void pickFile(purpose).then((p) => p && setCert({ [field]: p }))} onClear={() => setCert({ [field]: '' })} />
        </Row>
      ))}
      <Row label={t('apiClient.settings.passphraseVar')}>
        <input value={cert.passphraseVar} maxLength={100} spellCheck={false} placeholder="certPassword" onChange={(e) => setCert({ passphraseVar: e.target.value })} className={fieldClass} />
      </Row>
      <p className="col-span-2 text-xs leading-5 text-zinc-500">{t('apiClient.settings.passphraseHint')}</p>
    </div>
  )
}
