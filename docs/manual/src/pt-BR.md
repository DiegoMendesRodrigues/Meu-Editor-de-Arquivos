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

### Organizar pela barra lateral

Clique com o botão direito em uma pasta ou arquivo da barra lateral, do computador ou da nuvem:

- **{{sidebar.rename}}** (pastas e arquivos): abre a janela **{{rename.folderTitle}}** ou **{{rename.fileTitle}}** com o nome atual. Digite o novo nome e clique em **{{rename.submit}}**. O nome não pode ficar vazio nem ter `\ / : * ? " < > |`. As abas abertas desse arquivo, ou dos arquivos dentro da pasta, passam a usar o novo nome.
- **{{sidebar.folderColor}}** (pastas): abre a janela **{{folderColor.title}}** com doze cores, com a atual marcada. Escolha outra e clique em **{{folderColor.submit}}**. As cores ficam guardadas neste computador.
- **{{common.delete}}** (pastas): só fica disponível quando a pasta está vazia.

A pasta aberta no explorador não pode ser renomeada nem excluída por aqui.

Cada arquivo tem um ícone conforme o tipo: documentos (.md, .txt, .tex), logs, programação, scripts, web, dados e configuração (as mesmas seções do botão **+**) e um ícone genérico para os demais.

As áreas da barra lateral ({{sidebar.openDocs}}, {{sidebar.recent}}, as do Cliente de API e as outras) têm um triângulo à esquerda do nome: clique nele, ou no nome, para abrir ou fechar a área. Para mudar a ordem, arraste o nome da área para cima ou para baixo (pelo teclado, Alt+↑ e Alt+↓ com o nome selecionado). A ordem e as áreas fechadas ficam guardadas neste computador.

## 4. Salvar e documentos temporários

- **{{menu.file.save}}** (**Ctrl+S**) grava o documento no arquivo. Em um documento novo, o aplicativo pede o nome e o local.
- **{{menu.file.saveAs}}** (**Ctrl+Shift+S**) grava uma cópia com outro nome ou em outro lugar.
- **{{menu.file.saveAll}}** grava todos os documentos com alterações.

**Você não perde o que escreveu.** O aplicativo guarda automaticamente, uns segundos depois de cada alteração, todos os documentos abertos, inclusive os que nunca foram salvos. Isso é independente de você salvar ou não.

Ao **fechar o aplicativo**, nada é perguntado e nada é descartado. Quando você abrir de novo, as abas, a pasta e o texto ainda não salvo voltam como estavam. Salve quando quiser gravar no arquivo de verdade.

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
- **{{menu.view.fullScreen}}** (F11, em **{{menu.view}}**): mostra só o documento, ocupando a tela toda. Pressione F11 de novo, ou clique no botão do canto superior direito, para sair.
- **{{menu.view.toggleTheme}}** (em **{{menu.view}}**): alterna entre o modo claro e o escuro. Enquanto você não escolhe, o aplicativo segue o tema do sistema operacional; a escolha fica guardada para as próximas vezes.

As suas preferências de exibição ficam guardadas para a próxima vez. Os textos internos do editor, como a caixa de busca (Ctrl+F) e a paleta de comandos (F1), aparecem em inglês.

![O aplicativo no modo escuro](img/s22-dark-mode.png)

### Letras, espaços e quebras de linha

![Menu Editar com o submenu Converter letras para aberto](img/s20-menu-edit.png)

No fim do menu **{{menu.edit}}** há três submenus:

- **{{menu.edit.eol}}:** converte as quebras de linha do documento para o formato Windows (CRLF), Unix (LF) ou Mac (CR). A conversão marca o documento como alterado; basta salvar para valer.
- **{{menu.edit.case}}:** com um texto selecionado, escolha {{menu.edit.caseUpper}}, {{menu.edit.caseLower}} ou {{menu.edit.caseSentence}} (só a primeira letra de cada frase fica maiúscula).
- **{{menu.edit.spaces}}:** {{menu.edit.trimRight}}, {{menu.edit.trimLeft}} e {{menu.edit.trimBoth}} valem para a linha do cursor (ou para as linhas selecionadas). {{menu.edit.collapseSpaces}} troca dois ou mais espaços seguidos por um só no documento inteiro, sem mexer na indentação do começo das linhas.

### MD5, SHA-1, SHA-256 e SHA-512

![Janela para gerar o SHA-256 de um texto](img/s21-hash.png)

No fim do menu **{{menu.tools}}**, cada algoritmo tem duas opções:

- **{{menu.tools.hashGenerate}}:** abre uma janela; digite ou cole o texto e o resultado aparece na hora, logo abaixo. **{{hash.copy}}** leva o resultado para a área de transferência.
- **{{menu.tools.hashSelection}}:** calcula o resultado a partir do texto selecionado no documento e o deixa na área de transferência, pronto para colar. Um aviso aparece na barra de status.

### Terminal

Em **{{menu.tools}} → {{menu.tools.openTerminal}}**, um terminal abre logo abaixo do documento, na sua pasta pessoal: o PowerShell no Windows e o seu shell (normalmente o bash) no Linux. Digite os comandos e veja os resultados ali mesmo; o documento continua aberto acima, e o divisor entre os dois pode ser arrastado.

- Cada clique abre mais um terminal, numa aba própria (Terminal 1, Terminal 2…). O **×** da aba fecha o terminal; o comando `exit` também.
- Com um texto selecionado no terminal, Ctrl+C copia; sem seleção, Ctrl+C interrompe o comando em execução. Ctrl+V cola.
- Enquanto o cursor está no terminal, as teclas vão para ele (Ctrl+W, Ctrl+R…), e não para os atalhos do aplicativo.
- Os terminais não voltam na próxima abertura do aplicativo.

### Corretor ortográfico

![Palavra sublinhada e as sugestões de correção](img/s11a-spelling.png)

Em documentos Markdown, de texto (.txt) e LaTeX, as palavras que não estão no dicionário ficam sublinhadas em vermelho. Código, links, endereços, siglas e trechos entre crases não são verificados, e arquivos de log e CSV ficam de fora.

- Coloque o cursor na palavra e aperte **Ctrl+.** (ou clique com o botão direito e escolha **{{spell.suggestions}}**) para ver as sugestões. Escolha uma para trocar a palavra.
- **{{spell.addToDictionary}}** faz a palavra ser aceita dali em diante, em qualquer idioma.
- **{{menu.tools}} → {{menu.tools.spellCheck}}** (ou **F7**) liga e desliga a verificação.
- O corretor usa o idioma da interface. Para verificar em outro idioma, escolha em **{{menu.tools}} → {{menu.tools.spellSubmenu}}** uma das opções **{{spell.source}}: Deutsch**, **{{spell.source}}: English**… — há dicionários de alemão, espanhol, francês, inglês, português do Brasil e português de Portugal. **{{menu.tools.spellAuto}}** volta a seguir a interface.

Os dicionários vêm com o aplicativo: o corretor funciona sem internet.

### Assistente de IA (Ollama)

O **{{ai.title}}** usa um modelo de IA que roda no seu próprio computador, pelo Ollama (ollama.com): nada sai para a internet. Abra o painel em **{{menu.tools}} → {{menu.tools.ai}}** ou com **Ctrl+Shift+I**. Se o Ollama ainda não estiver no computador, o próprio painel guia a instalação: no Windows, **{{ai.install.button}}** baixa o instalador oficial, confere a assinatura digital e abre a janela dele para você concluir; no Linux, **{{ai.install.openTerminal}}** digita o comando oficial no terminal do aplicativo para você revisar e confirmar (ele precisa de sudo). Com o Ollama parado, use **{{ai.install.start}}**. Depois, escolha um modelo em **{{ai.install.pullTitle}}** e acompanhe o download; **{{ai.install.delete}}** libera espaço.

- Escolha o modelo, escreva a pergunta e acompanhe a resposta enquanto ela é gerada; **{{ai.stop}}** interrompe e **{{ai.newChat}}** começa do zero.
- As **{{ai.quick.label}}** trabalham sobre a seleção (ou o documento inteiro): **{{ai.quick.explain}}**, **{{ai.quick.improve}}**, **{{ai.quick.fix}}**, **{{ai.quick.summarize}}**, **{{ai.quick.translate}}**, **{{ai.quick.document}}** e **{{ai.quick.tests}}**.
- Nos blocos de código da resposta, use **{{ai.code.copy}}**, **{{ai.code.insert}}** ou **{{ai.code.replace}}**.
- A conversa fica só na memória e some ao fechar o aplicativo. Por padrão, o assistente só conversa com um Ollama deste computador.

## 6. Markdown

![Documento Markdown em modo de edição, com a barra de formatação](img/s03-markdown-edit.png)

Os arquivos Markdown (.md) abrem **formatados** e você pode continuar escrevendo direto no texto formatado. A barra de ferramentas aplica a formatação no lugar do cursor ou na seleção: títulos, lista com marcadores, lista numerada, recuo, **negrito** (Ctrl+B), *itálico* (Ctrl+I), ~~tachado~~ (Ctrl+Shift+X), link, tabela e remover formatação. Ctrl+Z e Ctrl+Y desfazem e refazem.

Para ver e editar o código Markdown, clique em **{{toolbar.editText}}** (ou use **Ctrl+Shift+E**); para voltar ao texto formatado, clique em **{{toolbar.preview}}**. A barra de formatação funciona nos dois modos.

Ao editar no texto formatado, o Markdown é regravado num formato padronizado (por exemplo, listas com `-`). Documentos que têm HTML ficam só para leitura nesse modo, para o HTML não se perder: edite-os pelo **{{toolbar.editText}}**. Para abrir um link no navegador, use Ctrl+clique. As imagens aparecem como uma etiqueta com o nome, e o endereço é mantido no arquivo.

## 7. Arquivos JSON

![Arquivo JSON em árvore, com um item selecionado](img/s04-json-tree.png)

Os arquivos .json abrem em **árvore**. Clique na seta de um item para abrir ou fechar aquela parte. Use **{{menu.view.unfoldAll}}** e **{{menu.view.foldAll}}** para abrir ou fechar tudo. Ao clicar em um item, a barra mostra o caminho dele, e você pode copiar o **{{json.path}}** ou o **{{json.value}}**. Listas muito grandes são mostradas aos poucos, com um botão para ver mais.

Para editar, clique em **{{toolbar.editText}}**. No modo de edição, o botão **{{toolbar.formatJson}}** (Shift+Alt+F) organiza o arquivo.

![Mensagem de erro de um JSON inválido, com linha e coluna](img/s05-json-error.png)

Se o arquivo tiver um erro, o aplicativo explica o problema e diz a linha e a coluna. O botão **{{json.editGoToError}}** abre o editor já no ponto do erro.

## 8. Cliente de API

![Cliente de API com uma requisição enviada e a resposta em árvore](img/s23-api-request.png)

O Cliente de API serve para testar serviços na internet (APIs): você monta uma requisição, envia e confere a resposta, sem sair do editor. Cada requisição é um arquivo **.apireq**, que você guarda, copia e versiona como qualquer outro.

### Abrir

- Aperte **Ctrl+Shift+A**, ou use **{{menu.tools}} → {{menu.tools.apiClient}}**.
- Ou use **{{menu.file}} → Novo arquivo de requisição de API (.apireq)**.

O documento abre no **{{apiClient.builder}}**. Para ver e editar o arquivo como texto (JSON), clique em **{{toolbar.editText}}**.

### Montar a requisição

Escolha o **{{apiClient.method}}** (GET, POST…) e digite o endereço em **{{apiClient.url}}**. Os dados ficam em abas:

- **{{apiClient.tab.params}}**: os parâmetros da query. O que você digita na URL aparece aqui, e vice-versa.
- **{{apiClient.tab.auth}}**: como se identificar no serviço (veja abaixo).
- **{{apiClient.tab.headers}}**: os cabeçalhos da requisição.
- **{{apiClient.tab.body}}**: o conteúdo enviado. Em **{{apiClient.body.type}}** você escolhe entre JSON, XML, texto, HTML, formulário, formulário com arquivos, arquivo binário, GraphQL, SOAP ou nenhum corpo.
- **{{apiClient.tab.settings}}**: tempo limite, redirecionamentos, proxy, certificados e **{{apiClient.settings.verifyTls}}**. Desligue a verificação só em ambientes de teste.

Em qualquer campo, use <code>&#123;&#123;nome&#125;&#125;</code> para inserir uma variável do ambiente ativo.

### Enviar e ver a resposta

Clique em **{{apiClient.send}}** ou aperte **Ctrl+Enter**. Enquanto a requisição está em andamento, **Esc** cancela o envio. O botão de seta ao lado oferece **{{apiClient.sendDownload}}**, que grava o corpo direto num arquivo (útil para respostas grandes ou binárias).

A resposta mostra o status, o tempo e o tamanho, e tem as abas **{{apiClient.response.tab.body}}**, **{{apiClient.response.tab.headers}}**, **{{apiClient.response.tab.cookies}}**, **{{apiClient.response.tab.tests}}** e **{{apiClient.response.tab.timings}}**. O corpo pode ser visto como **{{apiClient.response.view.tree}}** (para abrir e fechar as partes do JSON), **{{apiClient.response.view.pretty}}** ou **{{apiClient.response.view.raw}}**. Use **{{apiClient.response.saveResponse}}** para guardar a resposta num arquivo .apiresp, e **{{apiClient.response.openBody}}** para editá-la como um documento comum.

### Autorização

Na aba **{{apiClient.tab.auth}}**, escolha em **{{apiClient.auth.type}}**: API Key, Basic Auth, Bearer Token, OAuth 1.0 ou OAuth 2.0. No OAuth 2.0 há os fluxos **{{apiClient.oauth.flow.authorizationCode}}**, **{{apiClient.oauth.flow.clientCredentials}}**, **{{apiClient.oauth.flow.deviceCode}}** e **{{apiClient.oauth.flow.password}}**; clique em **{{apiClient.oauth.getToken}}** e, se for preciso, o navegador do sistema abre para você autorizar o acesso. Com **{{apiClient.auth.inherit}}**, a requisição usa a autorização definida na coleção.

Para senhas e tokens, use uma variável secreta (veja "Ambientes e segredos"): assim o valor nunca é gravado no arquivo da requisição.

### Testes e extrações

Na aba **{{apiClient.tab.tests}}**:

- **{{apiClient.tests.assertions}}**: regras conferidas a cada envio, como "o status é igual a 200", "o corpo contém um texto" ou "o JSONPath existe". O resultado aparece na aba **{{apiClient.response.tab.tests}}** da resposta.
- **{{apiClient.tests.extractions}}**: guardam um valor da resposta (por exemplo, um token) numa variável do ambiente, para usar nas próximas requisições.

### Ambientes e segredos

![Ambiente de API com uma variável comum e uma secreta](img/s24-api-environment.png)

Um ambiente reúne variáveis, como o endereço do servidor de testes e o de produção. Use **{{menu.tools}} → {{menu.tools.apiEnvironments}}** para criar um (arquivo **.apienv**) e escolha o ativo no seletor **{{apiClient.env.select}}**.

- Marque **{{apiClient.env.secret}}** nas variáveis sigilosas. O valor fica cifrado neste computador e **não vai para o arquivo .apienv**.
- Marque **{{apiClient.env.production}}** num ambiente de produção: o aplicativo pede confirmação antes de enviar POST, PUT, PATCH e DELETE.
- Os cookies recebidos ficam separados por ambiente; veja ou apague em **{{menu.tools}} → {{menu.tools.apiCookies}}**.

### Coleções e histórico

Uma coleção é uma pasta com as requisições e o arquivo **.apicol**, que guarda a autorização e as variáveis comuns. Na barra lateral, a seção **{{apiClient.col.section}}** mostra as coleções das pastas abertas; use o botão direito para criar requisições e pastas, **{{apiClient.col.run}}**, **{{apiClient.col.export}}**, **{{apiClient.col.document}}** (gera a documentação da coleção) e **{{apiClient.col.settings}}**.

O **{{apiClient.history.section}}** (também em **{{menu.tools}} → {{menu.tools.apiHistory}}**) lista as últimas requisições enviadas, e você pode limpá-lo quando quiser.

### Importar, exportar e gerar código

- **{{menu.tools}} → {{menu.tools.apiImport}}** traz requisições de curl, Postman, OpenAPI/Swagger, Insomnia, HAR e arquivos .http. Clique em **{{apiClient.import.analyze}}** para ver o que será importado e escolha **{{apiClient.import.asCollection}}** ou **{{apiClient.import.openInTabs}}**. Colar um comando curl na URL também oferece a importação.
- **{{apiClient.col.export}}** grava a coleção como Postman, OpenAPI, HAR, .http ou curl. Os valores de variáveis secretas nunca são exportados.
- O botão **{{apiClient.code}}** abre **{{apiClient.codegen.title}}** e mostra a requisição em várias linguagens, pronta para copiar.

### Executar uma coleção

Em **{{apiClient.col.run}}**, escolha as requisições, o ambiente, o número de iterações e o atraso entre elas. Um arquivo de dados (CSV ou JSON) repete a execução com os valores de cada linha, e **{{apiClient.runner.stopOnFailure}}** interrompe no primeiro erro. Clique em **{{apiClient.runner.start}}**: o resultado abre como relatório (**.apirun**), com totais, tempos e os testes de cada requisição. Em **{{apiClient.report.export}}** o relatório sai em JUnit XML, HTML ou Markdown.

### GraphQL

Em **{{apiClient.body.type}}**, escolha GraphQL para escrever a **{{apiClient.graphql.query}}** e as **{{apiClient.graphql.variables}}**. Com **{{apiClient.graphql.loadSchema}}**, o aplicativo lê o schema do servidor, mostra a documentação dos tipos e oferece o autocompletar.

Quando a operação escolhida é uma **subscription**, aparece o botão **{{apiClient.graphql.subscribe}}**: o aplicativo abre um WebSocket (protocolo graphql-transport-ws) no endereço da requisição e mostra os eventos recebidos logo abaixo do editor. Clique em **{{apiClient.mock.stop}}** para encerrar.

### SOAP e WSDL

Em **{{apiClient.body.type}}**, escolha SOAP, a **{{apiClient.soap.version}}** (1.1 ou 1.2) e a SOAPAction; **{{apiClient.soap.template}}** preenche um envelope vazio. Para criar as requisições a partir de um serviço, use **{{menu.tools}} → {{menu.tools.apiImport}}** com o arquivo WSDL: cada operação vira uma requisição, já com o envelope de exemplo. Nos testes e extrações, o alvo XPath lê respostas XML (por exemplo, <code>//*[local-name()='Resultado']</code>).

### WebSocket

Use **{{menu.tools}} → {{menu.tools.apiWebSocket}}** para criar uma conexão (arquivo **.apiws**). Digite a **{{apiClient.ws.url}}** (ws:// ou wss://), os cabeçalhos e os subprotocolos e clique em **{{apiClient.ws.connect}}**. Escreva a mensagem (texto, JSON ou binário em base64) e envie com **Ctrl+Enter**. O **{{apiClient.ws.log}}** mostra as mensagens enviadas e recebidas, com hora e tamanho; dá para filtrar, pausar e limpar. Use **{{apiClient.ws.saveMessage}}** para guardar mensagens que você envia sempre.

### Servidor mock

Um servidor mock responde no lugar da API real, com respostas que você já conhece. Na resposta de uma requisição salva, clique em **{{apiClient.response.saveExample}}**: o aplicativo guarda o exemplo junto da requisição. Depois, no botão direito da coleção, escolha **{{apiClient.col.mock}}** (ou **{{menu.tools}} → {{menu.tools.apiMock}}**). As rotas vêm dos exemplos salvos ou de um arquivo OpenAPI; ajuste o status e o atraso de cada uma e clique em **{{apiClient.mock.start}}**. O servidor atende só neste computador, a menos que você marque **{{apiClient.mock.lan}}**, e para sozinho depois de 8 horas sem chamadas.

### gRPC

Use **{{menu.tools}} → {{menu.tools.apiGrpc}}** para criar uma chamada (arquivo **.apigrpc**). Informe o **{{apiClient.grpc.address}}**, marque **{{apiClient.grpc.tls}}** se o servidor exigir, e escolha a **{{apiClient.grpc.source}}**: **{{apiClient.grpc.source.reflection}}** ou **{{apiClient.grpc.source.proto}}**. Clique em **{{apiClient.grpc.load}}**, escolha o serviço e o método, e use **{{apiClient.grpc.useTemplate}}** para começar a mensagem em JSON. Chamadas simples e com streaming do servidor usam **{{apiClient.grpc.invoke}}**; com streaming do cliente ou nos dois sentidos, use **{{apiClient.grpc.start}}**, **{{apiClient.grpc.send}}** e **{{apiClient.grpc.end}}**. As mensagens, os metadados e o status aparecem na lista de eventos.

### Monitores

Um monitor repete a execução de uma coleção a cada tantos minutos e avisa por notificação do sistema quando algo falha (e de novo quando volta a passar). No botão direito da coleção, escolha **{{apiClient.col.monitor}}** (ou **{{menu.tools}} → {{menu.tools.apiMonitor}}**), defina o intervalo, o ambiente e as requisições, e salve. O gráfico mostra o tempo de cada execução, com as falhas em vermelho; **{{apiClient.monitor.runNow}}** roda na hora. Os monitores só rodam com o aplicativo aberto e voltam sozinhos quando você o abre de novo.

### Scripts

Na aba **{{apiClient.tab.tests}}**, abaixo das asserções, há dois scripts opcionais em JavaScript: **{{apiClient.scripts.pre}}** (pode mudar a URL, os cabeçalhos e o corpo) e **{{apiClient.scripts.post}}** (pode conferir a resposta com <code>test</code> e <code>expect</code> e guardar valores com <code>env.set</code>). O alias <code>pm</code> aceita o básico dos scripts do Postman. Os scripts rodam isolados, sem rede, arquivos nem acesso ao computador, com limite de tempo e de memória; o que eles escrevem com <code>console.log</code> aparece no bloco **{{apiClient.scripts.console}}** da resposta.

Scripts que você não escreveu (importados ou recebidos de outra pessoa) não rodam sozinhos: a requisição mostra um aviso com **{{apiClient.scripts.trustCollection}}**. A confiança vale só neste computador e cai se os scripts mudarem.

### IA no Cliente de API

No painel da resposta, **{{ai.api.explain}}** pede ao assistente uma explicação da resposta e **{{ai.api.suggestTests}}** sugere asserções para a aba **{{apiClient.tab.tests}}**. No botão direito da coleção, **{{ai.api.document}}** escreve a documentação. Os cabeçalhos de autenticação e os valores secretos não são enviados ao modelo.

Nos scripts, <code>pm.sendRequest</code> faz requisições auxiliares (por exemplo, para buscar um token), com as mesmas regras de segredos das requisições comuns e no máximo 10 por script.

### Segurança

- Todas as requisições saem do próprio computador, pelo aplicativo; nada passa por servidores nossos.
- Senhas, tokens e valores secretos ficam no cofre do sistema operacional (cifrados). Se o sistema não tiver cofre, ficam só na memória e se perdem ao fechar o aplicativo.
- Esses valores **nunca** vão para os arquivos (.apireq, .apienv, .apicol), nem para exportações, geração de código, registros ou para a nuvem. O histórico e os cookies também ficam só neste computador.
- Só as respostas salvas e os relatórios de uma coleção podem ser sincronizados com a nuvem, e apenas se você ligar **{{apiClient.col.syncResponses}}**.

## 9. Busca em arquivos

![Painel de busca com os resultados agrupados por arquivo](img/s06-search.png)

Abra uma pasta e use **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). O painel inferior se abre.

1. Digite o texto e clique em **{{search.run}}** (ou aperte Enter).
2. Ajuste a busca com os três botões ao lado: **{{search.caseSensitive}}**, **{{search.wholeWord}}** e **{{search.regex}}**.
3. Para limitar os arquivos, escreva um filtro, como `*.md, docs/**`.
4. Os resultados aparecem agrupados por arquivo, com linha e coluna. Clique em um resultado para abrir o arquivo e selecionar o trecho.

Para trocar o texto, escreva o novo no campo de substituição e clique em **{{search.replaceAll}}**. Desmarque os arquivos que não devem mudar. O aplicativo pede confirmação, porque **a substituição é gravada direto nos arquivos e não pode ser desfeita pelo editor**. Arquivos abertos com alterações não salvas são ignorados, para você não perder trabalho.

A busca não entra em pastas como `node_modules` e `.git`, nem em arquivos binários ou maiores que 5 MB. Ela mostra no máximo 5.000 ocorrências por vez.

## 10. Linguagem, codificação e quebras de linha

![Menu Codificação](img/s09-menu-encoding.png)

- **{{menu.language}}:** o aplicativo escolhe a linguagem pela extensão do arquivo e usa cores para facilitar a leitura. Para mudar a de um documento, abra o menu e escolha outra.

![Menu Linguagem](img/s10-menu-language.png)

- **{{menu.encoding}}:** converta o documento para **UTF-8** ou **UTF-8 com BOM**, e escolha a quebra de linha do **Windows (CRLF)**, do **Unix (LF)** ou do **Mac (CR)**. A conversão marca o documento como alterado; basta salvar para valer.
  - **{{menu.encoding.autoFormat}}** remove os espaços duplos do documento (a indentação das linhas fica) e o formata no padrão da linguagem: Python como Python (PEP 8), C e C++ no estilo LLVM, Java no estilo Google, C# no estilo Microsoft, Go com o gofmt, e JavaScript, TypeScript, JSON, CSS, HTML, Markdown, YAML, PHP e XML com o Prettier; também Lua, Shell e SQL. Funciona sem internet. Nas linguagens sem formatador (Rust, PowerShell, Batch, LaTeX, INI, TOML e texto), só os espaços duplos são removidos, e a barra de status avisa. Se o código tiver erro de sintaxe, uma janela informa a linha do erro.
  - No Python, se a indentação estiver faltando, ela é deduzida: depois de uma linha terminada em `:` o bloco abre um nível; blocos de `if`, `for`, `while`, `try` e `with` ficam com a linha seguinte; o corpo de um `def` vai até uma linha em branco ou um `return`. Confira o resultado, porque em Python a indentação muda o que o programa faz. As aspas ficam como você escreveu. Atenção: espaços duplos dentro de textos entre aspas também são removidos. Ctrl+Z desfaz tudo de uma vez.
  - **{{menu.encoding.url}}** codifica o texto selecionado no formato de endereços web (`minha página` vira `minha%20p%C3%A1gina`); se o texto já estiver codificado, decodifica. Num endereço completo (`https://…`), os separadores `: / ? & = #` são mantidos.

A codificação e a quebra de linha atuais aparecem na barra de status.

## 11. Snippets e macros

![Janela de snippets](img/s12-snippets.png)

**Snippets** são trechos de texto prontos. Abra **{{menu.tools}} → {{menu.tools.snippets}}**. O aplicativo já traz alguns: `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` e `cabecalho`. Para usar, digite o atalho no editor e escolha a sugestão (ou aperte Ctrl+Espaço), ou clique em **{{snippets.insert}}** na janela. Para criar o seu, clique em **{{snippets.new}}**, dê um nome, um atalho e o texto. No texto, `$1` e `${2:padrão}` marcam os lugares onde o cursor para, e `$0` é o ponto final. Os snippets do aplicativo não podem ser editados, mas você pode duplicá-los.

![Janela de macros](img/s13-macros.png)

**Macros** repetem uma sequência que você fez. Aperte **Ctrl+Shift+R** para começar a gravar, escreva ou edite o que quiser e aperte **Ctrl+Shift+R** de novo para parar. Depois, **Ctrl+Shift+M** executa a última gravação. Em **{{menu.tools.macros}}** você escolhe quantas vezes repetir e pode salvar a macro com um nome. São gravados o texto digitado, o que você cola, as teclas de seta, Home, End, Backspace, Delete, Tab, Enter e os comandos dos menus. Cliques do mouse e Ctrl+Z não são gravados.

## 12. Conta e arquivos na nuvem

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

Com a conta conectada, o rodapé mostra, à esquerda do ícone da nuvem, quanto espaço você usa na nuvem, em MB com duas casas decimais (por exemplo, `1.25 MB`). A conta soma todos os seus arquivos na nuvem e os textos dos documentos ainda não salvos, guardados para você continuar em outro computador. O valor muda a cada gravação ou exclusão. Um arquivo da nuvem aberto sem alterações não ocupa espaço a mais; só o texto ainda não salvo é guardado.

Se o mesmo documento for alterado em dois computadores antes de sincronizar, cada computador fica com o seu texto, e a versão do outro abre numa aba nova, com "(conflito – outro computador)" no nome, para nada se perder.

## 13. Idiomas

![Bandeiras dos idiomas ao lado do botão de visualização](img/s08-flags.png)

O aplicativo está disponível em **alemão, espanhol, francês, inglês, português (Brasil) e português (Portugal)**. Ele abre no idioma do seu sistema; se não houver tradução, abre em inglês. Para trocar, clique na bandeira do idioma, à esquerda do botão de visualização. A escolha vale na hora e fica guardada para a próxima vez. Este manual abre no idioma que estiver em uso.

## 14. Atalhos de teclado

![Janela de atalhos de teclado](img/s14-shortcuts.png)

Para ver a lista dentro do aplicativo, abra **{{menu.help}} → {{menu.help.shortcuts}}**. Os atalhos disponíveis:

{{shortcuts}}

## 15. Perguntas frequentes

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

## 16. Sobre e suporte

![Janela Sobre](img/s15-about.png)

![Menu Ajuda](img/s19-menu-help.png)

O **Meu Editor de Arquivos** foi desenvolvido por Diego Mendes Rodrigues. O item **{{menu.help.support}}** do menu Ajuda ainda não está disponível nesta versão.
