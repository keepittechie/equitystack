"use client";

function previewText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.slice(0, 800);
}

function buildEndpointLabel(endpoint, status) {
  if (endpoint) {
    return `${endpoint} (${status})`;
  }
  return `API response (${status})`;
}

export async function readAdminJsonResponse(response, endpoint = "") {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const trimmed = text.trim();
  const looksLikeJson =
    contentType.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (!looksLikeJson) {
    console.error("Admin API returned a non-JSON response.", {
      endpoint,
      status: response.status,
      contentType,
      bodyPreview: previewText(text),
    });
    throw new Error(
      `Backend error: invalid response from API ${buildEndpointLabel(endpoint, response.status)}.`
    );
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
    console.error("Admin API returned malformed JSON.", {
      endpoint,
      status: response.status,
      contentType,
      bodyPreview: previewText(text),
      error,
    });
    throw new Error(
      `Backend error: malformed JSON from API ${buildEndpointLabel(endpoint, response.status)}.`
    );
  }
}
