# Meu Editor de Arquivos — Manual do utilizador

Versão {{version}}

## 1. Bem-vindo

O **Meu Editor de Arquivos** é um editor leve para quem trabalha com textos, notas, scripts, ficheiros de configuração, registos e código. Funciona no Windows 11, no Debian 12 e 13 e no Ubuntu 22.04 ou mais recente, e **não precisa de internet** para editar.

O que vai encontrar:

- separadores para vários ficheiros em simultâneo, com recuperação automática do que escreveu;
- Markdown que abre **formatado**, com um botão para editar o texto;
- um **visualizador de JSON** onde pode abrir e fechar partes do ficheiro;
- pesquisa e substituição num ficheiro ou numa pasta inteira;
- realce de cores para dezenas de linguagens, snippets e macros;
- uma conta de utilizador para guardar ficheiros na nuvem e abri-los noutros computadores;
- interface em seis idiomas.

## 2. Conhecer o ecrã

![Ecrã principal com uma pasta aberta e um documento Markdown](img/s01-main.png)

1. **Barra de menus** (no topo): {{menu.file}}, {{menu.edit}}, {{menu.search}}, {{menu.view}}, {{menu.encoding}}, {{menu.language}}, {{menu.tools}}, {{menu.account}} e {{menu.help}}.
2. **Barra de ferramentas**: atalhos para os comandos mais usados. Os botões de formatação aparecem quando o documento é Markdown. Do lado direito ficam as **bandeiras dos idiomas** e o botão que alterna entre pré-visualizar e editar.
3. **Barra lateral** (à esquerda): os documentos abertos, o explorador da pasta aberta e os ficheiros recentes. Para a ocultar ou mostrar, use **Ctrl+Shift+B**.
4. **Separadores**: cada documento tem o seu. Um ponto (●) junto ao nome indica que há alterações ainda não gravadas no ficheiro.
5. **Área de edição**: onde lê e escreve.
6. **Painel inferior**: mostra os resultados da pesquisa em ficheiros. Abre-se sozinho quando usa a pesquisa.
7. **Barra de estado** (em baixo): linha e coluna do cursor, tamanho do ficheiro, codificação, tipo de fim de linha e linguagem do documento.

## 3. Criar e abrir ficheiros

![O botão Novo com a seta que lista os tipos de documento](img/s02-new-menu.png)

- **Novo documento:** clique em **{{toolbar.new}}** ou use **Ctrl+N**. Um documento novo é Markdown (.md). Clique na **seta ao lado do botão** para criar outro tipo: .md (Markdown), .txt (texto), .py (Python) ou .sql (SQL).
- **Abrir ficheiros:** **{{menu.file}} → {{menu.file.open}}** ou **Ctrl+O**. Pode escolher vários ficheiros de uma só vez. O limite é de 50 MB por ficheiro.
- **Abrir uma pasta:** **{{menu.file}} → {{menu.file.openFolder}}** ou **Ctrl+Shift+K**. A pasta aparece no explorador, na barra lateral, e um clique num ficheiro abre-o. Use **{{menu.file.closeFolder}}** para a fechar.
- **Ficheiros recentes:** os últimos ficheiros que usou ficam na lista **Recentes**, na barra lateral. Clique num deles para o abrir de novo.

Se outro programa alterar um ficheiro que tem aberto, a aplicação recarrega-o sozinha. Se tiver alterações suas ainda não gravadas nesse documento, pergunta primeiro. Se o ficheiro for eliminado ou movido, o nome do separador fica a vermelho e riscado.

![Menu Ficheiro](img/s07-menu-file.png)

## 4. Guardar e documentos temporários

- **{{menu.file.save}}** (**Ctrl+S**) grava o documento no ficheiro. Num documento novo, a aplicação pede o nome e a localização.
- **{{menu.file.saveAs}}** (**Ctrl+Shift+S**) grava uma cópia com outro nome ou noutro local.
- **{{menu.file.saveAll}}** grava todos os documentos com alterações.

**Não perde o que escreveu.** Alguns segundos depois de cada alteração, a aplicação guarda automaticamente todos os documentos abertos, incluindo os que nunca foram guardados. Isto acontece quer guarde, quer não.

Ao **fechar a aplicação**, não é perguntado nada e nada é descartado. Quando a abrir de novo, os separadores, a pasta e o texto ainda não guardado regressam como estavam. Guarde quando quiser gravar no ficheiro propriamente dito.

Ao **fechar um separador** que tem alterações, a aplicação pergunta se quer guardar, não guardar ou cancelar. Duas notas: o histórico de anular (Ctrl+Z) não é guardado entre sessões, e a recuperação automática guarda até 100 MB de texto por guardar.

## 5. Editar texto

![Caracteres invisíveis: espaços, tabulações e fim de linha](img/s11-invisibles.png)

Os comandos de edição ficam em **{{menu.edit}}** e as opções de visualização em **{{menu.view}}**.

- **Anular e refazer:** Ctrl+Z e Ctrl+Y.
- **Localizar e substituir** no documento: Ctrl+F e Ctrl+H. Para ir para uma linha, use Ctrl+G.
- **Vários cursores:** mantenha Alt premido e clique onde quiser outro cursor, ou use Ctrl+D para selecionar a próxima ocorrência da palavra.
- **{{menu.edit.columnSelection}}:** mantenha Shift+Alt premido e arraste o rato para editar várias linhas na mesma coluna.
- **Linhas:** Alt+↑ e Alt+↓ movem a linha; Shift+Alt+↑ e Shift+Alt+↓ duplicam-na; Ctrl+/ comenta ou descomenta.
- **Arrumar:** {{menu.edit.sortAsc}}, {{menu.edit.sortDesc}}, {{menu.edit.removeDuplicates}} e {{menu.edit.trimWhitespace}}.
- **{{menu.view.invisibles}}:** mostra os espaços (·), as tabulações (→) e o fim de cada linha (¶). É ótimo para encontrar espaços a mais.
- **{{menu.view.wordWrap}}** e **{{menu.view.foldAll}} / {{menu.view.unfoldAll}}** ajudam a ler ficheiros compridos.
- **Tamanho do tipo de letra:** Ctrl++ aumenta, Ctrl+- diminui e Ctrl+0 repõe o tamanho predefinido.
- **Indentação:** em **{{menu.edit}}**, escolha entre espaços ou tabulação e o tamanho (2, 4 ou 8 colunas).
- **{{menu.view.fullScreen}}** (F11, em **{{menu.view}}**): mostra só o documento, a ocupar o ecrã todo. Prima F11 outra vez, ou clique no botão do canto superior direito, para sair.

As suas preferências de visualização ficam guardadas para a próxima vez. Os textos internos do editor, como a caixa de pesquisa (Ctrl+F) e a paleta de comandos (F1), aparecem em inglês.

### Letras, espaços e quebras de linha

![Menu Editar com o submenu Converter letras para aberto](img/s20-menu-edit.png)

No fim do menu **{{menu.edit}}** há três submenus:

- **{{menu.edit.eol}}:** converte as quebras de linha do documento para o formato Windows (CRLF), Unix (LF) ou Mac (CR). A conversão marca o documento como alterado; basta guardar para ter efeito.
- **{{menu.edit.case}}:** com um texto selecionado, escolha {{menu.edit.caseUpper}}, {{menu.edit.caseLower}} ou {{menu.edit.caseSentence}} (só a primeira letra de cada frase fica em maiúscula).
- **{{menu.edit.spaces}}:** {{menu.edit.trimRight}}, {{menu.edit.trimLeft}} e {{menu.edit.trimBoth}} aplicam-se à linha do cursor (ou às linhas selecionadas). {{menu.edit.collapseSpaces}} troca dois ou mais espaços seguidos por um só no documento inteiro, sem mexer na indentação do início das linhas.

### MD5, SHA-1, SHA-256 e SHA-512

![Janela para gerar o SHA-256 de um texto](img/s21-hash.png)

No fim do menu **{{menu.tools}}**, cada algoritmo tem duas opções:

- **{{menu.tools.hashGenerate}}:** abre uma janela; escreva ou cole o texto e o resultado aparece de imediato, logo abaixo. **{{hash.copy}}** leva o resultado para a área de transferência.
- **{{menu.tools.hashSelection}}:** calcula o resultado a partir do texto selecionado no documento e deixa-o na área de transferência, pronto a colar. Aparece um aviso na barra de estado.

### Corretor ortográfico

![Palavra sublinhada e as sugestões de correção](img/s11a-spelling.png)

Em documentos Markdown, de texto (.txt) e LaTeX, as palavras que não estão no dicionário ficam sublinhadas a vermelho. Código, ligações, endereços, siglas e trechos entre acentos graves não são verificados, e ficheiros de registo e CSV ficam de fora.

- Coloque o cursor na palavra e prima **Ctrl+.** (ou clique com o botão direito e escolha **{{spell.suggestions}}**) para ver as sugestões. Escolha uma para trocar a palavra.
- **{{spell.addToDictionary}}** faz com que a palavra passe a ser aceite, em qualquer idioma.
- **{{menu.tools}} → {{menu.tools.spellCheck}}** (ou **F7**) liga e desliga a verificação.
- O corretor usa o idioma da interface. Para verificar noutro idioma, escolha em **{{menu.tools}}** uma das opções **{{spell.source}}: Deutsch**, **{{spell.source}}: English**… — há dicionários de alemão, espanhol, francês, inglês, português do Brasil e português de Portugal (Acordo Ortográfico de 1990). **{{menu.tools.spellAuto}}** volta a seguir a interface.

Os dicionários vêm com a aplicação: o corretor funciona sem internet.

## 6. Markdown

![Documento Markdown em modo de edição, com a barra de formatação](img/s03-markdown-edit.png)

Os ficheiros Markdown (.md) abrem **formatados** e pode continuar a escrever diretamente no texto formatado. A barra de ferramentas aplica a formatação no lugar do cursor ou na seleção: títulos, lista com marcadores, lista numerada, recuo, **negrito** (Ctrl+B), *itálico* (Ctrl+I), ~~rasurado~~ (Ctrl+Shift+X), ligação, tabela e remover formatação. Ctrl+Z e Ctrl+Y anulam e refazem.

Para ver e editar o código Markdown, clique em **{{toolbar.editText}}** (ou use **Ctrl+Shift+E**); para voltar ao texto formatado, clique em **{{toolbar.preview}}**. A barra de formatação funciona nos dois modos.

Ao editar no texto formatado, o Markdown é regravado num formato padronizado (por exemplo, listas com `-`). Documentos que têm HTML ficam só de leitura nesse modo, para o HTML não se perder: edite-os em **{{toolbar.editText}}**. Para abrir uma ligação no navegador, use Ctrl+clique. As imagens aparecem como uma etiqueta com o nome, e o endereço é mantido no ficheiro.

## 7. Ficheiros JSON

![Ficheiro JSON em árvore, com um item selecionado](img/s04-json-tree.png)

Os ficheiros .json abrem em **árvore**. Clique na seta de um item para abrir ou fechar essa parte. Use **{{menu.view.unfoldAll}}** e **{{menu.view.foldAll}}** para abrir ou fechar tudo. Ao clicar num item, a barra mostra o respetivo caminho, e pode copiar o **{{json.path}}** ou o **{{json.value}}**. As listas muito grandes são apresentadas aos poucos, com um botão para ver mais.

Para editar, clique em **{{toolbar.editText}}**. No modo de edição, o botão **{{toolbar.formatJson}}** (Shift+Alt+F) organiza o ficheiro.

![Mensagem de erro de um JSON inválido, com linha e coluna](img/s05-json-error.png)

Se o ficheiro tiver um erro, a aplicação explica o problema e indica a linha e a coluna. O botão **{{json.editGoToError}}** abre o editor já no ponto do erro.

## 8. Pesquisa em ficheiros

![Painel de pesquisa com os resultados agrupados por ficheiro](img/s06-search.png)

Abra uma pasta e use **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). O painel inferior abre-se.

1. Escreva o texto e clique em **{{search.run}}** (ou prima Enter).
2. Ajuste a pesquisa com os três botões ao lado: **{{search.caseSensitive}}**, **{{search.wholeWord}}** e **{{search.regex}}**.
3. Para limitar os ficheiros, escreva um filtro, como `*.md, docs/**`.
4. Os resultados aparecem agrupados por ficheiro, com linha e coluna. Clique num resultado para abrir o ficheiro e selecionar o excerto.

Para substituir o texto, escreva o novo no campo de substituição e clique em **{{search.replaceAll}}**. Desmarque os ficheiros que não devem mudar. A aplicação pede confirmação, porque **a substituição é gravada diretamente nos ficheiros e não pode ser anulada pelo editor**. Os ficheiros abertos com alterações por guardar são ignorados, para não perder trabalho.

A pesquisa não entra em pastas como `node_modules` e `.git`, nem em ficheiros binários ou com mais de 5 MB. Mostra, no máximo, 5.000 ocorrências de cada vez.

## 9. Linguagem, codificação e fins de linha

![Menu Codificação](img/s09-menu-encoding.png)

- **{{menu.language}}:** a aplicação escolhe a linguagem pela extensão do ficheiro e usa cores para facilitar a leitura. Para mudar a linguagem de um documento, abra o menu e escolha outra.

![Menu Linguagem](img/s10-menu-language.png)

- **{{menu.encoding}}:** converta o documento para **UTF-8** ou **UTF-8 com BOM**, e escolha a quebra de linha do **Windows (CRLF)**, do **Unix (LF)** ou do **Mac (CR)**. A conversão marca o documento como alterado; basta guardar para ter efeito.

A codificação e a quebra de linha atuais aparecem na barra de estado.

## 10. Snippets e macros

![Janela de snippets](img/s12-snippets.png)

Os **snippets** são excertos de texto já prontos. Abra **{{menu.tools}} → {{menu.tools.snippets}}**. A aplicação já traz alguns: `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` e `cabecalho`. Para usar, escreva o atalho no editor e escolha a sugestão (ou prima Ctrl+Espaço), ou clique em **{{snippets.insert}}** na janela. Para criar o seu, clique em **{{snippets.new}}** e dê-lhe um nome, um atalho e o texto. No texto, `$1` e `${2:predefinição}` marcam os locais onde o cursor pára, e `$0` é a posição final. Os snippets da aplicação não podem ser editados, mas pode duplicá-los.

![Janela de macros](img/s13-macros.png)

As **macros** repetem uma sequência que fez. Prima **Ctrl+Shift+R** para começar a gravar, escreva ou edite o que quiser e prima **Ctrl+Shift+R** de novo para parar. Depois, **Ctrl+Shift+M** executa a última gravação. Em **{{menu.tools.macros}}** escolhe quantas vezes repetir e pode guardar a macro com um nome. É gravado o texto escrito, o texto colado, as teclas de seta, Início, Fim, Retrocesso, Delete, Tab, Enter e os comandos dos menus. Os cliques do rato e o Ctrl+Z não são gravados.

## 11. Conta e ficheiros na nuvem

![Primeiro acesso: endereço do servidor](img/s16a-account-server.png)

Com uma conta, guarda ficheiros na nuvem e abre-os noutros computadores. Abra o menu **{{menu.account}}**.

1. **Endereço do servidor:** na primeira vez, indique o endereço que a sua empresa ou o administrador lhe forneceu. Começa por `https://`.
2. **Criar conta:** clique em **{{account.link.register}}** e preencha o e-mail, o nome e uma palavra-passe com pelo menos 10 caracteres.

![Ecrã de início de sessão](img/s16-account-login.png)

3. **Iniciar sessão:** use o e-mail e a palavra-passe. Se se esquecer da palavra-passe, clique em **{{account.link.forgot}}**: recebe um código por e-mail e escolhe uma nova palavra-passe.

![Perfil do utilizador](img/s18-account-profile.png)

4. **Perfil:** em **{{menu.account}}**, abra o seu perfil para mudar o nome, alterar a palavra-passe ou terminar a sessão. Ao alterar a palavra-passe, os outros computadores têm de iniciar sessão de novo.

![Lista de ficheiros na nuvem](img/s17-cloud-open.png)

5. **Guardar na nuvem:** **{{menu.file}} → {{menu.file.saveCloud}}**. Escolha o caminho, por exemplo `trabalho/ata.md`.
6. **Abrir da nuvem:** **{{menu.file}} → {{menu.file.openCloud}}**. Na lista pode abrir ou eliminar ficheiros. Num documento aberto da nuvem, **Ctrl+S** volta a guardar na nuvem.

Se o ficheiro tiver mudado na nuvem desde a última vez, a aplicação avisa e pergunta se quer substituí-lo. Cada ficheiro pode ter até 10 MB. Se o seu sistema não tiver cofre de credenciais, a aplicação avisa que terá de iniciar sessão sempre que a abrir.

## 12. Idiomas

![Bandeiras dos idiomas junto ao botão de pré-visualização](img/s08-flags.png)

A aplicação está disponível em **alemão, espanhol, francês, inglês, português (Brasil) e português (Portugal)**. Abre no idioma do seu sistema; se não existir tradução, abre em inglês. Para mudar, clique na bandeira do idioma, à esquerda do botão de pré-visualização. A escolha tem efeito de imediato e fica guardada para a próxima vez. Este manual abre no idioma que estiver em uso.

## 13. Atalhos de teclado

![Janela de atalhos de teclado](img/s14-shortcuts.png)

Para ver a lista dentro da aplicação, abra **{{menu.help}} → {{menu.help.shortcuts}}**. Os atalhos disponíveis:

{{shortcuts}}

## 14. Perguntas frequentes

**Fechei a aplicação sem guardar. Perdi o meu texto?**
Não. O texto por guardar é conservado automaticamente e regressa quando abrir a aplicação de novo.

**Porque é que o Markdown abre formatado e não consigo escrever?**
É o modo de leitura. Clique em **{{toolbar.editText}}** (ou Ctrl+Shift+E) para editar.

**O meu JSON mostra um erro, mas abre noutro programa.**
O visualizador segue o padrão rigoroso do JSON: não aceita vírgula a mais no fim, comentários nem aspas simples. Use o botão do erro para ir diretamente ao problema.

**O ficheiro é grande e não abre.**
O limite é de 50 MB por ficheiro.

**Não consigo iniciar sessão nem guardar na nuvem.**
Verifique o endereço do servidor e a ligação à internet. Se a mensagem disser que a sessão expirou, inicie sessão de novo.

**Como vejo a versão da aplicação?**
Em **{{menu.help}} → {{menu.help.about}}**.

## 15. Sobre e suporte

![Janela Sobre](img/s15-about.png)

![Menu Ajuda](img/s19-menu-help.png)

O **Meu Editor de Arquivos** foi desenvolvido por Diego Mendes Rodrigues. O item **{{menu.help.support}}** do menu Ajuda ainda não está disponível nesta versão.
