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

O esquema também traz as tabelas `users_groups` (planos; o grupo 1, `Gratuito`, com 100 arquivos e 5 MB, é criado sozinho e é o de todo usuário) e `admins` (administradores; nenhuma rota da API os expõe). A tabela `users` ganha `last_access` (cadastro, login e cada requisição autenticada), `users_groups_id` e `stored_files` (número de arquivos na nuvem, recalculado junto com `storage_bytes`). Os limites do plano ainda **não são aplicados**. O `npm run migrate` é idempotente e acrescenta tudo isso a um banco existente; para colar no phpMyAdmin há o script `src/db/migrations/2026-11-planos.sql`.

Para cadastrar um administrador na migração, defina `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` (os três) no ambiente antes de `npm run migrate` (ou com `AUTO_MIGRATE=true`); o e-mail é o login e a linha é atualizada se o e-mail já existir. Nada disso fica em arquivo nem em log. Atenção: a senha do administrador é guardada como **SHA-256 simples, sem sal**, a pedido do projeto; isso é fraco contra força bruta e o **scrypt é o recomendado**.

Sem `DATABASE_URL` o servidor usa **memória** (só para experimentar; os dados somem ao parar).

No app: menu **Conta → Entrar ou criar conta**, informe o endereço da API (`http://localhost:3000` em testes).

## Pontos de segurança

- Publique **somente atrás de HTTPS** (proxy reverso). O app recusa `http://` fora de localhost.
- Senhas com scrypt + sal; tokens de sessão guardados só como SHA-256; sessão de 30 dias.
- Login com limite de tentativas (por IP + e-mail); respostas iguais para e-mail inexistente.
- Limite por IP nas rotas de conta (cadastro, login e recuperação de senha); contadores vencidos são limpos a cada minuto.
- Atrás de proxy reverso, defina `TRUST_PROXY=true` para os limites usarem o IP real do cliente.
- Cabeçalhos de segurança em todas as respostas (`nosniff`, `no-store`, `no-referrer`, `DENY`).
- O envio de e-mail é simulado (o código aparece no console, sem o e-mail da pessoa). Com `NODE_ENV=production`
  o servidor não inicia até ser configurado um serviço de e-mail real e o `DATABASE_URL`.
- Trocar ou redefinir a senha encerra as outras sessões.
- Arquivos isolados por usuário; sincronização com controle de versão (409 em conflito).
- **Recuperação de senha:** o código é apenas escrito no log do servidor. Ligue `Mailer` (`src/app.ts`) a um serviço de e-mail.
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
