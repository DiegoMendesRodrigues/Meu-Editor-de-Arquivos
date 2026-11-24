// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ASSERTION_OPS, ASSERTION_TARGETS, type Assertion, type Extraction } from '@shared/api/schema'
import { API_LIMITS } from '@shared/api/limits'
import { VARIABLE_NAME_RE } from '@shared/api/variables'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'

type Translate = ReturnType<typeof useT>
type Expected = Assertion['expected']

const cell = 'w-full min-w-0 bg-transparent px-2 py-1 font-mono text-[12px] outline-none placeholder:text-zinc-400 focus:bg-blue-50 disabled:opacity-40'
const selectCell = 'w-full min-w-0 bg-transparent px-1 py-1 text-[12px] outline-none focus:bg-blue-50'
const th = 'border-b border-l border-border px-2 py-1 font-semibold first:border-l-0'
const addButton = 'mt-2 flex items-center gap-1 rounded border border-border px-2 py-1 text-[12.5px] hover:bg-zinc-100 disabled:opacity-50'
const removeButton = 'rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700'

const NO_EXPECTED = new Set<Assertion['op']>(['exists', 'notExists'])
const LIST_OPS = new Set<Assertion['op']>(['in'])
const NUMBER_RE = /^-?\d+(\.\d+)?$/

/** O alvo usa o nome (cabeçalho, cookie) ou o caminho (JSONPath, XPath, schema)? */
export const usesName = (target: Assertion['target']): boolean => target === 'header' || target === 'cookie'
export const usesPath = (target: Assertion['target']): boolean => target === 'jsonPath' || target === 'xPath' || target === 'jsonSchema'

/** Texto digitado para valor esperado: números viram número; "in" aceita lista separada por vírgula. */
export function parseExpected(text: string, op: Assertion['op']): Expected {
  if (LIST_OPS.has(op)) {
    return text
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p !== '')
      .map((p) => (NUMBER_RE.test(p) ? Number(p) : p))
  }
  if (text === '') return undefined
  return NUMBER_RE.test(text.trim()) ? Number(text) : text
}

export function expectedText(expected: Expected): string {
  if (expected === undefined || expected === null) return ''
  return Array.isArray(expected) ? expected.join(', ') : String(expected)
}

const same = (a: Expected, b: Expected): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Descrição de uma asserção para a lista de resultados ("Corpo $.id é igual a 7"). */
export function assertionSummary(a: Assertion, t: Translate): string {
  const target = t(`apiClient.assert.target.${a.target}` as MessageKey)
  const ref = usesName(a.target) ? a.name : usesPath(a.target) ? a.path : ''
  const op = t(`apiClient.assert.op.${a.op}` as MessageKey)
  const exp = NO_EXPECTED.has(a.op) ? '' : expectedText(a.expected)
  return [target, ref, op, exp].filter((p) => p).join(' ')
}

/** Campo do valor esperado com rascunho próprio: digitar "1.0" não vira "1" no meio do caminho. */
function ExpectedInput({ value, op, disabled, label, onChange }: { value: Expected; op: Assertion['op']; disabled: boolean; label: string; onChange: (e: Expected) => void }) {
  const [draft, setDraft] = useState(expectedText(value))
  useEffect(() => {
    if (!same(parseExpected(draft, op), value)) setDraft(expectedText(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, op])
  return (
    <input
      value={draft}
      disabled={disabled}
      maxLength={API_LIMITS.valueChars}
      aria-label={label}
      spellCheck={false}
      onChange={(e) => {
        setDraft(e.target.value)
        onChange(parseExpected(e.target.value, op))
      }}
      className={cell}
    />
  )
}

export function TestsEditor({
  tests,
  extract,
  onChange
}: {
  tests: Assertion[]
  extract: Extraction[]
  onChange: (patch: { tests?: Assertion[]; extract?: Extraction[] }) => void
}) {
  const t = useT()
  const setTest = (i: number, patch: Partial<Assertion>): void => onChange({ tests: tests.map((a, j) => (j === i ? { ...a, ...patch } : a)) })
  const setExtract = (i: number, patch: Partial<Extraction>): void => onChange({ extract: extract.map((a, j) => (j === i ? { ...a, ...patch } : a)) })

  return (
    <div className="flex flex-col gap-5 py-1">
      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.tests.assertions')}</h3>
        {tests.length === 0 && <p className="mb-2 text-zinc-500">{t('apiClient.tests.empty')}</p>}
        {tests.length > 0 && (
          <table aria-label={t('apiClient.tests.assertions')} data-testid="api-assertions" className="w-full table-fixed border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="w-8 border-b border-border py-1" />
                <th className={`${th} w-36`}>{t('apiClient.tests.target')}</th>
                <th className={th}>{t('apiClient.tests.pathOrName')}</th>
                <th className={`${th} w-44`}>{t('apiClient.tests.operator')}</th>
                <th className={th}>{t('apiClient.tests.expected')}</th>
                <th className="w-8 border-b border-border" />
              </tr>
            </thead>
            <tbody>
              {tests.map((a, i) => {
                const n = i + 1
                return (
                  <tr key={i} className={a.enabled ? '' : 'text-zinc-400'}>
                    <td className="border-b border-border text-center">
                      <input type="checkbox" checked={a.enabled} onChange={(e) => setTest(i, { enabled: e.target.checked })} aria-label={t('apiClient.kv.enable', { n })} className="size-3.5 accent-accent align-middle" />
                    </td>
                    <td className="border-b border-l border-border p-0">
                      <select value={a.target} aria-label={`${t('apiClient.tests.target')} ${n}`} onChange={(e) => setTest(i, { target: e.target.value as Assertion['target'] })} className={selectCell}>
                        {ASSERTION_TARGETS.map((x) => (
                          <option key={x} value={x}>
                            {t(`apiClient.assert.target.${x}` as MessageKey)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-l border-border p-0">
                      <input
                        value={usesName(a.target) ? (a.name ?? '') : usesPath(a.target) ? (a.path ?? '') : ''}
                        disabled={!usesName(a.target) && !usesPath(a.target)}
                        maxLength={API_LIMITS.valueChars}
                        placeholder={a.target === 'jsonPath' ? '$.itens[0].id' : a.target === 'xPath' ? '//item/id' : ''}
                        aria-label={`${t('apiClient.tests.pathOrName')} ${n}`}
                        spellCheck={false}
                        onChange={(e) => setTest(i, usesName(a.target) ? { name: e.target.value } : { path: e.target.value })}
                        className={cell}
                      />
                    </td>
                    <td className="border-b border-l border-border p-0">
                      <select value={a.op} aria-label={`${t('apiClient.tests.operator')} ${n}`} onChange={(e) => setTest(i, { op: e.target.value as Assertion['op'] })} className={selectCell}>
                        {ASSERTION_OPS.map((x) => (
                          <option key={x} value={x}>
                            {t(`apiClient.assert.op.${x}` as MessageKey)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-l border-border p-0">
                      <ExpectedInput value={a.expected} op={a.op} disabled={NO_EXPECTED.has(a.op)} label={`${t('apiClient.tests.expected')} ${n}`} onChange={(expected) => setTest(i, { expected })} />
                    </td>
                    <td className="border-b border-border text-center">
                      <button type="button" onClick={() => onChange({ tests: tests.filter((_, j) => j !== i) })} title={t('apiClient.kv.remove', { n })} aria-label={t('apiClient.kv.remove', { n })} className={removeButton}>
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
          disabled={tests.length >= API_LIMITS.assertions}
          onClick={() => onChange({ tests: [...tests, { target: 'status', op: 'eq', expected: 200, enabled: true }] })}
          className={addButton}
        >
          <Plus size={13} /> {t('apiClient.tests.add')}
        </button>
      </section>

      <section>
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.tests.extractions')}</h3>
        <p className="mb-2 text-xs text-zinc-500">{t('apiClient.tests.extractHint')}</p>
        {extract.length > 0 && (
          <table aria-label={t('apiClient.tests.extractions')} data-testid="api-extractions" className="w-full table-fixed border-collapse">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="w-8 border-b border-border py-1" />
                <th className={`${th} w-32`}>{t('apiClient.tests.from')}</th>
                <th className={th}>{t('apiClient.tests.extractPath')}</th>
                <th className={th}>{t('apiClient.tests.to')}</th>
                <th className={`${th} w-20 text-center`}>{t('apiClient.tests.secret')}</th>
                <th className="w-8 border-b border-border" />
              </tr>
            </thead>
            <tbody>
              {extract.map((x, i) => {
                const n = i + 1
                const badName = x.to !== '' && !VARIABLE_NAME_RE.test(x.to)
                return (
                  <tr key={i} className={x.enabled ? '' : 'text-zinc-400'}>
                    <td className="border-b border-border text-center">
                      <input type="checkbox" checked={x.enabled} onChange={(e) => setExtract(i, { enabled: e.target.checked })} aria-label={t('apiClient.kv.enable', { n })} className="size-3.5 accent-accent align-middle" />
                    </td>
                    <td className="border-b border-l border-border p-0">
                      <select value={x.from} aria-label={`${t('apiClient.tests.from')} ${n}`} onChange={(e) => setExtract(i, { from: e.target.value as Extraction['from'] })} className={selectCell}>
                        {(['jsonPath', 'xPath', 'header', 'cookie', 'regex'] as const).map((f) => (
                          <option key={f} value={f}>
                            {t(`apiClient.extract.from.${f}` as MessageKey)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-l border-border p-0">
                      <input value={x.path} maxLength={API_LIMITS.valueChars} aria-label={`${t('apiClient.tests.extractPath')} ${n}`} placeholder={x.from === 'jsonPath' ? '$.token' : ''} spellCheck={false} onChange={(e) => setExtract(i, { path: e.target.value })} className={cell} />
                    </td>
                    <td className="border-b border-l border-border p-0">
                      <input value={x.to} maxLength={100} aria-label={`${t('apiClient.tests.to')} ${n}`} aria-invalid={badName} placeholder="token" spellCheck={false} onChange={(e) => setExtract(i, { to: e.target.value })} className={`${cell} ${badName ? 'text-red-600' : ''}`} />
                    </td>
                    <td className="border-b border-l border-border text-center">
                      <input type="checkbox" checked={x.secret} onChange={(e) => setExtract(i, { secret: e.target.checked })} aria-label={`${t('apiClient.tests.secret')} ${n}`} className="size-3.5 accent-accent align-middle" />
                    </td>
                    <td className="border-b border-border text-center">
                      <button type="button" onClick={() => onChange({ extract: extract.filter((_, j) => j !== i) })} title={t('apiClient.kv.remove', { n })} aria-label={t('apiClient.kv.remove', { n })} className={removeButton}>
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
          disabled={extract.length >= API_LIMITS.assertions}
          onClick={() => onChange({ extract: [...extract, { from: 'jsonPath', path: '', to: '', secret: false, enabled: true }] })}
          className={addButton}
        >
          <Plus size={13} /> {t('apiClient.tests.addExtraction')}
        </button>
      </section>
    </div>
  )
}
