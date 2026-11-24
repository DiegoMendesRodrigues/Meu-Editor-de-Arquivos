# Meu Editor de Arquivos — User Manual

Version {{version}}

## 1. Welcome

**Meu Editor de Arquivos** is a lightweight editor for anyone who works with text, notes, scripts, configuration files, logs and code. It runs on Windows 11, Debian 12 and 13, and Ubuntu 22.04 or newer, and it **does not need an internet connection** for editing.

What you will find in it:

- tabs for several files at once, with automatic recovery of what you have typed;
- Markdown that opens **formatted**, with a button to edit the text;
- a **JSON viewer** where you can open and close parts of the file;
- search and replace in a single file or in a whole folder;
- syntax colors for dozens of languages, snippets and macros;
- a user account to keep files in the cloud and open them on other computers;
- an interface in six languages.

## 2. Getting to know the screen

![Main screen with a folder open and a Markdown document](img/s01-main.png)

1. **Menu bar** (at the top): {{menu.file}}, {{menu.edit}}, {{menu.search}}, {{menu.view}}, {{menu.encoding}}, {{menu.language}}, {{menu.tools}}, {{menu.account}} and {{menu.help}}.
2. **Toolbar**: shortcuts for the most common commands. The formatting buttons appear when the document is Markdown. On the right you will find the **language flags** and the button that switches between preview and editing.
3. **Sidebar** (on the left): the open documents, the explorer for the open folder and your recent files. To hide or show it, use **Ctrl+Shift+B**.
4. **Tabs**: each document has its own tab. A dot (●) next to the name means there are changes not yet written to the file.
5. **Editing area**: where you read and write.
6. **Bottom panel**: shows the results of searching in files. It opens by itself when you use the search.
7. **Status bar** (at the bottom): cursor line and column, file size, encoding, line ending type and the document's language.

## 3. Creating and opening files

![The New button with the arrow that lists the document types](img/s02-new-menu.png)

- **New document:** click **{{toolbar.new}}** or press **Ctrl+N**. A new document is Markdown (.md). Click the **arrow next to the button** to create another type: .md (Markdown), .txt (text), .py (Python) or .sql (SQL).
- **Open files:** **{{menu.file}} → {{menu.file.open}}** or **Ctrl+O**. You can pick several files at once. The limit is 50 MB per file.
- **Open a folder:** **{{menu.file}} → {{menu.file.openFolder}}** or **Ctrl+Shift+K**. The folder appears in the explorer on the sidebar, and a click on a file opens it. Use **{{menu.file.closeFolder}}** to close it.
- **Recent files:** the last files you used are listed under **Recent** on the sidebar. Click one to open it again.

If another program changes a file you have open, the application reloads it by itself. If you have changes of your own in that document that are not yet saved, it asks you first. If the file is deleted or moved, the tab name turns red and struck through.

![File menu](img/s07-menu-file.png)

## 4. Saving and temporary documents

- **{{menu.file.save}}** (**Ctrl+S**) writes the document to its file. For a new document, the application asks for a name and a location.
- **{{menu.file.saveAs}}** (**Ctrl+Shift+S**) writes a copy under another name or in another place.
- **{{menu.file.saveAll}}** writes every document that has changes.

**You do not lose what you typed.** A few seconds after each change, the application automatically keeps all open documents, including those that were never saved. This works whether or not you save.

When you **close the application**, it asks nothing and discards nothing. The next time you open it, your tabs, the folder and the unsaved text come back as they were. Save whenever you want to write to the actual file.

When you **close a tab** that has changes, the application asks whether to save, not save or cancel. Two notes: the undo history (Ctrl+Z) is not kept between sessions, and automatic recovery keeps up to 100 MB of unsaved text.

## 5. Editing text

![Invisible characters: spaces, tabs and line endings](img/s11-invisibles.png)

Editing commands are in **{{menu.edit}}** and display options are in **{{menu.view}}**.

- **Undo and redo:** Ctrl+Z and Ctrl+Y.
- **Find and replace** in the document: Ctrl+F and Ctrl+H. To jump to a line, use Ctrl+G.
- **Multiple cursors:** hold Alt and click wherever you want another cursor, or press Ctrl+D to select the next occurrence of the word.
- **{{menu.edit.columnSelection}}:** hold Shift+Alt and drag the mouse to edit several lines in the same column.
- **Lines:** Alt+↑ and Alt+↓ move the line; Shift+Alt+↑ and Shift+Alt+↓ duplicate it; Ctrl+/ comments or uncomments it.
- **Tidying up:** {{menu.edit.sortAsc}}, {{menu.edit.sortDesc}}, {{menu.edit.removeDuplicates}} and {{menu.edit.trimWhitespace}}.
- **{{menu.view.invisibles}}:** shows spaces (·), tabs (→) and the end of each line (¶). It is great for finding stray spaces.
- **{{menu.view.wordWrap}}** and **{{menu.view.foldAll}} / {{menu.view.unfoldAll}}** help you read long files.
- **Font size:** Ctrl++ makes it larger, Ctrl+- makes it smaller and Ctrl+0 restores the default.
- **Indentation:** in **{{menu.edit}}**, choose between spaces and tabs and the size (2, 4 or 8 columns).
- **{{menu.view.fullScreen}}** (F11, in **{{menu.view}}**): shows only the document, filling the whole screen. Press F11 again, or click the button in the top right corner, to leave.

Your display preferences are remembered for next time. The editor's own texts, such as the find box (Ctrl+F) and the command palette (F1), appear in English.

### Case, whitespace and line endings

![Edit menu with the Convert Case To submenu open](img/s20-menu-edit.png)

At the end of the **{{menu.edit}}** menu there are three submenus:

- **{{menu.edit.eol}}:** converts the document's line endings to Windows (CRLF), Unix (LF) or Mac (CR) format. A conversion marks the document as changed; just save for it to take effect.
- **{{menu.edit.case}}:** with some text selected, choose {{menu.edit.caseUpper}}, {{menu.edit.caseLower}} or {{menu.edit.caseSentence}} (only the first letter of each sentence is capitalized).
- **{{menu.edit.spaces}}:** {{menu.edit.trimRight}}, {{menu.edit.trimLeft}} and {{menu.edit.trimBoth}} apply to the cursor's line (or to the selected lines). {{menu.edit.collapseSpaces}} replaces two or more consecutive spaces with a single one in the whole document, without touching the indentation at the start of lines.

### MD5, SHA-1, SHA-256 and SHA-512

![Window that generates the SHA-256 of a text](img/s21-hash.png)

At the end of the **{{menu.tools}}** menu, each algorithm has two options:

- **{{menu.tools.hashGenerate}}:** opens a window; type or paste the text and the result appears right away, just below. **{{hash.copy}}** puts the result on the clipboard.
- **{{menu.tools.hashSelection}}:** computes the result from the text selected in the document and puts it on the clipboard, ready to paste. A notice appears in the status bar.

### Spell checker

![Underlined word and the suggested corrections](img/s11a-spelling.png)

In Markdown, text (.txt) and LaTeX documents, words that are not in the dictionary are underlined in red. Code, links, addresses, acronyms and text between backticks are not checked, and log and CSV files are left out.

- Place the cursor on the word and press **Ctrl+.** (or right-click and choose **{{spell.suggestions}}**) to see the suggestions. Pick one to replace the word.
- **{{spell.addToDictionary}}** makes the word accepted from then on, in every language.
- **{{menu.tools}} → {{menu.tools.spellCheck}}** (or **F7**) turns checking on and off.
- The checker uses the interface language. To check in another language, choose one of the **{{spell.source}}: Deutsch**, **{{spell.source}}: English**… options in **{{menu.tools}} → {{menu.tools.spellSubmenu}}** — there are German, Spanish, French, English, Brazilian Portuguese and European Portuguese dictionaries. **{{menu.tools.spellAuto}}** goes back to following the interface.

The dictionaries ship with the application, so the checker works offline.

## 6. Markdown

![Markdown document in editing mode, with the formatting toolbar](img/s03-markdown-edit.png)

Markdown files (.md) open **formatted**, and you can keep writing directly in the formatted text. The toolbar applies formatting at the cursor or to the selection: headings, bulleted list, numbered list, indent, **bold** (Ctrl+B), *italic* (Ctrl+I), ~~strikethrough~~ (Ctrl+Shift+X), link, table and clear formatting. Ctrl+Z and Ctrl+Y undo and redo.

To see and edit the Markdown source, click **{{toolbar.editText}}** (or press **Ctrl+Shift+E**); to go back to the formatted text, click **{{toolbar.preview}}**. The formatting toolbar works in both modes.

When you edit the formatted text, the Markdown is rewritten in a standard style (for example, lists with `-`). Documents that contain HTML are read-only in this mode so the HTML is not lost: edit them with **{{toolbar.editText}}**. To open a link in the browser, use Ctrl+click. Images appear as a label with their name, and their address is kept in the file.

## 7. JSON files

![A JSON file as a tree, with one item selected](img/s04-json-tree.png)

.json files open as a **tree**. Click an item's arrow to open or close that part. Use **{{menu.view.unfoldAll}}** and **{{menu.view.foldAll}}** to open or close everything. When you click an item, the bar shows its path, and you can copy the **{{json.path}}** or the **{{json.value}}**. Very large lists are shown a little at a time, with a button to show more.

To edit, click **{{toolbar.editText}}**. In editing mode, the **{{toolbar.formatJson}}** button (Shift+Alt+F) tidies up the file.

![Error message for invalid JSON, with line and column](img/s05-json-error.png)

If the file has an error, the application explains the problem and gives the line and column. The **{{json.editGoToError}}** button opens the editor right at the error.

## 8. Searching in files

![Search panel with results grouped by file](img/s06-search.png)

Open a folder and choose **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). The bottom panel opens.

1. Type the text and click **{{search.run}}** (or press Enter).
2. Fine-tune the search with the three buttons beside it: **{{search.caseSensitive}}**, **{{search.wholeWord}}** and **{{search.regex}}**.
3. To limit the files, write a filter such as `*.md, docs/**`.
4. Results appear grouped by file, with line and column. Click a result to open the file and select the match.

To replace the text, type the new text in the replacement field and click **{{search.replaceAll}}**. Untick the files that must not change. The application asks for confirmation, because **the replacement is written straight to the files and cannot be undone from the editor**. Open files with unsaved changes are skipped, so you do not lose work.

The search does not enter folders such as `node_modules` and `.git`, nor binary files or files larger than 5 MB. It shows at most 5,000 matches at a time.

## 9. Language, encoding and line endings

![Encoding menu](img/s09-menu-encoding.png)

- **{{menu.language}}:** the application picks the language from the file extension and uses colors to make reading easier. To change a document's language, open the menu and choose another one.

![Language menu](img/s10-menu-language.png)

- **{{menu.encoding}}:** convert the document to **UTF-8** or **UTF-8 with BOM**, and choose **Windows (CRLF)**, **Unix (LF)** or **Mac (CR)** line endings. A conversion marks the document as changed; just save for it to take effect.

The current encoding and line ending appear in the status bar.

## 10. Snippets and macros

![Snippets window](img/s12-snippets.png)

**Snippets** are ready-made pieces of text. Open **{{menu.tools}} → {{menu.tools.snippets}}**. The application already includes a few: `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` and `cabecalho`. To use one, type its shortcut in the editor and pick the suggestion (or press Ctrl+Space), or click **{{snippets.insert}}** in the window. To create your own, click **{{snippets.new}}** and give it a name, a shortcut and the text. In the text, `$1` and `${2:default}` mark the places where the cursor stops, and `$0` is the final position. The application's own snippets cannot be edited, but you can duplicate them.

![Macros window](img/s13-macros.png)

**Macros** repeat a sequence you performed. Press **Ctrl+Shift+R** to start recording, type or edit whatever you like, and press **Ctrl+Shift+R** again to stop. After that, **Ctrl+Shift+M** runs the last recording. In **{{menu.tools.macros}}** you choose how many times to repeat it and can save the macro with a name. What gets recorded: typed text, pasted text, the arrow keys, Home, End, Backspace, Delete, Tab, Enter and menu commands. Mouse clicks and Ctrl+Z are not recorded.

## 11. Account and cloud files

![First access: server address](img/s16a-account-server.png)

With an account you can keep files in the cloud and open them on other computers. Open the **{{menu.account}}** menu.

1. **Server address:** the first time, enter the address given to you by your company or administrator. It starts with `https://`.
2. **Create an account:** click **{{account.link.register}}** and fill in your email, name and a password of at least 10 characters.

![Sign-in screen](img/s16-account-login.png)

3. **Sign in:** use your email and password. If you forget the password, click **{{account.link.forgot}}**: you will receive a code by email and can choose a new password.

![User profile](img/s18-account-profile.png)

4. **Profile:** in **{{menu.account}}**, open your profile to change your name, change your password or sign out. When you change your password, your other computers have to sign in again.

![List of files in the cloud](img/s17-cloud-open.png)

5. **Save to the cloud:** **{{menu.file}} → {{menu.file.saveCloud}}**. Pick the path, for example `work/minutes.md`.
6. **Open from the cloud:** **{{menu.file}} → {{menu.file.openCloud}}**. In the list you can open or delete files. In a document opened from the cloud, **Ctrl+S** saves back to the cloud.

If the file has changed in the cloud since you last synced, the application warns you and asks whether to overwrite it. Each file can be up to 10 MB. If your system has no credential vault, the application warns you that you will need to sign in every time you open it.

## 12. Languages

![Language flags next to the preview button](img/s08-flags.png)

The application is available in **German, Spanish, French, English, Portuguese (Brazil) and Portuguese (Portugal)**. It opens in your system's language; if there is no translation, it opens in English. To switch, click the flag of the language, to the left of the preview button. The change is immediate and remembered for next time. This manual opens in the language currently in use.

## 13. Keyboard shortcuts

![Keyboard shortcuts window](img/s14-shortcuts.png)

To see the list inside the application, open **{{menu.help}} → {{menu.help.shortcuts}}**. The available shortcuts:

{{shortcuts}}

## 14. Frequently asked questions

**I closed the application without saving. Did I lose my text?**
No. Unsaved text is kept automatically and comes back when you open the application again.

**Why does Markdown open formatted and I cannot type?**
That is reading mode. Click **{{toolbar.editText}}** (or Ctrl+Shift+E) to edit.

**My JSON shows an error, but it opens in another program.**
The viewer follows the strict JSON standard: it does not accept a trailing comma, comments or single quotes. Use the error button to go straight to the problem.

**The file is large and will not open.**
The limit is 50 MB per file.

**I cannot sign in or save to the cloud.**
Check the server address and your internet connection. If the message says the session has expired, sign in again.

**How do I see the application version?**
In **{{menu.help}} → {{menu.help.about}}**.

## 15. About and support

![About window](img/s15-about.png)

![Help menu](img/s19-menu-help.png)

**Meu Editor de Arquivos** was developed by Diego Mendes Rodrigues. The **{{menu.help.support}}** item in the Help menu is not available in this version yet.
