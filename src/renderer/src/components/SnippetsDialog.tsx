import { useMemo, useState } from 'react'
import type { Snippet } from '@shared/ipc'
import { allSnippets, insertSnippet } from '@/editor/snippets'
import { BUILTIN_SNIPPETS, newId, useLibrary } from '@/store/library'
import { useDialogs } from '@/store/dialogs'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from './Modal'

const isBuiltin = (s: Snippet): boolean => BUILTIN_SNIPPETS.some((b) => b.id === s.id)
const emptySnippet = (): Snippet => ({ id: newId(), name: '', prefix: '', body: '' })

export function SnippetsDialog() {
  const close = useDialogs((s) => s.close)
  const user = useLibrary((s) => s.snippets)
  const saveSnippets = useLibrary((s) => s.saveSnippets)
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState<Snippet | null>(null)
  const [error, setError] = useState<string | null>(null)

  const list = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return allSnippets().filter((s) => !q || s.name.toLowerCase().includes(q) || s.prefix.toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, user])

  const builtin = draft ? isBuiltin(draft) : false
  const isNew = draft ? !user.some((s) => s.id === draft.id) && !builtin : false

  const insert = (s: Snippet): void => {
    close() // devolve o foco ao editor antes de inserir
    setTimeout(() => insertSnippet(s.body), 50)
  }

  const save = async (): Promise<void> => {
    if (!draft) return
    if (!draft.name.trim() || !draft.prefix.trim() || !draft.body) return setError('Preencha nome, atalho e texto.')
    if (/\s/.test(draft.prefix)) return setError('O atalho não pode ter espaços.')
    const clean = { ...draft, name: draft.name.trim(), prefix: draft.prefix.trim() }
    await saveSnippets(isNew ? [...user, clean] : user.map((s) => (s.id === clean.id ? clean : s)))
    setError(null)
    setDraft(clean)
  }

  const remove = async (): Promise<void> => {
    if (!draft || builtin || !window.confirm(`Excluir o snippet "${draft.name}"?`)) return
    await saveSnippets(user.filter((s) => s.id !== draft.id))
    setDraft(null)
  }

  return (
    <Modal
      title="Snippets"
      description="Digite o atalho no editor e escolha a sugestão (Ctrl+Espaço), ou insira daqui. No texto, use $1, ${2:padrão} e $0 para as posições do cursor."
      onClose={close}
    >
      <div className="flex gap-4">
        <div className="flex w-64 shrink-0 flex-col gap-2">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar" aria-label="Filtrar snippets" className={fieldClass} />
          <ul className="max-h-72 overflow-auto rounded border border-border" aria-label="Lista de snippets">
            {list.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => { setDraft(s); setError(null) }}
                  onDoubleClick={() => insert(s)}
                  className={`flex w-full items-baseline gap-2 px-2 py-1 text-left text-sm hover:bg-blue-50 ${draft?.id === s.id ? 'bg-blue-100' : ''}`}
                >
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto font-mono text-xs text-zinc-500">{s.prefix}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="p-2 text-sm text-zinc-400">Nenhum snippet.</li>}
          </ul>
          <button type="button" className={buttonClass} onClick={() => { setDraft(emptySnippet()); setError(null) }}>
            Novo snippet
          </button>
        </div>

        <div className="min-w-0 flex-1">
          {draft ? (
            <form onSubmit={(e) => { e.preventDefault(); void save() }} className="flex flex-col gap-2">
              <label className="text-xs text-zinc-600">
                Nome
                <input value={draft.name} readOnly={builtin} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={fieldClass} />
              </label>
              <label className="text-xs text-zinc-600">
                Atalho (prefixo)
                <input value={draft.prefix} readOnly={builtin} onChange={(e) => setDraft({ ...draft, prefix: e.target.value })} className={`${fieldClass} font-mono`} />
              </label>
              <label className="text-xs text-zinc-600">
                Texto
                <textarea value={draft.body} readOnly={builtin} rows={8} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className={`${fieldClass} font-mono`} />
              </label>
              {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
              {builtin && <p className="text-xs text-zinc-500">Snippet do app (somente leitura). Para personalizar, crie um novo com o mesmo texto.</p>}
              <div className="flex gap-2">
                <button type="button" className={buttonClass} onClick={() => insert(draft)} disabled={!draft.body}>Inserir no editor</button>
                {!builtin && <button type="submit" className={primaryButtonClass}>Salvar</button>}
                {builtin && <button type="button" className={buttonClass} onClick={() => setDraft({ ...draft, id: newId(), name: `${draft.name} (cópia)`, prefix: `${draft.prefix}2` })}>Duplicar para editar</button>}
                {!builtin && !isNew && <button type="button" className={`${buttonClass} ml-auto`} onClick={() => void remove()}>Excluir</button>}
              </div>
            </form>
          ) : (
            <p className="text-sm text-zinc-400">Selecione um snippet ou crie um novo.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
