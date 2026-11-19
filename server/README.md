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

Sem `DATABASE_URL` o servidor usa **memória** (só para experimentar; os dados somem ao parar).

No app: menu **Conta → Entrar ou criar conta**, informe o endereço da API (`http://localhost:3000` em testes).

## Pontos de segurança

- Publique **somente atrás de HTTPS** (proxy reverso). O app recusa `http://` fora de localhost.
- Senhas com scrypt + sal; tokens de sessão guardados só como SHA-256; sessão de 30 dias.
- Login com limite de tentativas (por IP + e-mail); respostas iguais para e-mail inexistente.
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
`GET|PATCH /v1/me`, `POST /v1/me/password`; `GET /v1/files`, `GET /v1/files/:id`, `PUT /v1/files`, `DELETE /v1/files/:id`.
