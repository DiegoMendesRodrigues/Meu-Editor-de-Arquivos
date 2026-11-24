// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useRef, useState } from 'react'
import { Bot, Check, ClipboardCopy, ExternalLink, FileInput, Replace, RefreshCw, Send, Settings, SquarePen, Square, TriangleAlert, X } from 'lucide-react'
import { AI_DEFAULT_HOST, type AiErrorCode } from '@shared/ai'
import type { MessageKey } from '@shared/i18n'
import { useLocale, useT } from '@/i18n'
import { buttonClass, fieldClass, primaryButtonClass } from '@/components/Modal'
import { useDocuments } from '@/store/documents'
import { useNotice } from '@/store/notice'
import { canWriteToDocument, getDocContext, writeToDocument } from './editorBridge'
import { splitBlocks, splitInline } from './markdown'
import { buildQuickPrompt, QUICK_ACTIONS, QUICK_CONTEXT_CHARS, type QuickAction } from './prompts'
import { useAi, type ChatMessage } from './store'

const OLLAMA_URL = 'https://ollama.com/download'
const PULL_EXAMPLE = 'ollama pull llama3.2'

/** Comando para copiar (nunca executado pelo app). */
function CommandLine({ text }: { text: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  return (
    <div className="my-1 flex items-center gap-2 rounded border border-border bg-chrome px-2 py-1">
      <code className="min-w-0 flex-1 select-text break-all font-mono text-[12px]">{text}</code>
      <button
        type="button"
        title={t('ai.code.copy')}
        aria-label={t('ai.code.copy')}
        onClick={() => {
          void window.api.copyText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        className="rounded p-1 text-zinc-600 hover:bg-zinc-200"
      >
        {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
      </button>
    </div>
  )
}

function InstallHelp() {
  const t = useT()
  return (
    <div className="m-3 rounded border border-amber-300 bg-amber-50 p-3 text-[12.5px]" data-testid="ai-install-help">
      <p className="mb-1 flex items-center gap-2 font-semibold text-amber-700">
        <TriangleAlert size={15} /> {t('ai.install.title')}
      </p>
      <p className="mb-2">{t('ai.install.intro')}</p>
      <p>{t('ai.install.step1')}</p>
      <button type="button" onClick={() => window.open(OLLAMA_URL, '_blank', 'noopener')} className={`${buttonClass} my-1 inline-flex items-center gap-1`}>
        <ExternalLink size={13} /> {t('ai.install.link')}
      </button>
      <p>{t('ai.install.step2')}</p>
      <CommandLine text={PULL_EXAMPLE} />
      <p>{t('ai.install.step3')}</p>
      <p className="mt-1 text-zinc-500">{t('ai.install.note')}</p>
    </div>
  )
}

function NoModelHelp() {
  const t = useT()
  return (
    <div className="m-3 rounded border border-amber-300 bg-amber-50 p-3 text-[12.5px]" data-testid="ai-no-model">
      <p className="mb-1 font-semibold text-amber-700">{t('ai.noModel.title')}</p>
      <p>{t('ai.noModel.text')}</p>
      <CommandLine text={PULL_EXAMPLE} />
    </div>
  )
}

/** Bloco de código da resposta, com Copiar, Inserir no cursor e Substituir a seleção. */
function CodeBlock({ lang, text, closed }: { lang: string; text: string; closed: boolean }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const write = (mode: 'insert' | 'replace'): void => {
    if (!canWriteToDocument() || !writeToDocument(text, mode)) useNotice.getState().show(t('ai.code.noTarget'))
  }
  const btn = 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-zinc-600 hover:bg-zinc-200 disabled:opacity-40'
  return (
    <div className="my-2 overflow-hidden rounded border border-border" data-testid="ai-code-block">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-chrome px-2 py-0.5">
        <span className="mr-auto font-mono text-[11px] text-zinc-500">{lang}</span>
        <button
          type="button"
          disabled={!closed}
          onClick={() => {
            void window.api.copyText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
          className={btn}
        >
          {copied ? <Check size={12} /> : <ClipboardCopy size={12} />} {copied ? t('ai.code.copied') : t('ai.code.copy')}
        </button>
        <button type="button" disabled={!closed} onClick={() => write('insert')} className={btn}>
          <FileInput size={12} /> {t('ai.code.insert')}
        </button>
        <button type="button" disabled={!closed} onClick={() => write('replace')} className={btn}>
          <Replace size={12} /> {t('ai.code.replace')}
        </button>
      </div>
      <pre className="max-h-80 select-text overflow-auto bg-surface p-2 font-mono text-[12px] leading-snug">{text}</pre>
    </div>
  )
}

/** Texto da resposta: só elementos do React (nada de HTML), com `código` e **negrito** em linha. */
function TextBlock({ text }: { text: string }) {
  return (
    <p className="select-text whitespace-pre-wrap break-words">
      {splitInline(text).map((p, i) =>
        p.kind === 'code' ? (
          <code key={i} className="rounded bg-chrome px-1 font-mono text-[12px]">
            {p.text}
          </code>
        ) : p.kind === 'bold' ? (
          <strong key={i}>{p.text}</strong>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </p>
  )
}

function MessageView({ m }: { m: ChatMessage }) {
  const t = useT()
  const mine = m.role === 'user'
  return (
    <div className={`mb-3 ${mine ? 'ml-6' : 'mr-1'}`} data-testid={mine ? 'ai-user-message' : 'ai-assistant-message'}>
      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{t(mine ? 'ai.role.user' : 'ai.role.assistant')}</p>
      <div className={`rounded border border-border p-2 text-[13px] ${mine ? 'bg-chrome' : 'bg-surface'}`}>
        {mine ? (
          <p className="select-text whitespace-pre-wrap break-words">{m.display ?? m.content}</p>
        ) : (
          splitBlocks(m.content).map((b, i) => (b.type === 'code' ? <CodeBlock key={i} lang={b.lang} text={b.text} closed={b.closed && !m.streaming} /> : <TextBlock key={i} text={b.text} />))
        )}
        {m.streaming && m.content === '' && <span className="text-zinc-400">...</span>}
        {m.error && (
          <p className="mt-1 flex items-start gap-1 text-red-600" role="alert" data-testid="ai-error">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {t(`ai.error.${m.error}` as MessageKey)}
          </p>
        )}
      </div>
    </div>
  )
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const t = useT()
  const settings = useAi((s) => s.settings)
  const [host, setHost] = useState(settings.host)
  const [temperature, setTemperature] = useState(settings.temperature)
  const [allowRemote, setAllowRemote] = useState(settings.allowRemote)
  const [error, setError] = useState<AiErrorCode | null>(null)
  const [saved, setSaved] = useState(false)
  return (
    <form
      className="space-y-2 border-b border-border bg-chrome p-3 text-[12.5px]"
      data-testid="ai-settings"
      onSubmit={(e) => {
        e.preventDefault()
        setSaved(false)
        void useAi
          .getState()
          .saveSettings({ ...useAi.getState().settings, host: host.trim() || AI_DEFAULT_HOST, temperature, allowRemote })
          .then((code) => {
            setError(code)
            setSaved(code === null)
          })
      }}
    >
      <label className="block">
        {t('ai.settings.host')}
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder={AI_DEFAULT_HOST} spellCheck={false} className={`${fieldClass} mt-0.5 font-mono`} aria-label={t('ai.settings.host')} />
      </label>
      <label className="block">
        {t('ai.settings.temperature', { value: temperature.toFixed(1) })}
        <input type="range" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="w-full" aria-label={t('ai.settings.temperature', { value: temperature.toFixed(1) })} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={allowRemote} onChange={(e) => setAllowRemote(e.target.checked)} />
        {t('ai.settings.allowRemote')}
      </label>
      <p className="flex items-start gap-1 text-amber-700" data-testid="ai-remote-warning">
        <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {t('ai.settings.remoteWarning')}
      </p>
      {error && (
        <p className="text-red-600" role="alert">
          {t(`ai.error.${error}` as MessageKey)}
        </p>
      )}
      {saved && <p className="text-emerald-700">{t('ai.settings.saved')}</p>}
      <div className="flex gap-2">
        <button type="submit" className={primaryButtonClass}>
          {t('ai.settings.save')}
        </button>
        <button type="button" onClick={onDone} className={buttonClass}>
          {t('ai.close')}
        </button>
      </div>
    </form>
  )
}

function QuickActions({ disabled }: { disabled: boolean }) {
  const t = useT()
  const locale = useLocale((s) => s.locale)
  const hasText = useDocuments((s) => {
    const d = s.documents.find((x) => x.id === s.activeId)
    return !!d && d.content.trim() !== ''
  })
  const run = (action: QuickAction): void => {
    const ctx = getDocContext()
    if (!ctx) return
    const label = t(`ai.quick.${action}` as MessageKey)
    const where = t(ctx.scope === 'selection' ? 'ai.quick.selection' : 'ai.quick.whole', { action: label, name: ctx.name })
    const display = ctx.truncated ? `${where}\n${t('ai.quick.truncated', { n: QUICK_CONTEXT_CHARS })}` : where
    void useAi.getState().send(buildQuickPrompt(action, ctx, locale), display)
  }
  return (
    <div className="border-b border-border px-3 py-2" role="group" aria-label={t('ai.quick.label')}>
      <div className="flex flex-wrap gap-1">
        {QUICK_ACTIONS.map((a) => (
          <button key={a} type="button" disabled={disabled || !hasText} onClick={() => run(a)} data-testid={`ai-quick-${a}`} className="rounded border border-border px-2 py-0.5 text-[12px] hover:bg-zinc-100 disabled:opacity-50">
            {t(`ai.quick.${a}` as MessageKey)}
          </button>
        ))}
      </div>
      {!hasText && <p className="mt-1 text-[11.5px] text-zinc-500">{t('ai.quick.noDocument')}</p>}
    </div>
  )
}

/** Painel lateral do assistente de IA local (Ollama). Ferramentas → Assistente de IA, ou Ctrl+Shift+I. */
export function AssistantPanel() {
  const t = useT()
  const connection = useAi((s) => s.connection)
  const settings = useAi((s) => s.settings)
  const messages = useAi((s) => s.messages)
  const busy = useAi((s) => s.generationId !== null)
  const [showSettings, setShowSettings] = useState(false)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Acompanha a resposta em streaming, descendo a lista.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const ok = connection.state === 'ok'
  const models = ok ? connection.models : []
  const ready = ok && models.length > 0 && settings.model !== ''
  const submit = (): void => {
    if (!ready || busy || draft.trim() === '') return
    void useAi.getState().send(draft)
    setDraft('')
  }

  const statusText =
    connection.state === 'checking' || connection.state === 'unknown'
      ? t('ai.status.checking')
      : ok
        ? connection.version
          ? t('ai.status.okVersion', { version: connection.version })
          : t('ai.status.ok')
        : t('ai.status.down')
  const iconBtn = 'rounded p-1 text-zinc-600 hover:bg-zinc-200'

  return (
    <section aria-label={t('ai.title')} className="flex h-full min-w-0 flex-col bg-surface text-[13px]" data-testid="ai-panel">
      <header className="flex items-center gap-1 border-b border-border bg-chrome px-2 py-1.5">
        <Bot size={16} className="text-zinc-600" />
        <h2 className="mr-auto text-[12px] font-semibold uppercase tracking-wide text-zinc-600">{t('ai.title')}</h2>
        <button type="button" onClick={() => useAi.getState().newChat()} title={t('ai.newChat')} aria-label={t('ai.newChat')} className={iconBtn}>
          <SquarePen size={15} />
        </button>
        <button type="button" onClick={() => void useAi.getState().refresh()} title={t('ai.refresh')} aria-label={t('ai.refresh')} className={iconBtn}>
          <RefreshCw size={15} />
        </button>
        <button type="button" onClick={() => setShowSettings((v) => !v)} title={t('ai.settings')} aria-label={t('ai.settings')} aria-pressed={showSettings} className={iconBtn}>
          <Settings size={15} />
        </button>
        <button type="button" onClick={() => useAi.getState().hide()} title={t('ai.close')} aria-label={t('ai.close')} className={iconBtn}>
          <X size={15} />
        </button>
      </header>

      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[12px]" data-testid="ai-status" data-state={connection.state}>
        <span className={`size-2 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : connection.state === 'down' ? 'bg-red-500' : 'bg-zinc-400'}`} />
        <span className="min-w-0 flex-1 truncate">{statusText}</span>
        {ok && models.length > 0 && (
          <select
            value={models.includes(settings.model) ? settings.model : ''}
            onChange={(e) => void useAi.getState().chooseModel(e.target.value)}
            aria-label={t('ai.model.label')}
            title={t('ai.model.label')}
            className="max-w-[55%] rounded border border-border bg-surface px-1 py-0.5 text-[12px]"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
      </div>

      {showSettings && <SettingsForm key="settings" onDone={() => setShowSettings(false)} />}

      <QuickActions disabled={!ready || busy} />

      <div ref={listRef} className="min-h-0 flex-1 overflow-auto p-3" aria-live="polite">
        {connection.state === 'down' && <InstallHelp />}
        {ok && models.length === 0 && <NoModelHelp />}
        {messages.length === 0 && connection.state !== 'down' && <p className="text-zinc-500">{t('ai.empty')}</p>}
        {messages.map((m) => (
          <MessageView key={m.id} m={m} />
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-border p-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          rows={2}
          placeholder={t('ai.input.placeholder')}
          aria-label={t('ai.input.label')}
          className={`${fieldClass} min-h-[2.5rem] resize-y`}
        />
        {busy ? (
          <button type="button" onClick={() => useAi.getState().stop()} className={`${buttonClass} inline-flex items-center gap-1`} data-testid="ai-stop">
            <Square size={13} /> {t('ai.stop')}
          </button>
        ) : (
          <button type="button" disabled={!ready || draft.trim() === ''} onClick={submit} className={`${primaryButtonClass} inline-flex items-center gap-1`} data-testid="ai-send">
            <Send size={13} /> {t('ai.send')}
          </button>
        )}
      </div>
    </section>
  )
}
