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
- **Varios cursores:** mantén pulsada Alt y haz clic donde quieras otro cursor, o pulsa Ctrl+D para seleccionar la siguiente aparición de la palabra.
- **{{menu.edit.columnSelection}}:** mantén pulsadas Mayús+Alt y arrastra el ratón para editar varias líneas en la misma columna.
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

## 8. Búsqueda en archivos

![Panel de búsqueda con los resultados agrupados por archivo](img/s06-search.png)

Abre una carpeta y elige **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). Se abre el panel inferior.

1. Escribe el texto y haz clic en **{{search.run}}** (o pulsa Intro).
2. Ajusta la búsqueda con los tres botones de al lado: **{{search.caseSensitive}}**, **{{search.wholeWord}}** y **{{search.regex}}**.
3. Para limitar los archivos, escribe un filtro, como `*.md, docs/**`.
4. Los resultados aparecen agrupados por archivo, con línea y columna. Haz clic en un resultado para abrir el archivo y seleccionar el fragmento.

Para sustituir el texto, escribe el nuevo en el campo de reemplazo y haz clic en **{{search.replaceAll}}**. Desmarca los archivos que no deben cambiar. La aplicación pide confirmación, porque **el reemplazo se escribe directamente en los archivos y no se puede deshacer desde el editor**. Los archivos abiertos con cambios sin guardar se omiten, para que no pierdas trabajo.

La búsqueda no entra en carpetas como `node_modules` y `.git`, ni en archivos binarios o de más de 5 MB. Muestra como máximo 5.000 coincidencias cada vez.

## 9. Lenguaje, codificación y fines de línea

![Menú Codificación](img/s09-menu-encoding.png)

- **{{menu.language}}:** la aplicación elige el lenguaje por la extensión del archivo y usa colores para facilitar la lectura. Para cambiar el lenguaje de un documento, abre el menú y elige otro.

![Menú Lenguaje](img/s10-menu-language.png)

- **{{menu.encoding}}:** convierte el documento a **UTF-8** o **UTF-8 con BOM**, y elige el fin de línea de **Windows (CRLF)**, de **Unix (LF)** o de **Mac (CR)**. La conversión marca el documento como modificado; basta con guardar para que surta efecto.

La codificación y el fin de línea actuales aparecen en la barra de estado.

## 10. Snippets y macros

![Ventana de snippets](img/s12-snippets.png)

Los **snippets** son fragmentos de texto ya preparados. Abre **{{menu.tools}} → {{menu.tools.snippets}}**. La aplicación ya incluye algunos: `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` y `cabecalho`. Para usarlos, escribe el atajo en el editor y elige la sugerencia (o pulsa Ctrl+Espacio), o haz clic en **{{snippets.insert}}** en la ventana. Para crear el tuyo, haz clic en **{{snippets.new}}** y dale un nombre, un atajo y el texto. En el texto, `$1` y `${2:predeterminado}` marcan los lugares donde se detiene el cursor, y `$0` es la posición final. Los snippets de la aplicación no se pueden editar, pero sí duplicar.

![Ventana de macros](img/s13-macros.png)

Las **macros** repiten una secuencia que hiciste. Pulsa **Ctrl+Shift+R** para empezar a grabar, escribe o edita lo que quieras y pulsa **Ctrl+Shift+R** otra vez para detener. Después, **Ctrl+Shift+M** ejecuta la última grabación. En **{{menu.tools.macros}}** eliges cuántas veces repetirla y puedes guardar la macro con un nombre. Se graba el texto escrito, el texto pegado, las teclas de flecha, Inicio, Fin, Retroceso, Supr, Tab, Intro y los comandos de los menús. No se graban los clics del ratón ni Ctrl+Z.

## 11. Cuenta y archivos en la nube

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

## 12. Idiomas

![Banderas de los idiomas junto al botón de vista previa](img/s08-flags.png)

La aplicación está disponible en **alemán, español, francés, inglés, portugués (Brasil) y portugués (Portugal)**. Se abre en el idioma de tu sistema; si no hay traducción, se abre en inglés. Para cambiar, haz clic en la bandera del idioma, a la izquierda del botón de vista previa. El cambio es inmediato y se guarda para la próxima vez. Este manual se abre en el idioma que estés usando.

## 13. Atajos de teclado

![Ventana de atajos de teclado](img/s14-shortcuts.png)

Para ver la lista dentro de la aplicación, abre **{{menu.help}} → {{menu.help.shortcuts}}**. Los atajos disponibles:

{{shortcuts}}

## 14. Preguntas frecuentes

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

## 15. Acerca de y soporte

![Ventana Acerca de](img/s15-about.png)

![Menú Ayuda](img/s19-menu-help.png)

**Meu Editor de Arquivos** ha sido desarrollado por Diego Mendes Rodrigues. La opción **{{menu.help.support}}** del menú Ayuda aún no está disponible en esta versión.
