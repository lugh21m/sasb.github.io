# Pipedream + Telegram Lead-Tracking

Dieses Repo trackt CTA-Klicks rein clientseitig und sendet sie an einen oeffentlichen Webhook. Die eigentliche Telegram-Weiterleitung laeuft ueber zwei externe Pipedream-Workflows:

- `click-ingest` fuer Browser-Klicks
- `calendly-ingest` fuer echte Calendly-Buchungen und Stornos

## 1. Frontend konfigurieren

In [assets/tracking-config.js](/Users/lugh/Documents/WebsiteProjekte/SASB_CaseStudy_Website/assets/tracking-config.js) den Wert `clickEndpoint` mit der HTTP-URL des Pipedream-Workflows `click-ingest` fuellen.

```js
clickEndpoint: "https://your-click-endpoint.m.pipedream.net",
```

Wenn `clickEndpoint` leer bleibt, verhaelt sich die Seite normal weiter und sendet nur keine Klick-Events.

## 2. Workflow `click-ingest`

1. In Pipedream einen Workflow mit `HTTP / Webhook` Trigger anlegen.
2. Den Triggernamen auf `trigger` lassen.
3. Dahinter einen `Node.js`-Step anlegen.
4. Den Inhalt aus [integrations/pipedream/click-ingest.mjs](/Users/lugh/Documents/WebsiteProjekte/SASB_CaseStudy_Website/integrations/pipedream/click-ingest.mjs) in den Step kopieren.
5. Im Step diese Props setzen:

- `telegramBotToken`: Telegram Bot Token von `@BotFather`
- `telegramChatId`: Ziel-Chat oder Kanal-ID
- `dataStore`: neuer oder bestehender Data Store fuer Dedupe
- `allowedOriginPrefixesCsv`: mindestens `https://sasb.site`
- `dedupeWindowMs`: Standard `3000`

Erlaubte `action_id` Werte im Workflow:

- `header-cta-termin`
- `pilot-step-next-termin`
- `contact-phone-inline`
- `contact-email-inline`
- `contact-email-button`
- `contact-whatsapp-button`

## 3. Workflow `calendly-ingest`

1. Zweiten Pipedream-Workflow mit `HTTP / Webhook` Trigger anlegen.
2. Triggernamen ebenfalls `trigger` lassen.
3. Dahinter einen `Node.js`-Step anlegen.
4. Den Inhalt aus [integrations/pipedream/calendly-ingest.mjs](/Users/lugh/Documents/WebsiteProjekte/SASB_CaseStudy_Website/integrations/pipedream/calendly-ingest.mjs) in den Step kopieren.
5. Diese Props setzen:

- `telegramBotToken`
- `telegramChatId`
- `dataStore`
- `dedupeWindowSeconds`: z. B. `300`
- `calendlyAccessToken`: optional, aber empfohlen fuer Anreicherung mit Startzeit ueber die Calendly API

Danach in Calendly einen Webhook auf die Pipedream-URL registrieren.

## 4. Calendly-Webhook registrieren

Mit einem persoenlichen Access Token und der `organization`- oder `user`-URI:

```bash
curl --request POST \
  --url https://api.calendly.com/webhook_subscriptions \
  --header 'Content-Type: application/json' \
  --header 'authorization: Bearer <CALENDLY_PAT>' \
  --data '{
    "url":"https://your-calendly-endpoint.m.pipedream.net",
    "events":["invitee.created","invitee.canceled"],
    "organization":"https://api.calendly.com/organizations/AAAAAAAAAAAAAAAA",
    "scope":"organization"
  }'
```

Wenn nur das eigene Konto beobachtet werden soll, statt `organization` die passende `user`-URI und den Scope `user` verwenden.

## 5. Verhalten im Frontend

- Jeder markierte CTA sendet ein `cta_click` Event per `sendBeacon()` oder `fetch(..., { keepalive: true })`.
- Pro Besuch wird eine anonyme `session_id` in `sessionStorage` erzeugt.
- Calendly-Embeds werden mit konsistenten UTM-Werten versehen.
- `utm_content` wird fuer die Korrelation immer mit der `session_id` belegt.

## 6. Testen

- Klick auf Header-CTA auf Startseite pruefen: Telegram sollte genau eine Nachricht senden.
- Doppelklick auf denselben CTA pruefen: nur eine Nachricht.
- Klick auf WhatsApp und E-Mail auf [termin/index.html](/Users/lugh/Documents/WebsiteProjekte/SASB_CaseStudy_Website/termin/index.html) pruefen.
- Testbuchung in Calendly erstellen und auf `invitee.created` pruefen.
- Teststorno in Calendly erstellen und auf `invitee.canceled` pruefen.
