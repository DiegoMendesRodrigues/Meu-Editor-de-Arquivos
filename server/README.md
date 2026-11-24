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
`PATCH /v1/folders` (renomear pasta: `{from, to}`; leva arquivos e subpastas; 409 `folder_in_use` se o destino existe), `GET|PATCH /v1/me`, `POST /v1/me/password`, `GET /v1/me/storage` (espaço usado na nuvem, em bytes: arquivos + textos não salvos; também vem em `storageBytes` nas respostas de `PUT /v1/files`, `DELETE /v1/files/:id` e `PUT /v1/workspace`); `GET /v1/files`, `GET /v1/files/:id`, `PUT /v1/files`, `DELETE /v1/files/:id`.

## Pacote de instalação

```powershell
npm run package   # gera release/meu-editor-api-<versão>.tar.gz e .zip
```

O pacote traz o JavaScript compilado, o instalador para Debian/Ubuntu (`install.sh`, serviço systemd),
um exemplo de proxy nginx com HTTPS e as instruções em `installer/INSTALL.md` (inglês) e `installer/INSTALL.pt-BR.md`.
