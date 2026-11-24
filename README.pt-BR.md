<p align="center">
  <img src="build/icon.png" alt="Meu Editor de Arquivos" width="96" height="96">
</p>

<h1 align="center">Meu Editor de Arquivos</h1>

<p align="center">
  Editor leve para desktop de Markdown, código, scripts, logs e arquivos de configuração.<br>
  Windows 11 · Debian · Ubuntu
</p>

<p align="center">
  <a href="https://meueditordearquivos.aplicativoia.online/?lang=pt-BR">Site</a> ·
  <a href="INSTALL.pt-BR.md">Instalação</a> ·
  <a href="https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases">Download</a> ·
  <a href="README.md">English</a>
</p>

---

## Sobre o Meu Editor de Arquivos

O **Meu Editor de Arquivos** é um editor leve para desktop, feito para desenvolvedores, administradores de sistemas, profissionais de TI e todos que trabalham com arquivos de texto, scripts, logs e códigos de programação.

O Markdown é o formato padrão de documento. Os arquivos Markdown abrem formatados e continuam editáveis: a barra de ferramentas aplica títulos, listas, recuos, negrito, itálico, tachado, links e tabelas direto no texto formatado, e um clique alterna para o código Markdown. O aplicativo funciona totalmente sem internet, consome poucos recursos em comparação com uma IDE completa e tem a interface em seis idiomas.

Versão atual: **1.1.0**.

## Funcionalidades

**Edição**
- Monaco Editor (o motor de edição do VS Code), com realce de sintaxe, recolhimento de blocos (folding) e autocompletar
- Múltiplos cursores, seleção por coluna (retangular) e edição em várias linhas
- Abas para vários documentos abertos, com indicador de alterações
- Ordenar linhas, remover linhas duplicadas e remover espaços no fim das linhas
- Exibição de caracteres invisíveis (espaços, tabulações e quebras de linha)
- Ir para a linha, quebra automática de linha e tamanho da fonte e recuo ajustáveis

**Markdown e JSON**
- O Markdown abre formatado e pode ser editado nessa visualização, com a barra de formatação
- Edição do código Markdown com a mesma barra e atalhos (Ctrl+B, Ctrl+I, Ctrl+Shift+X)
- Visualizador de JSON com nós que abrem e fecham, e a posição do erro em JSON inválido

**Busca**
- Localizar e substituir no documento, com expressões regulares
- Busca e substituição em uma pasta inteira, com filtro de arquivos

**Linguagens e arquivos**
- Python, C, C++, C#, Java, JavaScript, TypeScript, PHP, Go, Rust, PowerShell, Bash, Batch, Lua, HTML, CSS, XML, JSON, YAML, TOML, INI, SQL, CSV, LaTeX, Markdown, logs e outros
- UTF-8 e UTF-8 com BOM, e conversão entre quebras de linha Windows (CRLF) e Unix (LF)
- Percebe alterações feitas por outros programas nos arquivos abertos

**Produtividade**
- Snippets e macros (gravar, repetir e salvar)
- Corretor ortográfico em alemão, espanhol, francês, inglês, português do Brasil e português de Portugal, sem internet
- Recuperação automática da sessão: abas, pasta e texto não salvo voltam ao abrir o aplicativo de novo
- Paleta de comandos e atalhos de teclado

**Interface**
- Seis idiomas: alemão, espanhol, francês, inglês, português do Brasil e português de Portugal
- Manual do usuário em cada idioma, com telas do próprio aplicativo
- Barra lateral e painel inferior redimensionáveis e ocultáveis
- Modos claro e escuro (segue o sistema até o usuário escolher)

**Conta e sincronização (opcional)**
- Cadastro, perfil e troca de senha
- Arquivos guardados num servidor, para usar os mesmos arquivos em vários computadores, por uma API com MySQL ou MariaDB

**Distribuição**
- Instalador e versão portátil (sem instalação) para Windows
- Pacote `.deb` e AppImage para Debian, Ubuntu e derivados

## Tecnologias utilizadas

| Camada | Tecnologia |
| --- | --- |
| Runtime desktop | [Electron](https://www.electronjs.org/) |
| Linguagem | [TypeScript](https://www.typescriptlang.org/) |
| Interface | [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), ícones [Lucide](https://lucide.dev/) |
| Editor de código | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| Editor de Markdown formatado | [Tiptap](https://tiptap.dev/) (ProseMirror) |
| Corretor ortográfico | [Hunspell](https://hunspell.github.io/) em WebAssembly ([hunspell-asm](https://github.com/kwonoj/hunspell-asm)) com os dicionários [wooorm/dictionaries](https://github.com/wooorm/dictionaries) |
| Estado | [Zustand](https://zustand.docs.pmnd.rs/) |
| Painéis | [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels) |
| Validação | [Zod](https://zod.dev/) |
| Build | [Vite](https://vite.dev/) com [electron-vite](https://electron-vite.org/) |
| Empacotamento | [electron-builder](https://www.electron.build/) (NSIS, portátil, DEB, AppImage) |
| Logs | [electron-log](https://github.com/megahertz/electron-log) |
| Testes | [Vitest](https://vitest.dev/) (unitários) e [Playwright](https://playwright.dev/) (interface) |
| API de contas | [Fastify](https://fastify.dev/) com [MySQL](https://www.mysql.com/) / [MariaDB](https://mariadb.org/) |

Segurança: a interface roda isolada (`contextIsolation`, `sandbox` e uma Content Security Policy restrita) e só alcança o sistema operacional por uma pequena API no preload. Arquivos só podem ser lidos ou gravados depois que o usuário os escolhe ou abre a pasta deles.

## Instalação

Veja o **[INSTALL.pt-BR.md](INSTALL.pt-BR.md)** para instalar o aplicativo (Windows e Linux) e para preparar o ambiente de desenvolvimento.

## GitHub

- Repositório: [github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos)
- Downloads: [Releases](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/releases)
- Erros e sugestões: [Issues](https://github.com/DiegoMendesRodrigues/Meu-Editor-de-Arquivos/issues)
- Site: [meueditordearquivos.aplicativoia.online](https://meueditordearquivos.aplicativoia.online/?lang=pt-BR)
- Licença: [MIT](LICENSE) ([tradução](LICENSE.pt-BR.md))
- Contato: suporte@meueditordearquivos.aplicativoia.online

## Desenvolvedor

Desenvolvido por **[Diego Mendes Rodrigues](https://www.linkedin.com/in/diegomendesrodrigues/)**.
