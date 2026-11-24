// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import { useEffect, useId, useState } from 'react'
import { useT } from '@/i18n'
import { useDialogs } from '@/store/dialogs'
import { Modal, buttonClass, fieldClass, primaryButtonClass } from './Modal'

/** Janela "Gerar MD5 / SHA-1 / SHA-256 / SHA-512": o resumo é recalculado a cada alteração do texto. */
export function HashDialog() {
  const t = useT()
  const close = useDialogs((s) => s.close)
  const algorithm = useDialogs((s) => s.hashAlgorithm)
  const [text, setText] = useState('')
  const [hash, setHash] = useState('')
  const [copied, setCopied] = useState(false)
  const inputId = useId()
  const outputId = useId()

  useEffect(() => {
    setCopied(false)
    if (!text) return setHash('')
    let current = true
    window.api
      .hashText(algorithm, text)
      .then((value) => current && setHash(value))
      .catch(() => current && setHash(''))
    return () => {
      current = false
    }
  }, [algorithm, text])

  const copy = async (): Promise<void> => {
    await window.api.copyText(hash)
    setCopied(true)
  }

  return (
    <Modal title={t('hash.title', { algorithm })} onClose={close}>
      <div className="flex flex-col gap-3 text-sm">
        <label htmlFor={inputId} className="font-medium">
          {t('hash.input')}
        </label>
        <textarea
          id={inputId}
          autoFocus
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className={`${fieldClass} resize-y font-mono`}
        />
        <label htmlFor={outputId} className="font-medium">
          {t('hash.output', { algorithm })}
        </label>
        <textarea
          id={outputId}
          readOnly
          rows={algorithm === 'SHA-512' ? 3 : 2}
          value={hash}
          className={`${fieldClass} resize-none break-all bg-zinc-50 font-mono`}
        />
        <div className="flex items-center justify-end gap-2">
          {copied && (
            <span role="status" className="mr-auto text-xs text-zinc-600">
              {t('hash.copied', { algorithm })}
            </span>
          )}
          <button type="button" className={primaryButtonClass} disabled={!hash} onClick={() => void copy()}>
            {t('hash.copy')}
          </button>
          <button type="button" className={buttonClass} onClick={close}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
