import { useState } from 'react'
import type { MacroStep } from '@shared/ipc'
import { playMacro } from '@/editor/macros'
import { newId, useLibrary } from '@/store/library'
import { useDialogs } from '@/store/dialogs'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from './Modal'

const describeSteps = (steps: MacroStep[]): string =>
  steps.map((s) => (s.type === 'text' ? JSON.stringify(s.text) : `<${s.id}>`)).join(' ') || '(vazia)'

export function MacrosDialog() {
  const close = useDialogs((s) => s.close)
  const macros = useLibrary((s) => s.macros)
  const steps = useLibrary((s) => s.steps)
  const recording = useLibrary((s) => s.recording)
  const saveMacros = useLibrary((s) => s.saveMacros)
  const [name, setName] = useState('')
  const [times, setTimes] = useState(1)
  const [message, setMessage] = useState<string | null>(null)

  const run = (id: string | null): void => {
    const list = id ? (macros.find((m) => m.id === id)?.steps ?? []) : steps
    close() // devolve o foco ao editor antes de executar
    setTimeout(() => {
      const ok = playMacro({ id: 'tmp', name: '', steps: list }, Math.max(1, Math.min(times, 10000)))
      if (!ok) window.alert('Abra um documento em modo de edição para executar a macro.')
    }, 50)
  }

  const saveCurrent = async (): Promise<void> => {
    if (!name.trim() || steps.length === 0) return
    await saveMacros([...macros, { id: newId(), name: name.trim(), steps }])
    setMessage(`Macro "${name.trim()}" salva.`)
    setName('')
  }

  const remove = async (id: string, label: string): Promise<void> => {
    if (window.confirm(`Excluir a macro "${label}"?`)) await saveMacros(macros.filter((m) => m.id !== id))
  }

  return (
    <Modal
      title="Macros"
      description="Grave uma sequência de digitação e comandos (Ctrl+Shift+R inicia e para) e execute-a quantas vezes quiser."
      onClose={close}
    >
      <div className="flex flex-col gap-4 text-sm">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Última gravação</h3>
          {recording ? (
            <p className="text-red-700">Gravando… feche esta janela, edite o texto e pare a gravação com Ctrl+Shift+R.</p>
          ) : steps.length === 0 ? (
            <p className="text-zinc-400">Nenhuma gravação. Use Ferramentas → Gravar macro.</p>
          ) : (
            <>
              <p className="mb-2 max-h-20 overflow-auto rounded bg-zinc-50 p-2 font-mono text-xs" aria-label="Passos gravados">
                {describeSteps(steps)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={primaryButtonClass} onClick={() => run(null)}>
                  Executar
                </button>
                <label className="flex items-center gap-1 text-xs text-zinc-600">
                  vezes
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={times}
                    onChange={(e) => setTimes(Number(e.target.value) || 1)}
                    aria-label="Repetições"
                    className={`${fieldClass} w-20`}
                  />
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome para salvar"
                  aria-label="Nome da macro"
                  className={`${fieldClass} w-48`}
                />
                <button type="button" className={buttonClass} disabled={!name.trim()} onClick={() => void saveCurrent()}>
                  Salvar macro
                </button>
              </div>
            </>
          )}
          {message && (
            <p role="status" className="mt-1 text-xs text-emerald-800">
              {message}
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Macros salvas</h3>
          {macros.length === 0 && <p className="text-zinc-400">Nenhuma macro salva.</p>}
          <ul className="divide-y divide-border rounded border border-border">
            {macros.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.name}</div>
                  <div className="truncate font-mono text-xs text-zinc-500">{describeSteps(m.steps)}</div>
                </div>
                <button type="button" className={buttonClass} onClick={() => run(m.id)}>
                  Executar
                </button>
                <button type="button" className={buttonClass} onClick={() => void remove(m.id, m.name)}>
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  )
}
