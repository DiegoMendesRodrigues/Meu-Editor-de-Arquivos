# Meu Editor de Arquivos — Manuel d'utilisation

Version {{version}}

## 1. Bienvenue

**Meu Editor de Arquivos** est un éditeur léger pour tous ceux qui travaillent avec des textes, des notes, des scripts, des fichiers de configuration, des journaux et du code. Il fonctionne sous Windows 11, Debian 12 et 13 et Ubuntu 22.04 ou plus récent, et **n'a pas besoin d'internet** pour modifier vos fichiers.

Ce que vous y trouverez :

- des onglets pour plusieurs fichiers à la fois, avec récupération automatique de ce que vous avez saisi ;
- du Markdown qui s'ouvre **mis en forme**, avec un bouton pour modifier le texte ;
- un **visionneur JSON** dans lequel vous ouvrez et refermez des parties du fichier ;
- la recherche et le remplacement dans un fichier ou dans un dossier entier ;
- la coloration syntaxique de dizaines de langages, des extraits de texte (snippets) et des macros ;
- un compte utilisateur pour conserver des fichiers dans le cloud et les ouvrir sur d'autres ordinateurs ;
- une interface en six langues.

## 2. Découvrir l'écran

![Écran principal avec un dossier ouvert et un document Markdown](img/s01-main.png)

1. **Barre de menus** (en haut) : {{menu.file}}, {{menu.edit}}, {{menu.search}}, {{menu.view}}, {{menu.encoding}}, {{menu.language}}, {{menu.tools}}, {{menu.account}} et {{menu.help}}.
2. **Barre d'outils** : raccourcis vers les commandes les plus courantes. Les boutons de mise en forme apparaissent quand le document est en Markdown. À droite se trouvent les **drapeaux des langues** et le bouton qui alterne entre l'aperçu et la modification.
3. **Barre latérale** (à gauche) : les documents ouverts, l'explorateur du dossier ouvert et vos fichiers récents. Pour la masquer ou l'afficher, utilisez **Ctrl+Shift+B**.
4. **Onglets** : chaque document a le sien. Un point (●) à côté du nom indique des modifications pas encore écrites dans le fichier.
5. **Zone d'édition** : c'est là que vous lisez et écrivez.
6. **Panneau inférieur** : affiche les résultats de la recherche dans les fichiers. Il s'ouvre tout seul quand vous utilisez la recherche.
7. **Barre d'état** (en bas) : ligne et colonne du curseur, taille du fichier, encodage, type de fin de ligne et langage du document.

## 3. Créer et ouvrir des fichiers

![Le bouton Nouveau avec la flèche qui liste les types de document](img/s02-new-menu.png)

- **Nouveau document :** cliquez sur **{{toolbar.new}}** ou appuyez sur **Ctrl+N**. Un nouveau document est en Markdown (.md). La **flèche à côté du bouton** permet de créer un autre type : .md (Markdown), .txt (texte), .py (Python) ou .sql (SQL).
- **Ouvrir des fichiers :** **{{menu.file}} → {{menu.file.open}}** ou **Ctrl+O**. Vous pouvez en choisir plusieurs à la fois. La limite est de 50 Mo par fichier.
- **Ouvrir un dossier :** **{{menu.file}} → {{menu.file.openFolder}}** ou **Ctrl+Shift+K**. Le dossier apparaît dans l'explorateur de la barre latérale, et un clic sur un fichier l'ouvre. Utilisez **{{menu.file.closeFolder}}** pour le fermer.
- **Fichiers récents :** les derniers fichiers utilisés figurent dans la liste **Récents** de la barre latérale. Cliquez sur l'un d'eux pour le rouvrir.

Si un autre programme modifie un fichier que vous avez ouvert, l'application le recharge toute seule. Si ce document contient des modifications de votre part non enregistrées, elle vous demande d'abord. Si le fichier est supprimé ou déplacé, le nom de l'onglet devient rouge et barré.

![Menu Fichier](img/s07-menu-file.png)

### Organiser depuis la barre latérale

Faites un clic droit sur un dossier ou un fichier de la barre latérale, sur l'ordinateur ou dans le cloud :

- **{{sidebar.rename}}** (dossiers et fichiers) : ouvre la fenêtre **{{rename.folderTitle}}** ou **{{rename.fileTitle}}** avec le nom actuel. Saisissez le nouveau nom et cliquez sur **{{rename.submit}}**. Le nom ne peut pas être vide ni contenir `\ / : * ? " < > |`. Les onglets ouverts de ce fichier, ou des fichiers du dossier, prennent le nouveau nom.
- **{{sidebar.folderColor}}** (dossiers) : ouvre la fenêtre **{{folderColor.title}}** avec douze couleurs, la couleur actuelle étant cochée. Choisissez-en une autre et cliquez sur **{{folderColor.submit}}**. Les couleurs sont conservées sur cet ordinateur.
- **{{common.delete}}** (dossiers) : disponible uniquement lorsque le dossier est vide.

Le dossier ouvert dans l'explorateur ne peut être ni renommé ni supprimé d'ici.

Chaque fichier a une icône selon son type : documents (.md, .txt, .tex), journaux, programmation, scripts, web, données et configuration (les mêmes sections que le bouton **+**) et une icône générique pour les autres.

Les zones de la barre latérale ({{sidebar.openDocs}}, {{sidebar.recent}}, celles du client d'API et les autres) ont un triangle à gauche du nom : cliquez dessus, ou sur le nom, pour ouvrir ou fermer la zone. Pour changer l'ordre, faites glisser le nom de la zone vers le haut ou vers le bas (au clavier, Alt+↑ et Alt+↓ avec le nom sélectionné). L'ordre et les zones fermées sont enregistrés sur cet ordinateur. Pour retirer une zone de la barre latérale, cliquez sur le X à droite de son nom, ou décochez-la dans **{{menu.view.sidebarAreas}}**, du menu **{{menu.view}}** ; cochez-la de nouveau pour qu'elle retrouve sa place.

## 4. Enregistrer et documents temporaires

- **{{menu.file.save}}** (**Ctrl+S**) écrit le document dans son fichier. Pour un nouveau document, l'application demande le nom et l'emplacement.
- **{{menu.file.saveAs}}** (**Ctrl+Shift+S**) écrit une copie sous un autre nom ou à un autre endroit.
- **{{menu.file.saveAll}}** écrit tous les documents qui ont des modifications.

**Vous ne perdez pas ce que vous avez saisi.** Quelques secondes après chaque modification, l'application conserve automatiquement tous les documents ouverts, y compris ceux qui n'ont jamais été enregistrés. Cela se fait que vous enregistriez ou non.

Quand vous **fermez l'application**, elle ne pose aucune question et ne supprime rien. À la prochaine ouverture, les onglets, le dossier et le texte non enregistré reviennent tels quels. Enregistrez quand vous voulez écrire dans le véritable fichier.

Quand vous **fermez un onglet** contenant des modifications, l'application demande s'il faut enregistrer, ne pas enregistrer ou annuler. Deux remarques : l'historique d'annulation (Ctrl+Z) n'est pas conservé d'une session à l'autre, et la récupération automatique conserve jusqu'à 100 Mo de texte non enregistré.

## 5. Modifier du texte

![Caractères invisibles : espaces, tabulations et fins de ligne](img/s11-invisibles.png)

Les commandes de modification se trouvent dans **{{menu.edit}}** et les options d'affichage dans **{{menu.view}}**.

- **Annuler et rétablir :** Ctrl+Z et Ctrl+Y.
- **Rechercher et remplacer** dans le document : Ctrl+F et Ctrl+H. Pour aller à une ligne, utilisez Ctrl+G.
- **Plusieurs curseurs :** maintenez Ctrl et cliquez là où vous voulez un autre curseur, ou appuyez sur Ctrl+D pour sélectionner l'occurrence suivante du mot.
- **{{menu.edit.columnSelection}} :** maintenez Maj+Ctrl et faites glisser la souris pour modifier plusieurs lignes dans la même colonne.
- **Lignes :** Alt+↑ et Alt+↓ déplacent la ligne ; Shift+Alt+↑ et Shift+Alt+↓ la dupliquent ; Ctrl+/ la commente ou la décommente.
- **Ranger :** {{menu.edit.sortAsc}}, {{menu.edit.sortDesc}}, {{menu.edit.removeDuplicates}} et {{menu.edit.trimWhitespace}}.
- **{{menu.view.invisibles}} :** affiche les espaces (·), les tabulations (→) et la fin de chaque ligne (¶). Très pratique pour repérer les espaces en trop.
- **{{menu.view.wordWrap}}** et **{{menu.view.foldAll}} / {{menu.view.unfoldAll}}** aident à lire les longs fichiers.
- **Taille de la police :** Ctrl++ l'agrandit, Ctrl+- la réduit et Ctrl+0 rétablit la taille par défaut.
- **Indentation :** dans **{{menu.edit}}**, choisissez entre espaces et tabulation, ainsi que la taille (2, 4 ou 8 colonnes).
- **{{menu.view.fullScreen}}** (F11, dans **{{menu.view}}**) : affiche uniquement le document, sur tout l’écran. Appuyez de nouveau sur F11, ou cliquez sur le bouton en haut à droite, pour en sortir.
- **{{menu.view.toggleTheme}}** (dans **{{menu.view}}**) : passe du mode clair au mode sombre et inversement. Tant que vous n’avez pas choisi, l’application suit le thème du système d’exploitation ; votre choix est conservé pour la prochaine fois.

Vos préférences d'affichage sont conservées pour la prochaine fois. Les textes propres à l'éditeur, comme la zone de recherche (Ctrl+F) et la palette de commandes (F1), apparaissent en anglais.

![L’application en mode sombre](img/s22-dark-mode.png)

### Lettres, espaces et fins de ligne

![Menu Édition avec le sous-menu Convertir les lettres en ouvert](img/s20-menu-edit.png)

À la fin du menu **{{menu.edit}}**, trois sous-menus sont proposés :

- **{{menu.edit.eol}} :** convertit les fins de ligne du document au format Windows (CRLF), Unix (LF) ou Mac (CR). Une conversion marque le document comme modifié ; il suffit d’enregistrer pour qu’elle prenne effet.
- **{{menu.edit.case}} :** avec du texte sélectionné, choisissez {{menu.edit.caseUpper}}, {{menu.edit.caseLower}} ou {{menu.edit.caseSentence}} (seule la première lettre de chaque phrase passe en majuscule).
- **{{menu.edit.spaces}} :** {{menu.edit.trimRight}}, {{menu.edit.trimLeft}} et {{menu.edit.trimBoth}} s’appliquent à la ligne du curseur (ou aux lignes sélectionnées). {{menu.edit.collapseSpaces}} remplace deux espaces consécutifs ou plus par un seul dans tout le document, sans toucher à l’indentation en début de ligne.

### MD5, SHA-1, SHA-256 et SHA-512

![Fenêtre qui génère le SHA-256 d’un texte](img/s21-hash.png)

À la fin du menu **{{menu.tools}}**, chaque algorithme propose deux options :

- **{{menu.tools.hashGenerate}} :** ouvre une fenêtre ; saisissez ou collez le texte et le résultat s’affiche aussitôt, juste en dessous. **{{hash.copy}}** place le résultat dans le presse-papiers.
- **{{menu.tools.hashSelection}} :** calcule le résultat à partir du texte sélectionné dans le document et le place dans le presse-papiers, prêt à être collé. Un message s’affiche dans la barre d’état.

### Terminal

Dans **{{menu.tools}} → {{menu.tools.openTerminal}}**, un terminal s’ouvre juste sous le document, dans votre dossier personnel : PowerShell sous Windows et votre shell (généralement bash) sous Linux. Saisissez les commandes et voyez les résultats sur place ; le document reste ouvert au-dessus, et le séparateur entre les deux peut être déplacé.

- Chaque clic ouvre un autre terminal, dans son propre onglet (Terminal 1, Terminal 2…). Le **×** de l’onglet ferme le terminal ; la commande `exit` aussi.
- Avec du texte sélectionné dans le terminal, Ctrl+C le copie ; sans sélection, Ctrl+C interrompt la commande en cours. Ctrl+V colle.
- Tant que le curseur est dans le terminal, les touches lui sont envoyées (Ctrl+W, Ctrl+R…) au lieu des raccourcis de l’application.
- Les terminaux ne reviennent pas à la prochaine ouverture de l’application.

### Correcteur orthographique

![Mot souligné et suggestions de correction](img/s11a-spelling.png)

Dans les documents Markdown, texte (.txt) et LaTeX, les mots absents du dictionnaire sont soulignés en rouge. Le code, les liens, les adresses, les sigles et le texte entre accents graves ne sont pas vérifiés, et les fichiers journaux et CSV sont ignorés.

- Placez le curseur sur le mot et appuyez sur **Ctrl+.** (ou faites un clic droit et choisissez **{{spell.suggestions}}**) pour voir les suggestions. Choisissez-en une pour remplacer le mot.
- **{{spell.addToDictionary}}** fait accepter le mot désormais, dans toutes les langues.
- **{{menu.tools}} → {{menu.tools.spellCheck}}** (ou **F7**) active et désactive la vérification.
- Le correcteur utilise la langue de l’interface. Pour vérifier dans une autre langue, choisissez dans **{{menu.tools}} → {{menu.tools.spellSubmenu}}** l’une des options **{{spell.source}} : Deutsch**, **{{spell.source}} : English**… : il existe des dictionnaires allemand, espagnol, français, anglais, portugais du Brésil et portugais du Portugal. **{{menu.tools.spellAuto}}** revient à la langue de l’interface.

Les dictionnaires sont fournis avec l’application : le correcteur fonctionne sans Internet.

### Assistant IA (Ollama)

L'**{{ai.title}}** utilise un modèle d'IA qui tourne sur votre propre ordinateur grâce à Ollama (ollama.com) : rien ne part sur internet. Ouvrez le panneau avec **{{menu.tools}} → {{menu.tools.ai}}** ou **Ctrl+Maj+I**. Si Ollama n'est pas encore sur l'ordinateur, le panneau guide l'installation : sous Windows, **{{ai.install.button}}** télécharge l'installateur officiel, vérifie sa signature numérique et ouvre sa fenêtre pour que vous terminiez ; sous Linux, **{{ai.install.openTerminal}}** saisit la commande officielle dans le terminal de l'application pour que vous la vérifiiez et la confirmiez (elle nécessite sudo). Si Ollama est arrêté, utilisez **{{ai.install.start}}**. Choisissez ensuite un modèle dans **{{ai.install.pullTitle}}** et suivez le téléchargement ; **{{ai.install.delete}}** libère de l'espace.

- Choisissez le modèle, saisissez votre question et suivez la réponse pendant sa génération ; **{{ai.stop}}** l'interrompt et **{{ai.newChat}}** repart de zéro.
- Les **{{ai.quick.label}}** portent sur la sélection (ou le document entier) : **{{ai.quick.explain}}**, **{{ai.quick.improve}}**, **{{ai.quick.fix}}**, **{{ai.quick.summarize}}**, **{{ai.quick.translate}}**, **{{ai.quick.document}}** et **{{ai.quick.tests}}**.
- Dans les blocs de code de la réponse, utilisez **{{ai.code.copy}}**, **{{ai.code.insert}}** ou **{{ai.code.replace}}**.
- La conversation reste uniquement en mémoire et disparaît à la fermeture de l'application. Par défaut, l'assistant ne communique qu'avec un Ollama de cet ordinateur.

## 6. Markdown

![Document Markdown en mode modification, avec la barre de mise en forme](img/s03-markdown-edit.png)

Les fichiers Markdown (.md) s’ouvrent **mis en forme**, et vous pouvez continuer à écrire directement dans le texte mis en forme. La barre d’outils applique la mise en forme au curseur ou à la sélection : titres, liste à puces, liste numérotée, retrait, **gras** (Ctrl+B), *italique* (Ctrl+I), ~~barré~~ (Ctrl+Shift+X), lien, tableau et effacer la mise en forme. Ctrl+Z et Ctrl+Y annulent et rétablissent.

Pour voir et modifier le code Markdown, cliquez sur **{{toolbar.editText}}** (ou appuyez sur **Ctrl+Shift+E**) ; pour revenir au texte mis en forme, cliquez sur **{{toolbar.preview}}**. La barre de mise en forme fonctionne dans les deux modes.

Quand vous modifiez le texte mis en forme, le Markdown est réécrit dans un style standard (par exemple, des listes avec `-`). Les documents qui contiennent du HTML sont en lecture seule dans ce mode, pour ne pas perdre le HTML : modifiez-les avec **{{toolbar.editText}}**. Pour ouvrir un lien dans le navigateur, utilisez Ctrl+clic. Les images apparaissent sous forme d’étiquette avec leur nom, et leur adresse est conservée dans le fichier.

## 7. Fichiers JSON

![Fichier JSON en arborescence, avec un élément sélectionné](img/s04-json-tree.png)

Les fichiers .json s'ouvrent en **arborescence**. Cliquez sur la flèche d'un élément pour ouvrir ou refermer cette partie. Utilisez **{{menu.view.unfoldAll}}** et **{{menu.view.foldAll}}** pour tout ouvrir ou tout refermer. Quand vous cliquez sur un élément, la barre affiche son chemin, et vous pouvez copier le **{{json.path}}** ou la **{{json.value}}**. Les très longues listes s'affichent par petites parties, avec un bouton pour en voir davantage.

Pour modifier, cliquez sur **{{toolbar.editText}}**. En mode modification, le bouton **{{toolbar.formatJson}}** (Shift+Alt+F) remet le fichier en ordre.

![Message d'erreur d'un JSON invalide, avec ligne et colonne](img/s05-json-error.png)

Si le fichier contient une erreur, l'application explique le problème et indique la ligne et la colonne. Le bouton **{{json.editGoToError}}** ouvre l'éditeur directement à l'endroit de l'erreur.

## 8. Client d'API

![Client d'API avec une requête envoyée et la réponse en arborescence](img/s23-api-request.png)

Le Client d'API sert à tester des services sur internet (API) : vous construisez une requête, vous l'envoyez et vous vérifiez la réponse sans quitter l'éditeur. Chaque requête est un fichier **.apireq**, que vous pouvez enregistrer, copier et versionner comme n'importe quel autre.

### Ouvrir

- Appuyez sur **Ctrl+Shift+A**, ou utilisez **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiClient}}**.
- Ou utilisez **{{menu.file}} → Nouveau fichier de requête API (.apireq)**.

Le document s'ouvre dans le **{{apiClient.builder}}**. Pour voir et modifier le fichier sous forme de texte (JSON), cliquez sur **{{toolbar.editText}}**.

### Construire la requête

Choisissez la **{{apiClient.method}}** (GET, POST…) et saisissez l'adresse dans **{{apiClient.url}}**. Les données sont réparties en onglets :

- **{{apiClient.tab.params}}** : les paramètres de la query. Ce que vous saisissez dans l'URL apparaît ici, et inversement.
- **{{apiClient.tab.auth}}** : comment vous identifier auprès du service (voir plus bas).
- **{{apiClient.tab.headers}}** : les en-têtes de la requête.
- **{{apiClient.tab.body}}** : le contenu envoyé. Dans **{{apiClient.body.type}}**, vous choisissez entre JSON, XML, texte, HTML, formulaire, formulaire avec fichiers, fichier binaire, GraphQL, SOAP ou aucun corps.
- **{{apiClient.tab.settings}}** : délai d'attente, redirections, proxy, certificats et **{{apiClient.settings.verifyTls}}**. Ne désactivez la vérification que dans des environnements de test.

Dans n'importe quel champ, utilisez <code>&#123;&#123;nom&#125;&#125;</code> pour insérer une variable de l'environnement actif.

### Envoyer et lire la réponse

Cliquez sur **{{apiClient.send}}** ou appuyez sur **Ctrl+Enter**. Pendant que la requête est en cours, **Échap** annule l'envoi. Le bouton en forme de flèche à côté propose **{{apiClient.sendDownload}}**, qui enregistre le corps directement dans un fichier (utile pour les réponses volumineuses ou binaires).

La réponse affiche le statut, la durée et la taille, avec les onglets **{{apiClient.response.tab.body}}**, **{{apiClient.response.tab.headers}}**, **{{apiClient.response.tab.cookies}}**, **{{apiClient.response.tab.tests}}** et **{{apiClient.response.tab.timings}}**. Le corps peut s'afficher en **{{apiClient.response.view.tree}}** (pour ouvrir et refermer les parties du JSON), **{{apiClient.response.view.pretty}}** ou **{{apiClient.response.view.raw}}**. Utilisez **{{apiClient.response.saveResponse}}** pour conserver la réponse dans un fichier .apiresp, et **{{apiClient.response.openBody}}** pour la modifier comme un document ordinaire.

### Autorisation

Dans l'onglet **{{apiClient.tab.auth}}**, choisissez dans **{{apiClient.auth.type}}** : API Key, Basic Auth, Bearer Token, OAuth 1.0 ou OAuth 2.0. OAuth 2.0 propose les flux **{{apiClient.oauth.flow.authorizationCode}}**, **{{apiClient.oauth.flow.clientCredentials}}**, **{{apiClient.oauth.flow.deviceCode}}** et **{{apiClient.oauth.flow.password}}** ; cliquez sur **{{apiClient.oauth.getToken}}** et, si nécessaire, le navigateur du système s'ouvre pour que vous autorisiez l'accès. Avec **{{apiClient.auth.inherit}}**, la requête utilise l'autorisation définie dans la collection.

Pour les mots de passe et les jetons, utilisez une variable secrète (voir « Environnements et secrets ») : ainsi, la valeur n'est jamais écrite dans le fichier de la requête.

### Tests et extractions

Dans l'onglet **{{apiClient.tab.tests}}** :

- **{{apiClient.tests.assertions}}** : des règles vérifiées à chaque envoi, comme « le statut est égal à 200 », « le corps contient un texte » ou « le JSONPath existe ». Le résultat apparaît dans l'onglet **{{apiClient.response.tab.tests}}** de la réponse.
- **{{apiClient.tests.extractions}}** : elles conservent une valeur de la réponse (un jeton, par exemple) dans une variable de l'environnement, pour l'utiliser dans les requêtes suivantes.

### Environnements et secrets

![Environnement d'API avec une variable ordinaire et une variable secrète](img/s24-api-environment.png)

Un environnement rassemble des variables, comme l'adresse du serveur de test et celle de la production. Utilisez **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiEnvironments}}** pour en créer un (fichier **.apienv**) et choisissez l'environnement actif dans le sélecteur **{{apiClient.env.select}}**.

- Cochez **{{apiClient.env.secret}}** pour les variables sensibles. La valeur est chiffrée sur cet ordinateur et **ne va pas dans le fichier .apienv**.
- Cochez **{{apiClient.env.production}}** pour un environnement de production : l'application demande une confirmation avant d'envoyer POST, PUT, PATCH et DELETE.
- Les cookies reçus sont séparés par environnement ; consultez-les ou supprimez-les dans **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiCookies}}**.

### Collections et historique

Une collection est un dossier contenant les requêtes et le fichier **.apicol**, qui conserve l'autorisation et les variables communes. Dans la barre latérale, la section **{{apiClient.col.section}}** affiche les collections des dossiers ouverts ; avec le clic droit, vous pouvez créer des requêtes et des dossiers, **{{apiClient.col.run}}**, **{{apiClient.col.export}}**, **{{apiClient.col.document}}** (génère la documentation de la collection) et **{{apiClient.col.settings}}**.

L'**{{apiClient.history.section}}** (aussi dans **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiHistory}}**) liste les dernières requêtes envoyées, et vous pouvez l'effacer quand vous le souhaitez.

### Importer, exporter et générer du code

- **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiImport}}** importe des requêtes depuis curl, Postman, OpenAPI/Swagger, Insomnia, HAR et des fichiers .http. Cliquez sur **{{apiClient.import.analyze}}** pour voir ce qui sera importé, puis choisissez **{{apiClient.import.asCollection}}** ou **{{apiClient.import.openInTabs}}**. Coller une commande curl dans l'URL propose aussi l'importation.
- **{{apiClient.col.export}}** enregistre la collection au format Postman, OpenAPI, HAR, .http ou curl. Les valeurs des variables secrètes ne sont jamais exportées.
- Le bouton **{{apiClient.code}}** ouvre **{{apiClient.codegen.title}}** et affiche la requête dans plusieurs langages, prête à copier.

### Exécuter une collection

Dans **{{apiClient.col.run}}**, choisissez les requêtes, l'environnement, le nombre d'itérations et le délai entre elles. Un fichier de données (CSV ou JSON) répète l'exécution avec les valeurs de chaque ligne, et **{{apiClient.runner.stopOnFailure}}** s'arrête à la première erreur. Cliquez sur **{{apiClient.runner.start}}** : le résultat s'ouvre sous forme de rapport (**.apirun**), avec les totaux, les durées et les tests de chaque requête. Avec **{{apiClient.report.export}}**, le rapport peut être enregistré en JUnit XML, HTML ou Markdown.

### GraphQL

Dans **{{apiClient.body.type}}**, choisissez GraphQL pour écrire la **{{apiClient.graphql.query}}** et les **{{apiClient.graphql.variables}}**. Avec **{{apiClient.graphql.loadSchema}}**, l'application lit le schéma du serveur, affiche la documentation des types et propose l'autocomplétion.

Lorsque l'opération choisie est une **subscription**, le bouton **{{apiClient.graphql.subscribe}}** apparaît : l'application ouvre un WebSocket (protocole graphql-transport-ws) vers l'adresse de la requête et affiche les événements reçus sous l'éditeur. Cliquez sur **{{apiClient.mock.stop}}** pour y mettre fin.

### SOAP et WSDL

Dans **{{apiClient.body.type}}**, choisissez SOAP, la **{{apiClient.soap.version}}** (1.1 ou 1.2) et la SOAPAction ; **{{apiClient.soap.template}}** remplit une enveloppe vide. Pour créer les requêtes à partir d'un service, utilisez **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiImport}}** avec le fichier WSDL : chaque opération devient une requête, avec une enveloppe d'exemple. Dans les tests et les extractions, la cible XPath lit les réponses XML (par exemple, <code>//*[local-name()='Resultat']</code>).

### WebSocket

Utilisez **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiWebSocket}}** pour créer une connexion (fichier **.apiws**). Saisissez l'**{{apiClient.ws.url}}** (ws:// ou wss://), les en-têtes et les sous-protocoles, puis cliquez sur **{{apiClient.ws.connect}}**. Rédigez le message (texte, JSON ou binaire en base64) et envoyez-le avec **Ctrl+Entrée**. Le **{{apiClient.ws.log}}** affiche les messages envoyés et reçus, avec l'heure et la taille ; vous pouvez le filtrer, le mettre en pause et le vider. Utilisez **{{apiClient.ws.saveMessage}}** pour garder les messages que vous envoyez souvent.

### Serveur mock

Un serveur mock répond à la place de la vraie API, avec des réponses que vous connaissez déjà. Dans la réponse d'une requête enregistrée, cliquez sur **{{apiClient.response.saveExample}}** : l'application range l'exemple à côté de la requête. Ensuite, d'un clic droit sur la collection, choisissez **{{apiClient.col.mock}}** (ou **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiMock}}**). Les routes viennent des exemples enregistrés ou d'un fichier OpenAPI ; ajustez le statut et le délai de chacune et cliquez sur **{{apiClient.mock.start}}**. Le serveur ne répond que sur cet ordinateur, sauf si vous cochez **{{apiClient.mock.lan}}**, et s'arrête tout seul après 8 heures sans appel.

### gRPC

Utilisez **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiGrpc}}** pour créer un appel (fichier **.apigrpc**). Indiquez l'**{{apiClient.grpc.address}}**, cochez **{{apiClient.grpc.tls}}** si le serveur l'exige, et choisissez la **{{apiClient.grpc.source}}** : **{{apiClient.grpc.source.reflection}}** ou **{{apiClient.grpc.source.proto}}**. Cliquez sur **{{apiClient.grpc.load}}**, choisissez le service et la méthode, puis utilisez **{{apiClient.grpc.useTemplate}}** pour commencer le message JSON. Les appels simples et en streaming serveur utilisent **{{apiClient.grpc.invoke}}** ; en streaming client ou bidirectionnel, utilisez **{{apiClient.grpc.start}}**, **{{apiClient.grpc.send}}** et **{{apiClient.grpc.end}}**. Les messages, les métadonnées et le statut apparaissent dans la liste des événements.

### Moniteurs

Un moniteur relance l'exécution d'une collection toutes les quelques minutes et envoie une notification système en cas d'échec (puis de nouveau quand tout repasse). D'un clic droit sur la collection, choisissez **{{apiClient.col.monitor}}** (ou **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiMonitor}}**), réglez l'intervalle, l'environnement et les requêtes, puis enregistrez. Le graphique montre la durée de chaque exécution, les échecs en rouge ; **{{apiClient.monitor.runNow}}** la lance tout de suite. Les moniteurs ne tournent que lorsque l'application est ouverte et reprennent seuls à sa réouverture.

### Scripts

Dans l'onglet **{{apiClient.tab.tests}}**, sous les assertions, se trouvent deux scripts JavaScript facultatifs : **{{apiClient.scripts.pre}}** (peut modifier l'URL, les en-têtes et le corps) et **{{apiClient.scripts.post}}** (peut vérifier la réponse avec <code>test</code> et <code>expect</code> et garder des valeurs avec <code>env.set</code>). L'alias <code>pm</code> accepte l'essentiel des scripts Postman. Les scripts s'exécutent isolés, sans réseau, fichiers ni accès à l'ordinateur, avec des limites de temps et de mémoire ; ce qu'ils écrivent avec <code>console.log</code> apparaît dans le bloc **{{apiClient.scripts.console}}** de la réponse.

Les scripts que vous n'avez pas écrits (importés ou reçus d'une autre personne) ne s'exécutent pas d'eux-mêmes : la requête affiche un avis avec **{{apiClient.scripts.trustCollection}}**. La confiance ne vaut que sur cet ordinateur et tombe si les scripts changent.

### IA dans le client d'API

Dans le panneau de la réponse, **{{ai.api.explain}}** demande à l'assistant d'expliquer la réponse et **{{ai.api.suggestTests}}** propose des assertions pour l'onglet **{{apiClient.tab.tests}}**. D'un clic droit sur une collection, **{{ai.api.document}}** rédige sa documentation. Les en-têtes d'authentification et les valeurs secrètes ne sont pas envoyés au modèle.

Dans les scripts, <code>pm.sendRequest</code> effectue des requêtes auxiliaires (par exemple pour obtenir un jeton), avec les mêmes règles de secrets que les requêtes normales et au maximum 10 par script.

### Sécurité

- Toutes les requêtes partent de votre propre ordinateur, via l'application ; rien ne passe par nos serveurs.
- Les mots de passe, les jetons et les valeurs secrètes sont conservés dans le coffre du système d'exploitation (chiffrés). Si le système n'a pas de coffre, ils restent uniquement en mémoire et sont perdus à la fermeture de l'application.
- Ces valeurs ne vont **jamais** dans les fichiers (.apireq, .apienv, .apicol), ni dans les exports, la génération de code, les journaux ou le cloud. L'historique et les cookies restent eux aussi uniquement sur cet ordinateur.
- Seuls les réponses enregistrées et les rapports d'une collection peuvent être synchronisés avec le cloud, et uniquement si vous activez **{{apiClient.col.syncResponses}}**.

## 9. Recherche dans les fichiers

![Panneau de recherche avec les résultats regroupés par fichier](img/s06-search.png)

Ouvrez un dossier et choisissez **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). Le panneau inférieur s'ouvre.

1. Saisissez le texte et cliquez sur **{{search.run}}** (ou appuyez sur Entrée).
2. Affinez la recherche avec les trois boutons voisins : **{{search.caseSensitive}}**, **{{search.wholeWord}}** et **{{search.regex}}**.
3. Pour limiter les fichiers, écrivez un filtre, par exemple `*.md, docs/**`.
4. Les résultats apparaissent regroupés par fichier, avec la ligne et la colonne. Cliquez sur un résultat pour ouvrir le fichier et sélectionner le passage.

Pour remplacer le texte, saisissez le nouveau dans le champ de remplacement et cliquez sur **{{search.replaceAll}}**. Décochez les fichiers qui ne doivent pas changer. L'application demande une confirmation, car **le remplacement est écrit directement dans les fichiers et ne peut pas être annulé depuis l'éditeur**. Les fichiers ouverts qui ont des modifications non enregistrées sont ignorés, pour que vous ne perdiez pas votre travail.

La recherche n'entre pas dans des dossiers comme `node_modules` et `.git`, ni dans les fichiers binaires ou de plus de 5 Mo. Elle affiche au maximum 5 000 occurrences à la fois.

## 10. Langage, encodage et fins de ligne

![Menu Encodage](img/s09-menu-encoding.png)

- **{{menu.language}} :** l'application choisit le langage d'après l'extension du fichier et utilise des couleurs pour faciliter la lecture. Pour changer le langage d'un document, ouvrez le menu et choisissez-en un autre.

![Menu Langage](img/s10-menu-language.png)

- **{{menu.encoding}} :** convertissez le document en **UTF-8** ou en **UTF-8 avec BOM**, et choisissez les fins de ligne **Windows (CRLF)**, **Unix (LF)** ou **Mac (CR)**. Une conversion marque le document comme modifié ; il suffit d'enregistrer pour qu'elle soit effective.
  - **{{menu.encoding.autoFormat}}** supprime les espaces doubles du document (l'indentation des lignes est conservée) et le met en forme selon le standard du langage : Python comme Python (PEP 8), C et C++ en style LLVM, Java en style Google, C# en style Microsoft, Go avec gofmt, et JavaScript, TypeScript, JSON, CSS, HTML, Markdown, YAML, PHP et XML avec Prettier ; Lua, Shell et SQL aussi. Fonctionne sans internet. Pour les langages sans outil de mise en forme (Rust, PowerShell, Batch, LaTeX, INI, TOML et texte), seuls les espaces doubles sont supprimés, et la barre d'état l'indique. Si le code contient une erreur de syntaxe, une fenêtre indique la ligne de l'erreur.
  - En Python, si l'indentation manque, elle est déduite : après une ligne terminée par `:` le bloc ouvre un niveau ; les blocs `if`, `for`, `while`, `try` et `with` prennent la ligne suivante ; le corps d'un `def` va jusqu'à une ligne vide ou un `return`. Vérifiez le résultat, car en Python l'indentation change ce que fait le programme. Les guillemets restent tels que vous les avez écrits. Attention : les espaces doubles à l'intérieur des textes entre guillemets sont aussi supprimés. Ctrl+Z annule tout d'un coup.
  - **{{menu.encoding.url}}** encode le texte sélectionné au format des adresses web (`ma page` devient `ma%20page`) ; si le texte est déjà encodé, il le décode. Dans une adresse complète (`https://…`), les séparateurs `: / ? & = #` sont conservés.

L'encodage et la fin de ligne actuels s'affichent dans la barre d'état.

## 11. Snippets et macros

![Fenêtre des snippets](img/s12-snippets.png)

Les **snippets** sont des extraits de texte tout prêts. Ouvrez **{{menu.tools}} → {{menu.tools.snippets}}**. L'application en fournit déjà quelques-uns : `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` et `cabecalho`. Pour en utiliser un, saisissez son raccourci dans l'éditeur et choisissez la suggestion (ou appuyez sur Ctrl+Espace), ou cliquez sur **{{snippets.insert}}** dans la fenêtre. Pour créer le vôtre, cliquez sur **{{snippets.new}}** et donnez-lui un nom, un raccourci et le texte. Dans le texte, `$1` et `${2:défaut}` marquent les endroits où le curseur s'arrête, et `$0` est la position finale. Les snippets fournis ne peuvent pas être modifiés, mais vous pouvez les dupliquer.

![Fenêtre des macros](img/s13-macros.png)

Les **macros** répètent une séquence que vous avez effectuée. Appuyez sur **Ctrl+Shift+R** pour commencer l'enregistrement, saisissez ou modifiez ce que vous voulez, puis appuyez de nouveau sur **Ctrl+Shift+R** pour l'arrêter. Ensuite, **Ctrl+Shift+M** exécute le dernier enregistrement. Dans **{{menu.tools.macros}}**, vous choisissez le nombre de répétitions et pouvez enregistrer la macro sous un nom. Sont enregistrés : le texte saisi, le texte collé, les touches fléchées, Début, Fin, Retour arrière, Suppr, Tab, Entrée et les commandes des menus. Les clics de souris et Ctrl+Z ne sont pas enregistrés.

## 12. Compte et fichiers dans le cloud

![Premier accès : adresse du serveur](img/s16a-account-server.png)

Avec un compte, vous conservez des fichiers dans le cloud et les ouvrez sur d'autres ordinateurs. Ouvrez le menu **{{menu.account}}**.

1. **Adresse du serveur :** la première fois, saisissez l'adresse que votre entreprise ou votre administrateur vous a communiquée. Elle commence par `https://`.
2. **Créer un compte :** cliquez sur **{{account.link.register}}** et renseignez votre e-mail, votre nom et un mot de passe d'au moins 10 caractères.

![Écran de connexion](img/s16-account-login.png)

3. **Se connecter :** utilisez votre e-mail et votre mot de passe. Si vous oubliez le mot de passe, cliquez sur **{{account.link.forgot}}** : vous recevez un code par e-mail et choisissez un nouveau mot de passe.

![Profil de l'utilisateur](img/s18-account-profile.png)

4. **Profil :** dans **{{menu.account}}**, ouvrez votre profil pour changer le nom, changer le mot de passe ou vous déconnecter. Quand vous changez le mot de passe, vos autres ordinateurs doivent se reconnecter.

![Liste des fichiers dans le cloud](img/s17-cloud-open.png)

5. **Enregistrer dans le cloud :** **{{menu.file}} → {{menu.file.saveCloud}}**. Choisissez le chemin, par exemple `travail/compte-rendu.md`.
6. **Ouvrir depuis le cloud :** **{{menu.file}} → {{menu.file.openCloud}}**. En haut s'affichent le nombre de fichiers enregistrés, leur taille totale et les limites de votre forfait. Les fichiers sont classés par dossier, comme dans la barre latérale, avec la version, la taille et la date de dernière modification en gris. Double-cliquez sur un fichier pour l'ouvrir ; le clic droit propose les mêmes actions que la barre latérale. Dans un document ouvert depuis le cloud, **Ctrl+S** enregistre de nouveau dans le cloud.

Si le fichier a changé dans le cloud depuis la dernière fois, l'application vous prévient et demande si vous voulez l'écraser. Chaque fichier peut peser jusqu'à 10 Mo. Si votre système n'a pas de coffre d'identifiants, l'application vous prévient que vous devrez vous reconnecter à chaque ouverture.

Lorsque vous êtes connecté, la barre d'état affiche, à gauche de l'icône du cloud, le nombre de fichiers enregistrés et l'espace que vous utilisez dans le cloud, en Mo avec deux décimales (par exemple, `Fichiers : 3   Stockage : 1.25 MB`). Chaque valeur passe à l'orange à 90 % de la limite de votre forfait et au rouge à 100 %. À la limite de fichiers, le cloud n'accepte plus de nouveaux fichiers ; à la limite de stockage, il n'accepte ni nouveaux fichiers ni modifications qui augmentent l'espace utilisé. Dans ces cas, le message **{{cloud.limit.title}}** s'affiche et rien n'est enregistré ; mettre à jour un fichier sans l'agrandir reste possible, et supprimer des fichiers libère le forfait. Le total comprend tous vos fichiers dans le cloud et les textes des documents non encore enregistrés, conservés pour continuer sur un autre ordinateur. La valeur change à chaque enregistrement ou suppression. Un fichier du cloud ouvert sans modifications n'occupe pas d'espace supplémentaire ; seul le texte non enregistré est conservé.

Si le même document est modifié sur deux ordinateurs avant la synchronisation, chaque ordinateur garde son texte, et la version de l'autre s'ouvre dans un nouvel onglet avec « (conflit – autre ordinateur) » dans le nom, pour que rien ne soit perdu.

## 13. Langues

![Drapeaux des langues à côté du bouton d'aperçu](img/s08-flags.png)

L'application est disponible en **allemand, espagnol, français, anglais, portugais (Brésil) et portugais (Portugal)**. Elle s'ouvre dans la langue de votre système ; s'il n'y a pas de traduction, elle s'ouvre en anglais. Pour changer, cliquez sur le drapeau de la langue, à gauche du bouton d'aperçu. Le changement est immédiat et conservé pour la prochaine fois. Ce manuel s'ouvre dans la langue utilisée.

## 14. Raccourcis clavier

![Fenêtre des raccourcis clavier](img/s14-shortcuts.png)

Pour voir la liste dans l'application, ouvrez **{{menu.help}} → {{menu.help.shortcuts}}**. Les raccourcis disponibles :

{{shortcuts}}

## 15. Questions fréquentes

**J'ai fermé l'application sans enregistrer. Ai-je perdu mon texte ?**
Non. Le texte non enregistré est conservé automatiquement et revient quand vous rouvrez l'application.

**Pourquoi le Markdown s'ouvre-t-il mis en forme sans que je puisse écrire ?**
C'est le mode lecture. Cliquez sur **{{toolbar.editText}}** (ou Ctrl+Shift+E) pour modifier.

**Mon JSON affiche une erreur, mais il s'ouvre dans un autre programme.**
Le visionneur suit strictement la norme JSON : il n'accepte ni virgule superflue à la fin, ni commentaires, ni apostrophes. Utilisez le bouton de l'erreur pour aller directement au problème.

**Le fichier est volumineux et ne s'ouvre pas.**
La limite est de 50 Mo par fichier.

**Je n'arrive pas à me connecter ni à enregistrer dans le cloud.**
Vérifiez l'adresse du serveur et la connexion internet. Si le message indique que la session a expiré, reconnectez-vous.

**Comment voir la version de l'application ?**
Dans **{{menu.help}} → {{menu.help.about}}**.

## 16. À propos et assistance

![Fenêtre À propos](img/s15-about.png)

![Menu Aide](img/s19-menu-help.png)

**Meu Editor de Arquivos** a été développé par Diego Mendes Rodrigues. L'élément **{{menu.help.support}}** du menu Aide n'est pas encore disponible dans cette version.
