function buildPayload(payload = {}) {
  return JSON.stringify(payload);
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

  if (!response.ok) {
    throw new Error("Failed to submit feedback");
  }

  return response.json();
}
