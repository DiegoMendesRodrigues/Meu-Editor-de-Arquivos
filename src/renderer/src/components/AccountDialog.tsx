import { useState } from 'react'
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
    if (f.password !== f.password2) {
      setError('As senhas não conferem.')
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
          setInfo('Se o e-mail estiver cadastrado, você receberá um código. Digite-o abaixo com a nova senha.')
        })
      case 'reset':
        if (!needMatch()) return
        return void run(async () => {
          await window.api.accountConfirmReset(f.code, f.password)
          setF({ ...f, password: '', password2: '', code: '' })
          go('login')
          setInfo('Senha redefinida. Entre com a nova senha.')
        })
      case 'profile':
        return void run(async () => {
          setStatus(await window.api.accountUpdateProfile(f.name))
          setInfo('Perfil atualizado.')
        })
      case 'password':
        if (!needMatch()) return
        return void run(async () => {
          await window.api.accountChangePassword(f.current, f.password)
          setF({ ...f, current: '', password: '', password2: '' })
          go('profile')
          setInfo('Senha alterada. Os outros computadores precisarão entrar de novo.')
        })
    }
  }

  const logout = (): void =>
    void run(async () => {
      setStatus(await window.api.accountLogout())
      close()
    })

  const titles: Record<View, string> = {
    server: 'Servidor',
    login: 'Entrar',
    register: 'Criar conta',
    forgot: 'Recuperar senha',
    reset: 'Nova senha',
    profile: 'Meu perfil',
    password: 'Alterar senha'
  }
  const link = 'text-accent underline hover:no-underline'

  return (
    <Modal title="Conta" description="Sua conta guarda o perfil e sincroniza arquivos entre computadores, por um servidor da sua escolha." onClose={close}>
      <form onSubmit={submit} className="mx-auto flex max-w-sm flex-col gap-3">
        <h3 className="text-sm font-semibold">{titles[view]}</h3>

        {view === 'server' && (
          <>
            <Field label="Endereço da API">
              <input value={f.server} onChange={set('server')} placeholder="https://api.suaempresa.com" aria-label="Endereço da API" className={fieldClass} autoFocus />
            </Field>
            <p className="text-xs text-zinc-500">Use https://. O endereço http:// só é aceito para localhost.</p>
          </>
        )}

        {(view === 'login' || view === 'register' || view === 'forgot') && (
          <Field label="E-mail">
            <input type="email" value={f.email} onChange={set('email')} aria-label="E-mail" className={fieldClass} autoFocus autoComplete="username" />
          </Field>
        )}
        {view === 'register' && (
          <Field label="Nome">
            <input value={f.name} onChange={set('name')} aria-label="Nome" className={fieldClass} />
          </Field>
        )}
        {view === 'profile' && status.user && (
          <>
            <Field label="E-mail">
              <input value={status.user.email} readOnly aria-label="E-mail" className={`${fieldClass} bg-zinc-50`} />
            </Field>
            <Field label="Nome">
              <input value={f.name} onChange={set('name')} aria-label="Nome" className={fieldClass} />
            </Field>
          </>
        )}
        {view === 'reset' && (
          <Field label="Código recebido">
            <input value={f.code} onChange={set('code')} aria-label="Código recebido" className={`${fieldClass} font-mono`} autoFocus />
          </Field>
        )}
        {view === 'password' && (
          <Field label="Senha atual">
            <input type="password" value={f.current} onChange={set('current')} aria-label="Senha atual" className={fieldClass} autoFocus autoComplete="current-password" />
          </Field>
        )}
        {(view === 'login' || view === 'register' || view === 'reset' || view === 'password') && (
          <Field label={view === 'login' ? 'Senha' : 'Nova senha (mínimo 10 caracteres)'}>
            <input type="password" value={f.password} onChange={set('password')} aria-label={view === 'login' ? 'Senha' : 'Nova senha'} className={fieldClass} autoComplete={view === 'login' ? 'current-password' : 'new-password'} />
          </Field>
        )}
        {(view === 'register' || view === 'reset' || view === 'password') && (
          <Field label="Repita a nova senha">
            <input type="password" value={f.password2} onChange={set('password2')} aria-label="Repita a senha" className={fieldClass} autoComplete="new-password" />
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
            {busy ? 'Aguarde…' : { server: 'Salvar servidor', login: 'Entrar', register: 'Criar conta', forgot: 'Enviar código', reset: 'Redefinir senha', profile: 'Salvar perfil', password: 'Alterar senha' }[view]}
          </button>
          {view === 'profile' && (
            <button type="button" className={buttonClass} onClick={logout} disabled={busy}>
              Sair da conta
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1 text-xs text-zinc-600">
          {view === 'login' && (
            <>
              <button type="button" className={`${link} self-start`} onClick={() => go('register')}>Criar uma conta</button>
              <button type="button" className={`${link} self-start`} onClick={() => go('forgot')}>Esqueci a senha</button>
            </>
          )}
          {(view === 'register' || view === 'forgot' || view === 'reset') && (
            <button type="button" className={`${link} self-start`} onClick={() => go('login')}>Voltar para entrar</button>
          )}
          {view === 'profile' && (
            <button type="button" className={`${link} self-start`} onClick={() => go('password')}>Alterar senha</button>
          )}
          {view === 'password' && (
            <button type="button" className={`${link} self-start`} onClick={() => go('profile')}>Voltar ao perfil</button>
          )}
          {view !== 'server' && view !== 'profile' && view !== 'password' && (
            <button type="button" className={`${link} self-start`} onClick={() => go('server')}>Servidor: {status.serverUrl ?? 'não configurado'}</button>
          )}
          {view === 'server' && status.serverUrl && (
            <button type="button" className={`${link} self-start`} onClick={() => go(status.user ? 'profile' : 'login')}>Cancelar</button>
          )}
          {!status.rememberSession && (view === 'login' || view === 'register') && (
            <p className="text-amber-700">Este sistema não tem cofre de credenciais: você precisará entrar a cada vez que abrir o app.</p>
          )}
        </div>
      </form>
    </Modal>
  )
}
