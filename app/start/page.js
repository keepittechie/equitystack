import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CitationNote, SectionIntro } from "@/app/components/public/core";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Start Here | Guided EquityStack research path",
  description:
    "Follow a guided reading path through EquityStack's core explainers on law, policy, history, and long-term Black outcomes, with clear next steps into reports, sources, and methodology.",
  path: "/start",
});

const learningPath = [
  {
    slug: "equal-protection-under-the-law",
    title: "Equal Protection Under the Law",
    description:
      "Start with the constitutional foundation. This explainer introduces the legal principle of equal protection and the gap between formal guarantees and real-world application.",
  },
  {
    slug: "party-switch-southern-strategy",
    title: "Did the Parties Switch? The Southern Strategy Explained",
    description:
      "This provides the political realignment context needed to understand how race, law, and party coalitions changed over time.",
  },
  {
    slug: "redlining-black-homeownership",
    title: "Redlining and Black Homeownership",
    description:
      "A key explainer on how federal housing policy, lending practices, and neighborhood grading shaped wealth and exclusion.",
  },
  {
    slug: "homestead-act-exclusion",
    title: "The Homestead Act and Unequal Access to Land",
    description:
      "This explains how early land policy created wealth-building opportunities that were not equally available in practice.",
  },
  {
    slug: "gi-bill-access-and-impact",
    title: "The GI Bill: Opportunity, Access, and Unequal Outcomes",
    description:
      "A focused look at how a landmark opportunity program produced different outcomes depending on race and local implementation.",
  },
  {
    slug: "bootstraps-vs-policy-reality",
    title: "“Pull Yourself Up by Your Bootstraps” vs. Policy Reality",
    description:
      "This connects public rhetoric about self-reliance to the actual role of policy in shaping economic mobility.",
  },
  {
    slug: "crime-statistics-context-and-misuse",
    title: "Crime Statistics in Context",
    description:
      "A methodological explainer on how commonly cited statistics are measured, interpreted, and often misused in debate.",
  },
  {
    slug: "sentencing-disparities-united-states",
    title: "Sentencing Disparities in the United States",
    description:
      "This examines how laws, discretion, and institutional structure can produce unequal punishment outcomes.",
  },
  {
    slug: "mass-incarceration-policy-history",
    title: "Mass Incarceration in the United States",
    description:
      "A system-level explainer connecting sentencing, enforcement, and legislative design to incarceration growth.",
  },
  {
    slug: "government-benefits-racial-gap",
    title: "Government Benefits and the Racial Gap",
    description:
      "This synthesizes multiple policy areas to show how public investment often built opportunity unevenly.",
  },
];

const audienceStartPoints = [
  {
    title: "Teachers and educators",
    description:
      "Share this page when a class, workshop, or reading group needs one structured sequence through EquityStack’s strongest explainers before moving into reports or records.",
  },
  {
    title: "Journalists and writers",
    description:
      "Use this guide when a broad topic needs historical grounding first, then move into the research hub, methodology, or a flagship report once the framing is clear.",
  },
  {
    title: "Researchers and students",
    description:
      "Start here when the project needs conceptual grounding, then move into policy, promise, president, and source pages for closer verification and citation.",
  },
  {
    title: "First-time readers",
    description:
      "This is the best orientation page when someone understands the broad topic but does not yet know which part of EquityStack to trust or open first.",
  },
];

export default function StartPage() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-10">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Start Here" }],
            "/start"
          ),
          buildCollectionPageJsonLd({
            title: "How to Use EquityStack",
            description:
              "A guided reading path through EquityStack's strongest explainers, reports, methodology, and source-backed research routes.",
            path: "/start",
            about: [
              "research guide",
              "Black history",
              "policy explainers",
              "public-interest research",
            ],
            keywords: [
              "how to use EquityStack",
              "Black history research guide",
              "EquityStack start page",
            ],
          }),
          buildItemListJsonLd({
            title: "EquityStack guided reading sequence",
            description:
              "The recommended order for first-time visitors moving through EquityStack's strongest explainers.",
            path: "/start",
            items: learningPath.map((item) => ({
              href: `/explainers/${item.slug}`,
              name: item.title,
            })),
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Start Here" }]} />
      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">
          Research guide
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          A guided path through Black history, policy, and the EquityStack research graph
        </h1>
        <p className="text-[var(--ink-soft)] text-lg leading-8 max-w-3xl">
          This page provides a structured introduction to the major themes covered
          on EquityStack. It is designed for readers who want a clear starting point
          and a logical sequence for understanding the relationship between law,
          policy, Black history, and long-term outcomes. It also works as a shareable
          orientation page for teachers, writers, and first-time readers who need one
          page to explain how the site should be approached.
        </p>
      </section>

      <section className="grid gap-6 border-t border-[var(--line)] pt-6 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold mb-3">What this guide covers</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            The sequence below moves from constitutional foundations to political
            realignment, housing and wealth, economic mobility, and criminal justice.
            Each explainer links back into the larger policy, promise, report, and historical research database.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-3">Why readers use this page</h2>
          <p className="text-sm text-[var(--ink-soft)] leading-7">
            This page is useful when someone needs a concise introduction to EquityStack&apos;s strongest historical explainers before moving into presidents, policies, reports, methodology, or sources.
          </p>
        </div>
      </section>

      <CitationNote
        title="How to cite or share this guide"
        description="When sharing this page, treat it as EquityStack&apos;s guided orientation path through the site&apos;s strongest public explainers and research routes. Cite the page title, EquityStack, the URL, and your access date, then link onward to the specific explainer, report, or methodology page most relevant to the topic."
      />

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Who this page helps most"
          title="Use this guide when the audience needs orientation before evidence"
          description="The start page is most useful when the reader needs a guided path through the site’s strongest public explainers before they begin citing reports, records, or methods."
        />
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
          {audienceStartPoints.map((item) => (
            <article key={item.title}>
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Recommended order"
          title="Follow the guided reading sequence"
          description="This order is designed to help new readers build context before they begin citing or comparing specific policy, promise, president, or report pages."
        />
        {learningPath.map((item, index) => (
          <Link
            key={item.slug}
            href={`/explainers/${item.slug}`}
            className="panel-link p-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-sm font-semibold text-[var(--accent)] bg-white/5 shrink-0">
                {index + 1}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                  {item.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="card-surface p-4">
        <h2 className="text-2xl font-semibold mb-3">Companion pages for verification</h2>
        <p className="text-sm text-[var(--ink-soft)] leading-7 max-w-3xl">
          After the explainers, the strongest next step is usually a report, the methodology page, or the source library. Those pages make the site easier to verify, teach from, and reference externally.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 mt-5">
          <Link href="/research" className="panel-link p-4">
            <h3 className="text-lg font-semibold">Research Hub</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Use the research hub when someone needs one curated page that bundles thematic guides, flagship reports, explainers, methodology, and sources.
            </p>
          </Link>
          <Link href="/glossary" className="panel-link p-4">
            <h3 className="text-lg font-semibold">Glossary</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Use the glossary when a reader needs quick definitions for the site’s main terms, page types, and research concepts.
            </p>
          </Link>
          <Link href="/reports" className="panel-link p-4">
            <h3 className="text-lg font-semibold">Reports and analysis</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Use reports when you need a summarized analytical page that still links back into the underlying public record.
            </p>
          </Link>
          <Link href="/methodology" className="panel-link p-4">
            <h3 className="text-lg font-semibold">Methodology</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Read the methodology when a teacher, editor, or researcher needs to understand how scores and statuses are constructed.
            </p>
          </Link>
          <Link href="/sources" className="panel-link p-4">
            <h3 className="text-lg font-semibold">Sources</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Open the source library when a claim needs direct verification or a reader wants to inspect the evidence base.
            </p>
          </Link>
        </div>
      </section>

      <section className="card-surface p-4">
        <h2 className="text-2xl font-semibold mb-3">Where to go next</h2>
        <p className="text-sm text-[var(--ink-soft)] leading-7 max-w-3xl">
          After the guided explainers, move into the tracked record layer first, then use the report system for summary, comparison, and timeline views.
        </p>
        <div className="grid gap-4 md:grid-cols-3 mt-5">
          <Link href="/promises" className="panel-link p-4">
            <h3 className="text-lg font-semibold">Promise Tracker</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Review promises, actions, outcomes, and source-backed detail at the record level.
            </p>
          </Link>
          <Link href="/reports/black-impact-score" className="panel-link p-4">
            <h3 className="text-lg font-semibold">Black Impact Score</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Move from individual records to a president-level accountability summary built from the tracker.
            </p>
          </Link>
          <Link href="/reports/civil-rights-timeline" className="panel-link p-4">
            <h3 className="text-lg font-semibold">Timeline</h3>
            <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
              Follow the broader civil-rights arc when you want historical continuity beyond a single report state.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
