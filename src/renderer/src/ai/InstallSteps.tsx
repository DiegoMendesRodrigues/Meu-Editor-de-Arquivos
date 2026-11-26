// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useState } from 'react'
import { Check, ClipboardCopy, Download, ExternalLink, Loader2, Play, Terminal, Trash2, TriangleAlert } from 'lucide-react'
import { AI_LINUX_INSTALL_COMMAND, AI_MODEL_NAME_MAX, AI_OLLAMA_SITE, AI_RECOMMENDED_MODELS, isValidModelName, type AiErrorCode } from '@shared/ai'
import type { MessageKey } from '@shared/i18n'
import { useT } from '@/i18n'
import { buttonClass, fieldClass, Modal, primaryButtonClass } from '@/components/Modal'
import { useNotice } from '@/store/notice'
import { useTerminals } from '@/store/terminals'
import { createTerminal } from '@/terminal/terminalBus'
import { useAi, type AiProgress } from './store'

/** Tamanho legível (B a GB). */
function size(n: number): string {
  if (n < 1024 ** 2) return `${Math.max(0, Math.round(n / 1024))} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(0)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

const approx = (mb: number): string => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`)

export function ErrorLine({ code }: { code: AiErrorCode | null }) {
  const t = useT()
  if (!code) return null
  return (
    <p className="mt-2 flex items-start gap-1 text-red-600" role="alert" data-testid="ai-op-error">
      <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {t(`ai.error.${code}` as MessageKey)}
    </p>
  )
}

/** Barra de progresso com texto e botão Cancelar. Sem total conhecido, fica indeterminada. */
export function ProgressBar({ progress, onCancel }: { progress: AiProgress; onCancel: () => void }) {
  const t = useT()
  const known = progress.total > 0
  const percent = known ? Math.min(100, Math.floor((progress.completed / progress.total) * 100)) : 0
  const label =
    progress.op === 'pull'
      ? progress.status
        ? t('ai.install.pulling', { model: progress.model ?? '', status: progress.status })
        : t('ai.install.pullStart', { model: progress.model ?? '' })
      : t(`ai.install.stage.${progress.stage}` as MessageKey)
  return (
    <div className="my-2" data-testid="ai-progress" data-op={progress.op} data-stage={progress.stage}>
      <p className="mb-1 flex items-center gap-1 break-all">
        <Loader2 size={13} className="shrink-0 animate-spin" /> {label}
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={known ? percent : undefined}
        className="h-2 w-full overflow-hidden rounded bg-zinc-200"
      >
        <div className={`h-full bg-accent ${known ? '' : 'w-1/3 animate-pulse'}`} style={known ? { width: `${percent}%` } : undefined} />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="flex-1 text-[11.5px] text-zinc-500" data-testid="ai-progress-text">
          {known ? t('ai.install.bytes', { done: size(progress.completed), total: size(progress.total), percent }) : ''}
        </span>
        <button type="button" onClick={onCancel} className={buttonClass} data-testid="ai-progress-cancel">
          {t('ai.install.cancel')}
        </button>
      </div>
    </div>
  )
}

/** Confirmação antes de baixar o instalador oficial (Windows). */
function ConfirmInstall({ onClose }: { onClose: () => void }) {
  const t = useT()
  return (
    <Modal title={t('ai.install.confirmTitle')} size="sm" onClose={onClose}>
      <p className="text-[13px]">{t('ai.install.confirmText')}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={buttonClass} onClick={onClose}>
          {t('ai.install.cancel')}
        </button>
        <button
          type="button"
          className={primaryButtonClass}
          data-testid="ai-install-confirm"
          onClick={() => {
            onClose()
            void useAi.getState().installOllama()
          }}
        >
          {t('ai.install.confirmYes')}
        </button>
      </div>
    </Modal>
  )
}

/** Digita o comando oficial no terminal do app, sem apertar Enter: a pessoa revisa e confirma. */
async function openInTerminal(): Promise<void> {
  await createTerminal()
  const id = useTerminals.getState().activeId
  if (id !== null) await window.api.terminalWrite(id, AI_LINUX_INSTALL_COMMAND)
}

function LinuxCommand() {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <div className="my-1">
      <div className="flex items-center gap-2 rounded border border-border bg-chrome px-2 py-1">
        <code className="min-w-0 flex-1 select-text break-all font-mono text-[12px]" data-testid="ai-linux-command">
          {AI_LINUX_INSTALL_COMMAND}
        </code>
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          className={`${buttonClass} inline-flex items-center gap-1`}
          onClick={() => {
            void window.api.copyText(AI_LINUX_INSTALL_COMMAND)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check size={13} /> : <ClipboardCopy size={13} />} {t(copied ? 'ai.code.copied' : 'ai.install.copyCommand')}
        </button>
        <button
          type="button"
          data-testid="ai-open-terminal"
          className={`${primaryButtonClass} inline-flex items-center gap-1`}
          onClick={() => void openInTerminal().catch(() => useNotice.getState().show(t('ai.error.unknown')))}
        >
          <Terminal size={13} /> {t('ai.install.openTerminal')}
        </button>
      </div>
      <p className="mt-1 text-zinc-500">{t('ai.install.sudoNote')}</p>
    </div>
  )
}

/** Assistente de passos quando o Ollama não responde: instalar, ou iniciar se já estiver instalado. */
export function SetupWizard() {
  const t = useT()
  const info = useAi((s) => s.info)
  const progress = useAi((s) => s.progress)
  const starting = useAi((s) => s.starting)
  const opError = useAi((s) => s.opError)
  const [confirm, setConfirm] = useState(false)
  const installing = progress?.op === 'install'

  return (
    <div className="m-3 rounded border border-amber-300 bg-amber-50 p-3 text-[12.5px]" data-testid="ai-install-help">
      <p className="mb-1 flex items-center gap-2 font-semibold text-amber-700">
        <TriangleAlert size={15} /> {t(info?.installed ? 'ai.install.stoppedTitle' : 'ai.install.title')}
      </p>
      <p className="mb-2">{t('ai.install.intro')}</p>

      {installing && progress ? (
        <ProgressBar progress={progress} onCancel={() => useAi.getState().cancelInstall()} />
      ) : info?.installed ? (
        <div>
          <p>{t('ai.install.stoppedText')}</p>
          <button type="button" disabled={starting} onClick={() => void useAi.getState().startOllama()} className={`${primaryButtonClass} my-1 inline-flex items-center gap-1`} data-testid="ai-start-server">
            {starting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} {t(starting ? 'ai.install.starting' : 'ai.install.start')}
          </button>
        </div>
      ) : info?.platform === 'win32' ? (
        <div>
          <p>{t('ai.install.windowsText')}</p>
          <button type="button" onClick={() => setConfirm(true)} className={`${primaryButtonClass} my-1 inline-flex items-center gap-1`} data-testid="ai-install-button">
            <Download size={13} /> {t('ai.install.button')}
          </button>
        </div>
      ) : info?.platform === 'linux' ? (
        <div>
          <p>{t('ai.install.linuxText')}</p>
          <LinuxCommand />
        </div>
      ) : null}

      <ErrorLine code={opError} />
      {!installing && (
        <details className="mt-2">
          <summary className="cursor-pointer text-zinc-600">{t('ai.install.manual')}</summary>
          <p className="mt-1">{t('ai.install.step1')}</p>
          <button type="button" onClick={() => window.open(AI_OLLAMA_SITE, '_blank', 'noopener')} className={`${buttonClass} my-1 inline-flex items-center gap-1`}>
            <ExternalLink size={13} /> {t('ai.install.link')}
          </button>
          <p>{t('ai.install.step3')}</p>
        </details>
      )}
      {confirm && <ConfirmInstall onClose={() => setConfirm(false)} />}
    </div>
  )
}

/** Modelos recomendados e campo livre; baixa pelo Main. Com um download em andamento, mostra a barra. */
export function ModelPicker({ title }: { title?: string }) {
  const t = useT()
  const progress = useAi((s) => s.progress)
  const opError = useAi((s) => s.opError)
  const [custom, setCustom] = useState('')
  const name = custom.trim()
  const invalid = name !== '' && !isValidModelName(name)
  const pulling = progress?.op === 'pull'
  const busy = progress !== null

  return (
    <div data-testid="ai-model-picker">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {pulling && progress ? (
        <ProgressBar progress={progress} onCancel={() => useAi.getState().cancelPull()} />
      ) : (
        <>
          <ul className="space-y-1">
            {AI_RECOMMENDED_MODELS.map((m) => (
              <li key={m.name} className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{m.name}</code>
                <span className="text-[11.5px] text-zinc-500">{t('ai.install.approxSize', { size: approx(m.sizeMb) })}</span>
                <button type="button" disabled={busy} onClick={() => void useAi.getState().pullModel(m.name)} className={`${buttonClass} inline-flex items-center gap-1`} data-testid={`ai-pull-${m.name}`}>
                  <Download size={13} /> {t('ai.install.pull')}
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (name !== '' && !invalid && !busy) void useAi.getState().pullModel(name)
            }}
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              maxLength={AI_MODEL_NAME_MAX}
              placeholder={t('ai.install.customPlaceholder')}
              aria-label={t('ai.install.customLabel')}
              aria-invalid={invalid}
              spellCheck={false}
              className={`${fieldClass} font-mono`}
            />
            <button type="submit" disabled={name === '' || invalid || busy} className={buttonClass} data-testid="ai-pull-custom">
              {t('ai.install.pull')}
            </button>
          </form>
          {invalid && <p className="mt-1 text-red-600">{t('ai.error.modelNameInvalid')}</p>}
        </>
      )}
      <ErrorLine code={opError} />
    </div>
  )
}

/** Modelos instalados, com exclusão (pede confirmação). */
export function InstalledModels({ models }: { models: string[] }) {
  const t = useT()
  const [target, setTarget] = useState<string | null>(null)
  if (models.length === 0) return null
  return (
    <div className="mt-2" data-testid="ai-installed-models">
      <p className="mb-1 font-semibold">{t('ai.install.installedTitle')}</p>
      <ul className="space-y-1">
        {models.map((m) => (
          <li key={m} className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-[12px]">{m}</code>
            <button type="button" onClick={() => setTarget(m)} title={t('ai.install.delete')} aria-label={`${t('ai.install.delete')}: ${m}`} className="rounded p-1 text-zinc-600 hover:bg-zinc-200">
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      {target && (
        <Modal title={t('ai.install.deleteTitle')} size="sm" onClose={() => setTarget(null)}>
          <p className="text-[13px]">{t('ai.install.deleteText', { model: target })}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={() => setTarget(null)}>
              {t('ai.install.cancel')}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              data-testid="ai-delete-confirm"
              onClick={() => {
                const m = target
                setTarget(null)
                void useAi.getState().deleteModel(m)
              }}
            >
              {t('ai.install.deleteYes')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
