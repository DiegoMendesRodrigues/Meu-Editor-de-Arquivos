// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Worker do corretor ortográfico: roda o Hunspell (WebAssembly) com os dicionários embutidos no
 * aplicativo, sem rede, fora da thread da interface. Cada idioma é carregado só quando usado.
 */
// O build ESM do pacote importa o runtime Emscripten (CommonJS) de um jeito que o Vite não resolve;
// o build CommonJS, convertido pelo Vite, funciona no navegador e no worker.
import { loadModule } from 'hunspell-asm/dist/cjs/index.js'
import type { Hunspell, HunspellFactory } from 'hunspell-asm'
import type { Locale } from '@shared/i18n'
import { extractWords, maskNonProse, normalizeWord } from './text'
import type { SpellRequest, SpellResponse, Misspelling } from './protocol'

type Raw = Promise<[{ default: string }, { default: string }]>

// Dicionários Hunspell (pacotes "dictionary-*", em UTF-8), importados como texto.
const DICTIONARIES: Record<Locale, () => Raw> = {
  'pt-BR': () => Promise.all([import('@dict/dictionary-pt/index.aff?raw'), import('@dict/dictionary-pt/index.dic?raw')]),
  'pt-PT': () => Promise.all([import('@dict/dictionary-pt-pt/index.aff?raw'), import('@dict/dictionary-pt-pt/index.dic?raw')]),
  en: () => Promise.all([import('@dict/dictionary-en/index.aff?raw'), import('@dict/dictionary-en/index.dic?raw')]),
  es: () => Promise.all([import('@dict/dictionary-es/index.aff?raw'), import('@dict/dictionary-es/index.dic?raw')]),
  fr: () => Promise.all([import('@dict/dictionary-fr/index.aff?raw'), import('@dict/dictionary-fr/index.dic?raw')]),
  de: () => Promise.all([import('@dict/dictionary-de/index.aff?raw'), import('@dict/dictionary-de/index.dic?raw')])
}

let factory: Promise<HunspellFactory> | null = null
const checkers = new Map<Locale, Promise<Hunspell>>()
/** Palavras do dicionário do usuário (valem para todos os idiomas). */
let userWords = new Set<string>()

function checker(locale: Locale): Promise<Hunspell> {
  let c = checkers.get(locale)
  if (!c) {
    c = (async () => {
      factory ??= loadModule()
      const f = await factory
      const [aff, dic] = await DICTIONARIES[locale]()
      const enc = new TextEncoder()
      const affPath = f.mountBuffer(enc.encode(aff.default), `${locale}.aff`)
      const dicPath = f.mountBuffer(enc.encode(dic.default), `${locale}.dic`)
      const h = f.create(affPath, dicPath)
      f.unmount(affPath)
      f.unmount(dicPath)
      return h
    })()
    checkers.set(locale, c)
    c.catch(() => checkers.delete(locale)) // permite tentar de novo
  }
  return c
}

/** A palavra está correta? Em compostos com hífen, basta cada parte estar correta. */
function correct(h: Hunspell, word: string): boolean {
  const w = normalizeWord(word)
  if (userWords.has(w) || userWords.has(w.toLowerCase())) return true
  if (h.spell(w)) return true
  return w.includes('-') && w.split('-').every((part) => part.length < 2 || userWords.has(part) || h.spell(part))
}

async function handle(req: SpellRequest): Promise<SpellResponse> {
  switch (req.type) {
    case 'words':
      userWords = new Set(req.words)
      return { id: req.id, type: 'ok' }
    case 'check': {
      const h = await checker(req.locale)
      const cache = new Map<string, boolean>()
      const errors: Misspelling[] = []
      for (const { word, offset } of extractWords(maskNonProse(req.text, req.language))) {
        let ok = cache.get(word)
        if (ok === undefined) cache.set(word, (ok = correct(h, word)))
        if (!ok) errors.push({ offset, length: word.length, word })
      }
      return { id: req.id, type: 'check', errors }
    }
    case 'suggest': {
      const h = await checker(req.locale)
      return { id: req.id, type: 'suggest', suggestions: h.suggest(normalizeWord(req.word)).slice(0, 7) }
    }
  }
}

self.onmessage = (e: MessageEvent<SpellRequest>) => {
  handle(e.data).then(
    (res) => self.postMessage(res),
    (err: unknown) => self.postMessage({ id: e.data.id, type: 'error', message: String(err) } satisfies SpellResponse)
  )
}
