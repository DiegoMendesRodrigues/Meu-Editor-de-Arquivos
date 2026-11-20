// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Corretor ortográfico no Monaco: sublinha as palavras desconhecidas (marcadores) e oferece as
 * sugestões e "Adicionar ao dicionário" como correções rápidas (Ctrl+. ou menu de contexto).
 */
import type { editor, IDisposable, languages } from 'monaco-editor'
import { monaco } from '@/editor/monacoSetup'
import { t, useLocale } from '@/i18n'
import { modelPath, useDocuments } from '@/store/documents'
import { normalizeWord, SPELL_LANGUAGES, isSpellLanguage } from './text'
import type { SpellRequest, SpellResponse } from './protocol'
import SpellWorker from './spell.worker?worker'
import { useSpelling } from '@/store/spelling'
import type { Locale } from '@shared/i18n'

const OWNER = 'spell'
/** Textos maiores que isso não são verificados (o editor continua leve em arquivos enormes). */
const MAX_CHARS = 2_000_000
/** Arquivos de texto puro que não são prosa. */
const SKIP_EXTENSIONS = /\.(log|csv|tsv)$/i

type NoId<T> = T extends unknown ? Omit<T, 'id'> : never

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, (res: SpellResponse) => void>()

function request<T extends SpellResponse['type']>(req: NoId<SpellRequest>): Promise<Extract<SpellResponse, { type: T }>> {
  if (!worker) {
    worker = new SpellWorker()
    worker.onmessage = (e: MessageEvent<SpellResponse>) => {
      pending.get(e.data.id)?.(e.data)
      pending.delete(e.data.id)
    }
    worker.postMessage({ id: 0, type: 'words', words: useSpelling.getState().words } satisfies SpellRequest)
  }
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, (res) => (res.type === 'error' ? reject(new Error(res.message)) : resolve(res as Extract<SpellResponse, { type: T }>)))
    worker!.postMessage({ ...req, id } as SpellRequest)
  })
}

/** Idioma da verificação: o escolhido no menu ou, sem escolha, o da interface. */
export const spellLocale = (): Locale => useSpelling.getState().locale ?? useLocale.getState().locale

function shouldCheck(model: editor.ITextModel): boolean {
  if (!useSpelling.getState().enabled || !isSpellLanguage(model.getLanguageId())) return false
  if (model.getValueLength() > MAX_CHARS) return false
  const uri = model.uri.toString(true)
  const doc = useDocuments.getState().documents.find((d) => modelPath(d) === uri)
  return !SKIP_EXTENSIONS.test(doc?.name ?? '')
}

/** Verifica o modelo e troca os sublinhados. Descarta o resultado se o texto mudou no meio. */
async function check(model: editor.ITextModel): Promise<void> {
  if (model.isDisposed()) return
  if (!shouldCheck(model)) return monaco.editor.setModelMarkers(model, OWNER, [])
  const version = model.getVersionId()
  try {
    const res = await request<'check'>({ type: 'check', locale: spellLocale(), language: model.getLanguageId(), text: model.getValue() })
    if (model.isDisposed() || model.getVersionId() !== version) return
    monaco.editor.setModelMarkers(
      model,
      OWNER,
      res.errors.map((err) => {
        const start = model.getPositionAt(err.offset)
        const end = model.getPositionAt(err.offset + err.length)
        return {
          severity: monaco.MarkerSeverity.Info,
          message: t('spell.unknownWord', { word: err.word }),
          source: t('spell.source'),
          code: err.word,
          startLineNumber: start.lineNumber,
          startColumn: start.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column
        }
      })
    )
  } catch {
    // Sem dicionário (erro ao carregar): sem sublinhados, a edição segue normal.
    monaco.editor.setModelMarkers(model, OWNER, [])
  }
}

/** Liga o corretor a um editor: verifica ao abrir, ao trocar de documento e depois de cada pausa na digitação. */
export function attachSpellcheck(ed: editor.IStandaloneCodeEditor): IDisposable {
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = (delay = 400): void => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const model = ed.getModel()
      if (model) void check(model)
    }, delay)
  }
  const subs = [
    ed.onDidChangeModelContent(() => schedule()),
    ed.onDidChangeModel(() => schedule(0)),
    ed.onDidChangeModelLanguage(() => schedule(0)),
    ed.addAction({
      id: 'meu.spell.suggestions',
      label: t('spell.suggestions'),
      contextMenuGroupId: '1_modification',
      contextMenuOrder: 0,
      precondition: undefined,
      run: (e) => e.trigger('spell', 'editor.action.quickFix', null)
    })
  ]
  schedule(0)
  return {
    dispose: () => {
      clearTimeout(timer)
      subs.forEach((s) => s.dispose())
    }
  }
}

/** Verifica de novo todos os documentos abertos (após mudar idioma, ligar/desligar ou adicionar palavra). */
function recheckAll(): void {
  for (const model of monaco.editor.getModels()) void check(model)
}

let registered = false

/** Registra (uma vez) as correções rápidas, o comando "Adicionar ao dicionário" e as reações às preferências. */
export function registerSpellcheck(): void {
  if (registered) return
  registered = true

  monaco.editor.registerCommand('meu.spell.addWord', (_accessor, word: string) => {
    useSpelling.getState().addWord(normalizeWord(word))
  })

  const provider: languages.CodeActionProvider = {
    async provideCodeActions(model, _range, context) {
      // context.markers não diz o dono; os do corretor são os que coincidem com os marcadores dele.
      const ours = monaco.editor.getModelMarkers({ owner: OWNER, resource: model.uri })
      const markers = context.markers.filter((m) =>
        ours.some((o) => o.startLineNumber === m.startLineNumber && o.startColumn === m.startColumn && o.endLineNumber === m.endLineNumber && o.endColumn === m.endColumn)
      )
      const actions: languages.CodeAction[] = []
      for (const marker of markers.slice(0, 3)) {
        const word = model.getValueInRange(marker)
        let suggestions: string[] = []
        try {
          suggestions = (await request<'suggest'>({ type: 'suggest', locale: spellLocale(), word })).suggestions
        } catch {
          suggestions = []
        }
        suggestions.forEach((s, i) =>
          actions.push({
            title: t('spell.replaceWith', { word: s }),
            kind: 'quickfix',
            diagnostics: [marker],
            isPreferred: i === 0,
            edit: { edits: [{ resource: model.uri, versionId: model.getVersionId(), textEdit: { range: marker, text: s } }] }
          })
        )
        if (suggestions.length === 0) actions.push({ title: t('spell.noSuggestions'), kind: 'quickfix', diagnostics: [marker], disabled: t('spell.noSuggestions') })
        actions.push({
          title: t('spell.addToDictionary'),
          kind: 'quickfix',
          diagnostics: [marker],
          command: { id: 'meu.spell.addWord', title: t('spell.addToDictionary'), arguments: [word] }
        })
      }
      return { actions, dispose: () => undefined }
    }
  }
  for (const lang of SPELL_LANGUAGES) monaco.languages.registerCodeActionProvider(lang, provider)

  // Preferências: dicionário do usuário vai para o worker; qualquer mudança refaz a verificação.
  useSpelling.subscribe((s, prev) => {
    if (s.words !== prev.words && worker) {
      worker.postMessage({ id: 0, type: 'words', words: s.words } satisfies SpellRequest)
    }
    if (s.words !== prev.words || s.enabled !== prev.enabled || s.locale !== prev.locale) recheckAll()
  })
  useLocale.subscribe((s, prev) => {
    if (s.locale !== prev.locale && useSpelling.getState().locale === null) recheckAll()
  })
}
