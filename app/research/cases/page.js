import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { getResearchCases } from "@/lib/research-cases";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
} from "@/lib/structured-data";
import {
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";

export const metadata = buildPageMetadata({
  title: "Research Cases | EquityStack",
  description:
    "Browse EquityStack research-layer case notes and litigation records before they are connected to public policy records.",
  path: "/research/cases",
});

function getMetadataValue(item, key) {
  return item.metadataMap.get(key.toLowerCase()) || null;
}

export default function ResearchCasesPage() {
  const cases = getResearchCases();

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/research", label: "Research" },
              { label: "Cases" },
            ],
            "/research/cases"
          ),
          buildCollectionPageJsonLd({
            title: "Research Cases",
            description:
              "Research-layer case notes and litigation records in EquityStack.",
            path: "/research/cases",
            items: cases.map((item) => ({
              title: item.title,
              href: `/research/cases/${item.slug}`,
              description: item.summary,
            })),
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/research", label: "Research" },
          { label: "Cases" },
        ]}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <SectionHeader
          eyebrow="Research layer"
          title="Research Cases"
          description="Case notes are research records. They provide legal context and can be linked to policy records when the relationship is reviewed."
        />
        <div className="space-y-4 p-4">
          {cases.map((item) => {
            const domain = getMetadataValue(item, "Domain");
            const type = getMetadataValue(item, "Type");
            const status = getMetadataValue(item, "Status");

            return (
              <Panel
                key={item.slug}
                as={Link}
                href={`/research/cases/${item.slug}`}
                padding="md"
                interactive
              >
                <div className="flex flex-wrap gap-2">
                  {domain ? <StatusPill tone="default">{domain}</StatusPill> : null}
                  {type ? <StatusPill tone="info">{type}</StatusPill> : null}
                  {status ? <StatusPill tone="default">{status}</StatusPill> : null}
                </div>
                <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
                {item.summary ? (
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                    {item.summary}
                  </p>
                ) : null}
              </Panel>
            );
          })}
          {!cases.length ? (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No research case files are available yet.
            </Panel>
          ) : null}
        </div>
      </Panel>
    </main>
  );
}

