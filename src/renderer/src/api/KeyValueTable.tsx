// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { Trash2 } from 'lucide-react'
import type { KeyValue } from '@shared/api/schema'
import { API_LIMITS } from '@shared/api/limits'
import { useT } from '@/i18n'

const cellInput =
  'w-full min-w-0 bg-transparent px-2 py-1 font-mono text-[12px] outline-none placeholder:text-zinc-400 focus:bg-blue-50'

/**
 * Tabela chave/valor (params, cabeçalhos, campos de formulário). A última linha fica sempre vazia:
 * digitar nela cria uma linha nova.
 */
export function KeyValueTable({
  label,
  rows,
  onChange,
  showDescription = true
}: {
  /** Nome da tabela, para leitores de tela. */
  label: string
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  showDescription?: boolean
}) {
  const t = useT()
  const canAdd = rows.length < API_LIMITS.keyValueRows
  const display: (KeyValue | null)[] = canAdd ? [...rows, null] : rows

  const edit = (index: number, patch: Partial<KeyValue>): void => {
    if (index === rows.length) onChange([...rows, { key: '', value: '', enabled: true, ...patch }])
    else onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  const remove = (index: number): void => onChange(rows.filter((_, i) => i !== index))

  return (
    <table aria-label={label} className="w-full table-fixed border-collapse">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
          <th className="w-8 border-b border-border py-1" />
          <th className="border-b border-l border-border px-2 py-1 font-semibold">{t('apiClient.kv.key')}</th>
          <th className="border-b border-l border-border px-2 py-1 font-semibold">{t('apiClient.kv.value')}</th>
          {showDescription && <th className="border-b border-l border-border px-2 py-1 font-semibold">{t('apiClient.kv.description')}</th>}
          <th className="w-8 border-b border-border" />
        </tr>
      </thead>
      <tbody>
        {display.map((row, i) => {
          const n = i + 1
          const off = row ? !row.enabled : true
          return (
            <tr key={i} className={off ? 'text-zinc-400' : ''}>
              <td className="border-b border-border text-center">
                {row && (
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => edit(i, { enabled: e.target.checked })}
                    aria-label={t('apiClient.kv.enable', { n })}
                    className="size-3.5 accent-accent align-middle"
                  />
                )}
              </td>
              <td className="border-b border-l border-border p-0">
                <input
                  value={row?.key ?? ''}
                  maxLength={API_LIMITS.keyChars}
                  placeholder={row ? '' : t('apiClient.kv.newKey')}
                  aria-label={`${t('apiClient.kv.key')} ${n}`}
                  onChange={(e) => edit(i, { key: e.target.value })}
                  spellCheck={false}
                  className={cellInput}
                />
              </td>
              <td className="border-b border-l border-border p-0">
                <input
                  value={row?.value ?? ''}
                  maxLength={API_LIMITS.valueChars}
                  aria-label={`${t('apiClient.kv.value')} ${n}`}
                  onChange={(e) => edit(i, { value: e.target.value })}
                  spellCheck={false}
                  className={cellInput}
                />
              </td>
              {showDescription && (
                <td className="border-b border-l border-border p-0">
                  <input
                    value={row?.description ?? ''}
                    maxLength={API_LIMITS.descriptionChars}
                    aria-label={`${t('apiClient.kv.description')} ${n}`}
                    onChange={(e) => edit(i, { description: e.target.value || undefined })}
                    className={`${cellInput} font-sans`}
                  />
                </td>
              )}
              <td className="border-b border-border text-center">
                {row && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    title={t('apiClient.kv.remove', { n })}
                    aria-label={t('apiClient.kv.remove', { n })}
                    className="rounded p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
