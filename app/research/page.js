import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CitationNote, SectionIntro } from "@/app/components/public/core";
import PageRoleCallout from "@/app/components/public/PageRoleCallout";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";
import { getThematicPageRole } from "@/lib/thematic-pages";

export const metadata = buildPageMetadata({
  title: "Research Hub | EquityStack",
  description:
    "Use the EquityStack Research Hub to explore the site’s strongest thematic pages, reports, explainers, methods, and source-backed research paths.",
  path: "/research",
  keywords: [
    "EquityStack research hub",
    "Black policy research hub",
    "presidents and Black Americans research",
    "civil rights policy research",
    "Black history research guide",
  ],
});

const FEATURED_THEMATIC_PAGES = [
  {
    ...getThematicPageRole("presidentsAndBlackAmericans"),
    cta: "Explore presidents and Black history",
  },
  {
    ...getThematicPageRole("presidentialImpactOnBlackAmericans"),
    cta: "Review presidential impact on Black Americans",
  },
  {
    ...getThematicPageRole("civilRightsLawsByPresident"),
    cta: "Trace civil-rights laws across administrations",
  },
  {
    ...getThematicPageRole("campaignPromisesToBlackAmericans"),
    cta: "Compare campaign promises and outcomes",
  },
  {
    ...getThematicPageRole("blackProgressUnderPresidents"),
    cta: "Review measurable progress across administrations",
  },
].filter((item) => item?.path);

const RESEARCH_PATHS = [
  {
    href: "/presidents",
    title: "Presidential records",
    description:
      "Start here when the question is how a presidency affected Black Americans across policy records, linked promises, and visible evidence.",
    cta: "Browse presidential records",
  },
  {
    href: "/policies",
    title: "Policy and executive action",
    description:
      "Use the policy explorer to inspect legislation, executive actions, court decisions, and the record-level impact context behind them.",
    cta: "Review policy records",
  },
  {
    href: "/bills",
    title: "Legislation and bills",
    description:
      "Follow federal legislation, public-law context, and bill-level detail when the research question turns on legal change or proposed reform.",
    cta: "Browse legislation affecting Black Americans",
  },
  {
    href: "/promises",
    title: "Campaign promises and follow-through",
    description:
      "Compare commitments with actions, outcomes, and related records when accountability and delivery matter most.",
    cta: "Compare promises with outcomes",
  },
  {
    href: "/reports",
    title: "Reports and synthesis",
    description:
      "Move into the analysis layer when you need a curated synthesis page that still routes back into underlying records, sources, and methodology.",
    cta: "Open reference-ready reports",
  },
  {
    href: "/methodology",
    title: "Methods and sources",
    description:
      "Use methodology and the source library when you need to understand how records are organized, how metrics are interpreted, and how evidence remains visible.",
    cta: "Review methods and evidence rules",
  },
  {
    href: "/research/how-black-impact-score-works",
    title: "How the Black Impact Score works",
    description:
      "Use this page when the question is specifically how the score is built: what it measures, what it excludes, how intent and systemic impact work, and where uncertainty still matters.",
    cta: "Read the score methodology page",
  },
];

const FLAGSHIP_REPORTS = [
  {
    href: "/reports/black-impact-score",
    title: "Black Impact Score",
    description:
      "The flagship accountability report for comparing presidents through outcome-based scoring, confidence, evidence, and linked records.",
    cta: "Read the Black Impact Score report",
  },
  {
    href: "/reports/civil-rights-timeline",
    title: "Civil-Rights Timeline",
    description:
      "Use the timeline report when chronology, sequence, and long-run legal change matter more than a single administration snapshot.",
    cta: "Follow the civil-rights timeline",
  },
  {
    href: "/reports",
    title: "Reports and analysis hub",
    description:
      "Browse the full report library when you need a wider comparison layer across Black history, policy impact, legislation, and presidential records.",
    cta: "Browse the full reports hub",
  },
];

const FEATURED_EXPLAINERS = [
  {
    href: "/explainers/equal-protection-under-the-law",
    title: "Equal Protection Under the Law",
    description:
      "A constitutional starting point for readers who need legal grounding before interpreting presidential, legislative, or policy records.",
    cta: "Read the equal-protection explainer",
  },
  {
    href: "/explainers/redlining-black-homeownership",
    title: "Redlining and Black Homeownership",
    description:
      "A flagship housing and wealth explainer connecting federal policy design to long-run exclusion and unequal opportunity.",
    cta: "Read the redlining explainer",
  },
  {
    href: "/explainers/gi-bill-access-and-impact",
    title: "The GI Bill: Opportunity, Access, and Unequal Outcomes",
    description:
      "Use this explainer when the question is how a major federal program produced unequal outcomes through implementation and access.",
    cta: "Read the GI Bill explainer",
  },
];

const OUTREACH_PRIORITY_PAGES = [
  {
    href: "/analysis/presidential-impact-on-black-americans",
    title: "Presidential Impact on Black Americans",
    audience: "Best for journalists and broad public-interest questions",
    description:
      "Use this page when the question is broad and comparative. It is the strongest first link for readers who need the overall frame before moving into laws, policies, or specific presidencies.",
  },
  {
    href: "/analysis/civil-rights-laws-by-president",
    title: "Civil Rights Laws by President",
    audience: "Best for educators, researchers, and legal-history readers",
    description:
      "Use this page when the topic is law-focused and the reader needs a route from major statutes into implementation, administration context, and longer historical change.",
  },
  {
    href: "/reports/black-impact-score",
    title: "Black Impact Score",
    audience: "Best for comparative reporting and shareable summaries",
    description:
      "Use this report when the reader needs a reference-grade synthesis page that still routes into methodology, presidents, and underlying policy records.",
  },
  {
    href: "/reports/civil-rights-timeline",
    title: "Civil Rights Timeline",
    audience: "Best for chronology-first teaching and historical reference",
    description:
      "Use this report when sequence matters more than one administration snapshot and the reader needs a chronological route through legal and policy change.",
  },
  {
    href: "/explainers/equal-protection-under-the-law",
    title: "Equal Protection Under the Law",
    audience: "Best for constitutional framing and legal context",
    description:
      "Use this explainer when the reader needs the legal concept before they can interpret a policy, report, or administration-level record well.",
  },
  {
    href: "/methodology",
    title: "Methodology",
    audience: "Best for skeptical readers, editors, and researchers",
    description:
      "Use this page when the question turns to how EquityStack organizes records, handles confidence and limits, and distinguishes between reports, explainers, and evidence-bearing records.",
  },
];

const USER_START_POINTS = [
  {
    title: "Students",
    description:
      "Start with a thematic page or flagship explainer, then move into reports and underlying records once the historical framing is clear.",
  },
  {
    title: "Journalists",
    description:
      "Use the hub to identify the strongest report or thematic page first, then verify the claim through policy records, sources, and methodology.",
  },
  {
    title: "Researchers",
    description:
      "Move quickly from synthesis into presidents, policies, bills, promises, sources, and methods when the task requires a stronger evidence trail.",
  },
  {
    title: "Curious readers",
    description:
      "Use the hub as a guided index into Black history, presidential records, legislation, and policy context without needing to know the site structure in advance.",
  },
];

const CONTINUE_EXPLORING = [
  {
    href: "/presidents",
    title: "Presidents",
    description: "Compare administrations, profile pages, and score drivers.",
  },
  {
    href: "/policies",
    title: "Policies",
    description: "Read the record layer for laws, executive actions, and court decisions.",
  },
  {
    href: "/bills",
    title: "Bills",
    description: "Browse legislation, proposed reform, and legislative context.",
  },
  {
    href: "/promises",
    title: "Promises",
    description: "Track commitments, delivery, and follow-through.",
  },
  {
    href: "/reports",
    title: "Reports",
    description: "Use the analysis layer for comparison and synthesis.",
  },
  {
    href: "/explainers",
    title: "Explainers",
    description: "Add legal and historical context before drawing conclusions.",
  },
  {
    href: "/methodology",
    title: "Methodology",
    description: "Review how EquityStack organizes and interprets records.",
  },
  {
    href: "/research/how-black-impact-score-works",
    title: "How the Black Impact Score Works",
    description: "See the score formula, inclusion rules, and known limitations in one public page.",
  },
  {
    href: "/glossary",
    title: "Glossary",
    description: "Clarify the site’s key terms, page types, and research concepts.",
  },
  {
    href: "/sources",
    title: "Sources",
    description: "Inspect the public evidence base behind the record layer.",
  },
  {
    href: "/start",
    title: "How to Use EquityStack",
    description: "Follow the guided reading path through core explainers and routes.",
  },
];

export default function ResearchHubPage() {
  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Research Hub" }],
            "/research"
          ),
          buildCollectionPageJsonLd({
            title: "EquityStack Research Hub",
            description:
              "A curated gateway to EquityStack’s strongest thematic pages, reports, explainers, methods, and source-backed research paths.",
            path: "/research",
            about: [
              "Black history research",
              "U.S. presidents",
              "civil rights policy",
              "campaign promises",
              "historical policy impact",
            ],
            keywords: [
              "EquityStack research hub",
              "Black policy research hub",
              "presidents and Black Americans research",
            ],
          }),
          buildItemListJsonLd({
            title: "Featured research paths in the EquityStack Research Hub",
            description:
              "A curated set of thematic pages, reports, explainers, and core research routes highlighted on the EquityStack Research Hub.",
            path: "/research",
            items: [
              ...FEATURED_THEMATIC_PAGES.map((item) => ({
                href: item.path,
                name: item.label,
              })),
              ...FLAGSHIP_REPORTS.map((item) => ({
                href: item.href,
                name: item.title,
              })),
              ...FEATURED_EXPLAINERS.map((item) => ({
                href: item.href,
                name: item.title,
              })),
            ],
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Research Hub" }]} />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Research Hub"
          title="A curated gateway to EquityStack’s strongest public research"
          description="This page brings together the site’s strongest thematic guides, flagship reports, historical explainers, and core research paths across presidents, promises, policies, legislation, and evidence. It is designed as a serious starting point for readers who want the clearest route into the public record."
          actions={
            <>
              <Link href="/reports" className="dashboard-button-primary">
                Open flagship reports
              </Link>
              <Link href="/methodology" className="dashboard-button-secondary">
                Review methodology
              </Link>
            </>
          }
        />
      </section>

      <PageRoleCallout
        title="Use the research hub as the site’s curated research index"
        description="This page is for choosing the strongest evidence-oriented path into EquityStack once you know the question you are asking. Use Start Here for a guided explainer sequence, Methodology for site-wide evaluation rules, and the score page when the question is specifically how the Black Impact Score works."
        links={[
          { href: "/start", label: "Guided start" },
          { href: "/methodology", label: "Site methodology" },
          { href: "/research/how-black-impact-score-works", label: "Score method" },
        ]}
      />

      <section className="public-two-col-rail grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <CitationNote
          title="Why this page is worth sharing"
          description="Use the Research Hub when someone needs one serious entry point into EquityStack’s strongest public pages. It is designed for teachers, journalists, researchers, students, and skeptical first-time visitors who need a curated path into the site rather than a raw archive."
        />
        <div className="border-l-0 border-t border-[var(--line)] pt-5 md:border-t-0 md:pt-0 md:pl-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            What this hub does
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Use it to choose the right research path quickly</h2>
          <div className="mt-4 grid gap-4 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="border-l border-[var(--line)] pl-4">
              Start with a major thematic question if the topic is broad and historical.
            </div>
            <div className="border-l border-[var(--line)] pl-4">
              Move into reports when you need synthesis, comparison, or a more shareable analytical page.
            </div>
            <div className="border-l border-[var(--line)] pl-4">
              Use explainers, sources, and methodology when context, verification, and interpretation matter more than speed.
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Promotion-ready pages"
          title="Best pages to share first"
          description="These are the strongest public pages to promote externally when you need a serious, link-worthy starting point rather than a raw database destination."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {OUTREACH_PRIORITY_PAGES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel-link p-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                {item.audience}
              </p>
              <h2 className="mt-4 text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Major thematic questions"
          title="Start with the site’s strongest thematic guides"
          description="These pages are the clearest entry points for visitors arriving with broad questions about presidents, Black Americans, civil-rights law, policy impact, promises, and historical change."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {FEATURED_THEMATIC_PAGES.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className="panel-link p-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                {item.clusterEyebrow || "Research guide"}
              </p>
              <h2 className="mt-4 text-xl font-semibold text-white">{item.label}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.clusterDescription || item.uniqueAngle}
              </p>
              <span className="mt-5 inline-flex text-sm font-medium text-[var(--accent)]">
                {item.cta}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Explore by research path"
          title="Choose the route that matches your question"
          description="EquityStack is easier to use when the starting point matches the kind of evidence, context, or comparison you actually need."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {RESEARCH_PATHS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel-link p-4"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
              <span className="mt-5 inline-flex text-sm font-medium text-[var(--accent)]">
                {item.cta}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Flagship reports"
          title="Start with the strongest report-level destinations"
          description="These pages are the strongest report-side entry points when you need synthesis, comparison, and historical analysis that still routes back into evidence and underlying records."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {FLAGSHIP_REPORTS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel-link p-4"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
              <span className="mt-5 inline-flex text-sm font-medium text-[var(--accent)]">
                {item.cta}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Featured explainers"
          title="Use explainers when historical and legal context comes first"
          description="These explainers are especially useful when a reader needs constitutional, policy, or long-run historical grounding before interpreting a president, law, promise, or report."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURED_EXPLAINERS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel-link p-4"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
              <span className="mt-5 inline-flex text-sm font-medium text-[var(--accent)]">
                {item.cta}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="How to use this hub"
          title="Different readers can begin in different places"
          description="The best starting point depends on whether you need orientation, evidence, comparison, or a shareable synthesis page."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {USER_START_POINTS.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Move from the hub into the core record and evidence layers"
          description="These are the strongest next destinations when you are ready to move from a curated overview into presidents, policies, legislation, promises, methods, or sources."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {CONTINUE_EXPLORING.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="panel-link p-4"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
