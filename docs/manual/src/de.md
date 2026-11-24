# Meu Editor de Arquivos — Benutzerhandbuch

Version {{version}}

## 1. Willkommen

**Meu Editor de Arquivos** ist ein schlanker Editor für alle, die mit Texten, Notizen, Skripten, Konfigurationsdateien, Protokollen und Programmcode arbeiten. Er läuft unter Windows 11, Debian 12 und 13 sowie Ubuntu 22.04 oder neuer und **braucht für die Bearbeitung keine Internetverbindung**.

Das bietet Ihnen das Programm:

- Registerkarten für mehrere Dateien gleichzeitig, mit automatischer Wiederherstellung Ihrer Eingaben;
- Markdown, das **formatiert** geöffnet wird, mit einer Schaltfläche zum Bearbeiten des Textes;
- einen **JSON-Viewer**, in dem Sie Teile der Datei auf- und zuklappen können;
- Suchen und Ersetzen in einer Datei oder in einem ganzen Ordner;
- Syntaxfarben für Dutzende Sprachen, Snippets und Makros;
- ein Benutzerkonto, um Dateien in der Cloud zu speichern und auf anderen Computern zu öffnen;
- eine Benutzeroberfläche in sechs Sprachen.

## 2. Die Oberfläche kennenlernen

![Hauptfenster mit geöffnetem Ordner und einem Markdown-Dokument](img/s01-main.png)

1. **Menüleiste** (oben): {{menu.file}}, {{menu.edit}}, {{menu.search}}, {{menu.view}}, {{menu.encoding}}, {{menu.language}}, {{menu.tools}}, {{menu.account}} und {{menu.help}}.
2. **Symbolleiste**: Schnellzugriff auf die häufigsten Befehle. Die Formatierungsschaltflächen erscheinen, wenn das Dokument Markdown ist. Rechts finden Sie die **Sprachflaggen** und die Schaltfläche zum Wechseln zwischen Vorschau und Bearbeitung.
3. **Seitenleiste** (links): die geöffneten Dokumente, der Explorer für den geöffneten Ordner und Ihre zuletzt geöffneten Dateien. Mit **Ctrl+Shift+B** blenden Sie sie aus oder wieder ein.
4. **Registerkarten**: Jedes Dokument hat eine eigene Registerkarte. Ein Punkt (●) neben dem Namen zeigt Änderungen an, die noch nicht in die Datei geschrieben wurden.
5. **Bearbeitungsbereich**: Hier lesen und schreiben Sie.
6. **Unterer Bereich**: zeigt die Ergebnisse der Suche in Dateien. Er öffnet sich von selbst, wenn Sie die Suche verwenden.
7. **Statusleiste** (unten): Zeile und Spalte des Cursors, Dateigröße, Kodierung, Art der Zeilenenden und die Sprache des Dokuments.

## 3. Dateien erstellen und öffnen

![Die Schaltfläche „Neu“ mit dem Pfeil, der die Dokumenttypen auflistet](img/s02-new-menu.png)

- **Neues Dokument:** Klicken Sie auf **{{toolbar.new}}** oder drücken Sie **Ctrl+N**. Ein neues Dokument ist Markdown (.md). Mit dem **Pfeil neben der Schaltfläche** erstellen Sie einen anderen Typ: .md (Markdown), .txt (Text), .py (Python) oder .sql (SQL).
- **Dateien öffnen:** **{{menu.file}} → {{menu.file.open}}** oder **Ctrl+O**. Sie können mehrere Dateien auf einmal auswählen. Die Grenze liegt bei 50 MB pro Datei.
- **Einen Ordner öffnen:** **{{menu.file}} → {{menu.file.openFolder}}** oder **Ctrl+Shift+K**. Der Ordner erscheint im Explorer der Seitenleiste; ein Klick auf eine Datei öffnet sie. Mit **{{menu.file.closeFolder}}** schließen Sie ihn.
- **Zuletzt geöffnete Dateien:** Die zuletzt verwendeten Dateien stehen in der Liste **Zuletzt geöffnet** in der Seitenleiste. Klicken Sie auf eine Datei, um sie erneut zu öffnen.

Wenn ein anderes Programm eine geöffnete Datei ändert, lädt die Anwendung sie selbstständig neu. Haben Sie in diesem Dokument eigene, noch nicht gespeicherte Änderungen, fragt sie vorher nach. Wird die Datei gelöscht oder verschoben, wird der Name der Registerkarte rot und durchgestrichen.

![Menü Datei](img/s07-menu-file.png)

## 4. Speichern und temporäre Dokumente

- **{{menu.file.save}}** (**Ctrl+S**) schreibt das Dokument in seine Datei. Bei einem neuen Dokument fragt die Anwendung nach Name und Speicherort.
- **{{menu.file.saveAs}}** (**Ctrl+Shift+S**) schreibt eine Kopie unter einem anderen Namen oder an einem anderen Ort.
- **{{menu.file.saveAll}}** schreibt alle Dokumente mit Änderungen.

**Von Ihnen Geschriebenes geht nicht verloren.** Wenige Sekunden nach jeder Änderung sichert die Anwendung automatisch alle geöffneten Dokumente, auch solche, die nie gespeichert wurden. Das geschieht unabhängig davon, ob Sie speichern oder nicht.

Beim **Beenden der Anwendung** wird nichts gefragt und nichts verworfen. Beim nächsten Start kommen Registerkarten, Ordner und der nicht gespeicherte Text so zurück, wie sie waren. Speichern Sie, wenn Sie in die eigentliche Datei schreiben möchten.

Beim **Schließen einer Registerkarte** mit Änderungen fragt die Anwendung, ob Sie speichern, nicht speichern oder abbrechen möchten. Zwei Hinweise: Der Rückgängig-Verlauf (Ctrl+Z) wird nicht von einer Sitzung zur nächsten aufbewahrt, und die automatische Wiederherstellung sichert bis zu 100 MB nicht gespeicherten Text.

## 5. Text bearbeiten

![Unsichtbare Zeichen: Leerzeichen, Tabulatoren und Zeilenenden](img/s11-invisibles.png)

Die Bearbeitungsbefehle finden Sie unter **{{menu.edit}}**, die Anzeigeoptionen unter **{{menu.view}}**.

- **Rückgängig und Wiederholen:** Ctrl+Z und Ctrl+Y.
- **Suchen und Ersetzen** im Dokument: Ctrl+F und Ctrl+H. Zu einer Zeile springen Sie mit Ctrl+G.
- **Mehrere Cursor:** Halten Sie Alt gedrückt und klicken Sie dorthin, wo ein weiterer Cursor stehen soll, oder wählen Sie mit Ctrl+D das nächste Vorkommen des Wortes aus.
- **{{menu.edit.columnSelection}}:** Halten Sie Shift+Alt gedrückt und ziehen Sie mit der Maus, um mehrere Zeilen in derselben Spalte zu bearbeiten.
- **Zeilen:** Alt+↑ und Alt+↓ verschieben die Zeile; Shift+Alt+↑ und Shift+Alt+↓ duplizieren sie; Ctrl+/ kommentiert sie aus oder ein.
- **Aufräumen:** {{menu.edit.sortAsc}}, {{menu.edit.sortDesc}}, {{menu.edit.removeDuplicates}} und {{menu.edit.trimWhitespace}}.
- **{{menu.view.invisibles}}:** zeigt Leerzeichen (·), Tabulatoren (→) und das Ende jeder Zeile (¶). Damit finden Sie überflüssige Leerzeichen sofort.
- **{{menu.view.wordWrap}}** und **{{menu.view.foldAll}} / {{menu.view.unfoldAll}}** helfen beim Lesen langer Dateien.
- **Schriftgröße:** Ctrl++ vergrößert, Ctrl+- verkleinert und Ctrl+0 stellt die Standardgröße wieder her.
- **Einrückung:** Wählen Sie unter **{{menu.edit}}** zwischen Leerzeichen und Tabulator sowie die Größe (2, 4 oder 8 Spalten).
- **{{menu.view.fullScreen}}** (F11, unter **{{menu.view}}**): zeigt nur das Dokument, bildschirmfüllend. Drücken Sie erneut F11 oder klicken Sie auf die Schaltfläche oben rechts, um den Modus zu verlassen.
- **{{menu.view.toggleTheme}}** (unter **{{menu.view}}**): wechselt zwischen hellem und dunklem Modus. Solange Sie nichts wählen, folgt die Anwendung dem Design des Betriebssystems; Ihre Wahl wird für das nächste Mal gespeichert.

Ihre Anzeigeeinstellungen werden für das nächste Mal gespeichert. Die eigenen Texte des Editors, etwa das Suchfeld (Ctrl+F) und die Befehlspalette (F1), erscheinen auf Englisch.

![Die Anwendung im dunklen Modus](img/s22-dark-mode.png)

### Buchstaben, Leerzeichen und Zeilenenden

![Menü Bearbeiten mit geöffnetem Untermenü Buchstaben umwandeln in](img/s20-menu-edit.png)

Am Ende des Menüs **{{menu.edit}}** gibt es drei Untermenüs:

- **{{menu.edit.eol}}:** wandelt die Zeilenenden des Dokuments in das Windows- (CRLF), Unix- (LF) oder Mac-Format (CR) um. Eine Umwandlung markiert das Dokument als geändert; zum Wirksamwerden genügt Speichern.
- **{{menu.edit.case}}:** Wählen Sie bei markiertem Text {{menu.edit.caseUpper}}, {{menu.edit.caseLower}} oder {{menu.edit.caseSentence}} (nur der erste Buchstabe jedes Satzes wird großgeschrieben).
- **{{menu.edit.spaces}}:** {{menu.edit.trimRight}}, {{menu.edit.trimLeft}} und {{menu.edit.trimBoth}} gelten für die Zeile des Cursors (oder die markierten Zeilen). {{menu.edit.collapseSpaces}} ersetzt im ganzen Dokument zwei oder mehr aufeinanderfolgende Leerzeichen durch eines, ohne die Einrückung am Zeilenanfang zu verändern.

### MD5, SHA-1, SHA-256 und SHA-512

![Fenster zum Erzeugen des SHA-256-Werts eines Textes](img/s21-hash.png)

Am Ende des Menüs **{{menu.tools}}** bietet jeder Algorithmus zwei Optionen:

- **{{menu.tools.hashGenerate}}:** öffnet ein Fenster; geben Sie den Text ein oder fügen Sie ihn ein, und das Ergebnis erscheint sofort darunter. **{{hash.copy}}** legt das Ergebnis in die Zwischenablage.
- **{{menu.tools.hashSelection}}:** berechnet das Ergebnis aus dem im Dokument markierten Text und legt es in die Zwischenablage, bereit zum Einfügen. In der Statusleiste erscheint ein Hinweis.

### Terminal

Unter **{{menu.tools}} → {{menu.tools.openTerminal}}** öffnet sich direkt unter dem Dokument ein Terminal in Ihrem persönlichen Ordner: PowerShell unter Windows und Ihre Shell (meist bash) unter Linux. Geben Sie Befehle ein und sehen Sie die Ergebnisse gleich dort; das Dokument bleibt darüber geöffnet, und die Trennlinie zwischen beiden lässt sich verschieben.

- Jeder Klick öffnet ein weiteres Terminal in einem eigenen Tab (Terminal 1, Terminal 2 …). Das **×** des Tabs schließt das Terminal, ebenso der Befehl `exit`.
- Mit markiertem Text im Terminal kopiert Ctrl+C; ohne Markierung bricht Ctrl+C den laufenden Befehl ab. Ctrl+V fügt ein.
- Solange der Cursor im Terminal steht, gehen die Tasten an das Terminal (Ctrl+W, Ctrl+R …) statt an die Tastenkürzel der Anwendung.
- Terminals werden beim nächsten Start der Anwendung nicht wiederhergestellt.

### Rechtschreibprüfung

![Unterstrichenes Wort und Korrekturvorschläge](img/s11a-spelling.png)

In Markdown-, Text- (.txt) und LaTeX-Dokumenten werden Wörter, die nicht im Wörterbuch stehen, rot unterstrichen. Code, Links, Adressen, Abkürzungen und Text zwischen Backticks werden nicht geprüft; Log- und CSV-Dateien bleiben außen vor.

- Setzen Sie den Cursor auf das Wort und drücken Sie **Strg+.** (oder Rechtsklick und **{{spell.suggestions}}**), um die Vorschläge zu sehen. Wählen Sie einen aus, um das Wort zu ersetzen.
- **{{spell.addToDictionary}}** lässt das Wort ab sofort in allen Sprachen gelten.
- **{{menu.tools}} → {{menu.tools.spellCheck}}** (oder **F7**) schaltet die Prüfung ein und aus.
- Die Prüfung verwendet die Sprache der Oberfläche. Für eine andere Sprache wählen Sie in **{{menu.tools}} → {{menu.tools.spellSubmenu}}** eine der Optionen **{{spell.source}}: Deutsch**, **{{spell.source}}: English**… — es gibt Wörterbücher für Deutsch, Spanisch, Französisch, Englisch, brasilianisches und europäisches Portugiesisch. **{{menu.tools.spellAuto}}** folgt wieder der Oberfläche.

Die Wörterbücher sind im Programm enthalten: Die Prüfung funktioniert ohne Internet.

## 6. Markdown

![Markdown-Dokument im Bearbeitungsmodus mit der Formatierungsleiste](img/s03-markdown-edit.png)

Markdown-Dateien (.md) öffnen sich **formatiert**, und Sie können direkt im formatierten Text weiterschreiben. Die Symbolleiste wendet die Formatierung an der Cursorposition oder auf die Auswahl an: Überschriften, Aufzählung, nummerierte Liste, Einzug, **fett** (Strg+B), *kursiv* (Strg+I), ~~durchgestrichen~~ (Strg+Shift+X), Link, Tabelle und Formatierung entfernen. Strg+Z und Strg+Y machen rückgängig und wiederholen.

Um den Markdown-Quelltext zu sehen und zu bearbeiten, klicken Sie auf **{{toolbar.editText}}** (oder drücken Sie **Strg+Shift+E**); zurück zum formatierten Text geht es mit **{{toolbar.preview}}**. Die Formatierungsleiste funktioniert in beiden Modi.

Wenn Sie den formatierten Text bearbeiten, wird das Markdown in einem einheitlichen Stil neu geschrieben (zum Beispiel Listen mit `-`). Dokumente mit HTML sind in diesem Modus schreibgeschützt, damit das HTML nicht verloren geht: Bearbeiten Sie sie über **{{toolbar.editText}}**. Einen Link öffnen Sie mit Strg+Klick im Browser. Bilder erscheinen als Etikett mit ihrem Namen; ihre Adresse bleibt in der Datei erhalten.

## 7. JSON-Dateien

![JSON-Datei als Baum mit einem ausgewählten Element](img/s04-json-tree.png)

.json-Dateien werden als **Baum** geöffnet. Klicken Sie auf den Pfeil eines Elements, um diesen Teil auf- oder zuzuklappen. Mit **{{menu.view.unfoldAll}}** und **{{menu.view.foldAll}}** öffnen oder schließen Sie alles. Wenn Sie ein Element anklicken, zeigt die Leiste seinen Pfad, und Sie können den **{{json.path}}** oder den **{{json.value}}** kopieren. Sehr große Listen werden nach und nach angezeigt, mit einer Schaltfläche für weitere Einträge.

Zum Bearbeiten klicken Sie auf **{{toolbar.editText}}**. Im Bearbeitungsmodus ordnet die Schaltfläche **{{toolbar.formatJson}}** (Shift+Alt+F) die Datei neu.

![Fehlermeldung bei ungültigem JSON mit Zeile und Spalte](img/s05-json-error.png)

Enthält die Datei einen Fehler, erklärt die Anwendung das Problem und nennt Zeile und Spalte. Die Schaltfläche **{{json.editGoToError}}** öffnet den Editor direkt an der Fehlerstelle.

## 8. In Dateien suchen

![Suchbereich mit nach Dateien gruppierten Ergebnissen](img/s06-search.png)

Öffnen Sie einen Ordner und wählen Sie **{{menu.search}} → {{menu.search.findInFiles}}** (**Ctrl+Shift+F**). Der untere Bereich öffnet sich.

1. Geben Sie den Text ein und klicken Sie auf **{{search.run}}** (oder drücken Sie die Eingabetaste).
2. Verfeinern Sie die Suche mit den drei Schaltflächen daneben: **{{search.caseSensitive}}**, **{{search.wholeWord}}** und **{{search.regex}}**.
3. Um die Dateien einzugrenzen, schreiben Sie einen Filter, etwa `*.md, docs/**`.
4. Die Ergebnisse erscheinen nach Dateien gruppiert, mit Zeile und Spalte. Klicken Sie auf ein Ergebnis, um die Datei zu öffnen und die Fundstelle zu markieren.

Zum Ersetzen geben Sie den neuen Text im Ersetzungsfeld ein und klicken auf **{{search.replaceAll}}**. Entfernen Sie das Häkchen bei Dateien, die sich nicht ändern sollen. Die Anwendung bittet um Bestätigung, denn **das Ersetzen wird direkt in die Dateien geschrieben und lässt sich im Editor nicht rückgängig machen**. Geöffnete Dateien mit nicht gespeicherten Änderungen werden übersprungen, damit keine Arbeit verloren geht.

Die Suche durchsucht keine Ordner wie `node_modules` und `.git` und auch keine Binärdateien oder Dateien über 5 MB. Sie zeigt höchstens 5.000 Treffer auf einmal.

## 9. Sprache, Kodierung und Zeilenenden

![Menü Kodierung](img/s09-menu-encoding.png)

- **{{menu.language}}:** Die Anwendung wählt die Sprache anhand der Dateiendung und nutzt Farben, damit der Text leichter lesbar ist. Um die Sprache eines Dokuments zu ändern, öffnen Sie das Menü und wählen eine andere.

![Menü Sprache](img/s10-menu-language.png)

- **{{menu.encoding}}:** Wandeln Sie das Dokument in **UTF-8** oder **UTF-8 mit BOM** um und wählen Sie Zeilenenden nach **Windows (CRLF)**, **Unix (LF)** oder **Mac (CR)**. Eine Umwandlung markiert das Dokument als geändert; zum Wirksamwerden genügt Speichern.
  - **{{menu.encoding.autoFormat}}** entfernt doppelte Leerzeichen aus dem Dokument (die Einrückung der Zeilen bleibt) und formatiert es im Standardstil der Sprache: Python wie Python (PEP 8), C und C++ im LLVM-Stil, Java im Google-Stil, C# im Microsoft-Stil, Go mit gofmt sowie JavaScript, TypeScript, JSON, CSS, HTML, Markdown, YAML, PHP und XML mit Prettier; außerdem Lua, Shell und SQL. Funktioniert ohne Internet. Bei Sprachen ohne Formatierer (Rust, PowerShell, Batch, LaTeX, INI, TOML und Text) werden nur die doppelten Leerzeichen entfernt; die Statusleiste weist darauf hin. Bei einem Syntaxfehler zeigt ein Fenster die betroffene Zeile.
  - Fehlt in Python die Einrückung, wird sie abgeleitet: Nach einer Zeile, die mit `:` endet, öffnet der Block eine Ebene; `if`-, `for`-, `while`-, `try`- und `with`-Blöcke umfassen die nächste Zeile; der Rumpf eines `def` reicht bis zu einer Leerzeile oder einem `return`. Prüfen Sie das Ergebnis, denn in Python ändert die Einrückung, was das Programm tut. Anführungszeichen bleiben, wie Sie sie geschrieben haben. Achtung: Auch doppelte Leerzeichen in Texten zwischen Anführungszeichen werden entfernt. Ctrl+Z macht alles auf einmal rückgängig.
  - **{{menu.encoding.url}}** kodiert den markierten Text im Format von Webadressen (`meine Seite` wird zu `meine%20Seite`); ist der Text bereits kodiert, wird er dekodiert. Bei einer vollständigen Adresse (`https://…`) bleiben die Trennzeichen `: / ? & = #` erhalten.

Kodierung und Zeilenenden werden in der Statusleiste angezeigt.

## 10. Snippets und Makros

![Fenster „Snippets“](img/s12-snippets.png)

**Snippets** sind fertige Textbausteine. Öffnen Sie **{{menu.tools}} → {{menu.tools.snippets}}**. Einige bringt die Anwendung schon mit: `data`, `hora`, `codigo`, `tarefa`, `tabela`, `link` und `cabecalho`. Zum Verwenden geben Sie das Kürzel im Editor ein und wählen den Vorschlag aus (oder drücken Ctrl+Leertaste), oder Sie klicken im Fenster auf **{{snippets.insert}}**. Ein eigenes Snippet legen Sie mit **{{snippets.new}}** an: Vergeben Sie Name, Kürzel und Text. Im Text markieren `$1` und `${2:Standard}` die Stellen, an denen der Cursor anhält, und `$0` ist die Endposition. Die mitgelieferten Snippets lassen sich nicht bearbeiten, aber duplizieren.

![Fenster „Makros“](img/s13-macros.png)

**Makros** wiederholen eine Abfolge, die Sie ausgeführt haben. Mit **Ctrl+Shift+R** starten Sie die Aufzeichnung, schreiben oder bearbeiten, was Sie möchten, und beenden sie mit **Ctrl+Shift+R**. Danach führt **Ctrl+Shift+M** die letzte Aufzeichnung aus. Unter **{{menu.tools.macros}}** legen Sie fest, wie oft sie wiederholt wird, und können das Makro unter einem Namen speichern. Aufgezeichnet werden eingegebener Text, eingefügter Text, die Pfeiltasten, Pos1, Ende, Rücktaste, Entf, Tab, die Eingabetaste und Menübefehle. Mausklicks und Ctrl+Z werden nicht aufgezeichnet.

## 11. Konto und Cloud-Dateien

![Erster Zugriff: Serveradresse](img/s16a-account-server.png)

Mit einem Konto speichern Sie Dateien in der Cloud und öffnen sie auf anderen Computern. Öffnen Sie das Menü **{{menu.account}}**.

1. **Serveradresse:** Geben Sie beim ersten Mal die Adresse ein, die Ihnen Ihr Unternehmen oder Ihr Administrator mitgeteilt hat. Sie beginnt mit `https://`.
2. **Konto erstellen:** Klicken Sie auf **{{account.link.register}}** und tragen Sie E-Mail-Adresse, Namen und ein Passwort mit mindestens 10 Zeichen ein.

![Anmeldebildschirm](img/s16-account-login.png)

3. **Anmelden:** Verwenden Sie Ihre E-Mail-Adresse und Ihr Passwort. Wenn Sie das Passwort vergessen haben, klicken Sie auf **{{account.link.forgot}}**: Sie erhalten einen Code per E-Mail und können ein neues Passwort festlegen.

![Benutzerprofil](img/s18-account-profile.png)

4. **Profil:** Öffnen Sie unter **{{menu.account}}** Ihr Profil, um den Namen oder das Passwort zu ändern oder sich abzumelden. Wenn Sie das Passwort ändern, müssen sich Ihre anderen Computer neu anmelden.

![Liste der Dateien in der Cloud](img/s17-cloud-open.png)

5. **In der Cloud speichern:** **{{menu.file}} → {{menu.file.saveCloud}}**. Wählen Sie den Pfad, zum Beispiel `arbeit/protokoll.md`.
6. **Aus der Cloud öffnen:** **{{menu.file}} → {{menu.file.openCloud}}**. In der Liste öffnen oder löschen Sie Dateien. In einem aus der Cloud geöffneten Dokument speichert **Ctrl+S** wieder in der Cloud.

Hat sich die Datei seit der letzten Synchronisierung in der Cloud geändert, warnt die Anwendung und fragt, ob sie überschrieben werden soll. Jede Datei darf bis zu 10 MB groß sein. Hat Ihr System keinen Tresor für Anmeldedaten, weist die Anwendung darauf hin, dass Sie sich bei jedem Start neu anmelden müssen.

Solange Sie angemeldet sind, zeigt die Statusleiste links neben dem Cloud-Symbol, wie viel Cloud-Speicher Sie belegen, in MB mit zwei Nachkommastellen (zum Beispiel `1.25 MB`). Gezählt werden alle Ihre Dateien in der Cloud und die Texte noch nicht gespeicherter Dokumente, die aufbewahrt werden, damit Sie an einem anderen Computer weiterarbeiten können. Der Wert ändert sich bei jedem Speichern oder Löschen.

## 12. Sprachen

![Sprachflaggen neben der Schaltfläche für die Vorschau](img/s08-flags.png)

Die Anwendung gibt es auf **Deutsch, Spanisch, Französisch, Englisch, Portugiesisch (Brasilien) und Portugiesisch (Portugal)**. Sie startet in der Sprache Ihres Systems; gibt es dafür keine Übersetzung, startet sie auf Englisch. Zum Wechseln klicken Sie auf die Flagge der gewünschten Sprache links neben der Schaltfläche für die Vorschau. Der Wechsel wirkt sofort und wird für das nächste Mal gespeichert. Dieses Handbuch öffnet sich in der gerade verwendeten Sprache.

## 13. Tastenkürzel

![Fenster „Tastenkürzel“](img/s14-shortcuts.png)

Die Liste sehen Sie auch in der Anwendung unter **{{menu.help}} → {{menu.help.shortcuts}}**. Die verfügbaren Tastenkürzel:

{{shortcuts}}

## 14. Häufige Fragen

**Ich habe die Anwendung ohne Speichern geschlossen. Ist mein Text weg?**
Nein. Nicht gespeicherter Text wird automatisch gesichert und kommt zurück, wenn Sie die Anwendung wieder öffnen.

**Warum wird Markdown formatiert geöffnet und ich kann nichts eintippen?**
Das ist der Lesemodus. Klicken Sie auf **{{toolbar.editText}}** (oder Ctrl+Shift+E), um zu bearbeiten.

**Mein JSON zeigt einen Fehler, lässt sich aber in einem anderen Programm öffnen.**
Der Viewer hält sich strikt an den JSON-Standard: Ein überzähliges Komma am Ende, Kommentare und einfache Anführungszeichen sind nicht erlaubt. Mit der Schaltfläche beim Fehler gelangen Sie direkt zur Fehlerstelle.

**Die Datei ist groß und lässt sich nicht öffnen.**
Die Grenze liegt bei 50 MB pro Datei.

**Ich kann mich nicht anmelden oder nicht in der Cloud speichern.**
Prüfen Sie die Serveradresse und Ihre Internetverbindung. Wenn die Meldung besagt, dass die Sitzung abgelaufen ist, melden Sie sich erneut an.

**Wie sehe ich die Version der Anwendung?**
Unter **{{menu.help}} → {{menu.help.about}}**.

## 15. Über das Programm und Support

![Fenster „Über“](img/s15-about.png)

![Menü Hilfe](img/s19-menu-help.png)

**Meu Editor de Arquivos** wurde von Diego Mendes Rodrigues entwickelt. Der Eintrag **{{menu.help.support}}** im Menü Hilfe ist in dieser Version noch nicht verfügbar.
