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

### Organizing from the sidebar

Right-click a folder or file in the sidebar, on the computer or in the cloud:

- **{{sidebar.rename}}** (folders and files): opens the **{{rename.folderTitle}}** or **{{rename.fileTitle}}** window with the current name. Type the new name and click **{{rename.submit}}**. The name cannot be empty or contain `\ / : * ? " < > |`. Open tabs of that file, or of the files inside the folder, switch to the new name.
- **{{sidebar.folderColor}}** (folders): opens the **{{folderColor.title}}** window with twelve colors, with the current one selected. Pick another and click **{{folderColor.submit}}**. Colors are kept on this computer.
- **{{common.delete}}** (folders): only available when the folder is empty.

The folder open in the explorer cannot be renamed or deleted from here.

Each file has an icon for its type: documents (.md, .txt, .tex), logs, programming, scripts, web, data and configuration (the same sections as the **+** button) and a generic icon for the rest.

The sidebar areas ({{sidebar.openDocs}}, {{sidebar.recent}}, the API client areas and the others) have a triangle to the left of the name: click it, or the name, to expand or collapse the area. To change the order, drag the area name up or down (with the keyboard, Alt+↑ and Alt+↓ with the name focused). The order and the collapsed areas are saved on this computer. To remove an area from the sidebar, click the X to the right of its name, or clear it under **{{menu.view.sidebarAreas}}** in the **{{menu.view}}** menu; select it again to bring it back where it was.

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
- **Multiple cursors:** hold Ctrl and click wherever you want another cursor, or press Ctrl+D to select the next occurrence of the word.
- **{{menu.edit.columnSelection}}:** hold Shift+Ctrl and drag the mouse to edit several lines in the same column.
- **Lines:** Alt+↑ and Alt+↓ move the line; Shift+Alt+↑ and Shift+Alt+↓ duplicate it; Ctrl+/ comments or uncomments it.
- **Tidying up:** {{menu.edit.sortAsc}}, {{menu.edit.sortDesc}}, {{menu.edit.removeDuplicates}} and {{menu.edit.trimWhitespace}}.
- **{{menu.view.invisibles}}:** shows spaces (·), tabs (→) and the end of each line (¶). It is great for finding stray spaces.
- **{{menu.view.wordWrap}}** and **{{menu.view.foldAll}} / {{menu.view.unfoldAll}}** help you read long files.
- **Font size:** Ctrl++ makes it larger, Ctrl+- makes it smaller and Ctrl+0 restores the default.
- **Indentation:** in **{{menu.edit}}**, choose between spaces and tabs and the size (2, 4 or 8 columns).
- **{{menu.view.fullScreen}}** (F11, in **{{menu.view}}**): shows only the document, filling the whole screen. Press F11 again, or click the button in the top right corner, to leave.
- **{{menu.view.toggleTheme}}** (in **{{menu.view}}**): switches between light and dark mode. Until you choose, the app follows the operating system theme; your choice is remembered for next time.

Your display preferences are remembered for next time. The editor's own texts, such as the find box (Ctrl+F) and the command palette (F1), appear in English.

![The app in dark mode](img/s22-dark-mode.png)

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

### Terminal

In **{{menu.tools}} → {{menu.tools.openTerminal}}**, a terminal opens right below the document, in your home folder: PowerShell on Windows and your shell (usually bash) on Linux. Type commands and see the results right there; the document stays open above, and you can drag the divider between them.

- Each click opens another terminal in its own tab (Terminal 1, Terminal 2…). The tab's **×** closes the terminal; so does the `exit` command.
- With text selected in the terminal, Ctrl+C copies it; with no selection, Ctrl+C interrupts the running command. Ctrl+V pastes.
- While the cursor is in the terminal, keys go to it (Ctrl+W, Ctrl+R…) instead of the app's shortcuts.
- Terminals do not come back the next time you open the app.

### Spell checker

![Underlined word and the suggested corrections](img/s11a-spelling.png)

In Markdown, text (.txt) and LaTeX documents, words that are not in the dictionary are underlined in red. Code, links, addresses, acronyms and text between backticks are not checked, and log and CSV files are left out.

- Place the cursor on the word and press **Ctrl+.** (or right-click and choose **{{spell.suggestions}}**) to see the suggestions. Pick one to replace the word.
- **{{spell.addToDictionary}}** makes the word accepted from then on, in every language.
- **{{menu.tools}} → {{menu.tools.spellCheck}}** (or **F7**) turns checking on and off.
- The checker uses the interface language. To check in another language, choose one of the **{{spell.source}}: Deutsch**, **{{spell.source}}: English**… options in **{{menu.tools}} → {{menu.tools.spellSubmenu}}** — there are German, Spanish, French, English, Brazilian Portuguese and European Portuguese dictionaries. **{{menu.tools.spellAuto}}** goes back to following the interface.

The dictionaries ship with the application, so the checker works offline.

### AI assistant (Ollama)

The **{{ai.title}}** uses an AI model that runs on your own computer through Ollama (ollama.com): nothing goes out to the internet. Open the panel with **{{menu.tools}} → {{menu.tools.ai}}** or **Ctrl+Shift+I**. If Ollama is not on the computer yet, the panel guides the installation: on Windows, **{{ai.install.button}}** downloads the official installer, checks its digital signature and opens its window for you to finish; on Linux, **{{ai.install.openTerminal}}** types the official command in the app's terminal for you to review and confirm (it needs sudo). If Ollama is stopped, use **{{ai.install.start}}**. Then pick a model in **{{ai.install.pullTitle}}** and follow the download; **{{ai.install.delete}}** frees up space.

- Pick the model, type your question and watch the answer as it is generated; **{{ai.stop}}** interrupts it and **{{ai.newChat}}** starts over.
- The **{{ai.quick.label}}** work on the selection (or the whole document): **{{ai.quick.explain}}**, **{{ai.quick.improve}}**, **{{ai.quick.fix}}**, **{{ai.quick.summarize}}**, **{{ai.quick.translate}}**, **{{ai.quick.document}}** and **{{ai.quick.tests}}**.
- In the answer's code blocks, use **{{ai.code.copy}}**, **{{ai.code.insert}}** or **{{ai.code.replace}}**.
- The conversation stays in memory only and is gone when you close the app. By default, the assistant only talks to an Ollama on this computer.

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

## 8. API Client

![API Client with a request sent and the response as a tree](img/s23-api-request.png)

The API Client lets you test web services (APIs): you build a request, send it and check the response without leaving the editor. Each request is a **.apireq** file that you can save, copy and version like any other file.

### Opening it

- Press **Ctrl+Shift+A**, or use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiClient}}**.
- Or use **{{menu.file}} → New API request (.apireq)**.

The document opens in the **{{apiClient.builder}}**. To see and edit the file as text (JSON), click **{{toolbar.editText}}**.

### Building the request

Choose the **{{apiClient.method}}** (GET, POST…) and type the address in **{{apiClient.url}}**. The details are in tabs:

- **{{apiClient.tab.params}}**: the query parameters. What you type in the URL appears here, and the other way round.
- **{{apiClient.tab.auth}}**: how to identify yourself to the service (see below).
- **{{apiClient.tab.headers}}**: the request headers.
- **{{apiClient.tab.body}}**: the content you send. In **{{apiClient.body.type}}** you choose JSON, XML, text, HTML, a form, a form with files, a binary file, GraphQL, SOAP or no body.
- **{{apiClient.tab.settings}}**: timeout, redirects, proxy, certificates and **{{apiClient.settings.verifyTls}}**. Turn the check off only in test environments.

In any field, use <code>&#123;&#123;name&#125;&#125;</code> to insert a variable from the active environment.

### Sending and reading the response

Click **{{apiClient.send}}** or press **Ctrl+Enter**. While the request is running, **Esc** cancels it. The arrow button next to it offers **{{apiClient.sendDownload}}**, which writes the body straight to a file (useful for large or binary responses).

The response shows the status, time and size, with the tabs **{{apiClient.response.tab.body}}**, **{{apiClient.response.tab.headers}}**, **{{apiClient.response.tab.cookies}}**, **{{apiClient.response.tab.tests}}** and **{{apiClient.response.tab.timings}}**. The body can be shown as **{{apiClient.response.view.tree}}** (to open and close parts of the JSON), **{{apiClient.response.view.pretty}}** or **{{apiClient.response.view.raw}}**. Use **{{apiClient.response.saveResponse}}** to keep the response in an .apiresp file, and **{{apiClient.response.openBody}}** to edit it as a regular document.

### Authorization

In the **{{apiClient.tab.auth}}** tab, pick the **{{apiClient.auth.type}}**: API Key, Basic Auth, Bearer Token, OAuth 1.0 or OAuth 2.0. OAuth 2.0 offers the **{{apiClient.oauth.flow.authorizationCode}}**, **{{apiClient.oauth.flow.clientCredentials}}**, **{{apiClient.oauth.flow.deviceCode}}** and **{{apiClient.oauth.flow.password}}** flows; click **{{apiClient.oauth.getToken}}** and, when needed, the system browser opens so you can authorize access. With **{{apiClient.auth.inherit}}**, the request uses the authorization set on the collection.

For passwords and tokens, use a secret variable (see "Environments and secrets"): that way the value is never written to the request file.

### Tests and extractions

In the **{{apiClient.tab.tests}}** tab:

- **{{apiClient.tests.assertions}}**: rules checked on every send, such as "status equals 200", "the body contains a text" or "the JSONPath exists". The result appears in the response's **{{apiClient.response.tab.tests}}** tab.
- **{{apiClient.tests.extractions}}**: store a value from the response (a token, for example) in an environment variable, to use in the next requests.

### Environments and secrets

![API environment with a regular and a secret variable](img/s24-api-environment.png)

An environment groups variables, such as the address of the test server and of production. Use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiEnvironments}}** to create one (an **.apienv** file) and pick the active one in the **{{apiClient.env.select}}** selector.

- Tick **{{apiClient.env.secret}}** on sensitive variables. The value is encrypted on this computer and **does not go into the .apienv file**.
- Tick **{{apiClient.env.production}}** on a production environment: the app asks for confirmation before sending POST, PUT, PATCH and DELETE.
- Received cookies are kept separately per environment; view or delete them in **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiCookies}}**.

### Collections and history

A collection is a folder with the requests and the **.apicol** file, which holds the shared authorization and variables. In the sidebar, the **{{apiClient.col.section}}** section lists the collections in your open folders; right-click to create requests and folders, **{{apiClient.col.run}}**, **{{apiClient.col.export}}**, **{{apiClient.col.document}}** (generates the collection's documentation) and **{{apiClient.col.settings}}**.

The **{{apiClient.history.section}}** (also under **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiHistory}}**) lists the latest requests you sent, and you can clear it whenever you like.

### Importing, exporting and generating code

- **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiImport}}** brings in requests from curl, Postman, OpenAPI/Swagger, Insomnia, HAR and .http files. Click **{{apiClient.import.analyze}}** to see what will be imported and choose **{{apiClient.import.asCollection}}** or **{{apiClient.import.openInTabs}}**. Pasting a curl command into the URL also offers to import it.
- **{{apiClient.col.export}}** saves the collection as Postman, OpenAPI, HAR, .http or curl. Values of secret variables are never exported.
- The **{{apiClient.code}}** button opens **{{apiClient.codegen.title}}** and shows the request in several languages, ready to copy.

### Running a collection

In **{{apiClient.col.run}}**, choose the requests, the environment, the number of iterations and the delay between them. A data file (CSV or JSON) repeats the run with the values of each row, and **{{apiClient.runner.stopOnFailure}}** stops at the first failure. Click **{{apiClient.runner.start}}**: the result opens as a report (**.apirun**) with totals, times and each request's tests. With **{{apiClient.report.export}}** the report can be saved as JUnit XML, HTML or Markdown.

### GraphQL

In **{{apiClient.body.type}}**, choose GraphQL to write the **{{apiClient.graphql.query}}** and the **{{apiClient.graphql.variables}}**. With **{{apiClient.graphql.loadSchema}}**, the app reads the server's schema, shows the documentation for the types and offers autocomplete.

When the selected operation is a **subscription**, the **{{apiClient.graphql.subscribe}}** button appears: the app opens a WebSocket (graphql-transport-ws protocol) to the request address and lists the events it receives below the editor. Click **{{apiClient.mock.stop}}** to end it.

### SOAP and WSDL

In **{{apiClient.body.type}}**, choose SOAP, the **{{apiClient.soap.version}}** (1.1 or 1.2) and the SOAPAction; **{{apiClient.soap.template}}** fills in an empty envelope. To create requests from a service, use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiImport}}** with the WSDL file: each operation becomes a request with a sample envelope. In tests and extractions, the XPath target reads XML responses (for example, <code>//*[local-name()='Result']</code>).

### WebSocket

Use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiWebSocket}}** to create a connection (a **.apiws** file). Type the **{{apiClient.ws.url}}** (ws:// or wss://), the headers and the subprotocols, then click **{{apiClient.ws.connect}}**. Write the message (text, JSON or base64 binary) and send it with **Ctrl+Enter**. The **{{apiClient.ws.log}}** shows sent and received messages with time and size; you can filter, pause and clear it. Use **{{apiClient.ws.saveMessage}}** to keep messages you send often.

### Mock server

A mock server answers in place of the real API, with responses you already know. In the response of a saved request, click **{{apiClient.response.saveExample}}**: the app stores the example next to the request. Then right-click the collection and choose **{{apiClient.col.mock}}** (or **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiMock}}**). Routes come from the saved examples or from an OpenAPI file; adjust each one's status and delay and click **{{apiClient.mock.start}}**. The server only answers on this computer unless you tick **{{apiClient.mock.lan}}**, and it stops by itself after 8 hours without calls.

### gRPC

Use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiGrpc}}** to create a call (a **.apigrpc** file). Enter the **{{apiClient.grpc.address}}**, tick **{{apiClient.grpc.tls}}** if the server requires it, and choose the **{{apiClient.grpc.source}}**: **{{apiClient.grpc.source.reflection}}** or **{{apiClient.grpc.source.proto}}**. Click **{{apiClient.grpc.load}}**, pick the service and method, and use **{{apiClient.grpc.useTemplate}}** to start the JSON message. Unary and server-streaming calls use **{{apiClient.grpc.invoke}}**; for client or bidirectional streaming, use **{{apiClient.grpc.start}}**, **{{apiClient.grpc.send}}** and **{{apiClient.grpc.end}}**. Messages, metadata and the status appear in the event list.

### Monitors

A monitor repeats a collection run every few minutes and sends a system notification when something fails (and again when it passes). Right-click the collection and choose **{{apiClient.col.monitor}}** (or **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiMonitor}}**), set the interval, environment and requests, and save. The chart shows each run's time, with failures in red; **{{apiClient.monitor.runNow}}** runs it right away. Monitors only run while the app is open and resume by themselves when you open it again.

### Scripts

In the **{{apiClient.tab.tests}}** tab, below the assertions, there are two optional JavaScript scripts: **{{apiClient.scripts.pre}}** (can change the URL, headers and body) and **{{apiClient.scripts.post}}** (can check the response with <code>test</code> and <code>expect</code> and keep values with <code>env.set</code>). The <code>pm</code> alias accepts the basics of Postman scripts. Scripts run isolated, with no network, files or access to the computer, and with time and memory limits; what they write with <code>console.log</code> appears in the response's **{{apiClient.scripts.console}}** block.

Scripts you did not write (imported or received from someone else) don't run by themselves: the request shows a notice with **{{apiClient.scripts.trustCollection}}**. Trust applies only on this computer and is dropped if the scripts change.

### AI in the API Client

In the response panel, **{{ai.api.explain}}** asks the assistant to explain the response and **{{ai.api.suggestTests}}** suggests assertions for the **{{apiClient.tab.tests}}** tab. Right-click a collection and choose **{{ai.api.document}}** to write its documentation. Authentication headers and secret values are not sent to the model.

In scripts, <code>pm.sendRequest</code> makes helper requests (for example, to fetch a token), with the same secret rules as normal requests and at most 10 per script.

### Security

- Every request leaves from your own computer, through the app; nothing goes through our servers.
- Passwords, tokens and secret values are kept in the operating system's vault (encrypted). If the system has no vault, they stay in memory only and are lost when you close the app.
- These values **never** go into files (.apireq, .apienv, .apicol), exports, generated code, logs or the cloud. History and cookies also stay on this computer only.
- Only the saved responses and reports of a collection can be synced to the cloud, and only if you turn on **{{apiClient.col.syncResponses}}**.

## 9. Searching in files

![Search panel with results grouped by file](img/s06-search.png)

Open a folder and choose **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). The bottom panel opens.

1. Type the text and click **{{search.run}}** (or press Enter).
2. Fine-tune the search with the three buttons beside it: **{{search.caseSensitive}}**, **{{search.wholeWord}}** and **{{search.regex}}**.
3. To limit the files, write a filter such as `*.md, docs/**`.
4. Results appear grouped by file, with line and column. Click a result to open the file and select the match.

To replace the text, type the new text in the replacement field and click **{{search.replaceAll}}**. Untick the files that must not change. The application asks for confirmation, because **the replacement is written straight to the files and cannot be undone from the editor**. Open files with unsaved changes are skipped, so you do not lose work.

The search does not enter folders such as `node_modules` and `.git`, nor binary files or files larger than 5 MB. It shows at most 5,000 matches at a time.

## 10. Language, encoding and line endings

![Encoding menu](img/s09-menu-encoding.png)

- **{{menu.language}}:** the application picks the language from the file extension and uses colors to make reading easier. To change a document's language, open the menu and choose another one.

![Language menu](img/s10-menu-language.png)

- **{{menu.encoding}}:** convert the document to **UTF-8** or **UTF-8 with BOM**, and choose **Windows (CRLF)**, **Unix (LF)** or **Mac (CR)** line endings. A conversion marks the document as changed; just save for it to take effect.
  - **{{menu.encoding.autoFormat}}** removes double spaces from the document (line indentation is kept) and formats it in the language's standard style: Python as Python (PEP 8), C and C++ in LLVM style, Java in Google style, C# in Microsoft style, Go with gofmt, and JavaScript, TypeScript, JSON, CSS, HTML, Markdown, YAML, PHP and XML with Prettier; Lua, Shell and SQL too. It works offline. For languages without a formatter (Rust, PowerShell, Batch, LaTeX, INI, TOML and text), only the double spaces are removed, and the status bar says so. If the code has a syntax error, a window shows the line of the error.
  - In Python, if the indentation is missing, it is guessed: after a line ending in `:` the block opens one level; `if`, `for`, `while`, `try` and `with` blocks take the next line; a `def` body runs until a blank line or a `return`. Check the result, because in Python indentation changes what the program does. Quotes stay as you wrote them. Note: double spaces inside quoted strings are removed too. Ctrl+Z undoes it all at once.
  - **{{menu.encoding.url}}** encodes the selected text in web address (URL) format (`my page` becomes `my%20page`); if the text is already encoded, it decodes it. In a full address (`https://…`), the `: / ? & = #` separators are kept.

The current encoding and line ending appear in the status bar.

## 11. Snippets and macros

![Snippets window](img/s12-snippets.png)

**Snippets** are ready-made pieces of text. Open **{{menu.tools}} → {{menu.tools.snippets}}**. The application already includes a few: `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` and `cabecalho`. To use one, type its shortcut in the editor and pick the suggestion (or press Ctrl+Space), or click **{{snippets.insert}}** in the window. To create your own, click **{{snippets.new}}** and give it a name, a shortcut and the text. In the text, `$1` and `${2:default}` mark the places where the cursor stops, and `$0` is the final position. The application's own snippets cannot be edited, but you can duplicate them.

![Macros window](img/s13-macros.png)

**Macros** repeat a sequence you performed. Press **Ctrl+Shift+R** to start recording, type or edit whatever you like, and press **Ctrl+Shift+R** again to stop. After that, **Ctrl+Shift+M** runs the last recording. In **{{menu.tools.macros}}** you choose how many times to repeat it and can save the macro with a name. What gets recorded: typed text, pasted text, the arrow keys, Home, End, Backspace, Delete, Tab, Enter and menu commands. Mouse clicks and Ctrl+Z are not recorded.

## 12. Account and cloud files

![First access: server address](img/s16a-account-server.png)

With an account you can keep files in the cloud and open them on other computers. Open the **{{menu.account}}** menu.

1. **Server address:** the first time, enter the address given to you by your company or administrator. It starts with `https://`.
2. **Create an account:** click **{{account.link.register}}**. The app opens the cloud plans page on the website, in the same language; choose a plan (Gratuito or paid) and enter your email, name and a password of at least 10 characters. Accounts are not created inside the app.

![Sign-in screen](img/s16-account-login.png)

3. **Sign in:** use your email and password. If you forget the password, click **{{account.link.forgot}}**: you will receive a code by email and can choose a new password.

![User profile](img/s18-account-profile.png)

4. **Profile:** in **{{menu.account}}**, open your profile to change your name, change your password or sign out. When you change your password, your other computers have to sign in again.

![List of files in the cloud](img/s17-cloud-open.png)

5. **Save to the cloud:** **{{menu.file}} → {{menu.file.saveCloud}}**. Pick the path, for example `work/minutes.md`.
6. **Open from the cloud:** **{{menu.file}} → {{menu.file.openCloud}}**. The top shows how many files you store, their total size and your plan's limits. Files are organized by folder, as in the sidebar, with the version, size and last-modified date in grey. Double-click a file to open it; drag files and folders to another folder (or to **{{cloud.root}}**), as in the sidebar, and right-click to **{{sidebar.rename}}**, **{{sidebar.folderColor}}** or **{{common.delete}}**. In a document opened from the cloud, **Ctrl+S** saves back to the cloud.

If the file has changed in the cloud since you last synced, the application warns you and asks whether to overwrite it. Each file can be up to 10 MB. If your system has no credential vault, the application warns you that you will need to sign in every time you open it.

While you are signed in, the status bar shows, to the left of the cloud icon, how many files you store and how much cloud space you use, in MB with two decimal places (for example, `Files: 3   Storage: 1.25 MB`). Each value turns orange at 90% of your plan's limit and red at 100%. At the file limit, the cloud accepts no new files; at the storage limit, it accepts no new files and no changes that increase the space used. In those cases the **{{cloud.limit.title}}** message appears and nothing is saved; updating a file without making it bigger is still allowed, and deleting files frees up the plan. It adds up all your files in the cloud and the text of documents not yet saved, which is kept so you can continue on another computer. The value changes with each save or deletion. A cloud file open without changes takes no extra space; only unsaved text is kept.

If the same document is changed on two computers before they sync, each computer keeps its own text, and the other version opens in a new tab with "(conflict – other computer)" in its name, so nothing is lost.

## 13. Languages

![Language flags next to the preview button](img/s08-flags.png)

The application is available in **German, Spanish, French, English, Portuguese (Brazil) and Portuguese (Portugal)**. It opens in your system's language; if there is no translation, it opens in English. To switch, click the flag of the language, to the left of the preview button. The change is immediate and remembered for next time. This manual opens in the language currently in use.

## 14. Keyboard shortcuts

![Keyboard shortcuts window](img/s14-shortcuts.png)

To see the list inside the application, open **{{menu.help}} → {{menu.help.shortcuts}}**. The available shortcuts:

{{shortcuts}}

## 15. Frequently asked questions

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

## 16. About and support

![About window](img/s15-about.png)

![Help menu](img/s19-menu-help.png)

**Meu Editor de Arquivos** was developed by Diego Mendes Rodrigues. The **{{menu.help.support}}** item in the Help menu is not available in this version yet.
