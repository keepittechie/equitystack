import FutureBillsClient from "./FutureBillsClient";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { getFutureBills } from "@/lib/shareable-cards";
import {
  buildCollectionPageJsonLd,
  buildDatasetJsonLd,
} from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Future bills and reform proposals",
  description:
    "Track forward-looking policy ideas, reform proposals, and linked legislation intended to address unresolved harms and equity gaps affecting Black Americans.",
  path: "/future-bills",
  keywords: [
    "future civil rights bills",
    "reform proposals for Black Americans",
    "future legislation affecting Black Americans",
  ],
});

export default async function FutureBillsPage({ searchParams }) {
  const bills = await getFutureBills();
  const resolvedSearchParams = await searchParams;
  const focusId = resolvedSearchParams?.focus || null;

  return (
    <>
      <StructuredData
        data={[
          buildCollectionPageJsonLd({
            title: "Future bills and reform proposals",
            description:
              "A public library of forward-looking reform proposals, future bills, and linked legislation related to Black Americans and unresolved policy harms.",
            path: "/future-bills",
            about: [
              "future legislation affecting Black Americans",
              "reform proposals",
              "civil rights policy",
            ],
            keywords: [
              "future civil rights bills",
              "future legislation affecting Black Americans",
            ],
          }),
          buildDatasetJsonLd({
            title: "EquityStack future bills dataset",
            description:
              "Structured future-bill records covering reform concepts, linked bills, explainers, legislative tracking, and sources.",
            path: "/future-bills",
            about: ["reform proposals", "civil rights policy", "Black Americans"],
            keywords: ["future civil rights bills", "reform proposals for Black Americans"],
            variableMeasured: [
              "Priority level",
              "Linked bills",
              "Source count",
              "Legislative updates",
            ],
          }),
        ]}
      />
      <FutureBillsClient bills={bills} focusId={focusId} />
    </>
  );
}
