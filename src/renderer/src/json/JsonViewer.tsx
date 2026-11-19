import { memo, useCallback, useMemo, useState } from 'react'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy, Pencil, TriangleAlert } from 'lucide-react'
import {
  childEntries,
  formatPath,
  getAtPath,
  isContainer,
  parseJson,
  pathKey,
  summary,
  type JsonValue,
  type PathSegment
} from './jsonTree'

/** Filhos exibidos por vez em arrays/objetos grandes, para manter a interface leve. */
const PAGE_SIZE = 200
/** Profundidade aberta por padrão ao carregar o arquivo. */
const DEFAULT_OPEN_DEPTH = 2

type ExpandMode = 'default' | 'all' | 'none'

interface TreeContext {
  isOpen(key: string, depth: number): boolean
  toggle(key: string, depth: number): void
  selectedKey: string | null
  select(path: PathSegment[]): void
}

function Primitive({ value }: { value: JsonValue }) {
  if (value === null) return <span className="text-violet-600">null</span>
  if (typeof value === 'boolean') return <span className="text-violet-600">{String(value)}</span>
  if (typeof value === 'number') return <span className="text-blue-700">{String(value)}</span>
  return <span className="break-all text-emerald-700">{JSON.stringify(value)}</span>
}

const Node = memo(function Node({
  name,
  value,
  path,
  depth,
  ctx
}: {
  name: PathSegment | null
  value: JsonValue
  path: PathSegment[]
  depth: number
  ctx: TreeContext
}) {
  const key = pathKey(path)
  const container = isContainer(value)
  const open = container && ctx.isOpen(key, depth)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const entries = open ? childEntries(value) : []
  const isArray = Array.isArray(value)

  return (
    <div role="treeitem" aria-expanded={container ? open : undefined} aria-selected={ctx.selectedKey === key}>
      <div
        onClick={() => {
          ctx.select(path)
          if (container) ctx.toggle(key, depth)
        }}
        style={{ paddingLeft: depth * 18 + 8 }}
        className={`flex cursor-default items-start gap-1 py-px pr-3 hover:bg-zinc-100 ${
          ctx.selectedKey === key ? 'bg-blue-50 hover:bg-blue-100' : ''
        }`}
      >
        <span className="mt-0.5 w-4 shrink-0 text-zinc-500">
          {container && <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />}
        </span>
        {name !== null && (
          <span className={`shrink-0 ${typeof name === 'number' ? 'text-zinc-400' : 'text-rose-800'}`}>
            {typeof name === 'number' ? name : JSON.stringify(name)}
            <span className="text-zinc-500">:&nbsp;</span>
          </span>
        )}
        {container ? (
          <span className="text-zinc-500">{open ? (isArray ? '[' : '{') : summary(value)}</span>
        ) : (
          <Primitive value={value} />
        )}
      </div>

      {open && (
        <div role="group">
          {entries.slice(0, visible).map(([childName, child]) => (
            <Node key={String(childName)} name={childName} value={child} path={[...path, childName]} depth={depth + 1} ctx={ctx} />
          ))}
          {entries.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              style={{ marginLeft: (depth + 1) * 18 + 28 }}
              className="my-0.5 rounded border border-border px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Mostrar mais {Math.min(PAGE_SIZE, entries.length - visible)} de {entries.length - visible} restantes
            </button>
          )}
          <div style={{ paddingLeft: depth * 18 + 28 }} className="text-zinc-500">
            {isArray ? ']' : '}'}
          </div>
        </div>
      )}
    </div>
  )
})

function ToolButton({ icon: Icon, label, onClick, disabled }: { icon: typeof Copy; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-zinc-700 hover:bg-zinc-200 disabled:pointer-events-none disabled:text-zinc-300"
    >
      <Icon size={14} /> {label}
    </button>
  )
}

export function JsonViewer({ content, onEdit }: { content: string; onEdit: (line?: number, column?: number) => void }) {
  const parsed = useMemo(() => parseJson(content), [content])
  const [mode, setMode] = useState<ExpandMode>('default')
  const [overrides, setOverrides] = useState<Map<string, boolean>>(() => new Map())
  const [selected, setSelected] = useState<PathSegment[] | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const isOpen = useCallback(
    (key: string, depth: number) =>
      overrides.get(key) ?? (mode === 'all' ? true : mode === 'none' ? depth === 0 : depth < DEFAULT_OPEN_DEPTH),
    [overrides, mode]
  )
  const toggle = useCallback(
    (key: string, depth: number) => setOverrides((prev) => new Map(prev).set(key, !isOpen(key, depth))),
    [isOpen]
  )
  const selectedKey = selected ? pathKey(selected) : null
  const ctx = useMemo<TreeContext>(() => ({ isOpen, toggle, selectedKey, select: setSelected }), [isOpen, toggle, selectedKey])

  const expandAll = (next: ExpandMode) => {
    setMode(next)
    setOverrides(new Map())
  }

  const copy = (label: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  if (!parsed.ok) {
    return (
      <div className="grid h-full place-items-center bg-white p-6">
        <div className="max-w-lg rounded-md border border-amber-300 bg-amber-50 p-4 text-zinc-800">
          <p className="mb-1 flex items-center gap-2 font-semibold">
            <TriangleAlert size={16} className="text-amber-600" /> Este arquivo não é um JSON válido
          </p>
          <p className="mb-3 select-text">
            {parsed.message}
            {parsed.line !== undefined && ` (linha ${parsed.line}, coluna ${parsed.column})`}
          </p>
          <button
            type="button"
            onClick={() => onEdit(parsed.line, parsed.column)}
            className="flex items-center gap-1.5 rounded border border-border bg-white px-3 py-1.5 hover:bg-zinc-100"
          >
            <Pencil size={14} /> {parsed.line !== undefined ? 'Editar e ir até o erro' : 'Editar texto'}
          </button>
        </div>
      </div>
    )
  }

  const selectedValue = selected ? getAtPath(parsed.value, selected) : undefined

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-chrome px-2 text-[13px]">
        <ToolButton icon={ChevronsUpDown} label="Expandir tudo" onClick={() => expandAll('all')} />
        <ToolButton icon={ChevronsDownUp} label="Recolher tudo" onClick={() => expandAll('none')} />
        <div className="mx-1 h-5 w-px bg-zinc-300" />
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-600 select-text" title="Caminho do item selecionado">
          {selected ? formatPath(selected) : 'Clique em um item para ver o caminho'}
        </code>
        {copied && <span className="text-xs text-emerald-700">{copied} copiado</span>}
        <ToolButton icon={Copy} label="Caminho" disabled={!selected} onClick={() => selected && copy('Caminho', formatPath(selected))} />
        <ToolButton
          icon={Copy}
          label="Valor"
          disabled={selectedValue === undefined}
          onClick={() => selectedValue !== undefined && copy('Valor', JSON.stringify(selectedValue, null, 2))}
        />
      </div>
      <div role="tree" className="min-h-0 flex-1 overflow-auto py-2 font-mono text-[13px] leading-5">
        <Node name={null} value={parsed.value} path={[]} depth={0} ctx={ctx} />
      </div>
    </div>
  )
}
