export default defineComponent({
  props: {
    telegramBotToken: {
      type: "string",
      secret: true,
      label: "Telegram Bot Token",
    },
    telegramChatId: {
      type: "string",
      label: "Telegram Chat ID",
    },
    dataStore: {
      type: "data_store",
      label: "Dedupe Data Store",
    },
    allowedOriginPrefixesCsv: {
      type: "string",
      label: "Allowed Origin Prefixes",
      default: "https://sasb.site",
    },
    dedupeWindowMs: {
      type: "integer",
      label: "Dedupe Window (ms)",
      default: 3000,
    },
  },
  async run({ steps, $ }) {
    const event = steps.trigger?.event || {};
    const payload = normalizePayload(event.body);
    const allowedActions = new Set([
      "header-cta-termin",
      "pilot-step-next-termin",
      "contact-phone-inline",
      "contact-email-inline",
      "contact-email-button",
      "contact-whatsapp-button",
    ]);

    const respond = async (status, body) =>
      $.respond({
        immediate: true,
        status,
        headers: { "content-type": "application/json" },
        body,
      });

    if ((event.method || "").toUpperCase() !== "POST") {
      await respond(405, { ok: false, error: "method_not_allowed" });
      return;
    }

    if (!payload || payload.event_type !== "cta_click") {
      await respond(400, { ok: false, error: "invalid_payload" });
      return;
    }

    const origin = getHeader(event.headers, "origin");
    const referer = getHeader(event.headers, "referer");
    const allowedOriginPrefixes = this.allowedOriginPrefixesCsv
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (
      !isAllowedSource({
        origin,
        referer,
        allowedOriginPrefixes,
      })
    ) {
      await respond(202, { ok: true, ignored: "origin_not_allowed" });
      return;
    }

    if (!allowedActions.has(payload.action_id)) {
      await respond(202, { ok: true, ignored: "action_not_allowed" });
      return;
    }

    const dedupeKey = [
      payload.event_type,
      payload.action_id,
      payload.session_id,
      payload.page_path,
    ].join("|");

    const existing = await this.dataStore.get(dedupeKey);
    if (existing) {
      await respond(202, { ok: true, ignored: "duplicate" });
      return;
    }

    await this.dataStore.set(dedupeKey, payload.timestamp, {
      ttl: Math.max(1, Math.ceil(this.dedupeWindowMs / 1000)),
    });

    await respond(202, { ok: true });

    const lines = [
      "Neuer CTA-Klick",
      `Aktion: ${payload.action_id}`,
      `Seite: ${payload.page_path || "-"}`,
      `Ziel: ${payload.target_url || "-"}`,
      `Zeit: ${payload.timestamp || "-"}`,
      `Session: ${payload.session_id || "-"}`,
      `Referrer: ${payload.referrer || "-"}`,
      `UTM Source: ${payload.utm_source || "-"}`,
      `UTM Medium: ${payload.utm_medium || "-"}`,
      `UTM Campaign: ${payload.utm_campaign || "-"}`,
      `UTM Content: ${payload.utm_content || "-"}`,
      `UTM Term: ${payload.utm_term || "-"}`,
      `Origin: ${origin || "-"}`,
      `Referer Header: ${referer || "-"}`,
    ];

    const response = await fetch(
      `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: this.telegramChatId,
          text: lines.join("\n"),
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram sendMessage failed: ${errorText}`);
    }

    return {
      delivered: true,
      summary: `${payload.action_id} @ ${payload.page_path}`,
    };
  },
});

function normalizePayload(body) {
  if (!body) return null;
  if (typeof body === "object") return body;
  if (typeof body !== "string") return null;

  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

function getHeader(headers, name) {
  if (!headers || typeof headers !== "object") return "";

  const key = Object.keys(headers).find(
    (headerName) => headerName.toLowerCase() === name.toLowerCase()
  );

  return key ? String(headers[key] || "") : "";
}

function isAllowedSource({ origin, referer, allowedOriginPrefixes }) {
  return allowedOriginPrefixes.some((prefix) => {
    return (
      (origin && origin.startsWith(prefix)) ||
      (referer && referer.startsWith(prefix))
    );
  });
}
