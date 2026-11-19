// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useState } from 'react'
import icon from '@/assets/icon.svg'
import { useT } from '@/i18n'
import { shortcutGroups } from '@/shortcuts'
import { useDialogs } from '@/store/dialogs'
import { Modal, buttonClass } from './Modal'

const DEVELOPER = 'Diego Mendes Rodrigues'
const DEVELOPER_URL = 'https://www.linkedin.com/in/diegomendesrodrigues/'

export function AboutDialog() {
  const t = useT()
  const close = useDialogs((s) => s.close)
  const [version, setVersion] = useState('')

  useEffect(() => {
    void window.api.getAppInfo().then((info) => setVersion(info.version))
  }, [])

  return (
    <Modal title={t('menu.help.about')} onClose={close}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
        <img src={icon} alt="" width={96} height={96} />
        <h3 className="text-lg font-semibold">Meu Editor de Arquivos</h3>
        <p className="text-sm text-zinc-600">{t('about.version', { version: version || '…' })}</p>
        <p className="text-sm">
          {t('about.developer')}{' '}
          <a href={DEVELOPER_URL} target="_blank" rel="noreferrer" className="text-accent underline hover:no-underline">
            {DEVELOPER}
          </a>
        </p>
        <button type="button" onClick={close} className={`${buttonClass} mt-2 px-6`} autoFocus>
          {t('common.close')}
        </button>
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
