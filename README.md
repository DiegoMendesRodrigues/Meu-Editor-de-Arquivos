<p align="center">
  <img src="build/icon.png" alt="Meu Editor de Arquivos" width="96" height="96">
</p>

<h1 align="center">Meu Editor de Arquivos</h1>

<p align="center">
  A lightweight desktop editor for Markdown, code, scripts, logs and configuration files.<br>
  Windows 11 · Debian · Ubuntu
</p>

<p align="center">
  <a href="https://meueditordearquivos.aplicativoia.online/?lang=en">Website</a> ·
  <a href="INSTALL.md">Installation</a> ·
  <a href="https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases">Download</a> ·
  <a href="README.pt-BR.md">Português (Brasil)</a>
</p>

---

## About Meu Editor de Arquivos

**Meu Editor de Arquivos** ("My File Editor") is a lightweight desktop editor for developers, system administrators, IT professionals and anyone who works with text files, scripts, logs and source code.

Markdown is the default document format. Markdown files open formatted and remain editable: the toolbar applies headings, lists, indentation, bold, italic, strikethrough, links and tables directly to the formatted text, and one click switches to the plain Markdown source. The application runs entirely offline, uses few resources compared with a full IDE, and its interface is available in six languages.

Current version: **1.0.0**.

## Features

**Editing**
- Monaco Editor (the editor engine behind VS Code), with syntax highlighting, code folding and autocomplete
- Multiple cursors, column (rectangular) selection and multi-line editing
- Tabs for many open documents, with change indicators
- Sort lines, remove duplicate lines and trim trailing spaces
- Show invisible characters (spaces, tabs and line endings)
- Go to line, word wrap and adjustable font size and indentation

**Markdown and JSON**
- Markdown opens formatted and can be edited in that view, with the formatting toolbar
- Markdown source editing with the same toolbar and shortcuts (Ctrl+B, Ctrl+I, Ctrl+Shift+X)
- JSON viewer with collapsible nodes and the error position for invalid JSON

**Search**
- Find and replace in the document, with regular expressions
- Search and replace across a folder, with file filters

**Languages and files**
- Python, C, C++, C#, Java, JavaScript, TypeScript, PHP, Go, Rust, PowerShell, Bash, Batch, Lua, HTML, CSS, XML, JSON, YAML, TOML, INI, SQL, CSV, LaTeX, Markdown, logs and more
- UTF-8 and UTF-8 with BOM, and conversion between Windows (CRLF) and Unix (LF) line endings
- Detects changes made to open files by other programs

**Productivity**
- Snippets and macros (record, replay and save)
- Spell checker in German, English, French, Brazilian Portuguese, European Portuguese and Spanish, working offline
- Automatic session recovery: tabs, folder and unsaved text come back when the application reopens
- Command palette and keyboard shortcuts

**Interface**
- Six interface languages: German, Spanish, French, English, Brazilian Portuguese and European Portuguese
- Built-in user manual in each language, with screenshots of the application
- Resizable, hideable sidebar and bottom panel
- Light theme

**Account and sync (optional)**
- Sign-up, profile and password change
- Saving files to a server to use the same files on several computers, through an API backed by MySQL or MariaDB

**Distribution**
- Windows installer and portable version (no installation)
- `.deb` package and AppImage for Debian, Ubuntu and derivatives

## Technologies

| Layer | Technology |
| --- | --- |
| Desktop runtime | [Electron](https://www.electronjs.org/) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Interface | [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide](https://lucide.dev/) icons |
| Code editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| Formatted Markdown editor | [Tiptap](https://tiptap.dev/) (ProseMirror) |
| Spell checker | [Hunspell](https://hunspell.github.io/) in WebAssembly ([hunspell-asm](https://github.com/kwonoj/hunspell-asm)) with the [wooorm/dictionaries](https://github.com/wooorm/dictionaries) dictionaries |
| State | [Zustand](https://zustand.docs.pmnd.rs/) |
| Panels | [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) |
| Validation | [Zod](https://zod.dev/) |
| Build | [Vite](https://vite.dev/) with [electron-vite](https://electron-vite.org/) |
| Packaging | [electron-builder](https://www.electron.build/) (NSIS, portable, DEB, AppImage) |
| Logs | [electron-log](https://github.com/megahertz/electron-log) |
| Tests | [Vitest](https://vitest.dev/) (unit) and [Playwright](https://playwright.dev/) (interface) |
| Account API | [Fastify](https://fastify.dev/) with [MySQL](https://www.mysql.com/) / [MariaDB](https://mariadb.org/) |

Security: the interface runs isolated (`contextIsolation`, `sandbox`, a strict Content Security Policy) and only reaches the operating system through a small preload API. Files can only be read or written after the user picks them or opens their folder.

## Installation

See **[INSTALL.md](INSTALL.md)** for installing the application (Windows and Linux) and for setting up the development environment.

## GitHub

- Repository: [github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos)
- Downloads: [Releases](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases)
- Bug reports and suggestions: [Issues](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/issues)
- Website: [meueditordearquivos.aplicativoia.online](https://meueditordearquivos.aplicativoia.online/?lang=en)
- License: [MIT](LICENSE)
- Contact: suporte@meueditordearquivos.aplicativoia.online

## Developer

Developed by **[Diego Mendes Rodrigues](https://www.linkedin.com/in/diegomendesrodrigues/)**.
