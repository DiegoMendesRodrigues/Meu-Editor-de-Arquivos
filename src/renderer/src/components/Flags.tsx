// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { Locale } from '@shared/i18n'

/**
 * Bandeiras em SVG (o Windows não desenha as bandeiras em emoji).
 * São desenhos simplificados: o objetivo é reconhecer o idioma, não reproduzir os brasões.
 */
const FLAGS: Record<Locale, React.ReactNode> = {
  de: (
    <>
      <rect width="60" height="10" fill="#000" />
      <rect y="10" width="60" height="10" fill="#dd0000" />
      <rect y="20" width="60" height="10" fill="#ffce00" />
    </>
  ),
  es: (
    <>
      <rect width="60" height="30" fill="#aa151b" />
      <rect y="7.5" width="60" height="15" fill="#f1bf00" />
    </>
  ),
  fr: (
    <>
      <rect width="20" height="30" fill="#0055a4" />
      <rect x="20" width="20" height="30" fill="#fff" />
      <rect x="40" width="20" height="30" fill="#ef4135" />
    </>
  ),
  en: (
    <>
      <clipPath id="flag-en-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="flag-en-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#flag-en-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#flag-en-t)" stroke="#c8102e" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </>
  ),
  'pt-BR': (
    <>
      <rect width="60" height="30" fill="#009c3b" />
      <path d="M30,3 L56,15 L30,27 L4,15 Z" fill="#ffdf00" />
      <circle cx="30" cy="15" r="7.5" fill="#002776" />
      <path d="M23,14 Q30,11 37,16" stroke="#fff" strokeWidth="1.4" fill="none" />
    </>
  ),
  'pt-PT': (
    <>
      <rect width="24" height="30" fill="#006600" />
      <rect x="24" width="36" height="30" fill="#ff0000" />
      <circle cx="24" cy="15" r="6" fill="#ffcc00" />
      <circle cx="24" cy="15" r="3.5" fill="#fff" />
      <circle cx="24" cy="15" r="1.8" fill="#ff0000" />
    </>
  )
}

export function Flag({ locale, width = 24 }: { locale: Locale; width?: number }) {
  return (
    <svg viewBox="0 0 60 30" width={width} height={width / 2} aria-hidden="true" focusable="false" className="rounded-[2px] ring-1 ring-black/20">
      {FLAGS[locale]}
    </svg>
  )
}
