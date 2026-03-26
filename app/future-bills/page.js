import FutureBillsClient from "./FutureBillsClient";
import { fetchInternalJson } from "@/lib/api";
import { PUBLIC_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Future Bills",
  description:
    "Track forward-looking policy ideas, reform proposals, and linked legislation intended to address unresolved harms and equity gaps.",
  path: "/future-bills",
});

async function getFutureBills() {
  return fetchInternalJson("/api/future-bills", {
    ...withRevalidate(PUBLIC_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch future bills",
  });
}

export default async function FutureBillsPage({ searchParams }) {
  const bills = await getFutureBills();
  const resolvedSearchParams = await searchParams;
  const focusId = resolvedSearchParams?.focus || null;

  return <FutureBillsClient bills={bills} focusId={focusId} />;
}
