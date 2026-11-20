# Installation

[Português (Brasil)](INSTALL.pt-BR.md)

This guide covers two scenarios:

1. [Production](#1-production-installing-the-application): installing the application to use it.
2. [Development](#2-development-environment): preparing a machine to work on the source code.

The optional [account server](#3-optional-account-and-sync-server) (sign-up and file sync) is described at the end.

---

## 1. Production: installing the application

### Supported systems

- Windows 11 (64-bit)
- Debian 12 and 13
- Ubuntu 22.04, 24.04 and later compatible versions
- Distributions derived from Debian and Ubuntu

### Windows 11

Download the latest version from the [Releases page](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases):

- **Installer** (`meu-editor-de-arquivos-<version>-x64.exe`): run it and follow the steps. You can choose the installation folder. The application is added to the Start menu.
- **Portable** (the portable `.exe`): no installation required. Copy it to any folder or USB drive and run it.

> Windows SmartScreen may warn about an unrecognized application while the installers are not code-signed. Choose **More info → Run anyway** only if you downloaded the file from the official Releases page.

To uninstall the installed version, use **Settings → Apps → Installed apps → Meu Editor de Arquivos → Uninstall**.

### Debian, Ubuntu and derivatives

Download the `.deb` package from the [Releases page](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases) and install it:

```bash
sudo apt install ./meu-editor-de-arquivos_<version>_amd64.deb
```

`apt` also installs the required system libraries. To uninstall:

```bash
sudo apt remove meu-editor-de-arquivos
```

**AppImage (no installation):** download the `.AppImage` file, make it executable and run it:

```bash
chmod +x Meu-Editor-de-Arquivos-<version>.AppImage
./Meu-Editor-de-Arquivos-<version>.AppImage
```

On recent Ubuntu versions, AppImages may need the `libfuse2` package (`sudo apt install libfuse2`, or `libfuse2t64` on Ubuntu 24.04).

### Where the application keeps its data

The session (open tabs, unsaved text, preferences) and logs are kept in the user's data folder:

- Windows: `%APPDATA%\Meu Editor de Arquivos`
- Linux: `~/.config/Meu Editor de Arquivos`

Your documents are always saved where you choose. Everything works offline, including the spell checker.

---

## 2. Development environment

### Requirements

- [Node.js](https://nodejs.org/) 22 LTS or later (includes npm)
- [Git](https://git-scm.com/)
- Windows 11, or Debian/Ubuntu with a graphical desktop
- On Linux, to build the `.deb` package: `sudo apt install fakeroot dpkg rpm` (rpm is optional)

### Getting the code

```bash
git clone https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos.git
cd Meu-Editor-de-Arquivos
npm install
```

### Main commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the application in development mode, with hot reload |
| `npm run typecheck` | Checks the TypeScript types (main, preload and renderer) |
| `npm test` | Runs the unit tests (Vitest) |
| `npm run test:e2e` | Builds the application and runs the interface tests (Playwright) |
| `npm run build` | Checks the types and builds the application into `out/` |
| `npm run manual` | Builds the application, captures the screenshots and generates the user manual in the six languages (`docs/manual/<language>/`) |
| `npm run dist:win` | Builds the Windows installer and portable version into `dist/` |
| `npm run dist:linux` | Builds the `.deb` package and the AppImage into `dist/` (run it on Linux) |

The first time you run the interface tests, install the Playwright browser support if asked:

```bash
npx playwright install
```

### Project structure

| Folder | Contents |
| --- | --- |
| `src/main` | Electron main process: windows, files, dialogs, IPC and access control |
| `src/preload` | The safe API exposed to the interface (`contextBridge`) |
| `src/renderer` | Interface in React + TypeScript: Monaco Editor, menus, tabs, panels, spell checker |
| `src/shared` | Code shared by the processes: IPC types, search and the six translations (`src/shared/i18n`) |
| `server` | Optional account and sync API (Fastify + MySQL/MariaDB) |
| `docs/manual` | User manual: sources in `docs/manual/src` and the generated HTML per language |
| `e2e` | Interface tests (Playwright) |
| `scripts` | Scripts that capture screenshots and generate the manual |

### Conventions

- Every source file (`ts`, `tsx`, `css`, `html`, `sql`, `yml`) starts with the authorship comment:
  `Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/`
- Interface texts live in `src/shared/i18n/`. Brazilian Portuguese (`pt-BR.ts`) is the reference, and the other languages must have the same keys (the build fails otherwise).
- After changing the interface or the manual, run `npm run manual`.

---

## 3. Optional: account and sync server

Sign-up, profile and file sync go through a small API (in `server/`) that sits between the application and the SQL database. The application never receives database credentials.

```bash
cd server
npm install
# Create an empty database (utf8mb4) and apply the schema
export DATABASE_URL="mysql://user:password@localhost:3306/meu_editor"   # PowerShell: $env:DATABASE_URL = "..."
npm run migrate
npm start            # listens on 127.0.0.1:3000 (HOST and PORT can be changed)
```

Without `DATABASE_URL`, the server keeps data in memory (for testing only; data is lost when it stops).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL/MariaDB connection, e.g. `mysql://user:password@host:3306/database` |
| `HOST` / `PORT` | Listening address (default `127.0.0.1:3000`) |
| `TRUST_PROXY` | `true` when running behind a trusted reverse proxy |
| `NODE_ENV` | `production` requires `DATABASE_URL` and a real e-mail service |

In production:

- Publish the API **only behind HTTPS** (reverse proxy such as Nginx or Caddy) and set `TRUST_PROXY=true`. The application refuses `http://` addresses other than localhost.
- Replace the simulated e-mail sender in `server/src/index.ts` with a real e-mail service. The server refuses to start in production while the simulated sender is in use.

In the application, open **Account → Sign In or Create Account...** and enter the API address.

> The server is a prototype. Before any real use, have it reviewed (architecture, functional and non-functional tests, backups, monitoring and data protection law compliance).
