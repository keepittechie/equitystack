function buildPayload(payload = {}) {
  return JSON.stringify(payload);
}

async function readPublicJsonResponse(response, endpoint) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const trimmed = text.trim();
  const looksLikeJson =
    contentType.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (!looksLikeJson) {
    console.error("Public API returned a non-JSON response.", {
      endpoint,
      status: response.status,
      contentType,
      bodyPreview: text.slice(0, 800),
    });
    throw new Error(`Backend error: invalid response from ${endpoint}.`);
  }

  try {
    const parsed = trimmed ? JSON.parse(trimmed) : {};
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.error &&
      typeof parsed.error === "object" &&
      typeof parsed.error.message === "string"
    ) {
      return {
        ...parsed,
        error: parsed.error.message,
        errorDetails: parsed.error,
      };
    }
    return parsed;
  } catch (error) {
    console.error("Public API returned malformed JSON.", {
      endpoint,
      status: response.status,
      contentType,
      bodyPreview: text.slice(0, 800),
      error,
    });
    throw new Error(`Backend error: malformed JSON from ${endpoint}.`);
  }
}

export function sendPublicSignal(payload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const body = buildPayload(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/public-signals", blob);
      return;
    }
  } catch {}

  fetch("/api/public-signals", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => {});
}

export async function sendPublicFeedback(payload = {}) {
  const response = await fetch("/api/public-feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: buildPayload(payload),
    keepalive: true,
  });
  const payloadResponse = await readPublicJsonResponse(response, "/api/public-feedback");
  if (!response.ok || payloadResponse?.success === false || payloadResponse?.ok === false) {
    throw new Error(payloadResponse?.error || "Failed to submit feedback");
  }
  return payloadResponse;
}
