import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  getResearchCaseBySlug,
  getResearchCaseSlugs,
} from "@/lib/research-cases";
import { getPoliciesForCase } from "@/lib/cases";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from "@/lib/structured-data";
import {
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import LinkedPoliciesForCasePanel from "@/app/components/public/LinkedPoliciesForCasePanel";

function getMetadataValue(item, key) {
  return item.metadataMap.get(key.toLowerCase()) || null;
}

function getMetadataChips(item) {
  return ["Status", "Domain", "Type", "Impact characterization"]
    .map((key) => getMetadataValue(item, key))
    .filter(Boolean);
}

export function generateStaticParams() {
  return getResearchCaseSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const researchCase = getResearchCaseBySlug(slug);

  if (!researchCase) {
    return buildPageMetadata({
      title: "Research Case Not Found | EquityStack",
      description: "The requested EquityStack research case could not be found.",
      path: `/research/cases/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${researchCase.title} | EquityStack Research Case`,
    description:
      researchCase.summary ||
      "EquityStack research-layer case note with legal context and source details.",
    path: `/research/cases/${slug}`,
  });
}

function CaseSection({ section }) {
  return (
    <Panel padding="md" className="space-y-3">
      <h2 className="text-lg font-semibold text-white">{section.title}</h2>
      <div className="space-y-3">
        {section.paragraphs.map((paragraph, index) => (
          <p
            key={`${section.title}-${index}`}
            className="text-sm leading-7 text-[var(--ink-soft)]"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </Panel>
  );
}

export default async function ResearchCaseDetailPage({ params }) {
  const { slug } = await params;
  const researchCase = getResearchCaseBySlug(slug);

  if (!researchCase) {
    notFound();
  }

  const linkedPolicies = getPoliciesForCase(researchCase.slug);
  const chips = getMetadataChips(researchCase);

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/research", label: "Research" },
              { href: "/research/cases", label: "Cases" },
              { label: researchCase.title },
            ],
            `/research/cases/${researchCase.slug}`
          ),
          buildWebPageJsonLd({
            title: researchCase.title,
            description: researchCase.summary,
            path: `/research/cases/${researchCase.slug}`,
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/research", label: "Research" },
          { href: "/research/cases", label: "Cases" },
          { label: researchCase.title },
        ]}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <SectionHeader
          as="h1"
          eyebrow="Research case"
          title={researchCase.title}
          description={researchCase.summary}
          action={
            <Link
              href="/research/cases"
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
            >
              All cases
            </Link>
          }
        />
        {chips.length ? (
          <div className="flex flex-wrap gap-2 border-b border-[var(--line)] p-4">
            {chips.map((chip) => (
              <StatusPill key={chip} tone="default">
                {chip}
              </StatusPill>
            ))}
          </div>
        ) : null}
        <div className="space-y-4 p-4">
          {researchCase.metadata.length ? (
            <Panel padding="md">
              <dl className="grid gap-3 md:grid-cols-2">
                {researchCase.metadata.map((item) => (
                  <div key={item.key}>
                    <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {item.key}
                    </dt>
                    <dd className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : null}
          {researchCase.sections.map((section) => (
            <CaseSection key={section.title} section={section} />
          ))}
          <LinkedPoliciesForCasePanel items={linkedPolicies} />
        </div>
      </Panel>
    </main>
  );
}
