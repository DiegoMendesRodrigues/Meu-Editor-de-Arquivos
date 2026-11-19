// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useState } from 'react'
import { useT } from '@/i18n'
import { errorMessage, useAccount } from '@/store/account'
import { useDialogs } from '@/store/dialogs'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from './Modal'

type View = 'login' | 'register' | 'forgot' | 'reset' | 'profile' | 'password' | 'server'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-zinc-600">
      {label}
      {children}
    </label>
  )
}

export function AccountDialog() {
  const t = useT()
  const close = useDialogs((s) => s.close)
  const status = useAccount((s) => s.status)
  const setStatus = useAccount((s) => s.set)
  const [view, setView] = useState<View>(() => (!status.serverUrl ? 'server' : status.user ? 'profile' : 'login'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [f, setF] = useState({ server: status.serverUrl ?? '', email: '', name: status.user?.name ?? '', password: '', password2: '', current: '', code: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const go = (v: View): void => {
    setView(v)
    setError(null)
    setInfo(null)
  }

  /** Executa a ação mostrando erros; devolve true se deu certo. */
  const run = async (fn: () => Promise<void>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await fn()
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const needMatch = (): boolean => {
    if (f.password.length < 10) {
      setError(t('account.passwordShort'))
      return false
    }
    if (f.password !== f.password2) {
      setError(t('account.passwordsDiffer'))
      return false
    }
    return true
  }

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (busy) return
    switch (view) {
      case 'server':
        return void run(async () => {
          setStatus(await window.api.accountSetServer(f.server))
          go('login')
        })
      case 'login':
        return void run(async () => {
          const s = await window.api.accountLogin(f.email, f.password)
          setStatus(s)
          setF({ ...f, password: '', name: s.user?.name ?? '' })
          close()
        })
      case 'register':
        if (!needMatch()) return
        return void run(async () => {
          setStatus(await window.api.accountRegister(f.email, f.name, f.password))
          close()
        })
      case 'forgot':
        return void run(async () => {
          await window.api.accountRequestReset(f.email)
          go('reset')
          setInfo(t('account.info.codeSent'))
        })
      case 'reset':
        if (!needMatch()) return
        return void run(async () => {
          await window.api.accountConfirmReset(f.code, f.password)
          setF({ ...f, password: '', password2: '', code: '' })
          go('login')
          setInfo(t('account.info.resetDone'))
        })
      case 'profile':
        return void run(async () => {
          setStatus(await window.api.accountUpdateProfile(f.name))
          setInfo(t('account.info.profileSaved'))
        })
      case 'password':
        if (!needMatch()) return
        return void run(async () => {
          await window.api.accountChangePassword(f.current, f.password)
          setF({ ...f, current: '', password: '', password2: '' })
          go('profile')
          setInfo(t('account.info.passwordChanged'))
        })
    }
  }

  const logout = (): void =>
    void run(async () => {
      setStatus(await window.api.accountLogout())
      close()
    })

  const titles: Record<View, string> = {
    server: t('account.view.server'),
    login: t('account.view.login'),
    register: t('account.view.register'),
    forgot: t('account.view.forgot'),
    reset: t('account.view.reset'),
    profile: t('account.view.profile'),
    password: t('account.view.password')
  }
  const link = 'text-accent underline hover:no-underline'

  return (
    <Modal title={t('menu.account')} description={t('account.description')} onClose={close}>
      <form onSubmit={submit} className="mx-auto flex max-w-sm flex-col gap-3">
        <h3 className="text-sm font-semibold">{titles[view]}</h3>

        {view === 'server' && (
          <>
            <Field label={t('account.serverUrl')}>
              <input value={f.server} onChange={set('server')} placeholder="https://api.suaempresa.com" aria-label={t('account.serverUrl')} className={fieldClass} autoFocus />
            </Field>
            <p className="text-xs text-zinc-500">{t('account.serverHint')}</p>
          </>
        )}

        {(view === 'login' || view === 'register' || view === 'forgot') && (
          <Field label={t('account.email')}>
            <input type="email" value={f.email} onChange={set('email')} aria-label={t('account.email')} className={fieldClass} autoFocus autoComplete="username" />
          </Field>
        )}
        {view === 'register' && (
          <Field label={t('account.name')}>
            <input value={f.name} onChange={set('name')} aria-label={t('account.name')} className={fieldClass} />
          </Field>
        )}
        {view === 'profile' && status.user && (
          <>
            <Field label={t('account.email')}>
              <input value={status.user.email} readOnly aria-label={t('account.email')} className={`${fieldClass} bg-zinc-50`} />
            </Field>
            <Field label={t('account.name')}>
              <input value={f.name} onChange={set('name')} aria-label={t('account.name')} className={fieldClass} />
            </Field>
          </>
        )}
        {view === 'reset' && (
          <Field label={t('account.code')}>
            <input value={f.code} onChange={set('code')} aria-label={t('account.code')} className={`${fieldClass} font-mono`} autoFocus />
          </Field>
        )}
        {view === 'password' && (
          <Field label={t('account.currentPassword')}>
            <input type="password" value={f.current} onChange={set('current')} aria-label={t('account.currentPassword')} className={fieldClass} autoFocus autoComplete="current-password" />
          </Field>
        )}
        {(view === 'login' || view === 'register' || view === 'reset' || view === 'password') && (
          <Field label={view === 'login' ? t('account.password') : t('account.newPasswordLabel')}>
            <input type="password" value={f.password} onChange={set('password')} aria-label={view === 'login' ? t('account.password') : t('account.newPassword')} className={fieldClass} autoComplete={view === 'login' ? 'current-password' : 'new-password'} />
          </Field>
        )}
        {(view === 'register' || view === 'reset' || view === 'password') && (
          <Field label={t('account.repeatLabel')}>
            <input type="password" value={f.password2} onChange={set('password2')} aria-label={t('account.repeat')} className={fieldClass} autoComplete="new-password" />
          </Field>
        )}

        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="text-xs text-emerald-800">
            {info}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? t('common.wait') : t(`account.submit.${view}`)}
          </button>
          {view === 'profile' && (
            <button type="button" className={buttonClass} onClick={logout} disabled={busy}>
              {t('account.signOut')}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1 text-xs text-zinc-600">
          {view === 'login' && (
            <>
              <button type="button" className={`${link} self-start`} onClick={() => go('register')}>{t('account.link.register')}</button>
              <button type="button" className={`${link} self-start`} onClick={() => go('forgot')}>{t('account.link.forgot')}</button>
            </>
          )}
          {(view === 'register' || view === 'forgot' || view === 'reset') && (
            <button type="button" className={`${link} self-start`} onClick={() => go('login')}>{t('account.link.backToLogin')}</button>
          )}
          {view === 'profile' && (
            <button type="button" className={`${link} self-start`} onClick={() => go('password')}>{t('account.link.changePassword')}</button>
          )}
          {view === 'password' && (
            <button type="button" className={`${link} self-start`} onClick={() => go('profile')}>{t('account.link.backToProfile')}</button>
          )}
          {view !== 'server' && view !== 'profile' && view !== 'password' && (
            <button type="button" className={`${link} self-start`} onClick={() => go('server')}>{t('account.link.server', { url: status.serverUrl ?? t('account.serverNotSet') })}</button>
          )}
          {view === 'server' && status.serverUrl && (
            <button type="button" className={`${link} self-start`} onClick={() => go(status.user ? 'profile' : 'login')}>{t('common.cancel')}</button>
          )}
          {!status.rememberSession && (view === 'login' || view === 'register') && (
            <p className="text-amber-700">{t('account.noVault')}</p>
          )}
        </div>
      </form>
    </Modal>
  )
}
