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

### Organizar pela barra lateral

Clique com o botão direito numa pasta ou ficheiro da barra lateral, do computador ou da nuvem:

- **{{sidebar.rename}}** (pastas e ficheiros): abre a janela **{{rename.folderTitle}}** ou **{{rename.fileTitle}}** com o nome atual. Escreva o novo nome e clique em **{{rename.submit}}**. O nome não pode ficar vazio nem ter `\ / : * ? " < > |`. Os separadores abertos desse ficheiro, ou dos ficheiros dentro da pasta, passam a usar o novo nome.
- **{{sidebar.folderColor}}** (pastas): abre a janela **{{folderColor.title}}** com doze cores, com a atual marcada. Escolha outra e clique em **{{folderColor.submit}}**. As cores ficam guardadas neste computador.
- **{{common.delete}}** (pastas): só fica disponível quando a pasta está vazia.

A pasta aberta no explorador não pode ser mudada de nome nem eliminada por aqui.

Cada ficheiro tem um ícone conforme o tipo: documentos (.md, .txt, .tex), logs, programação, scripts, web, dados e configuração (as mesmas secções do botão **+**) e um ícone genérico para os restantes.

As áreas da barra lateral ({{sidebar.openDocs}}, {{sidebar.recent}}, as do Cliente de API e as outras) têm um triângulo à esquerda do nome: clique nele, ou no nome, para abrir ou fechar a área. Para mudar a ordem, arraste o nome da área para cima ou para baixo (pelo teclado, Alt+↑ e Alt+↓ com o nome selecionado). A ordem e as áreas fechadas ficam guardadas neste computador. Para tirar uma área da barra lateral, clique no X à direita do nome dela, ou desmarque-a em **{{menu.view.sidebarAreas}}**, no menu **{{menu.view}}**; volte a marcá-la para ela regressar ao lugar de antes.

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
- **Vários cursores:** mantenha Ctrl premido e clique onde quiser outro cursor, ou use Ctrl+D para selecionar a próxima ocorrência da palavra.
- **{{menu.edit.columnSelection}}:** mantenha Shift+Ctrl premido e arraste o rato para editar várias linhas na mesma coluna.
- **Linhas:** Alt+↑ e Alt+↓ movem a linha; Shift+Alt+↑ e Shift+Alt+↓ duplicam-na; Ctrl+/ comenta ou descomenta.
- **Arrumar:** {{menu.edit.sortAsc}}, {{menu.edit.sortDesc}}, {{menu.edit.removeDuplicates}} e {{menu.edit.trimWhitespace}}.
- **{{menu.view.invisibles}}:** mostra os espaços (·), as tabulações (→) e o fim de cada linha (¶). É ótimo para encontrar espaços a mais.
- **{{menu.view.wordWrap}}** e **{{menu.view.foldAll}} / {{menu.view.unfoldAll}}** ajudam a ler ficheiros compridos.
- **Tamanho do tipo de letra:** Ctrl++ aumenta, Ctrl+- diminui e Ctrl+0 repõe o tamanho predefinido.
- **Indentação:** em **{{menu.edit}}**, escolha entre espaços ou tabulação e o tamanho (2, 4 ou 8 colunas).
- **{{menu.view.fullScreen}}** (F11, em **{{menu.view}}**): mostra só o documento, a ocupar o ecrã todo. Prima F11 outra vez, ou clique no botão do canto superior direito, para sair.
- **{{menu.view.toggleTheme}}** (em **{{menu.view}}**): alterna entre o modo claro e o escuro. Enquanto não escolher, a aplicação segue o tema do sistema operativo; a escolha fica guardada para as próximas vezes.

As suas preferências de visualização ficam guardadas para a próxima vez. Os textos internos do editor, como a caixa de pesquisa (Ctrl+F) e a paleta de comandos (F1), aparecem em inglês.

![A aplicação no modo escuro](img/s22-dark-mode.png)

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

### Terminal

Em **{{menu.tools}} → {{menu.tools.openTerminal}}**, abre-se um terminal logo abaixo do documento, na sua pasta pessoal: o PowerShell no Windows e o seu shell (normalmente o bash) no Linux. Escreva os comandos e veja os resultados aí mesmo; o documento continua aberto acima, e o divisor entre os dois pode ser arrastado.

- Cada clique abre mais um terminal, num separador próprio (Terminal 1, Terminal 2…). O **×** do separador fecha o terminal; o comando `exit` também.
- Com texto selecionado no terminal, Ctrl+C copia; sem seleção, Ctrl+C interrompe o comando em execução. Ctrl+V cola.
- Enquanto o cursor está no terminal, as teclas vão para ele (Ctrl+W, Ctrl+R…), e não para os atalhos da aplicação.
- Os terminais não regressam na abertura seguinte da aplicação.

### Corretor ortográfico

![Palavra sublinhada e as sugestões de correção](img/s11a-spelling.png)

Em documentos Markdown, de texto (.txt) e LaTeX, as palavras que não estão no dicionário ficam sublinhadas a vermelho. Código, ligações, endereços, siglas e trechos entre acentos graves não são verificados, e ficheiros de registo e CSV ficam de fora.

- Coloque o cursor na palavra e prima **Ctrl+.** (ou clique com o botão direito e escolha **{{spell.suggestions}}**) para ver as sugestões. Escolha uma para trocar a palavra.
- **{{spell.addToDictionary}}** faz com que a palavra passe a ser aceite, em qualquer idioma.
- **{{menu.tools}} → {{menu.tools.spellCheck}}** (ou **F7**) liga e desliga a verificação.
- O corretor usa o idioma da interface. Para verificar noutro idioma, escolha em **{{menu.tools}} → {{menu.tools.spellSubmenu}}** uma das opções **{{spell.source}}: Deutsch**, **{{spell.source}}: English**… — há dicionários de alemão, espanhol, francês, inglês, português do Brasil e português de Portugal (Acordo Ortográfico de 1990). **{{menu.tools.spellAuto}}** volta a seguir a interface.

Os dicionários vêm com a aplicação: o corretor funciona sem internet.

### Assistente de IA (Ollama)

O **{{ai.title}}** usa um modelo de IA que corre no seu próprio computador, através do Ollama (ollama.com): nada sai para a internet. Abra o painel em **{{menu.tools}} → {{menu.tools.ai}}** ou com **Ctrl+Shift+I**. Se o Ollama ainda não estiver no computador, o próprio painel guia a instalação: no Windows, **{{ai.install.button}}** transfere o instalador oficial, verifica a assinatura digital e abre a janela dele para concluir; no Linux, **{{ai.install.openTerminal}}** escreve o comando oficial no terminal da aplicação para o rever e confirmar (precisa de sudo). Com o Ollama parado, use **{{ai.install.start}}**. Depois, escolha um modelo em **{{ai.install.pullTitle}}** e acompanhe a transferência; **{{ai.install.delete}}** liberta espaço.

- Escolha o modelo, escreva a pergunta e acompanhe a resposta enquanto é gerada; **{{ai.stop}}** interrompe e **{{ai.newChat}}** começa do zero.
- As **{{ai.quick.label}}** trabalham sobre a seleção (ou o documento inteiro): **{{ai.quick.explain}}**, **{{ai.quick.improve}}**, **{{ai.quick.fix}}**, **{{ai.quick.summarize}}**, **{{ai.quick.translate}}**, **{{ai.quick.document}}** e **{{ai.quick.tests}}**.
- Nos blocos de código da resposta, use **{{ai.code.copy}}**, **{{ai.code.insert}}** ou **{{ai.code.replace}}**.
- A conversa fica só na memória e desaparece ao fechar a aplicação. Por omissão, o assistente só comunica com um Ollama deste computador.

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

## 8. Cliente de API

![Cliente de API com um pedido enviado e a resposta em árvore](img/s23-api-request.png)

O Cliente de API serve para testar serviços na internet (APIs): monta um pedido, envia-o e confere a resposta, sem sair do editor. Cada pedido é um ficheiro **.apireq**, que pode guardar, copiar e versionar como qualquer outro.

### Abrir

- Prima **Ctrl+Shift+A**, ou use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiClient}}**.
- Ou use **{{menu.file}} → Novo pedido de API (.apireq)**.

O documento abre no **{{apiClient.builder}}**. Para ver e editar o ficheiro como texto (JSON), clique em **{{toolbar.editText}}**.

### Montar o pedido

Escolha o **{{apiClient.method}}** (GET, POST…) e escreva o endereço em **{{apiClient.url}}**. Os dados ficam em separadores:

- **{{apiClient.tab.params}}**: os parâmetros da query. O que escreve na URL aparece aqui, e vice-versa.
- **{{apiClient.tab.auth}}**: como se identificar no serviço (veja abaixo).
- **{{apiClient.tab.headers}}**: os cabeçalhos do pedido.
- **{{apiClient.tab.body}}**: o conteúdo enviado. Em **{{apiClient.body.type}}** escolhe entre JSON, XML, texto, HTML, formulário, formulário com ficheiros, ficheiro binário, GraphQL, SOAP ou nenhum corpo.
- **{{apiClient.tab.settings}}**: tempo limite, redirecionamentos, proxy, certificados e **{{apiClient.settings.verifyTls}}**. Desligue a verificação apenas em ambientes de teste.

Em qualquer campo, use <code>&#123;&#123;nome&#125;&#125;</code> para inserir uma variável do ambiente ativo.

### Enviar e ver a resposta

Clique em **{{apiClient.send}}** ou prima **Ctrl+Enter**. Enquanto o pedido está em curso, **Esc** cancela o envio. O botão de seta ao lado oferece **{{apiClient.sendDownload}}**, que grava o corpo diretamente num ficheiro (útil para respostas grandes ou binárias).

A resposta mostra o estado, o tempo e o tamanho, e tem os separadores **{{apiClient.response.tab.body}}**, **{{apiClient.response.tab.headers}}**, **{{apiClient.response.tab.cookies}}**, **{{apiClient.response.tab.tests}}** e **{{apiClient.response.tab.timings}}**. O corpo pode ser visto como **{{apiClient.response.view.tree}}** (para abrir e fechar as partes do JSON), **{{apiClient.response.view.pretty}}** ou **{{apiClient.response.view.raw}}**. Use **{{apiClient.response.saveResponse}}** para guardar a resposta num ficheiro .apiresp, e **{{apiClient.response.openBody}}** para a editar como um documento comum.

### Autorização

No separador **{{apiClient.tab.auth}}**, escolha em **{{apiClient.auth.type}}**: API Key, Basic Auth, Bearer Token, OAuth 1.0 ou OAuth 2.0. No OAuth 2.0 existem os fluxos **{{apiClient.oauth.flow.authorizationCode}}**, **{{apiClient.oauth.flow.clientCredentials}}**, **{{apiClient.oauth.flow.deviceCode}}** e **{{apiClient.oauth.flow.password}}**; clique em **{{apiClient.oauth.getToken}}** e, se for preciso, o navegador do sistema abre para autorizar o acesso. Com **{{apiClient.auth.inherit}}**, o pedido usa a autorização definida na coleção.

Para palavras-passe e tokens, use uma variável secreta (veja "Ambientes e segredos"): assim o valor nunca é gravado no ficheiro do pedido.

### Testes e extrações

No separador **{{apiClient.tab.tests}}**:

- **{{apiClient.tests.assertions}}**: regras verificadas a cada envio, como "o estado é igual a 200", "o corpo contém um texto" ou "o JSONPath existe". O resultado aparece no separador **{{apiClient.response.tab.tests}}** da resposta.
- **{{apiClient.tests.extractions}}**: guardam um valor da resposta (por exemplo, um token) numa variável do ambiente, para usar nos pedidos seguintes.

### Ambientes e segredos

![Ambiente de API com uma variável comum e uma secreta](img/s24-api-environment.png)

Um ambiente reúne variáveis, como o endereço do servidor de testes e o de produção. Use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiEnvironments}}** para criar um (ficheiro **.apienv**) e escolha o ativo no seletor **{{apiClient.env.select}}**.

- Marque **{{apiClient.env.secret}}** nas variáveis sigilosas. O valor fica cifrado neste computador e **não vai para o ficheiro .apienv**.
- Marque **{{apiClient.env.production}}** num ambiente de produção: a aplicação pede confirmação antes de enviar POST, PUT, PATCH e DELETE.
- Os cookies recebidos ficam separados por ambiente; veja-os ou apague-os em **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiCookies}}**.

### Coleções e histórico

Uma coleção é uma pasta com os pedidos e o ficheiro **.apicol**, que guarda a autorização e as variáveis comuns. Na barra lateral, a secção **{{apiClient.col.section}}** mostra as coleções das pastas abertas; use o botão direito para criar pedidos e pastas, **{{apiClient.col.run}}**, **{{apiClient.col.export}}**, **{{apiClient.col.document}}** (gera a documentação da coleção) e **{{apiClient.col.settings}}**.

O **{{apiClient.history.section}}** (também em **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiHistory}}**) lista os últimos pedidos enviados, e pode limpá-lo quando quiser.

### Importar, exportar e gerar código

- **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiImport}}** traz pedidos de curl, Postman, OpenAPI/Swagger, Insomnia, HAR e ficheiros .http. Clique em **{{apiClient.import.analyze}}** para ver o que será importado e escolha **{{apiClient.import.asCollection}}** ou **{{apiClient.import.openInTabs}}**. Colar um comando curl na URL também oferece a importação.
- **{{apiClient.col.export}}** grava a coleção como Postman, OpenAPI, HAR, .http ou curl. Os valores de variáveis secretas nunca são exportados.
- O botão **{{apiClient.code}}** abre **{{apiClient.codegen.title}}** e mostra o pedido em várias linguagens, pronto a copiar.

### Executar uma coleção

Em **{{apiClient.col.run}}**, escolha os pedidos, o ambiente, o número de iterações e o atraso entre eles. Um ficheiro de dados (CSV ou JSON) repete a execução com os valores de cada linha, e **{{apiClient.runner.stopOnFailure}}** interrompe no primeiro erro. Clique em **{{apiClient.runner.start}}**: o resultado abre como relatório (**.apirun**), com totais, tempos e os testes de cada pedido. Em **{{apiClient.report.export}}** o relatório sai em JUnit XML, HTML ou Markdown.

### GraphQL

Em **{{apiClient.body.type}}**, escolha GraphQL para escrever a **{{apiClient.graphql.query}}** e as **{{apiClient.graphql.variables}}**. Com **{{apiClient.graphql.loadSchema}}**, a aplicação lê o schema do servidor, mostra a documentação dos tipos e oferece o preenchimento automático.

Quando a operação escolhida é uma **subscription**, aparece o botão **{{apiClient.graphql.subscribe}}**: a aplicação abre um WebSocket (protocolo graphql-transport-ws) no endereço do pedido e mostra os eventos recebidos logo abaixo do editor. Clique em **{{apiClient.mock.stop}}** para terminar.

### SOAP e WSDL

Em **{{apiClient.body.type}}**, escolha SOAP, a **{{apiClient.soap.version}}** (1.1 ou 1.2) e a SOAPAction; **{{apiClient.soap.template}}** preenche um envelope vazio. Para criar os pedidos a partir de um serviço, use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiImport}}** com o ficheiro WSDL: cada operação dá origem a um pedido, já com o envelope de exemplo. Nos testes e extrações, o alvo XPath lê respostas XML (por exemplo, <code>//*[local-name()='Resultado']</code>).

### WebSocket

Use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiWebSocket}}** para criar uma ligação (ficheiro **.apiws**). Escreva o **{{apiClient.ws.url}}** (ws:// ou wss://), os cabeçalhos e os subprotocolos e clique em **{{apiClient.ws.connect}}**. Escreva a mensagem (texto, JSON ou binário em base64) e envie com **Ctrl+Enter**. O **{{apiClient.ws.log}}** mostra as mensagens enviadas e recebidas, com hora e tamanho; é possível filtrar, pausar e limpar. Use **{{apiClient.ws.saveMessage}}** para guardar mensagens que envia com frequência.

### Servidor mock

Um servidor mock responde no lugar da API real, com respostas que já conhece. Na resposta de um pedido guardado, clique em **{{apiClient.response.saveExample}}**: a aplicação guarda o exemplo junto do pedido. Depois, no botão direito da coleção, escolha **{{apiClient.col.mock}}** (ou **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiMock}}**). As rotas vêm dos exemplos guardados ou de um ficheiro OpenAPI; ajuste o estado e o atraso de cada uma e clique em **{{apiClient.mock.start}}**. O servidor só atende neste computador, a menos que marque **{{apiClient.mock.lan}}**, e para sozinho ao fim de 8 horas sem chamadas.

### gRPC

Use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiGrpc}}** para criar uma chamada (ficheiro **.apigrpc**). Indique o **{{apiClient.grpc.address}}**, marque **{{apiClient.grpc.tls}}** se o servidor o exigir e escolha a **{{apiClient.grpc.source}}**: **{{apiClient.grpc.source.reflection}}** ou **{{apiClient.grpc.source.proto}}**. Clique em **{{apiClient.grpc.load}}**, escolha o serviço e o método e use **{{apiClient.grpc.useTemplate}}** para começar a mensagem em JSON. Chamadas simples e com streaming do servidor usam **{{apiClient.grpc.invoke}}**; com streaming do cliente ou nos dois sentidos, use **{{apiClient.grpc.start}}**, **{{apiClient.grpc.send}}** e **{{apiClient.grpc.end}}**. As mensagens, os metadados e o estado aparecem na lista de eventos.

### Monitores

Um monitor repete a execução de uma coleção a cada tantos minutos e avisa por notificação do sistema quando algo falha (e de novo quando volta a passar). No botão direito da coleção, escolha **{{apiClient.col.monitor}}** (ou **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiMonitor}}**), defina o intervalo, o ambiente e os pedidos e guarde. O gráfico mostra o tempo de cada execução, com as falhas a vermelho; **{{apiClient.monitor.runNow}}** executa de imediato. Os monitores só funcionam com a aplicação aberta e retomam sozinhos quando a volta a abrir.

### Scripts

No separador **{{apiClient.tab.tests}}**, abaixo das asserções, há dois scripts opcionais em JavaScript: **{{apiClient.scripts.pre}}** (pode alterar o URL, os cabeçalhos e o corpo) e **{{apiClient.scripts.post}}** (pode verificar a resposta com <code>test</code> e <code>expect</code> e guardar valores com <code>env.set</code>). O alias <code>pm</code> aceita o básico dos scripts do Postman. Os scripts correm isolados, sem rede, ficheiros nem acesso ao computador, com limite de tempo e de memória; o que escrevem com <code>console.log</code> aparece no bloco **{{apiClient.scripts.console}}** da resposta.

Scripts que não escreveu (importados ou recebidos de outra pessoa) não correm sozinhos: o pedido mostra um aviso com **{{apiClient.scripts.trustCollection}}**. A confiança vale só neste computador e cai se os scripts mudarem.

### IA no Cliente de API

No painel da resposta, **{{ai.api.explain}}** pede ao assistente uma explicação da resposta e **{{ai.api.suggestTests}}** sugere asserções para o separador **{{apiClient.tab.tests}}**. No botão direito da coleção, **{{ai.api.document}}** escreve a documentação. Os cabeçalhos de autenticação e os valores secretos não são enviados ao modelo.

Nos scripts, <code>pm.sendRequest</code> faz pedidos auxiliares (por exemplo, para obter um token), com as mesmas regras de segredos dos pedidos comuns e no máximo 10 por script.

### Segurança

- Todos os pedidos saem do próprio computador, pela aplicação; nada passa por servidores nossos.
- Palavras-passe, tokens e valores secretos ficam no cofre do sistema operativo (cifrados). Se o sistema não tiver cofre, ficam apenas na memória e perdem-se ao fechar a aplicação.
- Estes valores **nunca** vão para os ficheiros (.apireq, .apienv, .apicol), nem para exportações, geração de código, registos ou para a nuvem. O histórico e os cookies também ficam apenas neste computador.
- Apenas as respostas guardadas e os relatórios de uma coleção podem ser sincronizados com a nuvem, e só se ligar **{{apiClient.col.syncResponses}}**.

## 9. Pesquisa em ficheiros

![Painel de pesquisa com os resultados agrupados por ficheiro](img/s06-search.png)

Abra uma pasta e use **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). O painel inferior abre-se.

1. Escreva o texto e clique em **{{search.run}}** (ou prima Enter).
2. Ajuste a pesquisa com os três botões ao lado: **{{search.caseSensitive}}**, **{{search.wholeWord}}** e **{{search.regex}}**.
3. Para limitar os ficheiros, escreva um filtro, como `*.md, docs/**`.
4. Os resultados aparecem agrupados por ficheiro, com linha e coluna. Clique num resultado para abrir o ficheiro e selecionar o excerto.

Para substituir o texto, escreva o novo no campo de substituição e clique em **{{search.replaceAll}}**. Desmarque os ficheiros que não devem mudar. A aplicação pede confirmação, porque **a substituição é gravada diretamente nos ficheiros e não pode ser anulada pelo editor**. Os ficheiros abertos com alterações por guardar são ignorados, para não perder trabalho.

A pesquisa não entra em pastas como `node_modules` e `.git`, nem em ficheiros binários ou com mais de 5 MB. Mostra, no máximo, 5.000 ocorrências de cada vez.

## 10. Linguagem, codificação e fins de linha

![Menu Codificação](img/s09-menu-encoding.png)

- **{{menu.language}}:** a aplicação escolhe a linguagem pela extensão do ficheiro e usa cores para facilitar a leitura. Para mudar a linguagem de um documento, abra o menu e escolha outra.

![Menu Linguagem](img/s10-menu-language.png)

- **{{menu.encoding}}:** converta o documento para **UTF-8** ou **UTF-8 com BOM**, e escolha a quebra de linha do **Windows (CRLF)**, do **Unix (LF)** ou do **Mac (CR)**. A conversão marca o documento como alterado; basta guardar para ter efeito.
  - **{{menu.encoding.autoFormat}}** remove os espaços duplos do documento (a indentação das linhas mantém-se) e formata-o no padrão da linguagem: Python como Python (PEP 8), C e C++ no estilo LLVM, Java no estilo Google, C# no estilo Microsoft, Go com o gofmt, e JavaScript, TypeScript, JSON, CSS, HTML, Markdown, YAML, PHP e XML com o Prettier; também Lua, Shell e SQL. Funciona sem internet. Nas linguagens sem formatador (Rust, PowerShell, Batch, LaTeX, INI, TOML e texto), só os espaços duplos são removidos, e a barra de estado avisa. Se o código tiver erro de sintaxe, uma janela indica a linha do erro.
  - No Python, se a indentação estiver em falta, é deduzida: depois de uma linha terminada em `:` o bloco abre um nível; blocos de `if`, `for`, `while`, `try` e `with` ficam com a linha seguinte; o corpo de um `def` vai até uma linha em branco ou um `return`. Confirme o resultado, porque em Python a indentação muda o que o programa faz. As aspas ficam como as escreveu. Atenção: espaços duplos dentro de textos entre aspas também são removidos. Ctrl+Z anula tudo de uma vez.
  - **{{menu.encoding.url}}** codifica o texto selecionado no formato de endereços web (`minha página` passa a `minha%20p%C3%A1gina`); se o texto já estiver codificado, descodifica. Num endereço completo (`https://…`), os separadores `: / ? & = #` são mantidos.

A codificação e a quebra de linha atuais aparecem na barra de estado.

## 11. Snippets e macros

![Janela de snippets](img/s12-snippets.png)

Os **snippets** são excertos de texto já prontos. Abra **{{menu.tools}} → {{menu.tools.snippets}}**. A aplicação já traz alguns: `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` e `cabecalho`. Para usar, escreva o atalho no editor e escolha a sugestão (ou prima Ctrl+Espaço), ou clique em **{{snippets.insert}}** na janela. Para criar o seu, clique em **{{snippets.new}}** e dê-lhe um nome, um atalho e o texto. No texto, `$1` e `${2:predefinição}` marcam os locais onde o cursor pára, e `$0` é a posição final. Os snippets da aplicação não podem ser editados, mas pode duplicá-los.

![Janela de macros](img/s13-macros.png)

As **macros** repetem uma sequência que fez. Prima **Ctrl+Shift+R** para começar a gravar, escreva ou edite o que quiser e prima **Ctrl+Shift+R** de novo para parar. Depois, **Ctrl+Shift+M** executa a última gravação. Em **{{menu.tools.macros}}** escolhe quantas vezes repetir e pode guardar a macro com um nome. É gravado o texto escrito, o texto colado, as teclas de seta, Início, Fim, Retrocesso, Delete, Tab, Enter e os comandos dos menus. Os cliques do rato e o Ctrl+Z não são gravados.

## 12. Conta e ficheiros na nuvem

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

Com a conta ligada, o rodapé mostra, à esquerda do ícone da nuvem, quanto espaço usa na nuvem, em MB com duas casas decimais (por exemplo, `1.25 MB`). A conta soma todos os seus ficheiros na nuvem e os textos dos documentos ainda não guardados, que ficam guardados para continuar noutro computador. O valor muda a cada gravação ou eliminação. Um ficheiro da nuvem aberto sem alterações não ocupa espaço a mais; só o texto ainda não guardado é guardado.

Se o mesmo documento for alterado em dois computadores antes de sincronizar, cada computador fica com o seu texto, e a versão do outro abre num separador novo, com "(conflito – outro computador)" no nome, para nada se perder.

## 13. Idiomas

![Bandeiras dos idiomas junto ao botão de pré-visualização](img/s08-flags.png)

A aplicação está disponível em **alemão, espanhol, francês, inglês, português (Brasil) e português (Portugal)**. Abre no idioma do seu sistema; se não existir tradução, abre em inglês. Para mudar, clique na bandeira do idioma, à esquerda do botão de pré-visualização. A escolha tem efeito de imediato e fica guardada para a próxima vez. Este manual abre no idioma que estiver em uso.

## 14. Atalhos de teclado

![Janela de atalhos de teclado](img/s14-shortcuts.png)

Para ver a lista dentro da aplicação, abra **{{menu.help}} → {{menu.help.shortcuts}}**. Os atalhos disponíveis:

{{shortcuts}}

## 15. Perguntas frequentes

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

## 16. Sobre e suporte

![Janela Sobre](img/s15-about.png)

![Menu Ajuda](img/s19-menu-help.png)

O **Meu Editor de Arquivos** foi desenvolvido por Diego Mendes Rodrigues. O item **{{menu.help.support}}** do menu Ajuda ainda não está disponível nesta versão.
