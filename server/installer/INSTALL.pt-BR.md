# Instalação da API do Meu Editor de Arquivos

A API guarda as contas de usuário e os arquivos sincronizados na nuvem. O aplicativo conversa só com ela, nunca direto com o banco.

> **Protótipo.** Antes de qualquer uso real, peça a um profissional com experiência de entregas para revisar a arquitetura, os testes, os backups, o monitoramento e a LGPD.

## O que você precisa

- Debian 12/13, Ubuntu 22.04 ou mais novo, ou um derivado, com systemd.
- Node.js 22 LTS ou mais novo, com npm.
- MySQL 8+ ou MariaDB 10.6+.
- Um nome de domínio e um proxy reverso com HTTPS (por exemplo nginx com Let's Encrypt). Fora de `localhost`, o aplicativo não aceita `http://`.

## 1. Instalar o Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
node -v   # precisa ser v22 ou mais novo
```

## 2. Criar o banco

```bash
sudo apt install -y mariadb-server   # se ainda não houver um servidor de banco
sudo mysql
```

```sql
CREATE DATABASE meu_editor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'meu_editor'@'localhost' IDENTIFIED BY 'troque-por-uma-senha-forte';
GRANT ALL PRIVILEGES ON meu_editor.* TO 'meu_editor'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Instalar a API

Copie `meu-editor-api-<versão>.tar.gz` para o servidor e rode:

```bash
tar -xzf meu-editor-api-*.tar.gz
cd meu-editor-api-*/
sudo bash install.sh
```

Na primeira vez o instalador cria o arquivo de configuração e para. Edite-o:

```bash
sudo nano /etc/meu-editor-api/api.env
```

Coloque o endereço do banco em `DATABASE_URL`, por exemplo `mysql://meu_editor:SENHA@127.0.0.1:3306/meu_editor`. Se a senha tiver caracteres especiais (`@`, `:`, `/`, `#`), escreva-os codificados (`%40`, `%3A`, `%2F`, `%23`).

Depois aplique o esquema do banco e inicie o serviço:

```bash
sudo bash install.sh --migrate
```

O instalador:

- cria o usuário de sistema `meu-editor-api`;
- copia a API para `/opt/meu-editor-api` e instala só as dependências de produção;
- guarda a configuração em `/etc/meu-editor-api/api.env`, legível só pelo root e pelo serviço;
- registra e inicia o serviço systemd `meu-editor-api`, que escuta em `127.0.0.1:3000`.

## 4. Publicar com HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot certonly --nginx -d api.seudominio.com
sudo cp nginx-meu-editor-api.conf /etc/nginx/sites-available/meu-editor-api
sudo nano /etc/nginx/sites-available/meu-editor-api   # troque api.exemplo.com pelo seu domínio
sudo ln -s /etc/nginx/sites-available/meu-editor-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Mantenha `TRUST_PROXY=true` no `api.env` quando houver proxy na frente, para os limites de tentativas usarem o IP real de quem acessa.

## 5. Conferir

```bash
systemctl status meu-editor-api
journalctl -u meu-editor-api -f
```

No aplicativo, entre na conta pelo menu **Conta** e informe `https://api.seudominio.com` como endereço da API.

## Atualizar

Extraia o pacote da versão nova e rode `sudo bash install.sh --migrate`. A configuração é mantida e o esquema só cria o que falta.

## Remover

```bash
sudo bash uninstall.sh
```

A configuração em `/etc/meu-editor-api` e o banco não são apagados.

## Limitações atuais

- **E-mail simulado:** o código de recuperação de senha aparece só no log (`journalctl -u meu-editor-api`). Por isso a API não pode usar `NODE_ENV=production`: nesse modo ela se recusa a iniciar até haver um serviço de e-mail real ligado ao `Mailer` em `src/app.ts`.
- O limite de tentativas fica na memória: rode uma instância só.
- A camada MySQL ainda não foi testada contra um servidor real. Faça um teste completo (cadastro, login, sincronização) antes de abrir para usuários.
- Faça backup do banco com regularidade (por exemplo `mysqldump` agendado).

## Windows (só para testes)

Com Node.js 22+ instalado, extraia o `.zip` e, no PowerShell, dentro da pasta:

```powershell
npm ci --omit=dev
$env:DATABASE_URL = "mysql://meu_editor:SENHA@127.0.0.1:3306/meu_editor"
npm run migrate
npm start
```

Sem `DATABASE_URL`, a API guarda tudo na memória e os dados somem ao parar.
