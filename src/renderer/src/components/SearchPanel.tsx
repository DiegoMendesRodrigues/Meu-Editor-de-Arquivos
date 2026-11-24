// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useRef } from 'react'
import { CaseSensitive, Regex, Search, WholeWord } from 'lucide-react'
import { openMatch } from '@/commands'
import { useT } from '@/i18n'
import { useSearch } from '@/store/search'
import { useWorkspace } from '@/store/workspace'

function Toggle({ icon: Icon, label, on, onClick }: { icon: typeof Search; label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={onClick}
      className={`rounded p-1 ${on ? 'bg-accent text-white' : 'text-zinc-600 hover:bg-zinc-200'}`}
    >
      <Icon size={15} />
    </button>
  )
}

const inputClass = 'min-w-0 rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent'

/** Texto do trecho com a ocorrência destacada. */
function Preview({ text, start, length }: { text: string; start: number; length: number }) {
  return (
    <span className="truncate whitespace-pre font-mono text-xs text-zinc-700">
      {text.slice(0, start).trimStart()}
      <mark className="bg-yellow-200 text-zinc-900">{text.slice(start, start + length)}</mark>
      {text.slice(start + length)}
    </span>
  )
}

export function SearchPanel() {
  const t = useT()
  const s = useSearch()
  const folder = useWorkspace((w) => w.folder)
  const queryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    queryRef.current?.focus()
    queryRef.current?.select()
  }, [s.focusTick])

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    void s.run()
  }
  const res = s.response
  const selectedFiles = res ? res.files.filter((f) => !s.excluded[f.path]) : []

  return (
    <div className="flex min-h-0 flex-1 flex-col text-xs">
      <form onSubmit={submit} className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-2">
        <input
          ref={queryRef}
          value={s.query}
          onChange={(e) => s.setField('query', e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.queryLabel')}
          className={`${inputClass} w-64`}
        />
        <Toggle icon={CaseSensitive} label={t('search.caseSensitive')} on={s.caseSensitive} onClick={() => s.toggleFlag('caseSensitive')} />
        <Toggle icon={WholeWord} label={t('search.wholeWord')} on={s.wholeWord} onClick={() => s.toggleFlag('wholeWord')} />
        <Toggle icon={Regex} label={t('search.regex')} on={s.regex} onClick={() => s.toggleFlag('regex')} />
        <input
          value={s.include}
          onChange={(e) => s.setField('include', e.target.value)}
          placeholder={t('search.includePlaceholder')}
          aria-label={t('search.includeLabel')}
          className={`${inputClass} w-44`}
        />
        <button type="submit" disabled={s.status === 'searching'} className="rounded bg-accent px-3 py-1 text-white disabled:opacity-60">
          {s.status === 'searching' ? t('search.searching') : t('search.run')}
        </button>
        <input
          value={s.replacement}
          onChange={(e) => s.setField('replacement', e.target.value)}
          placeholder={t('search.replacePlaceholder')}
          aria-label={t('search.replaceLabel')}
          className={`${inputClass} w-64`}
        />
        <button
          type="button"
          onClick={() => void s.replaceAll()}
          disabled={selectedFiles.length === 0 || s.status === 'searching'}
          className="rounded border border-border px-3 py-1 hover:bg-zinc-100 disabled:opacity-50"
        >
          {t('search.replaceAll')}
        </button>
      </form>

      <div className="shrink-0 px-3 py-1 text-zinc-600" role="status">
        {s.error && <span className="text-red-700">{s.error}</span>}
        {!s.error && !folder && t('search.openFolderHint')}
        {!s.error && folder && s.status === 'idle' && t('search.folderLabel', { name: folder.name })}
        {!s.error && res && (
          <span>
            {t('search.matches', { n: res.totalMatches })} {t('search.inFiles', { n: res.files.length })} ({t('search.scanned', { n: res.filesScanned })}
            {res.filesSkipped > 0 ? `, ${t('search.skipped', { n: res.filesSkipped })}` : ''})
            {res.truncated && <strong className="text-amber-700">{t('search.partial')}</strong>}
          </span>
        )}
        {s.notice && <div className="font-medium text-emerald-800">{s.notice}</div>}
      </div>

      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {res?.files.map((f) => (
          <div key={f.path}>
            <label className="flex cursor-pointer items-center gap-2 bg-zinc-50 px-3 py-0.5 font-semibold text-zinc-700">
              <input type="checkbox" checked={!s.excluded[f.path]} onChange={() => s.toggleFile(f.path)} aria-label={t('search.includeFile', { path: f.relPath })} />
              <span className="truncate">{f.relPath}</span>
              <span className="font-normal text-zinc-500">({f.matches.length})</span>
            </label>
            {f.matches.map((m, i) => (
              <button
                key={`${m.line}:${m.column}:${i}`}
                type="button"
                onClick={() => void openMatch(f.path, m.line, m.column, m.length)}
                className="flex w-full items-baseline gap-3 px-3 py-0.5 pl-8 text-left hover:bg-blue-50"
              >
                <span className="w-14 shrink-0 text-right text-zinc-400">{m.line}:{m.column}</span>
                <Preview text={m.preview} start={m.previewStart} length={m.length} />
              </button>
            ))}
          </div>
        ))}
        {res && res.files.length === 0 && <div className="p-3 text-zinc-400">{t('search.noResults')}</div>}
      </div>
    </div>
  )
}
