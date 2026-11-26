# FrontWars – Browser-Version (Handy, Tablet, PC)

Das komplette FrontWars aus `frontwars.py` als Website: gleiche Karten, Gebäude, Bomben,
Bündnisse, Lobby, Karteneditor und Waffen-Editor. Online-Spiele laufen über dieselben
Online-Codes (`ON-...`) wie die PC-Version – Browser und Python spielen zusammen.

## Kostenlos online stellen mit GitHub Pages

1. Auf https://github.com ein kostenloses Konto anlegen und einloggen.
2. Oben rechts auf **+** → **New repository**. Name z. B. `frontwars`, auf **Public** lassen, **Create repository**.
3. Auf der neuen Seite **uploading an existing file** anklicken.
4. Diese ZIP entpacken und **alle Dateien** aus dem Ordner ins Browserfenster ziehen
   (`index.html`, alle `.js`-Dateien, die Bilder und `manifest.json`). Unten **Commit changes**.
5. Im Repository oben auf **Settings** → links **Pages**.
   Bei *Source* „Deploy from a branch“ wählen, Branch **main** und Ordner **/(root)** → **Save**.
6. Nach ca. 1 Minute ist das Spiel erreichbar unter
   `https://DEIN-NAME.github.io/frontwars/`
   (der Link steht dann auch oben auf der Pages-Seite).

## Als App aufs Handy

- **iPhone / iPad:** Link in Safari öffnen → Teilen → **Zum Home-Bildschirm**.
- **Android:** Link in Chrome öffnen → ⋮ → **Zum Startbildschirm hinzufügen** bzw. **App installieren**.

Danach startet FrontWars im Vollbild wie eine App. Am Handy bitte quer halten.

## Mit Freunden spielen (auch mit der PC-Version)

- Einer klickt **Spiel hosten**. In der Lobby steht der **Online-Code** (`ON-...`).
- Die anderen tragen den Code im Menü ein und klicken **Beitreten** – egal ob im Browser
  oder in der Python-Version.
- Im Browser gibt es nur Online-Codes. WLAN- und Internet-Codes der PC-Version
  (ohne `ON-`) gehen im Browser nicht.

## Steuerung am Handy

| Geste | Wirkung |
|---|---|
| Tippen | Startpunkt wählen, angreifen, Knöpfe |
| Ziehen | Karte verschieben |
| Zwei Finger | zoomen und verschieben |
| Lange drücken | Menü (wie Rechtsklick): bauen, Bomben, Bündnis, Gold → Truppen |
| Knopf „Chat“ | Chat öffnen (`/a Text` = nur an Verbündete) |

Am PC gilt die Steuerung aus der Python-Version (F1 zeigt sie im Spiel).

## Gut zu wissen

- Eigene Karten, eigene Waffen und der Endlos-Spielstand werden im Browser gespeichert
  (nicht in Dateien) – also pro Gerät und Browser.
- Der Online-Modus nutzt kostenlose öffentliche Server: nichts Privates in den Chat schreiben.
- Enthält pako (zlib für den Browser, MIT-Lizenz).
