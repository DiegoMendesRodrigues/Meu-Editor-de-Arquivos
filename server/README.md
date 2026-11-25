# API do Meu Editor de Arquivos (protótipo)

Servidor intermediário entre o app e o banco SQL (MySQL/MariaDB). O app nunca recebe credenciais do banco:
ele entra com e-mail e senha e usa um token de sessão.

> Protótipo: revise com um profissional de entregas (arquitetura, testes funcionais e não funcionais,
> backups, monitoramento, LGPD) antes de qualquer uso real.

## Executar

```powershell
cd server
npm install
# Banco: crie um banco vazio (utf8mb4) e aplique o esquema
$env:DATABASE_URL = "mysql://usuario:senha@localhost:3306/meu_editor"
npm run migrate
npm start            # escuta em 127.0.0.1:3000 (HOST e PORT configuráveis)
```

Num banco já existente, rode `npm run migrate` de novo ao atualizar: ele acrescenta a coluna `users.storage_bytes` (espaço usado na nuvem por usuário) e calcula o valor de todos os usuários.

O esquema também traz as tabelas `users_groups` (planos; o grupo 1, `Gratuito`, com 100 arquivos e 5 MB, é criado sozinho e é o de todo usuário) e `admins` (administradores; nenhuma rota da API os expõe). A tabela `users` ganha `last_access` (cadastro, login e cada requisição autenticada), `users_groups_id` e `stored_files` (número de arquivos na nuvem, recalculado junto com `storage_bytes`). Os limites do plano são aplicados: arquivo novo no limite de arquivos e qualquer gravação que aumente o espaço além do limite recebem 403 (`plan_file_limit`/`plan_storage_limit`). O `npm run migrate` é idempotente e acrescenta tudo isso a um banco existente; para colar no phpMyAdmin há o script `src/db/migrations/2026-11-planos.sql`.

Para cadastrar um administrador na migração, defina `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` (os três) no ambiente antes de `npm run migrate` (ou com `AUTO_MIGRATE=true`); o e-mail é o login e a linha é atualizada se o e-mail já existir. Nada disso fica em arquivo nem em log. Atenção: a senha do administrador é guardada como **SHA-256 simples, sem sal**, a pedido do projeto; isso é fraco contra força bruta e o **scrypt é o recomendado**.

Sem `DATABASE_URL` o servidor usa **memória** (só para experimentar; os dados somem ao parar).

No app: menu **Conta → Entrar ou criar conta**, informe o endereço da API (`http://localhost:3000` em testes).

## Pontos de segurança

- Publique **somente atrás de HTTPS** (proxy reverso). O app recusa `http://` fora de localhost.
- Senhas com scrypt + sal; tokens de sessão guardados só como SHA-256; sessão de 30 dias.
- Login com limite de tentativas por IP + e-mail e também por e-mail (de qualquer IP); respostas iguais para e-mail inexistente.
- Recuperação de senha: no máximo 3 e-mails por conta a cada 15 minutos; só o código mais recente vale; o envio não é aguardado (o tempo de resposta não revela a conta).
- Troca de senha: bloqueio depois de várias senhas atuais erradas.
- Limite por IP nas rotas de conta (cadastro, login e recuperação de senha); contadores vencidos são limpos a cada minuto.
- Atrás de proxy reverso, defina `TRUST_PROXY` com o número de proxies (ex.: `1`) ou a lista de IPs deles, para os limites usarem o IP real do cliente. `true` confia em todos e só é seguro se o proxy substituir o `X-Forwarded-For` (o nginx do instalador faz isso).
- Corpo das requisições limitado a 64 KB (10 MB só ao gravar arquivos e a área de trabalho); sessão e limite são conferidos antes de ler o corpo.
- Gravações do mesmo usuário em fila: os limites do plano não são ultrapassados por gravações simultâneas. Até 2.000 pastas por usuário.
- O log não guarda a query string; sessões e códigos vencidos são removidos de hora em hora.
- Cabeçalhos de segurança em todas as respostas (`nosniff`, `no-store`, `no-referrer`, `DENY`, HSTS).
- E-mail por SMTP (`SMTP_*`). Sem SMTP, o código de redefinição só aparece no console com `MEA_DEV=true` (desenvolvimento). Com `NODE_ENV=production`
  o servidor não inicia sem SMTP e `DATABASE_URL`.
- Trocar ou redefinir a senha encerra as outras sessões.
- Arquivos isolados por usuário; sincronização com controle de versão (409 em conflito).
- O limite de tentativas é em memória (uma instância). Com várias instâncias, mova-o para um armazenamento compartilhado.

## Testes

```powershell
npm test         # API contra o armazenamento em memória
npm run typecheck
```

A camada MySQL (`src/db/mysql.ts`) ainda **não foi testada contra um servidor real**.

## Rotas (v1)

`POST /v1/auth/register`, `/login`, `/logout`, `/password-reset/request`, `/password-reset/confirm`;
`PATCH /v1/folders` (renomear pasta: `{from, to}`; leva arquivos e subpastas; 409 `folder_in_use` se o destino existe), `GET|PATCH /v1/me`, `POST /v1/me/password`, `GET /v1/me/storage` (`{ storageBytes, storedFiles, plan: { name, maxFiles, maxSizeMb } }`: espaço usado na nuvem em bytes (arquivos + textos não salvos), número de arquivos e plano; `storageBytes` e `storedFiles` também vêm nas respostas de `PUT /v1/files`, `DELETE /v1/files/:id` e `PUT /v1/workspace`); `GET /v1/files`, `GET /v1/files/:id`, `PUT /v1/files`, `DELETE /v1/files/:id`.

## Pacote de instalação

```powershell
npm run package   # gera release/meu-editor-api-<versão>.tar.gz e .zip
```

O pacote traz o JavaScript compilado, o instalador para Debian/Ubuntu (`install.sh`, serviço systemd),
um exemplo de proxy nginx com HTTPS e as instruções em `installer/INSTALL.md` (inglês) e `installer/INSTALL.pt-BR.md`.
