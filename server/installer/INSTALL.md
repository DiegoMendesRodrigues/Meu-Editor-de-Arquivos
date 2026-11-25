# Installing the Meu Editor de Arquivos API

The API stores user accounts and the files synced to the cloud. The app talks only to the API, never directly to the database.

> **Prototype.** Before any real use, have an experienced delivery professional review the architecture, tests, backups, monitoring and data-protection compliance.

## Requirements

- Debian 12/13, Ubuntu 22.04 or newer, or a derivative, with systemd.
- Node.js 22 LTS or newer, with npm.
- MySQL 8+ or MariaDB 10.6+.
- A domain name and an HTTPS reverse proxy (for example nginx with Let's Encrypt). Outside `localhost`, the app refuses `http://`.

## 1. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
node -v   # must be v22 or newer
```

## 2. Create the database

```bash
sudo apt install -y mariadb-server   # if there is no database server yet
sudo mysql
```

```sql
CREATE DATABASE meu_editor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'meu_editor'@'localhost' IDENTIFIED BY 'change-to-a-strong-password';
GRANT ALL PRIVILEGES ON meu_editor.* TO 'meu_editor'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Install the API

Copy `meu-editor-api-<version>.tar.gz` to the server and run:

```bash
tar -xzf meu-editor-api-*.tar.gz
cd meu-editor-api-*/
sudo bash install.sh
```

The first run creates the configuration file and stops. Edit it:

```bash
sudo nano /etc/meu-editor-api/api.env
```

Set `DATABASE_URL`, for example `mysql://meu_editor:PASSWORD@127.0.0.1:3306/meu_editor`. Percent-encode special characters in the password (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`).

Then apply the database schema and start the service:

```bash
sudo bash install.sh --migrate
```

The installer:

- creates the `meu-editor-api` system user;
- copies the API to `/opt/meu-editor-api` and installs production dependencies only;
- keeps the configuration in `/etc/meu-editor-api/api.env`, readable only by root and the service;
- registers and starts the `meu-editor-api` systemd service, listening on `127.0.0.1:3000`.

## 4. Publish over HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot certonly --nginx -d api.yourdomain.com
sudo cp nginx-meu-editor-api.conf /etc/nginx/sites-available/meu-editor-api
sudo nano /etc/nginx/sites-available/meu-editor-api   # replace api.exemplo.com with your domain
sudo ln -s /etc/nginx/sites-available/meu-editor-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Keep `TRUST_PROXY=1` in `api.env` behind the nginx proxy (one proxy hop), so rate limits use the client's real IP. Use `true` only if every proxy in front replaces `X-Forwarded-For`.

## 5. Check

```bash
systemctl status meu-editor-api
journalctl -u meu-editor-api -f
```

In the app, sign in from the **Account** menu and enter `https://api.yourdomain.com` as the API address.

## Updating

Extract the new package and run `sudo bash install.sh --migrate`. The configuration is kept and the schema only creates what is missing.

## Uninstalling

```bash
sudo bash uninstall.sh
```

The configuration in `/etc/meu-editor-api` and the database are not deleted.

## Current limitations

- **E-mail:** configure `SMTP_*` in `api.env` for password resets. Without SMTP no e-mail is sent, and the reset code is only printed to the console when `MEA_DEV=true` (development). With `NODE_ENV=production` the API refuses to start without SMTP and `DATABASE_URL`.
- Rate limiting is in memory: run a single instance.
- The MySQL layer has not yet been tested against a real server. Run a full test (sign-up, sign-in, sync) before opening it to users.
- Back up the database regularly (for example a scheduled `mysqldump`).

## Windows (testing only)

With Node.js 22+ installed, extract the `.zip` and, in PowerShell, inside the folder:

```powershell
npm ci --omit=dev
$env:DATABASE_URL = "mysql://meu_editor:PASSWORD@127.0.0.1:3306/meu_editor"
npm run migrate
npm start
```

Without `DATABASE_URL`, the API keeps everything in memory and data is lost when it stops.
