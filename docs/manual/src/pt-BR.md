# Meu Editor de Arquivos — Manual do usuário

Versão {{version}}

## 1. Bem-vindo

O **Meu Editor de Arquivos** é um editor leve para quem trabalha com textos, anotações, scripts, arquivos de configuração, logs e código. Ele funciona no Windows 11, no Debian 12 e 13 e no Ubuntu 22.04 ou mais novo, e **não precisa de internet** para editar.

O que você encontra nele:

- abas para vários arquivos ao mesmo tempo, com recuperação automática do que você escreveu;
- Markdown que abre **formatado**, com um botão para editar o texto;
- um **visualizador de JSON** em que você abre e fecha as partes do arquivo;
- busca e substituição em um arquivo ou em uma pasta inteira;
- realce de cores para dezenas de linguagens, snippets e macros;
- conta de usuário para guardar arquivos na nuvem e abri-los em outros computadores;
- tela em seis idiomas.

## 2. Conhecendo a tela

![Tela principal do aplicativo com uma pasta aberta e um documento Markdown](img/s01-main.png)

1. **Barra de menus** (no alto): {{menu.file}}, {{menu.edit}}, {{menu.search}}, {{menu.view}}, {{menu.encoding}}, {{menu.language}}, {{menu.tools}}, {{menu.account}} e {{menu.help}}.
2. **Barra de ferramentas**: atalhos para os comandos mais usados. Os botões de formatação aparecem quando o documento é Markdown. No lado direito ficam as **bandeiras dos idiomas** e o botão que alterna entre visualizar e editar.
3. **Barra lateral** (à esquerda): os documentos abertos, o explorador da pasta aberta e os arquivos recentes. Para ocultá-la ou exibi-la, use **Ctrl+Shift+B**.
4. **Abas**: cada documento tem uma aba. Um ponto (●) ao lado do nome indica que há alterações ainda não gravadas no arquivo.
5. **Área de edição**: onde você lê e escreve.
6. **Painel inferior**: mostra os resultados da busca em arquivos. Ele se abre sozinho quando você usa a busca.
7. **Barra de status** (embaixo): linha e coluna do cursor, tamanho do arquivo, codificação, tipo de quebra de linha e linguagem do documento.

## 3. Criar e abrir arquivos

![Botão Novo com a seta que lista os tipos de documento](img/s02-new-menu.png)

- **Novo documento:** clique em **{{toolbar.new}}** ou use **Ctrl+N**. O documento novo é Markdown (.md). Clique na **seta ao lado do botão** para criar um documento de outro tipo: .md (Markdown), .txt (texto), .py (Python) ou .sql (SQL).
- **Abrir arquivos:** **{{menu.file}} → {{menu.file.open}}** ou **Ctrl+O**. Você pode escolher vários arquivos de uma vez. O limite é de 50 MB por arquivo.
- **Abrir uma pasta:** **{{menu.file}} → {{menu.file.openFolder}}** ou **Ctrl+Shift+K**. A pasta aparece no explorador, na barra lateral, e um clique em um arquivo o abre. Use **{{menu.file.closeFolder}}** para fechá-la.
- **Arquivos recentes:** os últimos arquivos que você usou ficam na lista **Recentes**, na barra lateral. Clique em um deles para abri-lo de novo.

Se outro programa alterar um arquivo que você tem aberto, o aplicativo o recarrega sozinho. Se você tiver alterações suas ainda não gravadas naquele documento, ele pergunta antes. Se o arquivo for apagado ou movido, o nome da aba fica em vermelho e riscado.

![Menu Arquivo](img/s07-menu-file.png)

## 4. Salvar e documentos temporários

![Aviso de documentos restaurados ao reabrir o aplicativo](img/s20-restored.png)

- **{{menu.file.save}}** (**Ctrl+S**) grava o documento no arquivo. Em um documento novo, o aplicativo pede o nome e o local.
- **{{menu.file.saveAs}}** (**Ctrl+Shift+S**) grava uma cópia com outro nome ou em outro lugar.
- **{{menu.file.saveAll}}** grava todos os documentos com alterações.

**Você não perde o que escreveu.** O aplicativo guarda automaticamente, uns segundos depois de cada alteração, todos os documentos abertos, inclusive os que nunca foram salvos. Isso é independente de você salvar ou não.

Ao **fechar o aplicativo**, nada é perguntado e nada é descartado. Quando você abrir de novo, as abas, a pasta e o texto ainda não salvo voltam como estavam, com um aviso amarelo no alto da tela. Salve quando quiser gravar no arquivo de verdade.

Ao **fechar uma aba** que tem alterações, o aplicativo pergunta se você quer salvar, não salvar ou cancelar. Duas observações: o histórico de desfazer (Ctrl+Z) não é guardado entre uma abertura e outra, e a recuperação automática guarda até 100 MB de texto não salvo.

## 5. Editando texto

![Caracteres invisíveis: espaços, tabulações e fim de linha](img/s11-invisibles.png)

Os comandos de edição ficam em **{{menu.edit}}**, e os de exibição em **{{menu.view}}**.

- **Desfazer e refazer:** Ctrl+Z e Ctrl+Y.
- **Localizar e substituir** no documento: Ctrl+F e Ctrl+H. Para ir a uma linha, use Ctrl+G.
- **Vários cursores:** segure Alt e clique onde quiser um cursor, ou use Ctrl+D para selecionar a próxima ocorrência da palavra.
- **{{menu.edit.columnSelection}}:** segure Shift+Alt e arraste o mouse para editar várias linhas na mesma coluna.
- **Linhas:** Alt+↑ e Alt+↓ movem a linha; Shift+Alt+↑ e Shift+Alt+↓ a duplicam; Ctrl+/ comenta ou descomenta.
- **Organizar:** {{menu.edit.sortAsc}}, {{menu.edit.sortDesc}}, {{menu.edit.removeDuplicates}} e {{menu.edit.trimWhitespace}}.
- **{{menu.view.invisibles}}:** mostra os espaços (·), as tabulações (→) e o fim de cada linha (¶). É ótimo para achar espaços sobrando.
- **{{menu.view.wordWrap}}** e **{{menu.view.foldAll}} / {{menu.view.unfoldAll}}** ajudam a ler arquivos longos.
- **Tamanho da letra:** Ctrl++ aumenta, Ctrl+- diminui e Ctrl+0 volta ao tamanho padrão.
- **Indentação:** em **{{menu.edit}}**, escolha entre espaços ou tabulação e o tamanho (2, 4 ou 8 colunas).

As suas preferências de exibição ficam guardadas para a próxima vez. Os textos internos do editor, como a caixa de busca (Ctrl+F) e a paleta de comandos (F1), aparecem em inglês.

### Corretor ortográfico

![Palavra sublinhada e as sugestões de correção](img/s11a-spelling.png)

Em documentos Markdown, de texto (.txt) e LaTeX, as palavras que não estão no dicionário ficam sublinhadas em vermelho. Código, links, endereços, siglas e trechos entre crases não são verificados, e arquivos de log e CSV ficam de fora.

- Coloque o cursor na palavra e aperte **Ctrl+.** (ou clique com o botão direito e escolha **{{spell.suggestions}}**) para ver as sugestões. Escolha uma para trocar a palavra.
- **{{spell.addToDictionary}}** faz a palavra ser aceita dali em diante, em qualquer idioma.
- **{{menu.tools}} → {{menu.tools.spellCheck}}** (ou **F7**) liga e desliga a verificação.
- O corretor usa o idioma da interface. Para verificar em outro idioma, escolha em **{{menu.tools}}** uma das opções **{{spell.source}}: Deutsch**, **{{spell.source}}: English**… — há dicionários de alemão, espanhol, francês, inglês, português do Brasil e português de Portugal. **{{menu.tools.spellAuto}}** volta a seguir a interface.

Os dicionários vêm com o aplicativo: o corretor funciona sem internet.

## 6. Markdown

![Documento Markdown em modo de edição, com a barra de formatação](img/s03-markdown-edit.png)

Os arquivos Markdown (.md) abrem **formatados**, prontos para ler. Para editar o texto, clique em **{{toolbar.editText}}** (ou use **Ctrl+Shift+E**); para voltar à leitura, clique em **{{toolbar.preview}}**.

Em modo de edição, a barra de ferramentas oferece a formatação: títulos, lista com marcadores, lista numerada, recuo, **negrito** (Ctrl+B), *itálico* (Ctrl+I), ~~tachado~~ (Ctrl+Shift+X), link, tabela e remover formatação. Selecione o texto e clique no botão; sem seleção, o aplicativo coloca o modelo no lugar do cursor.

Na leitura, os links abrem no navegador do sistema. As imagens do documento não são exibidas na versão atual.

## 7. Arquivos JSON

![Arquivo JSON em árvore, com um item selecionado](img/s04-json-tree.png)

Os arquivos .json abrem em **árvore**. Clique na seta de um item para abrir ou fechar aquela parte. Use **{{menu.view.unfoldAll}}** e **{{menu.view.foldAll}}** para abrir ou fechar tudo. Ao clicar em um item, a barra mostra o caminho dele, e você pode copiar o **{{json.path}}** ou o **{{json.value}}**. Listas muito grandes são mostradas aos poucos, com um botão para ver mais.

Para editar, clique em **{{toolbar.editText}}**. No modo de edição, o botão **{{toolbar.formatJson}}** (Shift+Alt+F) organiza o arquivo.

![Mensagem de erro de um JSON inválido, com linha e coluna](img/s05-json-error.png)

Se o arquivo tiver um erro, o aplicativo explica o problema e diz a linha e a coluna. O botão **{{json.editGoToError}}** abre o editor já no ponto do erro.

## 8. Busca em arquivos

![Painel de busca com os resultados agrupados por arquivo](img/s06-search.png)

Abra uma pasta e use **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). O painel inferior se abre.

1. Digite o texto e clique em **{{search.run}}** (ou aperte Enter).
2. Ajuste a busca com os três botões ao lado: **{{search.caseSensitive}}**, **{{search.wholeWord}}** e **{{search.regex}}**.
3. Para limitar os arquivos, escreva um filtro, como `*.md, docs/**`.
4. Os resultados aparecem agrupados por arquivo, com linha e coluna. Clique em um resultado para abrir o arquivo e selecionar o trecho.

Para trocar o texto, escreva o novo no campo de substituição e clique em **{{search.replaceAll}}**. Desmarque os arquivos que não devem mudar. O aplicativo pede confirmação, porque **a substituição é gravada direto nos arquivos e não pode ser desfeita pelo editor**. Arquivos abertos com alterações não salvas são ignorados, para você não perder trabalho.

A busca não entra em pastas como `node_modules` e `.git`, nem em arquivos binários ou maiores que 5 MB. Ela mostra no máximo 5.000 ocorrências por vez.

## 9. Linguagem, codificação e quebras de linha

![Menu Codificação](img/s09-menu-encoding.png)

- **{{menu.language}}:** o aplicativo escolhe a linguagem pela extensão do arquivo e usa cores para facilitar a leitura. Para mudar a de um documento, abra o menu e escolha outra.

![Menu Linguagem](img/s10-menu-language.png)

- **{{menu.encoding}}:** converta o documento para **UTF-8** ou **UTF-8 com BOM**, e escolha a quebra de linha do **Windows (CRLF)** ou do **Unix/Mac (LF)**. A conversão marca o documento como alterado; basta salvar para valer.

A codificação e a quebra de linha atuais aparecem na barra de status.

## 10. Snippets e macros

![Janela de snippets](img/s12-snippets.png)

**Snippets** são trechos de texto prontos. Abra **{{menu.tools}} → {{menu.tools.snippets}}**. O aplicativo já traz alguns: `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` e `cabecalho`. Para usar, digite o atalho no editor e escolha a sugestão (ou aperte Ctrl+Espaço), ou clique em **{{snippets.insert}}** na janela. Para criar o seu, clique em **{{snippets.new}}**, dê um nome, um atalho e o texto. No texto, `$1` e `${2:padrão}` marcam os lugares onde o cursor para, e `$0` é o ponto final. Os snippets do aplicativo não podem ser editados, mas você pode duplicá-los.

![Janela de macros](img/s13-macros.png)

**Macros** repetem uma sequência que você fez. Aperte **Ctrl+Shift+R** para começar a gravar, escreva ou edite o que quiser e aperte **Ctrl+Shift+R** de novo para parar. Depois, **Ctrl+Shift+M** executa a última gravação. Em **{{menu.tools.macros}}** você escolhe quantas vezes repetir e pode salvar a macro com um nome. São gravados o texto digitado, o que você cola, as teclas de seta, Home, End, Backspace, Delete, Tab, Enter e os comandos dos menus. Cliques do mouse e Ctrl+Z não são gravados.

## 11. Conta e arquivos na nuvem

![Primeiro acesso: endereço do servidor](img/s16a-account-server.png)

Com uma conta, você guarda arquivos na nuvem e os abre em outros computadores. Abra o menu **{{menu.account}}**.

1. **Endereço do servidor:** na primeira vez, informe o endereço que sua empresa ou o administrador passou. Ele começa com `https://`.
2. **Criar conta:** clique em **{{account.link.register}}** e preencha e-mail, nome e uma senha com pelo menos 10 caracteres.

![Tela de entrada](img/s16-account-login.png)

3. **Entrar:** use o e-mail e a senha. Se esquecer a senha, clique em **{{account.link.forgot}}**: você recebe um código por e-mail e escolhe uma nova senha.

![Perfil do usuário](img/s18-account-profile.png)

4. **Perfil:** em **{{menu.account}}**, abra o seu perfil para mudar o nome, trocar a senha ou sair da conta. Ao trocar a senha, os outros computadores precisam entrar de novo.

![Lista de arquivos na nuvem](img/s17-cloud-open.png)

5. **Salvar na nuvem:** **{{menu.file}} → {{menu.file.saveCloud}}**. Escolha o caminho, por exemplo `trabalho/ata.md`.
6. **Abrir da nuvem:** **{{menu.file}} → {{menu.file.openCloud}}**. Na lista você abre ou exclui arquivos. Em um documento aberto da nuvem, **Ctrl+S** grava de volta na nuvem.

Se o arquivo mudou na nuvem desde a última vez, o aplicativo avisa e pergunta se você quer sobrescrever. Cada arquivo pode ter até 10 MB. Se o seu sistema não tem cofre de credenciais, o aplicativo avisa que você precisará entrar a cada abertura.

## 12. Idiomas

![Bandeiras dos idiomas ao lado do botão de visualização](img/s08-flags.png)

O aplicativo está disponível em **alemão, espanhol, francês, inglês, português (Brasil) e português (Portugal)**. Ele abre no idioma do seu sistema; se não houver tradução, abre em inglês. Para trocar, clique na bandeira do idioma, à esquerda do botão de visualização. A escolha vale na hora e fica guardada para a próxima vez. Este manual abre no idioma que estiver em uso.

## 13. Atalhos de teclado

![Janela de atalhos de teclado](img/s14-shortcuts.png)

Para ver a lista dentro do aplicativo, abra **{{menu.help}} → {{menu.help.shortcuts}}**. Os atalhos disponíveis:

{{shortcuts}}

## 14. Perguntas frequentes

**Fechei o aplicativo sem salvar. Perdi meu texto?**
Não. O texto não salvo é guardado automaticamente e volta quando você abre o aplicativo de novo.

**Por que o Markdown abre formatado e eu não consigo digitar?**
É o modo de leitura. Clique em **{{toolbar.editText}}** (ou Ctrl+Shift+E) para editar.

**Meu JSON mostra um erro, mas ele abre em outro programa.**
O visualizador segue o padrão rigoroso do JSON: não aceita vírgula sobrando no fim, comentários nem aspas simples. Use o botão do erro para ir direto ao problema.

**O arquivo é grande e não abre.**
O limite é de 50 MB por arquivo.

**Não consigo entrar na conta ou salvar na nuvem.**
Confira o endereço do servidor e a conexão com a internet. Se a mensagem disser que a sessão expirou, entre de novo.

**Como vejo a versão do aplicativo?**
Em **{{menu.help}} → {{menu.help.about}}**.

## 15. Sobre e suporte

![Janela Sobre](img/s15-about.png)

![Menu Ajuda](img/s19-menu-help.png)

O **Meu Editor de Arquivos** foi desenvolvido por Diego Mendes Rodrigues. O item **{{menu.help.support}}** do menu Ajuda ainda não está disponível nesta versão.
