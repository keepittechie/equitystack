import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { getResearchCases } from "@/lib/research-cases";
import { getPoliciesForCase } from "@/lib/cases";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  ImpactOverviewCards,
  SectionIntro,
} from "@/app/components/public/core";
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

function getMetadataList(item, key) {
  return String(getMetadataValue(item, key) || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export default function ResearchCasesPage() {
  const cases = getResearchCases();
  const linkedCaseCount = cases.filter(
    (item) => getPoliciesForCase(item.slug).length > 0
  ).length;
  const representedDomains = new Set(
    cases.flatMap((item) => getMetadataList(item, "Domain"))
  );

  return (
    <main className="space-y-5">
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

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Research cases"
          title="Legal context records connected to the policy layer."
          description="Research cases summarize litigation and court constraints that may connect to policy records after review. They provide context only; they are not scored directly."
        />
      </section>

      <ImpactOverviewCards
        items={[
          {
            label: "Case records",
            value: cases.length,
            description: "Structured public case records currently available.",
            tone: "accent",
          },
          {
            label: "Linked-policy ready",
            value: linkedCaseCount,
            description: "Cases with verified relationships to policy records.",
            tone: linkedCaseCount ? "info" : "default",
          },
          {
            label: "Domains",
            value: representedDomains.size,
            description: "Policy domains represented across the current case set.",
          },
          {
            label: "Record type",
            value: "Legal context",
            description: "Research-layer context separate from scoring and ranking.",
          },
        ]}
      />

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Case archive"
          title="Browse research-layer case records"
          description="Open a case to review its summary, procedural posture, and any verified policy links."
        />
        <div className="space-y-5">
          {cases.map((item) => {
            const domains = getMetadataList(item, "Domain");
            const type = getMetadataValue(item, "Type");
            const status = getMetadataValue(item, "Status");
            const policyLinkCount = getPoliciesForCase(item.slug).length;

            return (
              <Panel
                key={item.slug}
                as="article"
                padding="md"
                prominence="primary"
                className="group"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="info">Research case</StatusPill>
                  {domains.map((domain) => (
                    <StatusPill key={domain} tone="default">
                      {domain}
                    </StatusPill>
                  ))}
                  {type ? <StatusPill tone="info">{type}</StatusPill> : null}
                  {status ? <StatusPill tone="default">{status}</StatusPill> : null}
                  {policyLinkCount ? (
                    <StatusPill tone="success">
                      {policyLinkCount} linked policy
                    </StatusPill>
                  ) : null}
                </div>
                <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 max-w-4xl">
                    <h2 className="text-xl font-semibold leading-tight text-white md:text-2xl">
                      {item.title}
                    </h2>
                    {item.summary ? (
                      <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)] md:text-base">
                        {item.summary}
                      </p>
                    ) : null}
                    <p className="mt-4 text-[12px] leading-5 text-[var(--ink-muted)]">
                      Legal context record. Policy relationships appear only after review.
                    </p>
                  </div>
                  <Link
                    href={`/research/cases/${item.slug}`}
                    className="dashboard-button-secondary shrink-0 self-start"
                  >
                    Open case
                  </Link>
                </div>
              </Panel>
            );
          })}
          {!cases.length ? (
            <Panel
              padding="md"
              className="border-dashed text-sm leading-7 text-[var(--ink-soft)]"
            >
              No public research case records are available yet.
            </Panel>
          ) : null}
        </div>
      </section>

      <Panel padding="md" className="bg-[rgba(18,31,49,0.52)]">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          How to read these cases
        </p>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
          Case records provide legal context for policy research. They can show
          reviewed links to policy records, but they do not create scores,
          rankings, or standalone impact ratings.
        </p>
      </Panel>
    </main>
  );
}
