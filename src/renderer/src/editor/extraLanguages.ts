// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type * as Monaco from 'monaco-editor'

/** Linguagens que o Monaco não traz de fábrica: LaTeX e TOML (realce simples). */
export function registerExtraLanguages(monaco: typeof Monaco): void {
  monaco.languages.register({ id: 'latex', extensions: ['.tex'], aliases: ['LaTeX'] })
  monaco.languages.setLanguageConfiguration('latex', {
    comments: { lineComment: '%' },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')']
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '$', close: '$' }
    ]
  })
  monaco.languages.setMonarchTokensProvider('latex', {
    tokenizer: {
      root: [
        [/%.*$/, 'comment'],
        [/\\(begin|end)\b/, 'keyword'],
        [/\\[a-zA-Z@]+\*?/, 'keyword'],
        [/\\./, 'string.escape'],
        [/\$\$/, { token: 'string', next: '@displayMath' }],
        [/\$/, { token: 'string', next: '@inlineMath' }],
        [/[{}[\]]/, 'delimiter.bracket']
      ],
      inlineMath: [
        [/[^$\\]+/, 'string'],
        [/\\./, 'string'],
        [/\$/, { token: 'string', next: '@pop' }]
      ],
      displayMath: [
        [/[^$\\]+/, 'string'],
        [/\\./, 'string'],
        [/\$\$/, { token: 'string', next: '@pop' }],
        [/\$/, 'string']
      ]
    }
  })

  monaco.languages.register({ id: 'toml', extensions: ['.toml'], aliases: ['TOML'] })
  monaco.languages.setLanguageConfiguration('toml', {
    comments: { lineComment: '#' },
    brackets: [
      ['[', ']'],
      ['{', '}']
    ],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '{', close: '}' },
      { open: '"', close: '"' }
    ]
  })
  monaco.languages.setMonarchTokensProvider('toml', {
    tokenizer: {
      root: [
        [/#.*$/, 'comment'],
        [/^\s*\[\[?[^\]]+\]\]?/, 'type'],
        [/^\s*[A-Za-z0-9_.\-"']+(?=\s*=)/, 'variable'],
        [/"""/, { token: 'string', next: '@multi' }],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/\b(true|false)\b/, 'keyword'],
        [/\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?/, 'number'],
        [/[+-]?(0x[0-9a-fA-F_]+|\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?)/, 'number'],
        [/[=,{}[\]]/, 'delimiter']
      ],
      multi: [
        [/[^"]+/, 'string'],
        [/"""/, { token: 'string', next: '@pop' }],
        [/"/, 'string']
      ]
    }
  })
}
