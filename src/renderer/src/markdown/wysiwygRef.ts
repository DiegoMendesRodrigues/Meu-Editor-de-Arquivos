// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
/** Editor da visualização editável do Markdown que está aberto (alvo dos botões de formatação). */
import type { Editor } from '@tiptap/react'

let current: Editor | null = null

export const setActiveWysiwyg = (editor: Editor | null): void => {
  current = editor
}

export const getActiveWysiwyg = (): Editor | null => (current && !current.isDestroyed ? current : null)
