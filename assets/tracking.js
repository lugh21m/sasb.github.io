(() => {
  const config = window.SASB_TRACKING_CONFIG || {};
  const site =
    typeof config.site === "string" && config.site.trim() !== ""
      ? config.site.trim()
      : window.location.hostname || "sasb-case-study";
  const clickEndpoint =
    typeof config.clickEndpoint === "string" ? config.clickEndpoint.trim() : "";
  const sessionStorageKey =
    typeof config.sessionStorageKey === "string" &&
    config.sessionStorageKey.trim() !== ""
      ? config.sessionStorageKey.trim()
      : "sasb-lead-session-id";
  const dedupeWindowMs = Number.isFinite(Number(config.dedupeWindowMs))
    ? Math.max(0, Number(config.dedupeWindowMs))
    : 3000;
  const utmDefaults = config.utmDefaults || {};
  const dedupeCache = new Map();
  const fallbackSessionId = createSessionId();
  const sessionId = readSessionId();

  document.documentElement.dataset.sasbSessionId = sessionId;

  function createSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `sasb_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function readSessionId() {
    try {
      const stored = window.sessionStorage.getItem(sessionStorageKey);
      if (stored) return stored;

      window.sessionStorage.setItem(sessionStorageKey, fallbackSessionId);
      return fallbackSessionId;
    } catch (error) {
      return fallbackSessionId;
    }
  }

  function getEffectiveUtmValues() {
    const params = new URLSearchParams(window.location.search);

    return {
      utm_source: params.get("utm_source") || utmDefaults.source || site,
      utm_medium: params.get("utm_medium") || utmDefaults.medium || "website",
      utm_campaign:
        params.get("utm_campaign") || utmDefaults.campaign || "pilot_2026",
      utm_term: params.get("utm_term") || utmDefaults.term || "",
      utm_content: sessionId,
    };
  }

  function buildCalendlyUrl(baseUrl) {
    if (typeof baseUrl !== "string" || baseUrl.trim() === "") return "";

    try {
      const url = new URL(baseUrl);
      const tracking = getEffectiveUtmValues();

      Object.entries(tracking).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });

      return url.toString();
    } catch (error) {
      return baseUrl;
    }
  }

  function initCalendlyTargets() {
    const targets = document.querySelectorAll("[data-calendly-base-url]");
    targets.forEach((target) => {
      if (!(target instanceof HTMLElement)) return;

      const baseUrl = target.dataset.calendlyBaseUrl || config.calendlyBaseUrl;
      const trackedUrl = buildCalendlyUrl(baseUrl);
      if (!trackedUrl) return;

      if (target.tagName === "IFRAME") {
        target.setAttribute("src", trackedUrl);
      } else if (target.tagName === "A") {
        target.setAttribute("href", trackedUrl);
      } else if (target.hasAttribute("href")) {
        target.setAttribute("href", trackedUrl);
      } else {
        target.setAttribute("src", trackedUrl);
      }
    });
  }

  function getHeader(headers, name) {
    if (!headers || typeof headers !== "object") return "";

    const direct = headers[name];
    if (typeof direct === "string") return direct;

    const lowerKey = Object.keys(headers).find(
      (key) => key.toLowerCase() === name.toLowerCase()
    );

    return lowerKey ? String(headers[lowerKey] || "") : "";
  }

  function shouldTrackEndpoint() {
    return /^https?:\/\//i.test(clickEndpoint);
  }

  function isDuplicate(actionId, targetUrl) {
    const now = Date.now();
    const key = `${actionId}|${window.location.pathname}|${targetUrl}`;
    const previous = dedupeCache.get(key);
    dedupeCache.set(key, now);

    dedupeCache.forEach((value, cachedKey) => {
      if (now - value > dedupeWindowMs) {
        dedupeCache.delete(cachedKey);
      }
    });

    return typeof previous === "number" && now - previous < dedupeWindowMs;
  }

  function buildClickPayload(anchor) {
    const targetUrl = anchor.href || anchor.getAttribute("href") || "";

    return {
      site,
      event_type: "cta_click",
      action_id: anchor.dataset.trackId || "",
      page_path: window.location.pathname,
      target_url: targetUrl,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      referrer: document.referrer || "",
      ...getEffectiveUtmValues(),
    };
  }

  function dispatchPayload(payload) {
    if (!shouldTrackEndpoint()) return false;

    const body = JSON.stringify(payload);

    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(clickEndpoint, blob)) {
          return true;
        }
      } catch (error) {
        // Continue with fetch fallback.
      }
    }

    try {
      fetch(clickEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body,
        mode: "cors",
        keepalive: true,
      }).catch(() => {});
      return true;
    } catch (error) {
      return false;
    }
  }

  function handleTrackedClick(event) {
    if (!(event.target instanceof Element)) return;

    const anchor = event.target.closest("a[data-track-id], area[data-track-id]");
    if (!(anchor instanceof HTMLAnchorElement || anchor instanceof HTMLAreaElement)) {
      return;
    }

    const actionId = anchor.dataset.trackId || "";
    const targetUrl = anchor.href || anchor.getAttribute("href") || "";

    if (!actionId || !targetUrl || isDuplicate(actionId, targetUrl)) return;

    dispatchPayload(buildClickPayload(anchor));
  }

  const configuredCalendlyUrl = buildCalendlyUrl(config.calendlyBaseUrl || "");
  if (configuredCalendlyUrl) {
    document.documentElement.dataset.sasbCalendlyUrl = configuredCalendlyUrl;
  }

  document.addEventListener("click", handleTrackedClick, { capture: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCalendlyTargets, {
      once: true,
    });
  } else {
    initCalendlyTargets();
  }

  window.SASBLeadTracking = {
    getSessionId() {
      return sessionId;
    },
    getTrackingContext() {
      return {
        site,
        session_id: sessionId,
        ...getEffectiveUtmValues(),
      };
    },
    buildCalendlyUrl,
    track(payload = {}) {
      if (!payload || typeof payload !== "object") return false;

      return dispatchPayload({
        site,
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        referrer: document.referrer || "",
        ...getEffectiveUtmValues(),
        ...payload,
      });
    },
    getRequestHeaders: getHeader,
  };
})();
