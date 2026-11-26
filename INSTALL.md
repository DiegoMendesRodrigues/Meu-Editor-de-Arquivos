# Installation

[Português (Brasil)](INSTALL.pt-BR.md)

This guide has three parts:

1. [Development environment](#1-development-environment): preparing a machine to work on the source code.
2. [Building and distributing the desktop application](#2-building-and-distributing-the-desktop-application): installers, portable version, Microsoft Store, `.deb` and AppImage.
3. [Account server](#3-account-server): the optional API for sign-up, cloud sync and plans.

If you only want to use the application, download it: Windows 11 from the [Microsoft Store](https://apps.microsoft.com/detail/9P9LZ413B1XL); Debian, Ubuntu and derivatives from the [Releases page](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases) (see [Installing a Linux package](#installing-a-linux-package)).

Supported systems: Windows 11 (64-bit), Debian 12 and 13, Ubuntu 22.04, 24.04 and later compatible versions, and distributions derived from Debian and Ubuntu.

---

## 1. Development environment

### Prerequisites

- [Node.js](https://nodejs.org/) 22 LTS or later (includes npm)
- [Git](https://git-scm.com/)
- Windows 11, or Debian/Ubuntu with a graphical desktop
- Native modules: the integrated terminal uses `node-pty`. On Windows it ships prebuilt binaries, so no compiler is normally needed. On Debian/Ubuntu there are no prebuilt binaries, so install the build tools first:

  ```bash
  sudo apt install build-essential python3 make g++
  ```

  The CI workflow also runs `npx @electron/rebuild --force --only node-pty` to compile it for Electron; do the same if the terminal fails to start in development on Linux.
- Python 3 with Pillow (`pip install pillow`), only to regenerate the Microsoft Store logos and screenshots (`npm run store:assets`)

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

The first time you run the interface tests, install the Playwright browser support if asked:

```bash
npx playwright install
```

### Project structure

| Folder | Contents |
| --- | --- |
| `src/main` | Electron main process: windows, files, dialogs, IPC, access control, terminal, formatting, API client and AI assistant |
| `src/preload` | The safe API exposed to the interface (`contextBridge`) |
| `src/renderer` | Interface in React + TypeScript: Monaco Editor, Tiptap, menus, tabs, panels, spell checker |
| `src/shared` | Code shared by the processes: IPC types, API client contract and schema, search and the six translations (`src/shared/i18n`) |
| `server` | Optional account and sync API (Fastify + MySQL/MariaDB) |
| `docs/manual` | User manual: sources in `docs/manual/src` and the generated HTML per language |
| `docs/store` | Microsoft Store material (see `docs/store/README.md`) |
| `e2e` | Interface tests (Playwright) |
| `scripts` | Scripts that capture screenshots, generate the manual and the Store assets |

### Conventions

- Every source file (`ts`, `tsx`, `css`, `html`, `sql`, `yml`) starts with the authorship comment:
  `Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/`
- Interface texts live in `src/shared/i18n/`. Brazilian Portuguese (`pt-BR.ts`) is the reference, and the other languages must have the same keys.
- After changing the interface or the manual, run `npm run manual`.

---

## 2. Building and distributing the desktop application

Packaging uses [electron-builder](https://www.electron.build/) (configuration in `electron-builder.yml`). Output goes to `dist/`.

| Command | Result |
| --- | --- |
| `npm run dist:win` | Windows installer (NSIS, `meu-editor-de-arquivos-setup-<version>-x64.exe`) and portable version (`meu-editor-de-arquivos-portable-<version>-x64.exe`) |
| `npm run dist:store` | Microsoft Store package (`appx`, x64 and arm64) |
| `npm run dist:linux` | `.deb` package and AppImage (run it on Linux) |

Each of these runs `npm run build` first.

### Windows

- **Installer:** run it and follow the steps; you can choose the installation folder. Screens follow the Windows language (English if it is not one of the six). To uninstall: Settings → Apps → Installed apps → Meu Editor de Arquivos → Uninstall.
- **Portable:** no installation; copy it to any folder or USB drive and run it.

> Windows SmartScreen may warn about an unrecognized application while the installers are not code-signed. Continue only if the file came from an official source.

### Microsoft Store

`npm run dist:store` builds the package. The identity values (`identityName`, `publisher`) in `electron-builder.yml` come from Partner Center (Product identity). The store page text and screenshots per language are in `docs/store/`; run `npm run manual` and then `npm run store:assets` to regenerate the logos and screenshots. The full guide is `docs/store/README.md`.

### Linux

On Debian/Ubuntu, building the `.deb` needs `sudo apt install fakeroot dpkg` (and `rpm` is optional). `node-pty` must be compiled for Electron first (`npx @electron/rebuild --force --only node-pty`), because `electron-builder.yml` turns off the automatic rebuild.

The GitHub Actions workflow `.github/workflows/release-linux.yml` does all of this on Ubuntu 22.04 (Node 22, `npm ci`, `npm test`, rebuild of `node-pty`, `electron-builder --linux --publish never`). It runs when a release is published, or manually from Actions → Run workflow, and attaches the `.deb`, the AppImage and `latest-linux.yml` to the release.

#### Installing a Linux package

```bash
sudo apt install ./meu-editor-de-arquivos_<version>_amd64.deb
sudo apt remove meu-editor-de-arquivos      # to uninstall
```

AppImage (no installation):

```bash
chmod +x Meu-Editor-de-Arquivos-<version>.AppImage
./Meu-Editor-de-Arquivos-<version>.AppImage
```

On recent Ubuntu versions, AppImages may need `libfuse2` (`libfuse2t64` on Ubuntu 24.04).

### Pointing the application to the account server

The application does not have a built-in server address. In **Account → Sign In or Create Account...**, enter the address of the API (for example `https://api.yourdomain.com`, or `http://localhost:3000` while testing). The application refuses `http://` addresses other than localhost.

### Where the application keeps its data

- Windows: `%APPDATA%\Meu Editor de Arquivos`
- Linux: `~/.config/Meu Editor de Arquivos`

It holds the session, preferences, logs, the secrets vault of the API client and the AI settings. Your documents are always saved where you choose. Everything works offline, including the spell checker and the local AI assistant (which needs [Ollama](https://ollama.com/), installable from the assistant panel).

---

## 3. Account server

Sign-up, profile, password recovery, cloud sync and plans go through a small API (in `server/`, Fastify) that sits between the application and the SQL database. The application never receives database credentials.

> The server is a prototype. Before any real use, have it reviewed (architecture, functional and non-functional tests, backups, monitoring and data protection law compliance). The MySQL layer has not yet been tested against a real server in the project's own documentation, so run a full test (sign-up, sign-in, sync) before opening it to users.

### Requirements

- Node.js 22 or later
- **MySQL 8+ or MariaDB 10.6+**, with an empty `utf8mb4` database. PostgreSQL is not supported by the code (it uses the `mysql2` driver only).
- For production: a domain, an HTTPS reverse proxy (Nginx, Caddy) and an SMTP account

### Running in development

```bash
cd server
npm install
npm run dev          # in-memory data, listens on 127.0.0.1:3000, restarts on changes
```

Without `DATABASE_URL`, the server keeps data **in memory** (testing only; data is lost when it stops), and the password-reset code is printed to the console instead of being e-mailed.

To use a real database:

```bash
# Linux/macOS
export DATABASE_URL="mysql://user:password@localhost:3306/database"
# PowerShell
$env:DATABASE_URL = "mysql://user:password@localhost:3306/database"
npm run migrate
npm start
```

Tests: `npm test` (API against the in-memory store) and `npm run typecheck`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | MySQL/MariaDB connection, `mysql://user:password@host:3306/database` (percent-encode special characters in the password). Without it, in-memory storage is used |
| `HOST` / `PORT` | Listening address (default `127.0.0.1:3000`) |
| `TRUST_PROXY` | Trusted reverse proxy, so rate limits use the real client IP: number of proxies in front (e.g. `1`, the safest), a comma-separated list of proxy IPs/CIDRs, or `true` (trusts every hop; only safe if the proxy replaces `X-Forwarded-For`) |
| `MEA_DEV` | `true` prints the password-reset code to the console when SMTP is not configured (development only) |
| `NODE_ENV` | `production` requires `DATABASE_URL` and SMTP (the API does not start without them) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Real e-mail for password recovery (port 465 uses direct TLS; other ports require STARTTLS; `SMTP_PORT` defaults to 465 and `SMTP_FROM` to `SMTP_USER`) |
| `AUTO_MIGRATE` | `true` applies the schema when the server starts (useful on hosting without a shell) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | When all three are set during `npm run migrate` (or with `AUTO_MIGRATE=true`), an administrator row is created or updated by e-mail. The administrator password is stored as plain SHA-256 without salt, which is weak; prefer a strong password and treat it as a known limitation |

### Database, migration and plans

```bash
cd server
npm run migrate      # idempotent: creates missing tables and adds missing columns to an existing database
```

The schema (`server/src/db/schema.sql`) has the tables `admins`, `users_groups`, `users`, `sessions`, `password_resets`, `files`, `folders` and `workspaces`.

- **Plans:** `users_groups` defines the limits `max_files` and `max_size_mb`. Group id 1, "Gratuito" (Free), with 100 files and 5 MB, is created automatically and is the plan of every user, through `users.users_groups_id`. `users.stored_files`, `users.storage_bytes` and `users.last_access` are maintained by the server. To change a user's limits, edit the group or move the user to another group in SQL.
- **phpMyAdmin:** for an already existing database, paste `server/src/db/migrations/2026-11-planos.sql` into the SQL tab (or run it in the `mysql` client). It is equivalent to `npm run migrate`; the `ALTER TABLE` commands run once, so if the server reports that a column or key already exists (errors 1060, 1061 or 1826), skip that command.

### Production

- Publish the API **only behind HTTPS** (reverse proxy) and set `TRUST_PROXY` (for example `1` behind a single proxy).
- Set `NODE_ENV=production`, `DATABASE_URL` and the `SMTP_*` variables. Keep them in a protected configuration (never in the repository).
- Make regular database backups (for example a scheduled `mysqldump`).
- Rate limits are kept in memory: run a single instance.

Build the deploy package:

```bash
cd server
npm run package      # creates release/meu-editor-api-<version>.tar.gz and .zip
```

The package has the compiled JavaScript, a production-only `package.json` (`npm start` runs `node server.js`; `npm run migrate` runs `node dist/migrate.js`), `server.js` and `server.cjs` entry files, `api.env.example`, an nginx example with HTTPS, the Debian/Ubuntu installer (`install.sh`, systemd service) and its own detailed instructions (`INSTALL.md`, `INSTALL.pt-BR.md` inside the package).

- **Debian/Ubuntu VPS:** extract the package, run `sudo bash install.sh`, edit `/etc/meu-editor-api/api.env`, then `sudo bash install.sh --migrate`. The service `meu-editor-api` listens on `127.0.0.1:3000`; put Nginx with HTTPS in front of it.
- **Node.js hosting (control panel):** upload the package, use `server.js` as the entry file, run `npm ci --omit=dev`, set the environment variables above in the panel (and `AUTO_MIGRATE=true` if there is no shell), and make sure the site is served over HTTPS.
- **Windows (testing only):** extract the `.zip` and, inside the folder, run `npm ci --omit=dev`, set `DATABASE_URL`, `npm run migrate` and `npm start`.
