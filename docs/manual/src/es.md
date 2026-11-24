# Meu Editor de Arquivos — Manual del usuario

Versión {{version}}

## 1. Bienvenida

**Meu Editor de Arquivos** es un editor ligero para quienes trabajan con textos, notas, scripts, archivos de configuración, registros y código. Funciona en Windows 11, Debian 12 y 13 y Ubuntu 22.04 o posterior, y **no necesita conexión a internet** para editar.

Lo que encontrarás en él:

- pestañas para varios archivos a la vez, con recuperación automática de lo que has escrito;
- Markdown que se abre **con formato**, con un botón para editar el texto;
- un **visor de JSON** en el que puedes abrir y cerrar partes del archivo;
- búsqueda y reemplazo en un archivo o en una carpeta entera;
- colores de sintaxis para decenas de lenguajes, fragmentos (snippets) y macros;
- una cuenta de usuario para guardar archivos en la nube y abrirlos en otros equipos;
- la interfaz en seis idiomas.

## 2. Conoce la pantalla

![Pantalla principal con una carpeta abierta y un documento Markdown](img/s01-main.png)

1. **Barra de menús** (arriba): {{menu.file}}, {{menu.edit}}, {{menu.search}}, {{menu.view}}, {{menu.encoding}}, {{menu.language}}, {{menu.tools}}, {{menu.account}} y {{menu.help}}.
2. **Barra de herramientas**: accesos directos a los comandos más usados. Los botones de formato aparecen cuando el documento es Markdown. A la derecha están las **banderas de los idiomas** y el botón que alterna entre vista previa y edición.
3. **Barra lateral** (a la izquierda): los documentos abiertos, el explorador de la carpeta abierta y los archivos recientes. Para ocultarla o mostrarla, usa **Ctrl+Shift+B**.
4. **Pestañas**: cada documento tiene la suya. Un punto (●) junto al nombre indica que hay cambios que aún no se han escrito en el archivo.
5. **Área de edición**: donde lees y escribes.
6. **Panel inferior**: muestra los resultados de la búsqueda en archivos. Se abre solo cuando usas la búsqueda.
7. **Barra de estado** (abajo): línea y columna del cursor, tamaño del archivo, codificación, tipo de fin de línea y lenguaje del documento.

## 3. Crear y abrir archivos

![El botón Nuevo con la flecha que muestra los tipos de documento](img/s02-new-menu.png)

- **Documento nuevo:** haz clic en **{{toolbar.new}}** o pulsa **Ctrl+N**. Un documento nuevo es Markdown (.md). Con la **flecha junto al botón** creas otro tipo: .md (Markdown), .txt (texto), .py (Python) o .sql (SQL).
- **Abrir archivos:** **{{menu.file}} → {{menu.file.open}}** o **Ctrl+O**. Puedes elegir varios archivos a la vez. El límite es de 50 MB por archivo.
- **Abrir una carpeta:** **{{menu.file}} → {{menu.file.openFolder}}** o **Ctrl+Shift+K**. La carpeta aparece en el explorador de la barra lateral, y al hacer clic en un archivo se abre. Usa **{{menu.file.closeFolder}}** para cerrarla.
- **Archivos recientes:** los últimos archivos que usaste están en la lista **Recientes** de la barra lateral. Haz clic en uno para abrirlo de nuevo.

Si otro programa modifica un archivo que tienes abierto, la aplicación lo vuelve a cargar sola. Si en ese documento tienes cambios tuyos sin guardar, te pregunta antes. Si el archivo se elimina o se mueve, el nombre de la pestaña se pone en rojo y tachado.

![Menú Archivo](img/s07-menu-file.png)

### Organizar desde la barra lateral

Haga clic con el botón derecho en una carpeta o archivo de la barra lateral, del equipo o de la nube:

- **{{sidebar.rename}}** (carpetas y archivos): abre la ventana **{{rename.folderTitle}}** o **{{rename.fileTitle}}** con el nombre actual. Escriba el nuevo nombre y haga clic en **{{rename.submit}}**. El nombre no puede quedar vacío ni contener `\ / : * ? " < > |`. Las pestañas abiertas de ese archivo, o de los archivos dentro de la carpeta, pasan a usar el nuevo nombre.
- **{{sidebar.folderColor}}** (carpetas): abre la ventana **{{folderColor.title}}** con doce colores, con el actual marcado. Elija otro y haga clic en **{{folderColor.submit}}**. Los colores se guardan en este equipo.
- **{{common.delete}}** (carpetas): solo está disponible cuando la carpeta está vacía.

La carpeta abierta en el explorador no se puede renombrar ni eliminar desde aquí.

Cada archivo tiene un icono según su tipo: documentos (.md, .txt, .tex), logs, programación, scripts, web, datos y configuración (las mismas secciones del botón **+**) y un icono genérico para los demás.

Las áreas de la barra lateral ({{sidebar.openDocs}}, {{sidebar.recent}}, las del cliente de API y las demás) tienen un triángulo a la izquierda del nombre: haga clic en él, o en el nombre, para abrir o cerrar el área. Para cambiar el orden, arrastre el nombre del área hacia arriba o hacia abajo (con el teclado, Alt+↑ y Alt+↓ con el nombre seleccionado). El orden y las áreas cerradas se guardan en este equipo. Para quitar un área de la barra lateral, haga clic en la X a la derecha de su nombre, o desmárquela en **{{menu.view.sidebarAreas}}**, en el menú **{{menu.view}}**; márquela de nuevo para que vuelva a su lugar.

## 4. Guardar y documentos temporales

- **{{menu.file.save}}** (**Ctrl+S**) escribe el documento en su archivo. En un documento nuevo, la aplicación pide el nombre y la ubicación.
- **{{menu.file.saveAs}}** (**Ctrl+Shift+S**) escribe una copia con otro nombre o en otro lugar.
- **{{menu.file.saveAll}}** escribe todos los documentos que tienen cambios.

**No pierdes lo que escribiste.** Unos segundos después de cada cambio, la aplicación guarda automáticamente todos los documentos abiertos, incluso los que nunca se guardaron. Esto ocurre te acuerdes de guardar o no.

Al **cerrar la aplicación**, no pregunta nada y no descarta nada. La próxima vez que la abras, las pestañas, la carpeta y el texto sin guardar vuelven como estaban. Guarda cuando quieras escribir en el archivo de verdad.

Al **cerrar una pestaña** con cambios, la aplicación pregunta si quieres guardar, no guardar o cancelar. Dos observaciones: el historial de deshacer (Ctrl+Z) no se conserva entre sesiones, y la recuperación automática guarda hasta 100 MB de texto sin guardar.

## 5. Editar texto

![Caracteres invisibles: espacios, tabulaciones y fin de línea](img/s11-invisibles.png)

Los comandos de edición están en **{{menu.edit}}** y las opciones de visualización en **{{menu.view}}**.

- **Deshacer y rehacer:** Ctrl+Z y Ctrl+Y.
- **Buscar y reemplazar** en el documento: Ctrl+F y Ctrl+H. Para ir a una línea, usa Ctrl+G.
- **Varios cursores:** mantén pulsada Ctrl y haz clic donde quieras otro cursor, o pulsa Ctrl+D para seleccionar la siguiente aparición de la palabra.
- **{{menu.edit.columnSelection}}:** mantén pulsadas Mayús+Ctrl y arrastra el ratón para editar varias líneas en la misma columna.
- **Líneas:** Alt+↑ y Alt+↓ mueven la línea; Shift+Alt+↑ y Shift+Alt+↓ la duplican; Ctrl+/ la comenta o la descomenta.
- **Ordenar y limpiar:** {{menu.edit.sortAsc}}, {{menu.edit.sortDesc}}, {{menu.edit.removeDuplicates}} y {{menu.edit.trimWhitespace}}.
- **{{menu.view.invisibles}}:** muestra los espacios (·), las tabulaciones (→) y el final de cada línea (¶). Es muy útil para encontrar espacios de más.
- **{{menu.view.wordWrap}}** y **{{menu.view.foldAll}} / {{menu.view.unfoldAll}}** ayudan a leer archivos largos.
- **Tamaño de la letra:** Ctrl++ la agranda, Ctrl+- la reduce y Ctrl+0 vuelve al tamaño predeterminado.
- **Sangría:** en **{{menu.edit}}**, elige entre espacios o tabulación y el tamaño (2, 4 u 8 columnas).
- **{{menu.view.fullScreen}}** (F11, en **{{menu.view}}**): muestra solo el documento, ocupando toda la pantalla. Pulsa F11 de nuevo, o haz clic en el botón de la esquina superior derecha, para salir.
- **{{menu.view.toggleTheme}}** (en **{{menu.view}}**): cambia entre el modo claro y el oscuro. Mientras no elija, la aplicación sigue el tema del sistema operativo; la elección se guarda para la próxima vez.

Tus preferencias de visualización se guardan para la próxima vez. Los textos propios del editor, como el cuadro de búsqueda (Ctrl+F) y la paleta de comandos (F1), aparecen en inglés.

![La aplicación en modo oscuro](img/s22-dark-mode.png)

### Letras, espacios y finales de línea

![Menú Editar con el submenú Convertir letras a abierto](img/s20-menu-edit.png)

Al final del menú **{{menu.edit}}** hay tres submenús:

- **{{menu.edit.eol}}:** convierte los finales de línea del documento al formato Windows (CRLF), Unix (LF) o Mac (CR). La conversión marca el documento como modificado; basta con guardar para que surta efecto.
- **{{menu.edit.case}}:** con un texto seleccionado, elige {{menu.edit.caseUpper}}, {{menu.edit.caseLower}} o {{menu.edit.caseSentence}} (solo la primera letra de cada oración queda en mayúscula).
- **{{menu.edit.spaces}}:** {{menu.edit.trimRight}}, {{menu.edit.trimLeft}} y {{menu.edit.trimBoth}} se aplican a la línea del cursor (o a las líneas seleccionadas). {{menu.edit.collapseSpaces}} reemplaza dos o más espacios seguidos por uno solo en todo el documento, sin tocar la sangría del comienzo de las líneas.

### MD5, SHA-1, SHA-256 y SHA-512

![Ventana para generar el SHA-256 de un texto](img/s21-hash.png)

Al final del menú **{{menu.tools}}**, cada algoritmo tiene dos opciones:

- **{{menu.tools.hashGenerate}}:** abre una ventana; escribe o pega el texto y el resultado aparece al instante, justo debajo. **{{hash.copy}}** lleva el resultado al portapapeles.
- **{{menu.tools.hashSelection}}:** calcula el resultado a partir del texto seleccionado en el documento y lo deja en el portapapeles, listo para pegar. Aparece un aviso en la barra de estado.

### Terminal

En **{{menu.tools}} → {{menu.tools.openTerminal}}**, se abre un terminal justo debajo del documento, en su carpeta personal: PowerShell en Windows y su shell (normalmente bash) en Linux. Escriba los comandos y vea los resultados ahí mismo; el documento sigue abierto arriba, y el divisor entre ambos se puede arrastrar.

- Cada clic abre otro terminal, en su propia pestaña (Terminal 1, Terminal 2…). La **×** de la pestaña cierra el terminal; el comando `exit` también.
- Con texto seleccionado en el terminal, Ctrl+C lo copia; sin selección, Ctrl+C interrumpe el comando en ejecución. Ctrl+V pega.
- Mientras el cursor está en el terminal, las teclas van a él (Ctrl+W, Ctrl+R…) y no a los atajos de la aplicación.
- Los terminales no vuelven la próxima vez que abra la aplicación.

### Corrector ortográfico

![Palabra subrayada y las sugerencias de corrección](img/s11a-spelling.png)

En los documentos Markdown, de texto (.txt) y LaTeX, las palabras que no están en el diccionario aparecen subrayadas en rojo. El código, los enlaces, las direcciones, las siglas y el texto entre comillas invertidas no se revisan, y los archivos de registro y CSV quedan fuera.

- Coloque el cursor en la palabra y pulse **Ctrl+.** (o haga clic derecho y elija **{{spell.suggestions}}**) para ver las sugerencias. Elija una para reemplazar la palabra.
- **{{spell.addToDictionary}}** hace que la palabra se acepte a partir de entonces, en cualquier idioma.
- **{{menu.tools}} → {{menu.tools.spellCheck}}** (o **F7**) activa y desactiva la revisión.
- El corrector usa el idioma de la interfaz. Para revisar en otro idioma, elija en **{{menu.tools}} → {{menu.tools.spellSubmenu}}** una de las opciones **{{spell.source}}: Deutsch**, **{{spell.source}}: English**…: hay diccionarios de alemán, español, francés, inglés, portugués de Brasil y portugués de Portugal. **{{menu.tools.spellAuto}}** vuelve a seguir la interfaz.

Los diccionarios vienen con la aplicación: el corrector funciona sin internet.

### Asistente de IA (Ollama)

El **{{ai.title}}** usa un modelo de IA que se ejecuta en su propio equipo mediante Ollama (ollama.com): nada sale a internet. Abra el panel en **{{menu.tools}} → {{menu.tools.ai}}** o con **Ctrl+Shift+I**. Si Ollama aún no está en el equipo, el propio panel guía la instalación: en Windows, **{{ai.install.button}}** descarga el instalador oficial, comprueba la firma digital y abre su ventana para que la termine; en Linux, **{{ai.install.openTerminal}}** escribe el comando oficial en el terminal de la aplicación para que lo revise y confirme (necesita sudo). Con Ollama detenido, use **{{ai.install.start}}**. Después, elija un modelo en **{{ai.install.pullTitle}}** y siga la descarga; **{{ai.install.delete}}** libera espacio.

- Elija el modelo, escriba la pregunta y siga la respuesta mientras se genera; **{{ai.stop}}** la interrumpe y **{{ai.newChat}}** empieza de cero.
- Las **{{ai.quick.label}}** actúan sobre la selección (o el documento entero): **{{ai.quick.explain}}**, **{{ai.quick.improve}}**, **{{ai.quick.fix}}**, **{{ai.quick.summarize}}**, **{{ai.quick.translate}}**, **{{ai.quick.document}}** y **{{ai.quick.tests}}**.
- En los bloques de código de la respuesta, use **{{ai.code.copy}}**, **{{ai.code.insert}}** o **{{ai.code.replace}}**.
- La conversación queda solo en memoria y desaparece al cerrar la aplicación. De forma predeterminada, el asistente solo habla con un Ollama de este equipo.

## 6. Markdown

![Documento Markdown en modo de edición, con la barra de formato](img/s03-markdown-edit.png)

Los archivos Markdown (.md) se abren **formateados** y puede seguir escribiendo directamente en el texto formateado. La barra de herramientas aplica el formato en el cursor o en la selección: títulos, lista con viñetas, lista numerada, sangría, **negrita** (Ctrl+B), *cursiva* (Ctrl+I), ~~tachado~~ (Ctrl+Shift+X), enlace, tabla y quitar formato. Ctrl+Z y Ctrl+Y deshacen y rehacen.

Para ver y editar el código Markdown, haga clic en **{{toolbar.editText}}** (o pulse **Ctrl+Shift+E**); para volver al texto formateado, haga clic en **{{toolbar.preview}}**. La barra de formato funciona en los dos modos.

Al editar el texto formateado, el Markdown se reescribe en un estilo estándar (por ejemplo, listas con `-`). Los documentos que contienen HTML quedan de solo lectura en este modo para no perder el HTML: edítelos con **{{toolbar.editText}}**. Para abrir un enlace en el navegador, use Ctrl+clic. Las imágenes aparecen como una etiqueta con su nombre, y su dirección se conserva en el archivo.

## 7. Archivos JSON

![Archivo JSON en árbol, con un elemento seleccionado](img/s04-json-tree.png)

Los archivos .json se abren en **árbol**. Haz clic en la flecha de un elemento para abrir o cerrar esa parte. Usa **{{menu.view.unfoldAll}}** y **{{menu.view.foldAll}}** para abrir o cerrar todo. Al hacer clic en un elemento, la barra muestra su ruta y puedes copiar la **{{json.path}}** o el **{{json.value}}**. Las listas muy grandes se muestran poco a poco, con un botón para ver más.

Para editar, haz clic en **{{toolbar.editText}}**. En modo de edición, el botón **{{toolbar.formatJson}}** (Shift+Alt+F) ordena el archivo.

![Mensaje de error de un JSON no válido, con línea y columna](img/s05-json-error.png)

Si el archivo tiene un error, la aplicación explica el problema e indica la línea y la columna. El botón **{{json.editGoToError}}** abre el editor justo en el punto del error.

## 8. Cliente de API

![Cliente de API con una solicitud enviada y la respuesta en árbol](img/s23-api-request.png)

El Cliente de API sirve para probar servicios en internet (APIs): montas una solicitud, la envías y compruebas la respuesta sin salir del editor. Cada solicitud es un archivo **.apireq**, que puedes guardar, copiar y versionar como cualquier otro.

### Abrir

- Pulsa **Ctrl+Shift+A**, o usa **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiClient}}**.
- O usa **{{menu.file}} → Nuevo archivo de solicitud de API (.apireq)**.

El documento se abre en el **{{apiClient.builder}}**. Para ver y editar el archivo como texto (JSON), haz clic en **{{toolbar.editText}}**.

### Montar la solicitud

Elige el **{{apiClient.method}}** (GET, POST…) y escribe la dirección en **{{apiClient.url}}**. Los datos están en pestañas:

- **{{apiClient.tab.params}}**: los parámetros de la query. Lo que escribes en la URL aparece aquí, y al revés.
- **{{apiClient.tab.auth}}**: cómo identificarte ante el servicio (ver más abajo).
- **{{apiClient.tab.headers}}**: las cabeceras de la solicitud.
- **{{apiClient.tab.body}}**: el contenido que se envía. En **{{apiClient.body.type}}** eliges entre JSON, XML, texto, HTML, formulario, formulario con archivos, archivo binario, GraphQL, SOAP o ningún cuerpo.
- **{{apiClient.tab.settings}}**: tiempo límite, redirecciones, proxy, certificados y **{{apiClient.settings.verifyTls}}**. Desactiva la verificación solo en entornos de prueba.

En cualquier campo, usa <code>&#123;&#123;nombre&#125;&#125;</code> para insertar una variable del entorno activo.

### Enviar y ver la respuesta

Haz clic en **{{apiClient.send}}** o pulsa **Ctrl+Enter**. Mientras la solicitud está en curso, **Esc** cancela el envío. El botón de flecha de al lado ofrece **{{apiClient.sendDownload}}**, que guarda el cuerpo directamente en un archivo (útil para respuestas grandes o binarias).

La respuesta muestra el estado, el tiempo y el tamaño, y tiene las pestañas **{{apiClient.response.tab.body}}**, **{{apiClient.response.tab.headers}}**, **{{apiClient.response.tab.cookies}}**, **{{apiClient.response.tab.tests}}** y **{{apiClient.response.tab.timings}}**. El cuerpo se puede ver como **{{apiClient.response.view.tree}}** (para abrir y cerrar partes del JSON), **{{apiClient.response.view.pretty}}** o **{{apiClient.response.view.raw}}**. Usa **{{apiClient.response.saveResponse}}** para guardar la respuesta en un archivo .apiresp, y **{{apiClient.response.openBody}}** para editarla como un documento normal.

### Autorización

En la pestaña **{{apiClient.tab.auth}}**, elige en **{{apiClient.auth.type}}**: API Key, Basic Auth, Bearer Token, OAuth 1.0 u OAuth 2.0. En OAuth 2.0 hay los flujos **{{apiClient.oauth.flow.authorizationCode}}**, **{{apiClient.oauth.flow.clientCredentials}}**, **{{apiClient.oauth.flow.deviceCode}}** y **{{apiClient.oauth.flow.password}}**; haz clic en **{{apiClient.oauth.getToken}}** y, si hace falta, se abre el navegador del sistema para que autorices el acceso. Con **{{apiClient.auth.inherit}}**, la solicitud usa la autorización definida en la colección.

Para contraseñas y tokens, usa una variable secreta (ver "Entornos y secretos"): así el valor nunca se guarda en el archivo de la solicitud.

### Pruebas y extracciones

En la pestaña **{{apiClient.tab.tests}}**:

- **{{apiClient.tests.assertions}}**: reglas que se comprueban en cada envío, como "el estado es igual a 200", "el cuerpo contiene un texto" o "el JSONPath existe". El resultado aparece en la pestaña **{{apiClient.response.tab.tests}}** de la respuesta.
- **{{apiClient.tests.extractions}}**: guardan un valor de la respuesta (por ejemplo, un token) en una variable del entorno, para usarlo en las siguientes solicitudes.

### Entornos y secretos

![Entorno de API con una variable común y una secreta](img/s24-api-environment.png)

Un entorno reúne variables, como la dirección del servidor de pruebas y la de producción. Usa **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiEnvironments}}** para crear uno (archivo **.apienv**) y elige el activo en el selector **{{apiClient.env.select}}**.

- Marca **{{apiClient.env.secret}}** en las variables confidenciales. El valor se guarda cifrado en este equipo y **no va al archivo .apienv**.
- Marca **{{apiClient.env.production}}** en un entorno de producción: la aplicación pide confirmación antes de enviar POST, PUT, PATCH y DELETE.
- Las cookies recibidas se guardan separadas por entorno; consúltalas o bórralas en **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiCookies}}**.

### Colecciones e historial

Una colección es una carpeta con las solicitudes y el archivo **.apicol**, que guarda la autorización y las variables comunes. En la barra lateral, la sección **{{apiClient.col.section}}** muestra las colecciones de las carpetas abiertas; con el botón derecho puedes crear solicitudes y carpetas, **{{apiClient.col.run}}**, **{{apiClient.col.export}}**, **{{apiClient.col.document}}** (genera la documentación de la colección) y **{{apiClient.col.settings}}**.

El **{{apiClient.history.section}}** (también en **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiHistory}}**) lista las últimas solicitudes enviadas, y puedes borrarlo cuando quieras.

### Importar, exportar y generar código

- **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiImport}}** trae solicitudes de curl, Postman, OpenAPI/Swagger, Insomnia, HAR y archivos .http. Haz clic en **{{apiClient.import.analyze}}** para ver qué se importará y elige **{{apiClient.import.asCollection}}** o **{{apiClient.import.openInTabs}}**. Pegar un comando curl en la URL también ofrece la importación.
- **{{apiClient.col.export}}** guarda la colección como Postman, OpenAPI, HAR, .http o curl. Los valores de las variables secretas nunca se exportan.
- El botón **{{apiClient.code}}** abre **{{apiClient.codegen.title}}** y muestra la solicitud en varios lenguajes, lista para copiar.

### Ejecutar una colección

En **{{apiClient.col.run}}**, elige las solicitudes, el entorno, el número de iteraciones y el retraso entre ellas. Un archivo de datos (CSV o JSON) repite la ejecución con los valores de cada fila, y **{{apiClient.runner.stopOnFailure}}** se detiene en el primer error. Haz clic en **{{apiClient.runner.start}}**: el resultado se abre como informe (**.apirun**), con totales, tiempos y las pruebas de cada solicitud. Con **{{apiClient.report.export}}** el informe se guarda en JUnit XML, HTML o Markdown.

### GraphQL

En **{{apiClient.body.type}}**, elige GraphQL para escribir la **{{apiClient.graphql.query}}** y las **{{apiClient.graphql.variables}}**. Con **{{apiClient.graphql.loadSchema}}**, la aplicación lee el schema del servidor, muestra la documentación de los tipos y ofrece autocompletado.

Cuando la operación elegida es una **subscription**, aparece el botón **{{apiClient.graphql.subscribe}}**: la aplicación abre un WebSocket (protocolo graphql-transport-ws) en la dirección de la solicitud y muestra los eventos recibidos debajo del editor. Haga clic en **{{apiClient.mock.stop}}** para terminar.

### SOAP y WSDL

En **{{apiClient.body.type}}**, elija SOAP, la **{{apiClient.soap.version}}** (1.1 o 1.2) y la SOAPAction; **{{apiClient.soap.template}}** rellena un sobre vacío. Para crear las solicitudes a partir de un servicio, use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiImport}}** con el archivo WSDL: cada operación se convierte en una solicitud, ya con el sobre de ejemplo. En las pruebas y extracciones, el destino XPath lee respuestas XML (por ejemplo, <code>//*[local-name()='Resultado']</code>).

### WebSocket

Use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiWebSocket}}** para crear una conexión (archivo **.apiws**). Escriba la **{{apiClient.ws.url}}** (ws:// o wss://), los encabezados y los subprotocolos y haga clic en **{{apiClient.ws.connect}}**. Escriba el mensaje (texto, JSON o binario en base64) y envíelo con **Ctrl+Enter**. El **{{apiClient.ws.log}}** muestra los mensajes enviados y recibidos, con hora y tamaño; se puede filtrar, pausar y limpiar. Use **{{apiClient.ws.saveMessage}}** para guardar los mensajes que envía a menudo.

### Servidor mock

Un servidor mock responde en lugar de la API real, con respuestas que ya conoce. En la respuesta de una solicitud guardada, haga clic en **{{apiClient.response.saveExample}}**: la aplicación guarda el ejemplo junto a la solicitud. Después, con el botón derecho en la colección, elija **{{apiClient.col.mock}}** (o **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiMock}}**). Las rutas vienen de los ejemplos guardados o de un archivo OpenAPI; ajuste el estado y el retraso de cada una y haga clic en **{{apiClient.mock.start}}**. El servidor solo atiende en este equipo, salvo que marque **{{apiClient.mock.lan}}**, y se detiene solo tras 8 horas sin llamadas.

### gRPC

Use **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiGrpc}}** para crear una llamada (archivo **.apigrpc**). Indique la **{{apiClient.grpc.address}}**, marque **{{apiClient.grpc.tls}}** si el servidor lo exige y elija el **{{apiClient.grpc.source}}**: **{{apiClient.grpc.source.reflection}}** o **{{apiClient.grpc.source.proto}}**. Haga clic en **{{apiClient.grpc.load}}**, elija el servicio y el método y use **{{apiClient.grpc.useTemplate}}** para empezar el mensaje en JSON. Las llamadas simples y con streaming del servidor usan **{{apiClient.grpc.invoke}}**; con streaming del cliente o bidireccional, use **{{apiClient.grpc.start}}**, **{{apiClient.grpc.send}}** y **{{apiClient.grpc.end}}**. Los mensajes, los metadatos y el estado aparecen en la lista de eventos.

### Monitores

Un monitor repite la ejecución de una colección cada cierto número de minutos y avisa con una notificación del sistema cuando algo falla (y otra vez cuando vuelve a pasar). Con el botón derecho en la colección, elija **{{apiClient.col.monitor}}** (o **{{menu.tools}} → {{menu.tools.apiSubmenu}} → {{menu.tools.apiMonitor}}**), defina el intervalo, el entorno y las solicitudes, y guarde. El gráfico muestra el tiempo de cada ejecución, con los fallos en rojo; **{{apiClient.monitor.runNow}}** la ejecuta al momento. Los monitores solo funcionan con la aplicación abierta y se reanudan solos al volver a abrirla.

### Scripts

En la pestaña **{{apiClient.tab.tests}}**, debajo de las aserciones, hay dos scripts opcionales en JavaScript: **{{apiClient.scripts.pre}}** (puede cambiar la URL, los encabezados y el cuerpo) y **{{apiClient.scripts.post}}** (puede comprobar la respuesta con <code>test</code> y <code>expect</code> y guardar valores con <code>env.set</code>). El alias <code>pm</code> acepta lo básico de los scripts de Postman. Los scripts se ejecutan aislados, sin red, archivos ni acceso al equipo, con límite de tiempo y de memoria; lo que escriben con <code>console.log</code> aparece en el bloque **{{apiClient.scripts.console}}** de la respuesta.

Los scripts que usted no escribió (importados o recibidos de otra persona) no se ejecutan solos: la solicitud muestra un aviso con **{{apiClient.scripts.trustCollection}}**. La confianza vale solo en este equipo y se pierde si los scripts cambian.

### IA en el Cliente de API

En el panel de la respuesta, **{{ai.api.explain}}** pide al asistente que explique la respuesta y **{{ai.api.suggestTests}}** sugiere aserciones para la pestaña **{{apiClient.tab.tests}}**. Con el botón derecho en la colección, **{{ai.api.document}}** escribe su documentación. Los encabezados de autenticación y los valores secretos no se envían al modelo.

En los scripts, <code>pm.sendRequest</code> hace solicitudes auxiliares (por ejemplo, para obtener un token), con las mismas reglas de secretos que las solicitudes normales y un máximo de 10 por script.

### Seguridad

- Todas las solicitudes salen de tu propio equipo, a través de la aplicación; nada pasa por servidores nuestros.
- Las contraseñas, los tokens y los valores secretos se guardan en el almacén seguro del sistema operativo (cifrados). Si el sistema no tiene almacén, solo quedan en la memoria y se pierden al cerrar la aplicación.
- Estos valores **nunca** van a los archivos (.apireq, .apienv, .apicol), ni a las exportaciones, la generación de código, los registros o la nube. El historial y las cookies también quedan solo en este equipo.
- Solo las respuestas guardadas y los informes de una colección pueden sincronizarse con la nube, y solo si activas **{{apiClient.col.syncResponses}}**.

## 9. Búsqueda en archivos

![Panel de búsqueda con los resultados agrupados por archivo](img/s06-search.png)

Abre una carpeta y elige **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). Se abre el panel inferior.

1. Escribe el texto y haz clic en **{{search.run}}** (o pulsa Intro).
2. Ajusta la búsqueda con los tres botones de al lado: **{{search.caseSensitive}}**, **{{search.wholeWord}}** y **{{search.regex}}**.
3. Para limitar los archivos, escribe un filtro, como `*.md, docs/**`.
4. Los resultados aparecen agrupados por archivo, con línea y columna. Haz clic en un resultado para abrir el archivo y seleccionar el fragmento.

Para sustituir el texto, escribe el nuevo en el campo de reemplazo y haz clic en **{{search.replaceAll}}**. Desmarca los archivos que no deben cambiar. La aplicación pide confirmación, porque **el reemplazo se escribe directamente en los archivos y no se puede deshacer desde el editor**. Los archivos abiertos con cambios sin guardar se omiten, para que no pierdas trabajo.

La búsqueda no entra en carpetas como `node_modules` y `.git`, ni en archivos binarios o de más de 5 MB. Muestra como máximo 5.000 coincidencias cada vez.

## 10. Lenguaje, codificación y fines de línea

![Menú Codificación](img/s09-menu-encoding.png)

- **{{menu.language}}:** la aplicación elige el lenguaje por la extensión del archivo y usa colores para facilitar la lectura. Para cambiar el lenguaje de un documento, abre el menú y elige otro.

![Menú Lenguaje](img/s10-menu-language.png)

- **{{menu.encoding}}:** convierte el documento a **UTF-8** o **UTF-8 con BOM**, y elige el fin de línea de **Windows (CRLF)**, de **Unix (LF)** o de **Mac (CR)**. La conversión marca el documento como modificado; basta con guardar para que surta efecto.
  - **{{menu.encoding.autoFormat}}** elimina los espacios dobles del documento (la sangría de las líneas se mantiene) y lo formatea según el estándar del lenguaje: Python como Python (PEP 8), C y C++ en estilo LLVM, Java en estilo Google, C# en estilo Microsoft, Go con gofmt, y JavaScript, TypeScript, JSON, CSS, HTML, Markdown, YAML, PHP y XML con Prettier; también Lua, Shell y SQL. Funciona sin internet. En los lenguajes sin formateador (Rust, PowerShell, Batch, LaTeX, INI, TOML y texto), solo se eliminan los espacios dobles, y la barra de estado lo indica. Si el código tiene un error de sintaxis, una ventana muestra la línea del error.
  - En Python, si falta la sangría, se deduce: después de una línea que termina en `:` el bloque abre un nivel; los bloques `if`, `for`, `while`, `try` y `with` se quedan con la línea siguiente; el cuerpo de un `def` llega hasta una línea en blanco o un `return`. Revise el resultado, porque en Python la sangría cambia lo que hace el programa. Las comillas quedan como las escribió. Atención: también se eliminan los espacios dobles dentro de textos entre comillas. Ctrl+Z lo deshace todo de una vez.
  - **{{menu.encoding.url}}** codifica el texto seleccionado en formato de direcciones web (`mi página` se convierte en `mi%20p%C3%A1gina`); si el texto ya está codificado, lo decodifica. En una dirección completa (`https://…`), se mantienen los separadores `: / ? & = #`.

La codificación y el fin de línea actuales aparecen en la barra de estado.

## 11. Snippets y macros

![Ventana de snippets](img/s12-snippets.png)

Los **snippets** son fragmentos de texto ya preparados. Abre **{{menu.tools}} → {{menu.tools.snippets}}**. La aplicación ya incluye algunos: `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` y `cabecalho`. Para usarlos, escribe el atajo en el editor y elige la sugerencia (o pulsa Ctrl+Espacio), o haz clic en **{{snippets.insert}}** en la ventana. Para crear el tuyo, haz clic en **{{snippets.new}}** y dale un nombre, un atajo y el texto. En el texto, `$1` y `${2:predeterminado}` marcan los lugares donde se detiene el cursor, y `$0` es la posición final. Los snippets de la aplicación no se pueden editar, pero sí duplicar.

![Ventana de macros](img/s13-macros.png)

Las **macros** repiten una secuencia que hiciste. Pulsa **Ctrl+Shift+R** para empezar a grabar, escribe o edita lo que quieras y pulsa **Ctrl+Shift+R** otra vez para detener. Después, **Ctrl+Shift+M** ejecuta la última grabación. En **{{menu.tools.macros}}** eliges cuántas veces repetirla y puedes guardar la macro con un nombre. Se graba el texto escrito, el texto pegado, las teclas de flecha, Inicio, Fin, Retroceso, Supr, Tab, Intro y los comandos de los menús. No se graban los clics del ratón ni Ctrl+Z.

## 12. Cuenta y archivos en la nube

![Primer acceso: dirección del servidor](img/s16a-account-server.png)

Con una cuenta guardas archivos en la nube y los abres en otros equipos. Abre el menú **{{menu.account}}**.

1. **Dirección del servidor:** la primera vez, escribe la dirección que te dio tu empresa o el administrador. Empieza por `https://`.
2. **Crear cuenta:** haz clic en **{{account.link.register}}** y rellena el correo, el nombre y una contraseña de al menos 10 caracteres.

![Pantalla de inicio de sesión](img/s16-account-login.png)

3. **Iniciar sesión:** usa tu correo y tu contraseña. Si olvidas la contraseña, haz clic en **{{account.link.forgot}}**: recibirás un código por correo y podrás elegir una contraseña nueva.

![Perfil del usuario](img/s18-account-profile.png)

4. **Perfil:** en **{{menu.account}}**, abre tu perfil para cambiar el nombre, cambiar la contraseña o cerrar sesión. Al cambiar la contraseña, tus otros equipos tendrán que iniciar sesión de nuevo.

![Lista de archivos en la nube](img/s17-cloud-open.png)

5. **Guardar en la nube:** **{{menu.file}} → {{menu.file.saveCloud}}**. Elige la ruta, por ejemplo `trabajo/acta.md`.
6. **Abrir desde la nube:** **{{menu.file}} → {{menu.file.openCloud}}**. En la lista puedes abrir o eliminar archivos. En un documento abierto desde la nube, **Ctrl+S** vuelve a guardar en la nube.

Si el archivo ha cambiado en la nube desde la última vez, la aplicación te avisa y pregunta si quieres sobrescribirlo. Cada archivo puede tener hasta 10 MB. Si tu sistema no tiene almacén de credenciales, la aplicación te avisa de que tendrás que iniciar sesión cada vez que la abras.

Con la cuenta conectada, la barra de estado muestra, a la izquierda del icono de la nube, cuánto espacio usa en la nube, en MB con dos decimales (por ejemplo, `1.25 MB`). La cuenta suma todos sus archivos en la nube y los textos de los documentos aún no guardados, que se conservan para continuar en otro equipo. El valor cambia con cada guardado o eliminación. Un archivo de la nube abierto sin cambios no ocupa espacio adicional; solo se conserva el texto aún no guardado.

Si el mismo documento se modifica en dos equipos antes de sincronizar, cada equipo conserva su texto, y la versión del otro se abre en una pestaña nueva con "(conflicto – otro equipo)" en el nombre, para que nada se pierda.

## 13. Idiomas

![Banderas de los idiomas junto al botón de vista previa](img/s08-flags.png)

La aplicación está disponible en **alemán, español, francés, inglés, portugués (Brasil) y portugués (Portugal)**. Se abre en el idioma de tu sistema; si no hay traducción, se abre en inglés. Para cambiar, haz clic en la bandera del idioma, a la izquierda del botón de vista previa. El cambio es inmediato y se guarda para la próxima vez. Este manual se abre en el idioma que estés usando.

## 14. Atajos de teclado

![Ventana de atajos de teclado](img/s14-shortcuts.png)

Para ver la lista dentro de la aplicación, abre **{{menu.help}} → {{menu.help.shortcuts}}**. Los atajos disponibles:

{{shortcuts}}

## 15. Preguntas frecuentes

**Cerré la aplicación sin guardar. ¿He perdido mi texto?**
No. El texto sin guardar se conserva automáticamente y vuelve cuando abres la aplicación de nuevo.

**¿Por qué el Markdown se abre con formato y no puedo escribir?**
Es el modo de lectura. Haz clic en **{{toolbar.editText}}** (o Ctrl+Shift+E) para editar.

**Mi JSON muestra un error, pero se abre en otro programa.**
El visor sigue el estándar estricto de JSON: no acepta una coma sobrante al final, comentarios ni comillas simples. Usa el botón del error para ir directamente al problema.

**El archivo es grande y no se abre.**
El límite es de 50 MB por archivo.

**No puedo iniciar sesión ni guardar en la nube.**
Comprueba la dirección del servidor y la conexión a internet. Si el mensaje dice que la sesión ha caducado, inicia sesión de nuevo.

**¿Cómo veo la versión de la aplicación?**
En **{{menu.help}} → {{menu.help.about}}**.

## 16. Acerca de y soporte

![Ventana Acerca de](img/s15-about.png)

![Menú Ayuda](img/s19-menu-help.png)

**Meu Editor de Arquivos** ha sido desarrollado por Diego Mendes Rodrigues. La opción **{{menu.help.support}}** del menú Ayuda aún no está disponible en esta versión.
