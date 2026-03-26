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
    throw new Error(errorMessage || `Failed to fetch ${normalizedPath}`);
  }

  return response.json();
}
