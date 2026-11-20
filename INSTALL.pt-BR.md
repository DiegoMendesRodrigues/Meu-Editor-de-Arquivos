# Instalação

[English](INSTALL.md)

Este guia cobre dois cenários:

1. [Produção](#1-produção-instalar-o-aplicativo): instalar o aplicativo para usá-lo.
2. [Desenvolvimento](#2-ambiente-de-desenvolvimento): preparar um computador para trabalhar no código-fonte.

O [servidor de contas](#3-opcional-servidor-de-contas-e-sincronização) (cadastro e sincronização de arquivos), opcional, está no final.

---

## 1. Produção: instalar o aplicativo

### Sistemas suportados

- Windows 11 (64 bits)
- Debian 12 e 13
- Ubuntu 22.04, 24.04 e versões posteriores compatíveis
- Distribuições derivadas do Debian e do Ubuntu

### Windows 11

Baixe a versão mais recente na [página de Releases](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases):

- **Instalador** (`meu-editor-de-arquivos-<versão>-x64.exe`): execute e siga os passos. Você pode escolher a pasta de instalação. O aplicativo aparece no menu Iniciar.
- **Portátil** (o `.exe` portátil): não precisa instalar. Copie para qualquer pasta ou pen drive e execute.

> Enquanto os instaladores não tiverem assinatura digital, o Windows SmartScreen pode avisar que o aplicativo não é reconhecido. Escolha **Mais informações → Executar assim mesmo** somente se você baixou o arquivo da página oficial de Releases.

Para desinstalar a versão instalada, use **Configurações → Aplicativos → Aplicativos instalados → Meu Editor de Arquivos → Desinstalar**.

### Debian, Ubuntu e derivados

Baixe o pacote `.deb` na [página de Releases](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases) e instale:

```bash
sudo apt install ./meu-editor-de-arquivos_<versão>_amd64.deb
```

O `apt` também instala as bibliotecas do sistema necessárias. Para desinstalar:

```bash
sudo apt remove meu-editor-de-arquivos
```

**AppImage (sem instalação):** baixe o arquivo `.AppImage`, dê permissão de execução e execute:

```bash
chmod +x Meu-Editor-de-Arquivos-<versão>.AppImage
./Meu-Editor-de-Arquivos-<versão>.AppImage
```

Nas versões recentes do Ubuntu, o AppImage pode precisar do pacote `libfuse2` (`sudo apt install libfuse2`, ou `libfuse2t64` no Ubuntu 24.04).

### Onde o aplicativo guarda os dados

A sessão (abas abertas, texto não salvo, preferências) e os logs ficam na pasta de dados do usuário:

- Windows: `%APPDATA%\Meu Editor de Arquivos`
- Linux: `~/.config/Meu Editor de Arquivos`

Os seus documentos são sempre salvos onde você escolher. Tudo funciona sem internet, inclusive o corretor ortográfico.

---

## 2. Ambiente de desenvolvimento

### Requisitos

- [Node.js](https://nodejs.org/) 22 LTS ou mais recente (já inclui o npm)
- [Git](https://git-scm.com/)
- Windows 11, ou Debian/Ubuntu com ambiente gráfico
- No Linux, para gerar o pacote `.deb`: `sudo apt install fakeroot dpkg rpm` (o rpm é opcional)

### Obter o código

```bash
git clone https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos.git
cd Meu-Editor-de-Arquivos
npm install
```

### Comandos principais

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Abre o aplicativo em modo de desenvolvimento, com recarga automática |
| `npm run typecheck` | Confere os tipos do TypeScript (main, preload e renderer) |
| `npm test` | Executa os testes unitários (Vitest) |
| `npm run test:e2e` | Compila o aplicativo e executa os testes de interface (Playwright) |
| `npm run build` | Confere os tipos e compila o aplicativo em `out/` |
| `npm run manual` | Compila, captura as telas e gera o manual do usuário nos seis idiomas (`docs/manual/<idioma>/`) |
| `npm run dist:win` | Gera o instalador e a versão portátil do Windows em `dist/` |
| `npm run dist:linux` | Gera o pacote `.deb` e o AppImage em `dist/` (execute no Linux) |

Na primeira execução dos testes de interface, instale o suporte do Playwright se ele pedir:

```bash
npx playwright install
```

### Estrutura do projeto

| Pasta | Conteúdo |
| --- | --- |
| `src/main` | Processo principal do Electron: janelas, arquivos, diálogos, IPC e controle de acesso |
| `src/preload` | API segura exposta à interface (`contextBridge`) |
| `src/renderer` | Interface em React + TypeScript: Monaco Editor, menus, abas, painéis, corretor ortográfico |
| `src/shared` | Código comum aos processos: tipos do IPC, busca e as seis traduções (`src/shared/i18n`) |
| `server` | API opcional de contas e sincronização (Fastify + MySQL/MariaDB) |
| `docs/manual` | Manual do usuário: textos em `docs/manual/src` e o HTML gerado por idioma |
| `e2e` | Testes de interface (Playwright) |
| `scripts` | Scripts que capturam as telas e geram o manual |

### Convenções

- Todo arquivo de código-fonte (`ts`, `tsx`, `css`, `html`, `sql`, `yml`) começa com o comentário de autoria:
  `Desenvolvido por Diego Mendes Rodrigues - https://www.linkedin.com/in/diegomendesrodrigues/`
- Os textos da interface ficam em `src/shared/i18n/`. O português do Brasil (`pt-BR.ts`) é a referência, e os demais idiomas precisam ter as mesmas chaves (senão a compilação falha).
- Depois de mudar a interface ou o manual, rode `npm run manual`.

---

## 3. Opcional: servidor de contas e sincronização

O cadastro, o perfil e a sincronização de arquivos passam por uma pequena API (em `server/`), que fica entre o aplicativo e o banco SQL. O aplicativo nunca recebe as credenciais do banco.

```bash
cd server
npm install
# Crie um banco vazio (utf8mb4) e aplique o esquema
export DATABASE_URL="mysql://usuario:senha@localhost:3306/meu_editor"   # PowerShell: $env:DATABASE_URL = "..."
npm run migrate
npm start            # escuta em 127.0.0.1:3000 (HOST e PORT configuráveis)
```

Sem `DATABASE_URL`, o servidor guarda os dados em memória (só para testes; os dados somem ao parar).

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | Conexão MySQL/MariaDB, ex.: `mysql://usuario:senha@host:3306/banco` |
| `HOST` / `PORT` | Endereço de escuta (padrão `127.0.0.1:3000`) |
| `TRUST_PROXY` | `true` quando estiver atrás de um proxy reverso de confiança |
| `NODE_ENV` | `production` exige `DATABASE_URL` e um serviço de e-mail real |

Em produção:

- Publique a API **somente atrás de HTTPS** (proxy reverso como Nginx ou Caddy) e defina `TRUST_PROXY=true`. O aplicativo recusa endereços `http://` que não sejam localhost.
- Troque o envio de e-mail simulado em `server/src/index.ts` por um serviço de e-mail real. Em produção, o servidor não inicia enquanto o envio simulado estiver em uso.

No aplicativo, abra **Conta → Entrar ou criar conta...** e informe o endereço da API.

> O servidor é um protótipo. Antes de qualquer uso real, faça uma revisão (arquitetura, testes funcionais e não funcionais, backups, monitoramento e adequação à LGPD).
