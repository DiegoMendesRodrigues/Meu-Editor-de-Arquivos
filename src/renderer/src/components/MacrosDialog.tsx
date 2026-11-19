// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useState } from 'react'
import type { MacroStep } from '@shared/ipc'
import { playMacro } from '@/editor/macros'
import { newId, useLibrary } from '@/store/library'
import { useT } from '@/i18n'
import { useDialogs } from '@/store/dialogs'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from './Modal'

const describeSteps = (steps: MacroStep[], empty: string): string =>
  steps.map((s) => (s.type === 'text' ? JSON.stringify(s.text) : `<${s.id}>`)).join(' ') || empty

export function MacrosDialog() {
  const t = useT()
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
      if (!ok) window.alert(t('macros.needEditor'))
    }, 50)
  }

  const saveCurrent = async (): Promise<void> => {
    if (!name.trim() || steps.length === 0) return
    await saveMacros([...macros, { id: newId(), name: name.trim(), steps }])
    setMessage(t('macros.saved', { name: name.trim() }))
    setName('')
  }

  const remove = async (id: string, label: string): Promise<void> => {
    if (window.confirm(t('macros.confirmDelete', { name: label }))) await saveMacros(macros.filter((m) => m.id !== id))
  }

  return (
    <Modal
      title={t('menu.tools.macros').replace('...', '')}
      description={t('macros.description')}
      onClose={close}
    >
      <div className="flex flex-col gap-4 text-sm">
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">{t('macros.last')}</h3>
          {recording ? (
            <p className="text-red-700">{t('macros.recordingNow')}</p>
          ) : steps.length === 0 ? (
            <p className="text-zinc-400">{t('macros.noneRecorded')}</p>
          ) : (
            <>
              <p className="mb-2 max-h-20 overflow-auto rounded bg-zinc-50 p-2 font-mono text-xs" aria-label={t('macros.steps')}>
                {describeSteps(steps, t('macros.empty'))}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={primaryButtonClass} onClick={() => run(null)}>
                  {t('common.run')}
                </button>
                <label className="flex items-center gap-1 text-xs text-zinc-600">
                  {t('macros.times')}
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={times}
                    onChange={(e) => setTimes(Number(e.target.value) || 1)}
                    aria-label={t('macros.repetitions')}
                    className={`${fieldClass} w-20`}
                  />
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('macros.namePlaceholder')}
                  aria-label={t('macros.nameLabel')}
                  className={`${fieldClass} w-48`}
                />
                <button type="button" className={buttonClass} disabled={!name.trim()} onClick={() => void saveCurrent()}>
                  {t('macros.saveMacro')}
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
          <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">{t('macros.savedList')}</h3>
          {macros.length === 0 && <p className="text-zinc-400">{t('macros.noneSaved')}</p>}
          <ul className="divide-y divide-border rounded border border-border">
            {macros.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.name}</div>
                  <div className="truncate font-mono text-xs text-zinc-500">{describeSteps(m.steps, t('macros.empty'))}</div>
                </div>
                <button type="button" className={buttonClass} onClick={() => run(m.id)}>
                  {t('common.run')}
                </button>
                <button type="button" className={buttonClass} onClick={() => void remove(m.id, m.name)}>
                  {t('common.delete')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  )
}
