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
    dedupeWindowSeconds: {
      type: "integer",
      label: "Dedupe Window (seconds)",
      default: 300,
    },
    calendlyAccessToken: {
      type: "string",
      secret: true,
      label: "Calendly Access Token",
      optional: true,
    },
  },
  async run({ steps, $ }) {
    const event = steps.trigger?.event || {};
    const payload = normalizePayload(event.body);
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

    if (
      !payload ||
      !["invitee.created", "invitee.canceled"].includes(payload.event)
    ) {
      await respond(202, { ok: true, ignored: "event_not_used" });
      return;
    }

    const invitee = payload.payload || {};
    const dedupeKey = [
      payload.event,
      invitee.uri || invitee.event || "",
      invitee.updated_at || payload.created_at || "",
    ].join("|");

    const existing = await this.dataStore.get(dedupeKey);
    if (existing) {
      await respond(202, { ok: true, ignored: "duplicate" });
      return;
    }

    await this.dataStore.set(dedupeKey, payload.created_at || invitee.updated_at, {
      ttl: Math.max(1, Number(this.dedupeWindowSeconds) || 300),
    });

    await respond(202, { ok: true });

    const tracking = invitee.tracking || {};
    const scheduledEvent = await fetchScheduledEvent({
      accessToken: this.calendlyAccessToken,
      eventUri: invitee.event,
    });

    const lines = [
      payload.event === "invitee.created"
        ? "Neue Calendly-Buchung"
        : "Calendly-Termin storniert",
      `Event: ${payload.event}`,
      `Status: ${invitee.status || "-"}`,
      `Termin: ${scheduledEvent.start_time || "-"}`,
      `Zeitzone: ${invitee.timezone || scheduledEvent.event_memberships?.[0]?.user || "-"}`,
      `Event URL: ${invitee.event || "-"}`,
      `Invitee URI: ${invitee.uri || "-"}`,
      `Rescheduled: ${String(Boolean(invitee.rescheduled))}`,
      `Canceled By: ${invitee.canceled_by || "-"}`,
      `Reason: ${invitee.reason || "-"}`,
      `UTM Source: ${tracking.utm_source || "-"}`,
      `UTM Medium: ${tracking.utm_medium || "-"}`,
      `UTM Campaign: ${tracking.utm_campaign || "-"}`,
      `UTM Content: ${tracking.utm_content || "-"}`,
      `UTM Term: ${tracking.utm_term || "-"}`,
      `Webhook Time: ${payload.created_at || "-"}`,
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
      summary: `${payload.event} @ ${invitee.event || invitee.uri || "-"}`,
    };
  },
});

async function fetchScheduledEvent({ accessToken, eventUri }) {
  if (!accessToken || !eventUri) return {};

  const response = await fetch(eventUri, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) return {};

  const data = await response.json();
  return data.resource || data.collection?.[0] || {};
}

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
