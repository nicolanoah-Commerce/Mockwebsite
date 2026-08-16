# LANDI Prototype v9

Klickbarer LANDI-Prototyp mit Produktvergleich, PDP, Kundenkonto, Serviceaufträgen, zwei serverseitig angebundenen KI-Assistenten und einem einfachen vorgeschalteten HTML-Login.

## Neu in v9

- **Einfacher HTML-Login vor dem Prototype**
  - Benutzer: `LANDIWebsite`
  - Passwort: wird separat geteilt und nicht im README veröffentlicht
  - bleibt während des geöffneten Browser-Tabs angemeldet (`sessionStorage`)
  - Abmelden über **Kundenkonto → Abmelden**

- **Serviceaufträge im Kundenkonto**
  - gekauftes Produkt auswählen
  - Problemart und Beschreibung erfassen
  - bevorzugten Kontakt wählen
  - Demo-Serviceauftrag wird lokal im Browser gespeichert
  - Übersicht der erfassten Serviceaufträge
- **KI-Serviceassistent** direkt neben dem Serviceauftrag
  - ausgewähltes gekauftes Produkt wird als Kontext verwendet
  - kann das Problem eingrenzen und sichere erste Prüfungen vorschlagen
  - letzte Problembeschreibung kann mit einem Klick in den Serviceauftrag übernommen werden
- **Aufklappbarer LANDI Assistent auf der Landingpage**
  - Produktberatung aus dem hinterlegten Prototype-Sortiment
  - Quick Prompts und echter Multi-Turn-Chat
- Neuer serverseitiger Endpunkt **`POST /api/chat`**
- Bestehender LLM-Produktvergleich über **`POST /api/compare`** bleibt erhalten
- Standardmodell auf `gpt-5.6` aktualisiert

## Lokal starten

Voraussetzung: Node.js 20.6 oder neuer.

```bash
cp .env.example .env
```

In `.env` den API-Key setzen:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.6
PORT=8000
```

Optional kann für Chats ein separates Modell gesetzt werden:

```env
OPENAI_CHAT_MODEL=gpt-5.6
```

Dann starten:

```bash
npm run dev
```

Browser:

```text
http://localhost:8000
```

## KI-Endpunkte

### Produktvergleich

`POST /api/compare`

```json
{
  "articleA": "100788",
  "articleB": "108769"
}
```

### Chat

`POST /api/chat`

Landingpage:

```json
{
  "mode": "shopping",
  "message": "Welcher Rasenmäher passt zu 250 m²?",
  "history": []
}
```

Serviceassistent:

```json
{
  "mode": "service",
  "articleNo": "100788",
  "message": "Der Akku lädt nicht mehr.",
  "history": []
}
```

Der API-Key bleibt auf dem Server. Produktdaten werden serverseitig aus `data/products.json` ergänzt. Der Browser übermittelt beim Servicechat nur Artikelnummer, Nachricht und einen begrenzten Chatverlauf.

## Serviceaufträge im Prototype

Die Erstellung eines Serviceauftrags ist aktuell bewusst eine Frontend-Demo. Aufträge werden mit `localStorage` nur im jeweiligen Browser gespeichert. Für den echten Betrieb sollte `serviceOrderForm` später an CRM-/ERP-/Service-Backend oder Ticketing angebunden werden.

## Deployment via Git + Vercel

1. Repository zu GitHub/GitLab/Bitbucket pushen.
2. In Vercel importieren.
3. Environment Variable `OPENAI_API_KEY` setzen.
4. Optional `OPENAI_MODEL` und `OPENAI_CHAT_MODEL` setzen.
5. Deployen.

Vercel stellt `api/compare.mjs` und `api/chat.mjs` als Serverless Functions bereit.

## Sicherheit / nächster Produktionsschritt

- `.env` niemals committen.
- API-Key ausschliesslich serverseitig halten.
- Chatverlauf wird auf maximal acht vorherige Nachrichten begrenzt.
- Eingaben werden längenbegrenzt.
- KI-Serviceassistent vermeidet Anleitungen für riskante Eigenreparaturen und verweist bei sicherheitsrelevanten Arbeiten auf den Service.
- Für eine öffentliche Produktion zusätzlich persistentes Rate Limiting, Authentifizierung, Logging/Monitoring und serverseitige Speicherung von Serviceaufträgen ergänzen.

## Demo-Hinweis

Die Rezensionen im Prototype sind Beispielrezensionen. Die KI-Prompts weisen das Modell an, sie nicht als echte Kundenbewertungen darzustellen.


## Hinweis zum Login

Der Login in v9 ist bewusst ein **einfacher clientseitiger Zugangsschutz für Demos/Prototypen**. Der Browser prüft das Passwort gegen einen im JavaScript hinterlegten Hash. Das ist besser als Klartext im Code, stellt aber keinen sicheren Schutz für sensible Daten dar. Für einen öffentlich erreichbaren Produktionsbetrieb sollte die Authentifizierung serverseitig bzw. über den Hosting-/Identity-Provider erfolgen.
