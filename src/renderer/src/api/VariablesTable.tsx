// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { EnvironmentVariable } from '@shared/api/schema'
import { API_LIMITS } from '@shared/api/limits'
import { VARIABLE_NAME_RE } from '@shared/api/variables'
import { useT } from '@/i18n'

interface Row {
  key: string
  /** Valor digitado. Nas secretas é só um rascunho: vai para o cofre e nunca para o arquivo. */
  value: string
  secret: boolean
  description: string
}

const toRows = (variables: EnvironmentVariable[]): Row[] =>
  variables.map((v) => ({ key: v.key, value: v.secret ? '' : (v.value ?? ''), secret: v.secret, description: v.description ?? '' }))

const toVariables = (rows: Row[]): EnvironmentVariable[] =>
  rows
    .filter((r) => r.key !== '')
    .map((r) => ({
      key: r.key,
      ...(r.secret ? {} : { value: r.value }),
      secret: r.secret,
      ...(r.description ? { description: r.description } : {})
    }))

const cell = 'w-full min-w-0 bg-transparent px-2 py-1 font-mono text-[12px] outline-none placeholder:text-zinc-400 focus:bg-blue-50'

/**
 * Tabela de variáveis de um ambiente ou coleção. As linhas ficam num rascunho local: só viram arquivo
 * quando todos os nomes são válidos e únicos. O valor das secretas vai direto para o cofre do computador
 * (escopo = id do ambiente ou da coleção) e o arquivo guarda só "secret": true.
 */
export function VariablesTable({
  label,
  scopeId,
  variables,
  onChange
}: {
  label: string
  scopeId: string
  variables: EnvironmentVariable[]
  onChange: (variables: EnvironmentVariable[]) => void
}) {
  const t = useT()
  const [rows, setRows] = useState<Row[]>(() => toRows(variables))
  const [has, setHas] = useState<Record<string, boolean>>({})
  const lastSent = useRef(JSON.stringify(variables))

  // Mudança vinda de fora (edição do texto, recarregamento): refaz o rascunho.
  useEffect(() => {
    const json = JSON.stringify(variables)
    if (json === lastSent.current) return
    lastSent.current = json
    setRows(toRows(variables))
  }, [variables])

  const secretKeys = rows.filter((r) => r.secret && r.key !== '').map((r) => r.key)
  const secretKeysJoined = secretKeys.join('\n')
  useEffect(() => {
    let cancelled = false
    void Promise.all(secretKeysJoined === '' ? [] : secretKeysJoined.split('\n').map(async (k) => [k, await window.api.apiSecretHas(scopeId, k).catch(() => false)] as const)).then((pairs) => {
      if (!cancelled) setHas(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [scopeId, secretKeysJoined])

  const problems = (list: Row[]): Map<number, 'invalid' | 'duplicate'> => {
    const out = new Map<number, 'invalid' | 'duplicate'>()
    const seen = new Set<string>()
    list.forEach((r, i) => {
      if (r.key === '') return
      if (!VARIABLE_NAME_RE.test(r.key)) out.set(i, 'invalid')
      else if (seen.has(r.key)) out.set(i, 'duplicate')
      seen.add(r.key)
    })
    return out
  }
  const issues = problems(rows)

  const commit = (next: Row[]): void => {
    setRows(next)
    if (problems(next).size > 0) return
    const vars = toVariables(next)
    lastSent.current = JSON.stringify(vars)
    onChange(vars)
  }
  const edit = (i: number, patch: Partial<Row>): void => commit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const storeSecret = (key: string, value: string): void => {
    if (!VARIABLE_NAME_RE.test(key)) return
    const done = value === '' ? window.api.apiSecretDelete(scopeId, key) : window.api.apiSecretSet(scopeId, key, value)
    void done.then(() => window.api.apiSecretHas(scopeId, key)).then((ok) => setHas((h) => ({ ...h, [key]: ok })), () => undefined)
  }

  const onSecretToggle = (i: number, secret: boolean): void => {
    const row = rows[i]!
    if (secret && row.value !== '') storeSecret(row.key, row.value) // o valor digitado sai do arquivo e vai para o cofre
    if (!secret && row.key !== '') void window.api.apiSecretDelete(scopeId, row.key).catch(() => undefined)
    edit(i, { secret, value: '' })
  }

  const remove = (i: number): void => {
    const row = rows[i]!
    if (row.secret && row.key !== '') void window.api.apiSecretDelete(scopeId, row.key).catch(() => undefined)
    commit(rows.filter((_, j) => j !== i))
  }

  return (
    <div>
      <table aria-label={label} className="w-full table-fixed border-collapse">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
            <th className="w-1/4 border-b border-border py-1 pl-2 font-semibold">{t('apiClient.env.key')}</th>
            <th className="w-1/3 border-b border-border py-1 pl-2 font-semibold">{t('apiClient.env.value')}</th>
            <th className="w-20 border-b border-border py-1 text-center font-semibold">{t('apiClient.env.secret')}</th>
            <th className="border-b border-border py-1 pl-2 font-semibold">{t('apiClient.env.description')}</th>
            <th className="w-8 border-b border-border py-1" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const issue = issues.get(i)
            return (
              <tr key={i} className="group border-b border-border/60" data-testid="env-row">
                <td>
                  <input
                    value={row.key}
                    onChange={(e) => edit(i, { key: e.target.value })}
                    maxLength={100}
                    spellCheck={false}
                    aria-label={t('apiClient.env.keyN', { n: i + 1 })}
                    aria-invalid={!!issue}
                    placeholder={t('apiClient.env.newKey')}
                    className={`${cell} ${issue ? 'text-red-700' : ''}`}
                  />
                  {issue && <p role="alert" className="px-2 text-[11px] text-red-700">{t(issue === 'invalid' ? 'apiClient.env.invalidKey' : 'apiClient.env.duplicateKey')}</p>}
                </td>
                <td>
                  <input
                    value={row.value}
                    type={row.secret ? 'password' : 'text'}
                    onChange={(e) => {
                      edit(i, { value: e.target.value })
                      if (row.secret) storeSecret(row.key, e.target.value)
                    }}
                    onBlur={() => {
                      if (row.secret && row.value !== '') setRows((list) => list.map((r, j) => (j === i ? { ...r, value: '' } : r))) // não guarda o segredo na tela
                    }}
                    maxLength={API_LIMITS.valueChars}
                    spellCheck={false}
                    autoComplete="off"
                    disabled={row.secret && !VARIABLE_NAME_RE.test(row.key)}
                    aria-label={t('apiClient.env.valueN', { n: i + 1 })}
                    placeholder={row.secret ? (has[row.key] ? '••••••' : t('apiClient.env.secretPlaceholder')) : ''}
                    className={cell}
                  />
                  {row.secret && row.key !== '' && (
                    <p className={`px-2 text-[11px] ${has[row.key] ? 'text-emerald-700' : 'text-amber-700'}`} data-testid="secret-status">
                      {t(has[row.key] ? 'apiClient.env.secretSet' : 'apiClient.env.secretNotSet')}
                    </p>
                  )}
                </td>
                <td className="text-center">
                  <input type="checkbox" checked={row.secret} onChange={(e) => onSecretToggle(i, e.target.checked)} aria-label={t('apiClient.env.secretN', { n: i + 1 })} />
                </td>
                <td>
                  <input
                    value={row.description}
                    onChange={(e) => edit(i, { description: e.target.value })}
                    maxLength={API_LIMITS.descriptionChars}
                    aria-label={t('apiClient.env.descriptionN', { n: i + 1 })}
                    className={`${cell} font-sans`}
                  />
                </td>
                <td className="text-center">
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    title={t('apiClient.env.remove', { n: i + 1 })}
                    aria-label={t('apiClient.env.remove', { n: i + 1 })}
                    className="rounded p-1 text-zinc-500 hover:bg-zinc-200"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button
        type="button"
        disabled={rows.length >= API_LIMITS.variables}
        onClick={() => setRows([...rows, { key: '', value: '', secret: false, description: '' }])}
        className="mt-2 flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 text-[12.5px] hover:bg-zinc-100 disabled:opacity-50"
      >
        <Plus size={13} /> {t('apiClient.env.add')}
      </button>
    </div>
  )
}
