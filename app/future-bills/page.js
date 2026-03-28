import FutureBillsClient from "./FutureBillsClient";
import { buildPageMetadata } from "@/lib/metadata";
import { getFutureBills } from "@/lib/shareable-cards";

export const metadata = buildPageMetadata({
  title: "Future Bills",
  description:
    "Track forward-looking policy ideas, reform proposals, and linked legislation intended to address unresolved harms and equity gaps.",
  path: "/future-bills",
});

export default async function FutureBillsPage({ searchParams }) {
  const bills = await getFutureBills();
  const resolvedSearchParams = await searchParams;
  const focusId = resolvedSearchParams?.focus || null;

  return <FutureBillsClient bills={bills} focusId={focusId} />;
}
