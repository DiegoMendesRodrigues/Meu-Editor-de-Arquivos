// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useState } from 'react'
import icon from '@/assets/icon.svg'
import { useLocale, useT } from '@/i18n'
import { GITHUB_URL, siteUrl } from '@shared/support'
import { shortcutGroups } from '@/shortcuts'
import { useDialogs } from '@/store/dialogs'
import { Modal, buttonClass } from './Modal'

const DEVELOPER = 'Diego Mendes Rodrigues'
const DEVELOPER_URL = 'https://www.linkedin.com/in/diegomendesrodrigues/'

export function AboutDialog() {
  const t = useT()
  const close = useDialogs((s) => s.close)
  const locale = useLocale((s) => s.locale)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.api.getAppInfo().then((info) => setVersion(info.version))
  }, [])

  const website = siteUrl(locale)
  const link = 'break-all text-[#3b6f8f] underline hover:text-accent'
  return (
    <Modal title={t('menu.help.about')} onClose={close}>
      <div className="flex flex-col gap-5 text-sm">
        <div className="flex items-center gap-6">
          <img src={icon} alt="" width={104} height={104} className="shrink-0" />
          <div className="flex flex-col gap-2">
            <h3 className="text-xl">Meu Editor de Arquivos</h3>
            <p className="text-zinc-600">{t('about.version', { version: version || '…' })}</p>
            <p className="flex items-center gap-3">
              <span>
                {t('about.developer')} {DEVELOPER}
              </span>
              <a href={DEVELOPER_URL} target="_blank" rel="noreferrer" title="LinkedIn" aria-label={`LinkedIn — ${DEVELOPER}`}>
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                  <rect width="24" height="24" rx="3" fill="#0a66c2" />
                  <path fill="#fff" d="M5.3 9.4h2.9V19H5.3zM6.8 4.9a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4zM10 9.4h2.8v1.3h.04c.39-.74 1.34-1.52 2.76-1.52 2.95 0 3.5 1.94 3.5 4.47V19h-2.9v-4.7c0-1.12-.02-2.56-1.56-2.56-1.56 0-1.8 1.22-1.8 2.48V19H10z" />
                </svg>
              </a>
            </p>
          </div>
        </div>
        <div>
          <p className="font-semibold text-[#2f78c4]">{t('about.website')}</p>
          <a href={website} target="_blank" rel="noreferrer" className={link}>{website}</a>
        </div>
        <div>
          <p className="font-semibold text-[#2f78c4]">{t('about.github')}</p>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={link}>{GITHUB_URL}</a>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={close} className={`${buttonClass} px-8`} autoFocus>
            {t('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function ShortcutsDialog() {
  const t = useT()
  const close = useDialogs((s) => s.close)
  return (
    <Modal title={t('menu.help.shortcuts')} description={t('sc.description')} onClose={close}>
      <div className="grid gap-5 text-sm md:grid-cols-2">
        {shortcutGroups(t).map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{group.title}</h3>
            <dl className="divide-y divide-border rounded border border-border">
              {group.items.map((item) => (
                <div key={item.keys} className="flex items-baseline gap-3 px-2 py-1">
                  <dt className="w-44 shrink-0 font-mono text-xs text-zinc-700">{item.keys}</dt>
                  <dd className="min-w-0 flex-1">{item.action}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={close} className={buttonClass}>
          {t('common.close')}
        </button>
      </div>
    </Modal>
  )
}

type UpdateState = { status: 'checking' } | { status: 'done'; version: string; link: string; newer: boolean } | { status: 'error' }

/** Ajuda → Verificar por atualizações: compara a versão publicada no site com a deste aplicativo. */
export function UpdateDialog() {
  const t = useT()
  const close = useDialogs((s) => s.close)
  const [state, setState] = useState<UpdateState>({ status: 'checking' })

  useEffect(() => {
    let alive = true
    void Promise.all([window.api.checkUpdate(), window.api.getAppInfo()])
      .then(([latest, info]) => {
        if (alive) setState({ status: 'done', version: latest.version, link: latest.websiteLink, newer: latest.version !== info.version })
      })
      .catch(() => {
        if (alive) setState({ status: 'error' })
      })
    return () => {
      alive = false
    }
  }, [])

  const title = state.status === 'done' ? t(state.newer ? 'update.newTitle' : 'update.latestTitle') : t('menu.help.checkUpdate')
  return (
    <Modal title={title} onClose={close}>
      <div className="flex flex-col gap-5 text-sm">
        {state.status === 'checking' && <p className="text-zinc-600">{t('update.checking')}</p>}
        {state.status === 'error' && <p role="alert">{t('update.error')}</p>}
        {state.status === 'done' && !state.newer && <p>{t('update.latestText')}</p>}
        {state.status === 'done' && state.newer && (
          <div className="flex flex-col gap-2">
            <p>{t('update.newText', { version: state.version })}</p>
            <p>
              {t('update.download')}{' '}
              <a href={state.link} target="_blank" rel="noreferrer" className="break-all text-[#3b6f8f] underline hover:text-accent">
                {state.link}
              </a>
              .
            </p>
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={close} className={`${buttonClass} px-8`} autoFocus>
            {t('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
