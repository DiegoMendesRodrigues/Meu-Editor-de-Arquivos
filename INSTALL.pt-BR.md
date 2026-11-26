# Instalação

[English](INSTALL.md)

Este guia tem três partes:

1. [Ambiente de desenvolvimento](#1-ambiente-de-desenvolvimento): preparar uma máquina para trabalhar no código-fonte.
2. [Geração e distribuição do aplicativo desktop](#2-geração-e-distribuição-do-aplicativo-desktop): instaladores, versão portátil, Microsoft Store, `.deb` e AppImage.
3. [Servidor de contas](#3-servidor-de-contas): a API opcional de cadastro, sincronização na nuvem e planos.

Se você só quer usar o aplicativo, baixe-o: Windows 11 pela [Microsoft Store](https://apps.microsoft.com/detail/9P9LZ413B1XL); Debian, Ubuntu e derivadas pela [página de Releases](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases) (veja [Instalar um pacote Linux](#instalar-um-pacote-linux)).

Sistemas compatíveis: Windows 11 (64 bits), Debian 12 e 13, Ubuntu 22.04, 24.04 e versões posteriores compatíveis, e distribuições derivadas do Debian e do Ubuntu.

---

## 1. Ambiente de desenvolvimento

### Pré-requisitos

- [Node.js](https://nodejs.org/) 22 LTS ou superior (inclui o npm)
- [Git](https://git-scm.com/)
- Windows 11, ou Debian/Ubuntu com ambiente gráfico
- Módulos nativos: o terminal integrado usa o `node-pty`. No Windows ele já traz binários prontos, então normalmente não é preciso compilador. No Debian/Ubuntu não há binários prontos; instale antes as ferramentas de compilação:

  ```bash
  sudo apt install build-essential python3 make g++
  ```

  O fluxo de CI também roda `npx @electron/rebuild --force --only node-pty` para compilá-lo para o Electron; faça o mesmo se o terminal não abrir no desenvolvimento em Linux.
- Python 3 com Pillow (`pip install pillow`), só para gerar de novo os logotipos e telas da Microsoft Store (`npm run store:assets`)

### Obter o código

```bash
git clone https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos.git
cd Meu-Editor-de-Arquivos
npm install
```

### Principais comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Inicia o aplicativo em modo de desenvolvimento, com recarga automática |
| `npm run typecheck` | Confere os tipos do TypeScript (main, preload e renderer) |
| `npm test` | Roda os testes unitários (Vitest) |
| `npm run test:e2e` | Compila o aplicativo e roda os testes de interface (Playwright) |
| `npm run build` | Confere os tipos e compila o aplicativo em `out/` |
| `npm run manual` | Compila o aplicativo, captura as telas e gera o manual do usuário nos seis idiomas (`docs/manual/<idioma>/`) |

Na primeira vez que rodar os testes de interface, instale o suporte aos navegadores do Playwright se for solicitado:

```bash
npx playwright install
```

### Estrutura do projeto

| Pasta | Conteúdo |
| --- | --- |
| `src/main` | Processo principal do Electron: janelas, arquivos, diálogos, IPC, controle de acesso, terminal, formatação, Cliente de API e assistente de IA |
| `src/preload` | A API segura exposta à interface (`contextBridge`) |
| `src/renderer` | Interface em React + TypeScript: Monaco Editor, Tiptap, menus, abas, painéis, corretor ortográfico |
| `src/shared` | Código compartilhado entre os processos: tipos de IPC, contrato e esquema do Cliente de API, busca e as seis traduções (`src/shared/i18n`) |
| `server` | API opcional de contas e sincronização (Fastify + MySQL/MariaDB) |
| `docs/manual` | Manual do usuário: fontes em `docs/manual/src` e o HTML gerado por idioma |
| `docs/store` | Material da Microsoft Store (veja `docs/store/README.md`) |
| `e2e` | Testes de interface (Playwright) |
| `scripts` | Scripts que capturam telas, geram o manual e os arquivos da Store |

### Convenções

- Todo arquivo de código-fonte (`ts`, `tsx`, `css`, `html`, `sql`, `yml`) começa com o comentário de autoria:
  `Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/`
- Os textos da interface ficam em `src/shared/i18n/`. O português do Brasil (`pt-BR.ts`) é a referência, e os outros idiomas precisam ter as mesmas chaves.
- Depois de mudar a interface ou o manual, rode `npm run manual`.

---

## 2. Geração e distribuição do aplicativo desktop

O empacotamento usa o [electron-builder](https://www.electron.build/) (configuração em `electron-builder.yml`). A saída vai para `dist/`.

| Comando | Resultado |
| --- | --- |
| `npm run dist:win` | Instalador do Windows (NSIS, `meu-editor-de-arquivos-setup-<versão>-x64.exe`) e versão portátil (`meu-editor-de-arquivos-portable-<versão>-x64.exe`) |
| `npm run dist:store` | Pacote da Microsoft Store (`appx`, x64 e arm64) |
| `npm run dist:linux` | Pacote `.deb` e AppImage (rode no Linux) |

Todos eles rodam `npm run build` antes.

### Windows

- **Instalador:** execute e siga os passos; é possível escolher a pasta de instalação. As telas seguem o idioma do Windows (inglês se não for um dos seis). Para desinstalar: Configurações → Aplicativos → Aplicativos instalados → Meu Editor de Arquivos → Desinstalar.
- **Portátil:** sem instalação; copie para qualquer pasta ou pendrive e execute.

> O Windows SmartScreen pode avisar sobre um aplicativo não reconhecido enquanto os instaladores não forem assinados. Continue só se o arquivo veio de uma fonte oficial.

### Microsoft Store

`npm run dist:store` gera o pacote. Os valores de identidade (`identityName`, `publisher`) no `electron-builder.yml` vêm do Partner Center (Identidade do produto). Os textos da página da loja e as telas por idioma ficam em `docs/store/`; rode `npm run manual` e depois `npm run store:assets` para gerar de novo os logotipos e telas. O guia completo é `docs/store/README.md`.

### Linux

No Debian/Ubuntu, gerar o `.deb` exige `sudo apt install fakeroot dpkg` (e `rpm` é opcional). O `node-pty` precisa ser compilado antes para o Electron (`npx @electron/rebuild --force --only node-pty`), porque o `electron-builder.yml` desliga a recompilação automática.

O fluxo do GitHub Actions `.github/workflows/release-linux.yml` faz tudo isso num Ubuntu 22.04 (Node 22, `npm ci`, `npm test`, recompilação do `node-pty`, `electron-builder --linux --publish never`). Ele roda quando um release é publicado, ou manualmente em Actions → Run workflow, e anexa ao release o `.deb`, o AppImage e o `latest-linux.yml`.

#### Instalar um pacote Linux

```bash
sudo apt install ./meu-editor-de-arquivos_<versão>_amd64.deb
sudo apt remove meu-editor-de-arquivos      # para desinstalar
```

AppImage (sem instalação):

```bash
chmod +x Meu-Editor-de-Arquivos-<versão>.AppImage
./Meu-Editor-de-Arquivos-<versão>.AppImage
```

Em versões recentes do Ubuntu, o AppImage pode precisar do `libfuse2` (`libfuse2t64` no Ubuntu 24.04).

### Apontar o aplicativo para o servidor de contas

O aplicativo não traz um endereço de servidor embutido. Em **Conta → Entrar ou criar conta...**, informe o endereço da API (por exemplo `https://api.seudominio.com`, ou `http://localhost:3000` em testes). O aplicativo recusa endereços `http://` fora de localhost.

### Onde o aplicativo guarda seus dados

- Windows: `%APPDATA%\Meu Editor de Arquivos`
- Linux: `~/.config/Meu Editor de Arquivos`

Ali ficam a sessão, as preferências, os logs, o cofre de segredos do Cliente de API e as configurações da IA. Seus documentos são sempre salvos onde você escolher. Tudo funciona sem internet, inclusive o corretor ortográfico e o assistente de IA local (que precisa do [Ollama](https://ollama.com/), instalável pelo painel do assistente).

---

## 3. Servidor de contas

Cadastro, perfil, recuperação de senha, sincronização na nuvem e planos passam por uma pequena API (em `server/`, Fastify) que fica entre o aplicativo e o banco SQL. O aplicativo nunca recebe credenciais do banco.

> O servidor é um protótipo. Antes de qualquer uso real, faça uma revisão (arquitetura, testes funcionais e não funcionais, backups, monitoramento e conformidade com a LGPD). A camada MySQL ainda não foi testada contra um servidor real, segundo a própria documentação do projeto; faça um teste completo (cadastro, login, sincronização) antes de abrir para usuários.

### Requisitos

- Node.js 22 ou superior
- **MySQL 8+ ou MariaDB 10.6+**, com um banco `utf8mb4` vazio. O PostgreSQL não é suportado pelo código (ele usa só o driver `mysql2`).
- Para produção: um domínio, um proxy reverso com HTTPS (Nginx, Caddy) e uma conta SMTP

### Executar em desenvolvimento

```bash
cd server
npm install
npm run dev          # dados em memória, escuta em 127.0.0.1:3000, reinicia ao alterar o código
```

Sem `DATABASE_URL`, o servidor guarda os dados **em memória** (só para testes; somem ao parar), e o código de redefinição de senha aparece no console em vez de ser enviado por e-mail.

Para usar um banco real:

```bash
# Linux/macOS
export DATABASE_URL="mysql://usuario:senha@localhost:3306/banco"
# PowerShell
$env:DATABASE_URL = "mysql://usuario:senha@localhost:3306/banco"
npm run migrate
npm start
```

Testes: `npm test` (API contra o armazenamento em memória) e `npm run typecheck`.

### Variáveis de ambiente

| Variável | Finalidade |
| --- | --- |
| `DATABASE_URL` | Conexão MySQL/MariaDB, `mysql://usuario:senha@host:3306/banco` (codifique com `%` os caracteres especiais da senha). Sem ela, usa armazenamento em memória |
| `HOST` / `PORT` | Endereço de escuta (padrão `127.0.0.1:3000`) |
| `TRUST_PROXY` | Proxy reverso de confiança, para os limites usarem o IP real do cliente: número de proxies na frente (ex.: `1`, o mais seguro), lista de IPs/CIDRs dos proxies separados por vírgula, ou `true` (confia em todos; só é seguro se o proxy substituir o `X-Forwarded-For`) |
| `MEA_DEV` | `true` mostra no console o código de redefinição de senha quando não há SMTP (só desenvolvimento) |
| `NODE_ENV` | `production` exige `DATABASE_URL` e SMTP (a API não inicia sem eles) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | E-mail real para a recuperação de senha (a porta 465 usa TLS direto; as demais exigem STARTTLS; `SMTP_PORT` vale 465 por padrão e `SMTP_FROM` vale `SMTP_USER`) |
| `AUTO_MIGRATE` | `true` aplica o esquema ao iniciar o servidor (útil em hospedagem sem shell) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Com os três definidos durante o `npm run migrate` (ou com `AUTO_MIGRATE=true`), uma linha de administrador é criada ou atualizada pelo e-mail. A senha do administrador é guardada como SHA-256 simples, sem sal, o que é fraco; use uma senha forte e trate isso como uma limitação conhecida |

### Banco, migração e planos

```bash
cd server
npm run migrate      # idempotente: cria as tabelas que faltam e acrescenta colunas a um banco existente
```

O esquema (`server/src/db/schema.sql`) traz as tabelas `admins`, `users_groups`, `users`, `sessions`, `password_resets`, `files`, `folders` e `workspaces`.

- **Planos:** `users_groups` define os limites `max_files` e `max_size_mb`. O grupo 1, "Gratuito", com 100 arquivos e 5 MB, é criado sozinho e é o plano de todo usuário, por meio de `users.users_groups_id`. `users.stored_files`, `users.storage_bytes` e `users.last_access` são mantidos pelo servidor. Para mudar os limites de um usuário, altere o grupo ou mude o usuário para outro grupo no SQL.
- **phpMyAdmin:** para um banco já existente, cole `server/src/db/migrations/2026-11-planos.sql` na aba SQL (ou rode no cliente `mysql`). Equivale ao `npm run migrate`; os comandos `ALTER TABLE` rodam uma vez só, então, se o servidor avisar que uma coluna ou chave já existe (erros 1060, 1061 ou 1826), pule aquele comando.

### Produção

- Publique a API **somente atrás de HTTPS** (proxy reverso) e defina `TRUST_PROXY` (por exemplo `1` atrás de um único proxy).
- Defina `NODE_ENV=production`, `DATABASE_URL` e as variáveis `SMTP_*`. Guarde-as numa configuração protegida (nunca no repositório).
- Faça backups regulares do banco (por exemplo, um `mysqldump` agendado).
- Os limites de tentativas ficam em memória: rode uma única instância.

Gerar o pacote de implantação:

```bash
cd server
npm run package      # cria release/meu-editor-api-<versão>.tar.gz e .zip
```

O pacote traz o JavaScript compilado, um `package.json` só de produção (`npm start` roda `node server.js`; `npm run migrate` roda `node dist/migrate.js`), os arquivos de entrada `server.js` e `server.cjs`, o `api.env.example`, um exemplo de nginx com HTTPS, o instalador para Debian/Ubuntu (`install.sh`, serviço systemd) e as instruções detalhadas (`INSTALL.md` e `INSTALL.pt-BR.md` dentro do pacote).

- **VPS Debian/Ubuntu:** extraia o pacote, rode `sudo bash install.sh`, edite `/etc/meu-editor-api/api.env` e depois `sudo bash install.sh --migrate`. O serviço `meu-editor-api` escuta em `127.0.0.1:3000`; coloque o Nginx com HTTPS na frente.
- **Hospedagem Node.js (painel de controle):** envie o pacote, use `server.js` como arquivo de entrada, rode `npm ci --omit=dev`, defina no painel as variáveis de ambiente acima (e `AUTO_MIGRATE=true` se não houver shell) e garanta que o site seja servido por HTTPS.
- **Windows (só para testes):** extraia o `.zip` e, dentro da pasta, rode `npm ci --omit=dev`, defina `DATABASE_URL`, `npm run migrate` e `npm start`.
