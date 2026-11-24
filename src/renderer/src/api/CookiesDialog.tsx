// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { ApiCookieJarEntry } from '@shared/api/protocol'
import { useT } from '@/i18n'
import { useApiStore } from '@/store/api'
import { Modal, buttonClass, fieldClass } from '@/components/Modal'

/**
 * Cookies guardados pelo Cliente de API. Cada ambiente tem o seu "pote" (id do ambiente); sem ambiente
 * ativo vale o "default". Dá para apagar um cookie, um domínio inteiro ou todos.
 */
export function CookiesDialog({ onClose, jar: initialJar }: { onClose: () => void; jar?: string }) {
  const t = useT()
  const info = useApiStore((s) => s.envInfo)
  const [jar, setJar] = useState(initialJar ?? info?.id ?? 'default')
  const [cookies, setCookies] = useState<ApiCookieJarEntry[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    window.api
      .apiCookiesList(jar)
      .then((list) => {
        setCookies(list)
        setFailed(false)
      })
      .catch(() => setFailed(true))
  }, [jar])
  useEffect(load, [load])

  const clear = (domain?: string, name?: string): void => {
    window.api.apiCookiesClear(jar, domain, name).then(load, () => setFailed(true))
  }

  const byDomain = useMemo(() => {
    const map = new Map<string, ApiCookieJarEntry[]>()
    for (const c of cookies ?? []) map.set(c.domain, [...(map.get(c.domain) ?? []), c])
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [cookies])

  return (
    <Modal title={t('apiClient.cookies.title')} description={t('apiClient.cookies.help')} onClose={onClose}>
      <div className="mb-3 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          {t('apiClient.cookies.jar')}
          <select value={jar} onChange={(e) => setJar(e.target.value)} className={`${fieldClass} w-auto`} aria-label={t('apiClient.cookies.jar')}>
            <option value="default">{t('apiClient.cookies.default')}</option>
            {info && <option value={info.id}>{info.name}</option>}
            {initialJar && initialJar !== 'default' && initialJar !== info?.id && <option value={initialJar}>{initialJar}</option>}
          </select>
        </label>
        <button type="button" disabled={!cookies || cookies.length === 0} onClick={() => clear()} className={`${buttonClass} ml-auto`}>
          {t('apiClient.cookies.clearAll')}
        </button>
      </div>
      {failed && <p role="alert" className="text-sm text-red-700">{t('apiClient.cookies.error')}</p>}
      {cookies && cookies.length === 0 && <p className="text-sm text-zinc-500">{t('apiClient.cookies.empty')}</p>}
      <div className="flex flex-col gap-3" data-testid="cookies-list">
        {byDomain.map(([domain, list]) => (
          <section key={domain}>
            <div className="flex items-center border-b border-border pb-1">
              <h3 className="flex-1 truncate text-[12.5px] font-semibold">{domain}</h3>
              <button type="button" onClick={() => clear(domain)} className="rounded px-2 py-0.5 text-[12px] text-red-700 hover:bg-zinc-100">
                {t('apiClient.cookies.clearDomain')}
              </button>
            </div>
            <ul>
              {list.map((c) => (
                <li key={`${c.path ?? ''}|${c.name}`} className="flex items-center gap-2 border-b border-border/60 py-1 text-[12px]">
                  <span className="w-1/4 truncate font-mono font-medium" title={c.name}>{c.name}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-zinc-600" title={c.value}>{c.value}</span>
                  <span className="w-20 truncate text-zinc-500" title={c.path}>{c.path ?? '/'}</span>
                  <span className="w-32 truncate text-zinc-500" title={c.expires}>{c.expires ?? t('apiClient.cookies.session')}</span>
                  <button
                    type="button"
                    onClick={() => clear(domain, c.name)}
                    title={t('apiClient.cookies.delete', { name: c.name })}
                    aria-label={t('apiClient.cookies.delete', { name: c.name })}
                    className="rounded p-1 text-zinc-500 hover:bg-zinc-200"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
