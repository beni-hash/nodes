# Nodes – Web-App für Cloudflare

Singleplayer (gegen den Computer), Duell (online, 1 gegen 1) und Multiplayer (online, 3 Spieler alle gegen alle oder 2 gegen 2). Jeder spielt auf seinem eigenen Gerät.

## Aufbau

- `public/` – die App (index.html, app.js, engine.js = Regeln, ai.js = Computergegner)
- `src/worker.js` – Cloudflare Worker: liefert die App aus und verwaltet die Räume für Duell und Multiplayer (Durable Objects, WebSocket). Der Server prüft jeden Zug mit derselben `engine.js`.
- `wrangler.toml` – Konfiguration

Wichtig: Duell und Multiplayer brauchen **Cloudflare Workers** (wegen der Durable Objects), nicht Cloudflare Pages. Durable Objects mit SQLite laufen auch im Gratis-Plan.

## Online stellen

1. Node.js installieren (falls noch nicht vorhanden).
2. Im Ordner `nodes` ein Terminal öffnen:
   ```
   npm install
   npx wrangler login
   npx wrangler deploy
   ```
3. Wrangler zeigt am Schluss die Adresse an, z. B. `https://nodes.<dein-name>.workers.dev`.

Lokal testen: `npx wrangler dev`, dann http://localhost:8787 öffnen (für ein Duell zwei Browserfenster).

## Duell

- Spieler 1 tippt auf «Duell» → «Raum erstellen» und erhält einen Code aus 4 Zeichen (oder teilt den Link `…/?r=CODE`).
- Spieler 2 tippt auf «Duell» und gibt den Code ein.
- Wer die Seite neu lädt, kommt mit demselben Gerät wieder auf seinen Platz zurück.
- Räume werden nach 2 Tagen ohne Aktivität gelöscht.

## Multiplayer

- Spieler 1 tippt auf «Multiplayer», wählt «3 Spieler» oder «2 gegen 2», gibt seinen Namen ein und erstellt einen Raum (Link: `…/?m=CODE`).
- Die anderen tippen auf «Multiplayer» und geben den Code ein. Sie bekommen automatisch einen freien Platz.
- Vor der Heldenwahl kann man auf einen freien Platz wechseln (z. B. ins andere Team). Der Gastgeber kann freie Plätze mit dem Computer besetzen; die Computer laufen auf seinem Gerät, darum sollte er die Seite offen lassen.
- Gespielt wird auf einem grösseren Netz mit 85 Punkten.

## Als App installieren

Nodes ist eine installierbare Web-App (PWA): `manifest.webmanifest`, Symbole in `public/icons/` und `public/sw.js` (Zwischenspeicher, Singleplayer auch offline).

- **iPhone (Safari):** Teilen-Symbol → «Zum Home-Bildschirm».
- **Android (Chrome):** Menü ⋮ → «App installieren» bzw. «Zum Startbildschirm hinzufügen».
- **Computer (Chrome/Edge):** Installieren-Symbol rechts in der Adresszeile.

Neue Versionen kommen automatisch, sobald man online ist (beim zweiten Öffnen sichtbar).

## Update (bestehende Installation)

Einfach die Dateien ersetzen und erneut `npx wrangler deploy` ausführen. Es ist keine neue Migration nötig.

## Regeln anpassen

Alles zu Regeln und Helden steht in `public/engine.js` (z. B. `START_NODES`, `MULTI_NODES`, `HERO_ROUND`, Texte der Helden in `HEROES`).
