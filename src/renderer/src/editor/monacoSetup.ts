// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Carrega o Monaco a partir do pacote local (sem CDN), para o editor funcionar offline.
 */
import * as monaco from 'monaco-editor'
import { registerExtraLanguages } from './extraLanguages'
import { registerSnippetCompletion } from './snippets'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case 'json':
        return new JsonWorker()
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker()
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker()
      case 'typescript':
      case 'javascript':
        return new TsWorker()
      default:
        return new EditorWorker()
    }
  }
}

registerExtraLanguages(monaco)
registerSnippetCompletion(monaco)

// Tema claro do app: o "vs" com espaços e tabulações visíveis o bastante para serem notados.
monaco.editor.defineTheme('meu-claro', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    // Coluna dos números de linha (e da dobra) em cinza claro, diferente do editor, da barra lateral e das abas.
    'editorGutter.background': '#e4e4e9',
    'editorLineNumber.foreground': '#6b7280',
    'editorLineNumber.activeForeground': '#27272a',
    'editorWhitespace.foreground': '#7c8591',
    // Sublinhado do corretor ortográfico (marcadores "info"): vermelho, como nos processadores de texto.
    'editorInfo.foreground': '#d32f2f'
  }
})
// Tema escuro do app: o "vs-dark" com os mesmos ajustes do claro.
monaco.editor.defineTheme('meu-escuro', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editorGutter.background': '#2d2d31',
    'editorLineNumber.foreground': '#8b8b93',
    'editorLineNumber.activeForeground': '#e4e4e7',
    'editorWhitespace.foreground': '#6b7280',
    'editorInfo.foreground': '#f14c4c'
  }
})
loader.config({ monaco })

export { monaco }
