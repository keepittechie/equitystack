import { fetchInternalJson } from "@/lib/api";
import { REPORT_REVALIDATE_SECONDS, withRevalidate } from "@/lib/cache";
import { buildPageMetadata } from "@/lib/metadata";
import TimelineBrowser from "@/app/timeline/TimelineBrowser";

export const metadata = buildPageMetadata({
  title: "Timeline",
  description:
    "Follow EquityStack's policy timeline across major historical eras, from Reconstruction to the present.",
  path: "/timeline",
});

async function getEraSummary() {
  return fetchInternalJson("/api/reports/era-summary", {
    ...withRevalidate(REPORT_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch era summary",
  });
}

async function getEraDetails() {
  return fetchInternalJson("/api/reports/era-details", {
    ...withRevalidate(REPORT_REVALIDATE_SECONDS),
    errorMessage: "Failed to fetch era details",
  });
}

function groupByEra(rows) {
  const grouped = {};

  for (const row of rows) {
    const era = row.era || row.name || "Unknown Era";

    if (!grouped[era]) {
      grouped[era] = [];
    }

    grouped[era].push(row);
  }

  return grouped;
}

function getEraName(row) {
  return row.era || row.name || "Unknown Era";
}

export default async function TimelinePage() {
  const [eraSummary, eraDetails] = await Promise.all([
    getEraSummary(),
    getEraDetails(),
  ]);

  const safeEraSummary = eraSummary || [];
  const safeEraDetails = eraDetails || [];
  const detailsByEra = groupByEra(safeEraDetails);
  const eras = safeEraSummary.map((era) => {
    const eraName = getEraName(era);

    return {
      ...era,
      name: eraName,
      policies: detailsByEra[eraName] || [],
    };
  });

  return <TimelineBrowser eras={eras} />;
}
