// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/**
 * Visualização editável do Markdown: o documento aparece formatado e continua podendo ser editado,
 * inclusive com os botões de formatação da barra de ferramentas. Cada alteração é convertida de
 * volta para Markdown e gravada no documento.
 *
 * Segurança: o conteúdo passa pelo esquema do editor (ProseMirror), que só cria os elementos
 * conhecidos (parágrafos, títulos, listas, tabelas, links...). Scripts e HTML embutido não são
 * executados. Links não navegam: Ctrl+clique abre os endereços http(s) e mailto no navegador.
 *
 * Documentos com HTML ficam só para leitura aqui: o editor formatado não guarda HTML e o perderia ao gravar.
 */
import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import { setActiveWysiwyg } from './wysiwygRef'
import { finishMarkdown, hasHtml, splitFrontMatter } from './wysiwygText'
import { useT } from '@/i18n'

const EXTERNAL = /^(https?:|mailto:)/i

/**
 * Imagens aparecem como uma etiqueta com o texto alternativo (o arquivo não é carregado: o app não lê
 * arquivos que o usuário não abriu). O endereço é preservado no Markdown.
 */
const ImagePlaceholder = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const src = String(HTMLAttributes.src ?? '')
    const alt = String(HTMLAttributes.alt ?? '')
    return ['span', { class: 'md-image', title: src, 'data-src': src }, `🖼 ${alt || src}`]
  }
})

export function MarkdownWysiwyg({ content, onChange }: { content: string; onChange: (markdown: string) => void }) {
  const t = useT()
  const readOnly = hasHtml(content)
  // Último texto conhecido pelo editor (o que ele gerou ou recebeu); evita recarregar o próprio eco.
  const known = useRef(content)
  // O front matter (--- ... ---) não é exibido, mas é preservado ao gravar.
  const frontMatter = useRef(splitFrontMatter(content).frontMatter)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, protocols: ['mailto'], isAllowedUri: (url) => EXTERNAL.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url) }
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      ImagePlaceholder.configure({ allowBase64: false }),
      Markdown.configure({ indentation: { style: 'space', size: 2 } })
    ],
    content: splitFrontMatter(content).body,
    editable: !readOnly,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class:
          'prose prose-zinc dark:prose-invert mx-auto max-w-4xl px-10 py-8 outline-none prose-headings:font-semibold prose-a:text-accent prose-code:before:content-none prose-code:after:content-none prose-pre:bg-zinc-100 prose-pre:text-zinc-800 prose-table:text-sm prose-th:border prose-th:border-zinc-300 prose-th:bg-zinc-50 prose-th:px-3 prose-th:py-1.5 prose-td:border prose-td:border-zinc-300 prose-td:px-3 prose-td:py-1.5',
        spellcheck: 'false'
      },
      // Ctrl+clique num link externo abre no navegador do sistema (o processo principal valida o endereço).
      handleClick: (_view, _pos, event) => {
        const anchor = (event.target as HTMLElement).closest('a')
        const href = anchor?.getAttribute('href') ?? ''
        if (anchor && (event.ctrlKey || event.metaKey) && EXTERNAL.test(href)) {
          window.open(href, '_blank', 'noopener')
          return true
        }
        return false
      }
    },
    onUpdate: ({ editor: ed }) => {
      const markdown = finishMarkdown(frontMatter.current + ed.getMarkdown(), known.current)
      known.current = markdown
      onChange(markdown)
    },
    immediatelyRender: true
  })

  // O texto mudou fora daqui (arquivo alterado por outro programa): recarrega sem gerar alteração.
  useEffect(() => {
    if (!editor || content === known.current) return
    known.current = content
    const parts = splitFrontMatter(content)
    frontMatter.current = parts.frontMatter
    editor.commands.setContent(parts.body, { contentType: 'markdown', emitUpdate: false })
    editor.setEditable(!hasHtml(content), false)
  }, [editor, content])

  // Torna este editor o alvo dos botões de formatação enquanto estiver aberto.
  useEffect(() => {
    if (!editor) return
    if (readOnly) return
    setActiveWysiwyg(editor)
    editor.commands.focus('start')
    return () => setActiveWysiwyg(null)
  }, [editor, readOnly])

  return (
    <div className="flex h-full flex-col bg-surface">
      {readOnly && (
        <div role="note" className="shrink-0 border-b border-border bg-zinc-50 px-3 py-1.5 text-zinc-600">
          {t('md.htmlReadOnly', { label: t('toolbar.editText') })}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto" onMouseDown={(e) => focusEnd(e, editor)}>
        <EditorContent editor={editor} className="min-h-full" />
      </div>
    </div>
  )
}

/** Clique na área vazia abaixo do texto: coloca o cursor no fim do documento. */
function focusEnd(e: React.MouseEvent, editor: Editor | null): void {
  if (editor && e.target === e.currentTarget) {
    e.preventDefault()
    editor.commands.focus('end')
  }
}
