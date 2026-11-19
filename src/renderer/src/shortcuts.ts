// Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/
import type { MessageKey, Params } from '@shared/i18n'

/** Atalhos de teclado do aplicativo, agrupados, para a janela "Atalhos de teclado". */
export interface ShortcutGroup {
  title: string
  items: { keys: string; action: string }[]
}

type Translate = (key: MessageKey, params?: Params) => string

export function shortcutGroups(t: Translate): ShortcutGroup[] {
  return [
    {
      title: t('menu.file'),
      items: [
        { keys: 'Ctrl+N', action: t('sc.newMd') },
        { keys: 'Ctrl+O', action: t('sc.openFiles') },
        { keys: 'Ctrl+Shift+K', action: t('sc.openFolder') },
        { keys: 'Ctrl+S', action: t('toolbar.save') },
        { keys: 'Ctrl+Shift+S', action: t('menu.file.saveAs').replace('...', '') },
        { keys: 'Ctrl+W', action: t('menu.file.closeTab') },
        { keys: 'Alt+F4', action: t('menu.file.exit') }
      ]
    },
    {
      title: t('menu.edit'),
      items: [
        { keys: 'Ctrl+Z', action: t('menu.edit.undo') },
        { keys: 'Ctrl+Y', action: t('menu.edit.redo') },
        { keys: 'Ctrl+X / Ctrl+C / Ctrl+V', action: t('sc.cutCopyPaste') },
        { keys: 'Ctrl+A', action: t('menu.edit.selectAll') },
        { keys: 'Ctrl+L', action: t('sc.selectLine') },
        { keys: 'Ctrl+D', action: t('sc.nextOccurrence') },
        { keys: t('sc.altClickKeys'), action: t('sc.addCursor') },
        { keys: t('menu.edit.columnSelectionKeys'), action: t('menu.edit.columnSelection') },
        { keys: 'Alt+↑ / Alt+↓', action: t('sc.moveLine') },
        { keys: 'Shift+Alt+↑ / Shift+Alt+↓', action: t('sc.copyLine') },
        { keys: 'Ctrl+/', action: t('sc.comment') },
        { keys: 'F1', action: t('menu.tools.commandPalette') }
      ]
    },
    {
      title: t('menu.search'),
      items: [
        { keys: 'Ctrl+F', action: t('toolbar.find') },
        { keys: 'Ctrl+H', action: t('toolbar.replace') },
        { keys: 'Ctrl+Shift+F', action: t('sc.findInFiles') },
        { keys: 'Ctrl+G', action: t('sc.goToLine') }
      ]
    },
    {
      title: t('menu.view'),
      items: [
        { keys: 'Ctrl+Shift+B', action: t('sc.sidebar') },
        { keys: 'Ctrl+Shift+E', action: t('sc.togglePreview') },
        { keys: 'Ctrl++', action: t('menu.view.fontIncrease') },
        { keys: 'Ctrl+-', action: t('menu.view.fontDecrease') },
        { keys: 'Ctrl+0', action: t('menu.view.fontReset') }
      ]
    },
    {
      title: t('sc.group.mdjson'),
      items: [
        { keys: 'Ctrl+B', action: t('toolbar.bold') },
        { keys: 'Ctrl+I', action: t('toolbar.italic') },
        { keys: 'Ctrl+Shift+X', action: t('toolbar.strike') },
        { keys: 'Shift+Alt+F', action: t('sc.formatDoc') }
      ]
    },
    {
      title: t('sc.group.macros'),
      items: [
        { keys: 'Ctrl+Shift+R', action: t('sc.macroRecord') },
        { keys: 'Ctrl+Shift+M', action: t('menu.tools.macroRunLast') }
      ]
    }
  ]
}
