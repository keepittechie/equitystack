import ActivityFeed from "./ActivityFeed";
import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Activity Feed",
  description:
    "Browse recent accountability activity across tracked future bills, legislative actions, and linked legislator scorecards.",
  path: "/activity",
});

async function getFutureBills() {
  return fetchInternalJson("/api/future-bills", {
    ...withRevalidate(REPORT_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch activity feed data",
  });
}

export default async function ActivityPage() {
  const bills = await getFutureBills();

  return <ActivityFeed bills={bills} />;
}
