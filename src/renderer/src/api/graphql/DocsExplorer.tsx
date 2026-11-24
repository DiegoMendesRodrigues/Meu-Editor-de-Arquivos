// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useMemo, useState } from 'react'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import type { GqlArg, GqlField, GqlSchemaModel, GqlType } from '@shared/api/graphql'
import { useT } from '@/i18n'

const fieldClass = 'w-full rounded border border-border bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-accent'
const linkClass = 'cursor-pointer text-blue-600 hover:underline'
const headingClass = 'mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500'

/** Tipo como link: leva ao tipo nomeado de dentro (ex.: [User!]! abre User), se ele existir no schema. */
function TypeLink({ display, base, model, onOpen }: { display: string; base: string; model: GqlSchemaModel; onOpen: (name: string) => void }) {
  if (!model.types[base]) return <span>{display}</span>
  return (
    <button type="button" className={linkClass} onClick={() => onOpen(base)}>
      {display}
    </button>
  )
}

function NameList({ names, model, onOpen }: { names: string[]; model: GqlSchemaModel; onOpen: (n: string) => void }) {
  return (
    <div className="font-mono text-[12px]">
      {names.map((n, i) => (
        <span key={n}>
          {i > 0 && ', '}
          <TypeLink display={n} base={n} model={model} onOpen={onOpen} />
        </span>
      ))}
    </div>
  )
}

function ArgList({ args, model, onOpen }: { args: GqlArg[]; model: GqlSchemaModel; onOpen: (n: string) => void }) {
  return (
    <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
      {args.map((a) => (
        <li key={a.name} className="text-[12px]">
          <span className="font-mono text-violet-700">{a.name}</span>
          <span className="text-zinc-500">: </span>
          <span className="font-mono">
            <TypeLink display={a.type.display} base={a.type.base} model={model} onOpen={onOpen} />
          </span>
          {a.defaultValue !== undefined && <span className="font-mono text-zinc-500"> = {a.defaultValue}</span>}
          {a.description && <div className="text-zinc-500">{a.description}</div>}
        </li>
      ))}
    </ul>
  )
}

function FieldRow({ field, model, onOpen, onInsert }: { field: GqlField; model: GqlSchemaModel; onOpen: (n: string) => void; onInsert: (f: GqlField) => void }) {
  const t = useT()
  return (
    <li className="border-b border-border py-1.5">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 font-mono text-[12.5px]">
          <span className={field.deprecated ? 'text-zinc-400 line-through' : 'text-blue-800'}>{field.name}</span>
          <span className="text-zinc-500">: </span>
          <TypeLink display={field.type.display} base={field.type.base} model={model} onOpen={onOpen} />
          {field.deprecated && <span className="ml-1 font-sans text-[11px] text-amber-700">({t('apiClient.graphql.deprecated')})</span>}
        </div>
        <button
          type="button"
          title={t('apiClient.graphql.insertField')}
          aria-label={`${t('apiClient.graphql.insertField')}: ${field.name}`}
          className="rounded p-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          onClick={() => onInsert(field)}
        >
          <Plus size={14} />
        </button>
      </div>
      {field.description && <div className="mt-0.5 text-[12px] text-zinc-500">{field.description}</div>}
      {field.args.length > 0 && <ArgList args={field.args} model={model} onOpen={onOpen} />}
    </li>
  )
}

function TypeView({ type, model, onOpen, onInsert }: { type: GqlType; model: GqlSchemaModel; onOpen: (n: string) => void; onInsert: (f: GqlField, owner: GqlType) => void }) {
  const t = useT()
  return (
    <div>
      <div className="font-mono text-[13px] font-semibold">
        {type.name} <span className="font-sans text-[11px] font-normal text-zinc-500">{type.kind}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-zinc-600">{type.description || t('apiClient.graphql.noDescription')}</p>
      {type.interfaces.length > 0 && (
        <>
          <div className={headingClass}>{t('apiClient.graphql.interfaces')}</div>
          <NameList names={type.interfaces} model={model} onOpen={onOpen} />
        </>
      )}
      {type.fields.length > 0 && (
        <>
          <div className={headingClass}>{t('apiClient.graphql.fields')}</div>
          <ul>
            {type.fields.map((f) => (
              <FieldRow key={f.name} field={f} model={model} onOpen={onOpen} onInsert={(field) => onInsert(field, type)} />
            ))}
          </ul>
        </>
      )}
      {type.inputFields.length > 0 && (
        <>
          <div className={headingClass}>{t('apiClient.graphql.inputFields')}</div>
          <ArgList args={type.inputFields} model={model} onOpen={onOpen} />
        </>
      )}
      {type.enumValues.length > 0 && (
        <>
          <div className={headingClass}>{t('apiClient.graphql.enumValues')}</div>
          <ul className="space-y-0.5">
            {type.enumValues.map((e) => (
              <li key={e.name} className="text-[12px]">
                <span className={`font-mono ${e.deprecated ? 'text-zinc-400 line-through' : 'text-violet-700'}`}>{e.name}</span>
                {e.description && <span className="text-zinc-500"> - {e.description}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
      {type.possibleTypes.length > 0 && (
        <>
          <div className={headingClass}>{t('apiClient.graphql.possibleTypes')}</div>
          <NameList names={type.possibleTypes} model={model} onOpen={onOpen} />
        </>
      )}
    </div>
  )
}

/** Painel de documentação do schema: tipos raiz, busca, navegação por tipo e inserção de campos na query. */
export function DocsExplorer({ model, onInsert }: { model: GqlSchemaModel; onInsert: (field: GqlField, owner: GqlType) => void }) {
  const t = useT()
  const [nav, setNav] = useState<string[]>([])
  const [search, setSearch] = useState('')

  const current = nav.length > 0 ? model.types[nav[nav.length - 1]] : undefined
  const roots = [model.queryType, model.mutationType, model.subscriptionType].filter((n): n is string => !!n && !!model.types[n])
  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return Object.values(model.types)
      .filter((x) => x.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50)
  }, [model, search])

  const open = (name: string): void => {
    setSearch('')
    setNav((n) => (n[n.length - 1] === name ? n : [...n, name]))
  }

  return (
    <div className="flex h-full flex-col text-[12.5px]">
      <div className="flex items-center gap-1 border-b border-border p-1.5">
        {nav.length > 0 && (
          <button type="button" title={t('apiClient.graphql.back')} aria-label={t('apiClient.graphql.back')} className="rounded p-1 hover:bg-zinc-100" onClick={() => setNav((n) => n.slice(0, -1))}>
            <ArrowLeft size={14} />
          </button>
        )}
        <div className="relative flex-1">
          <Search size={13} className="pointer-events-none absolute left-2 top-1.5 text-zinc-400" />
          <input
            className={`${fieldClass} pl-7`}
            placeholder={t('apiClient.graphql.searchTypes')}
            aria-label={t('apiClient.graphql.searchTypes')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {search.trim() !== '' ? (
          results.length === 0 ? (
            <p className="text-zinc-500">{t('apiClient.graphql.noResults')}</p>
          ) : (
            <ul>
              {results.map((x) => (
                <li key={x.name}>
                  <button type="button" className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-zinc-100" onClick={() => open(x.name)}>
                    <span className="font-mono">{x.name}</span>
                    <span className="text-[11px] text-zinc-500">{x.kind}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : current ? (
          <TypeView type={current} model={model} onOpen={open} onInsert={onInsert} />
        ) : (
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t('apiClient.graphql.rootTypes')}</div>
            <ul>
              {roots.map((n) => (
                <li key={n}>
                  <button type="button" className={`${linkClass} font-mono`} onClick={() => open(n)}>
                    {n}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-zinc-500">
              {t('apiClient.graphql.types')}: {Object.keys(model.types).length}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
