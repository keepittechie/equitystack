import { headers } from "next/headers";

function normalizeBaseUrl(value) {
  if (!value) return null;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");

  if (!host) {
    return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) || "http://localhost:3000";
  }

  const protocol = headerStore.get("x-forwarded-proto") || "http";
  return `${protocol}://${host}`;
}

async function readInternalJsonResponse(response, normalizedPath) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const trimmed = text.trim();
  const looksLikeJson =
    contentType.includes("application/json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (!looksLikeJson) {
    throw new Error(`Invalid JSON response from ${normalizedPath} (${response.status})`);
  }

  let payload;
  try {
    payload = trimmed ? JSON.parse(trimmed) : {};
  } catch {
    throw new Error(`Malformed JSON response from ${normalizedPath} (${response.status})`);
  }

  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    payload.success === false
  ) {
    const message =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message || `Request failed for ${normalizedPath}`;
    throw new Error(message);
  }

  return payload;
}

export async function fetchInternalJson(path, options = {}) {
  const { errorMessage, allow404 = false, ...fetchOptions } = options;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) || (await getRequestOrigin());
  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    cache: "no-store",
    ...fetchOptions,
  });

  if (allow404 && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    try {
      const payload = await readInternalJsonResponse(response, normalizedPath);
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : payload?.error?.message || errorMessage || `Failed to fetch ${normalizedPath}`;
      throw new Error(message);
    } catch (error) {
      throw new Error(errorMessage || error.message || `Failed to fetch ${normalizedPath}`);
    }
  }

  return readInternalJsonResponse(response, normalizedPath);
}
