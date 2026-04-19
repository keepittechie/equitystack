import { buildPageMetadata } from "@/lib/metadata";
import Link from "next/link";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CitationNote, KpiCard, SectionIntro } from "@/app/components/public/core";
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Methodology | How EquityStack organizes and interprets records",
  description:
    "Read how EquityStack organizes presidents, promises, policies, bills, reports, explainers, narratives, and thematic pages, and how to interpret scores, evidence, and known limits responsibly.",
  path: "/methodology",
  keywords: [
    "EquityStack methodology",
    "how EquityStack works",
    "Black Impact Score methodology",
    "promise tracker methodology",
    "policy records methodology",
  ],
});

const SITE_SURFACES = [
  {
    title: "Presidents",
    description:
      "President pages gather administration-level records, score context, promises, policies, and linked evidence into one profile surface.",
  },
  {
    title: "Promises",
    description:
      "Promise pages track public commitments and visible follow-through. They are accountability records, not substitutes for downstream impact analysis.",
  },
  {
    title: "Policies",
    description:
      "Policy pages are the main record layer for laws, court actions, executive actions, and outcomes that can be tied to Black impact analysis.",
  },
  {
    title: "Bills and legislation",
    description:
      "Bills add legislative pathway context, including enacted laws, proposals, and related federal reform efforts where the data supports the connection.",
  },
  {
    title: "Reports",
    description:
      "Reports synthesize patterns across many records. They are summary and comparison tools that should still lead readers back into underlying records.",
  },
  {
    title: "Explainers",
    description:
      "Explainers provide historical, legal, and policy context so readers can interpret records without treating summaries as self-explanatory.",
  },
  {
    title: "Narratives",
    description:
      "Narratives group change over time into broader historical arcs. They help readers understand expansion, rollback, and continuity across eras.",
  },
  {
    title: "Thematic pages",
    description:
      "Thematic landing pages are guided entry points built around common research questions. They organize pathways, not final answers.",
  },
];

const READING_LAYERS = [
  {
    title: "Raw and linked records",
    description:
      "Policies, promises, bills, and president profiles are the record layer. These pages carry the clearest link between structured data, visible sources, and traceable evidence.",
  },
  {
    title: "Editorial context",
    description:
      "Explainers and narratives help interpret the record layer. They add historical and conceptual framing, but they do not replace source-backed records.",
  },
  {
    title: "Reports and synthesis",
    description:
      "Reports summarize patterns across many records. They are useful reference pages, but they should be read alongside methodology and underlying records when precision matters.",
  },
  {
    title: "Thematic entry pages",
    description:
      "Analysis pages help users enter the site through a clear research question. They point readers into stronger evidence trails rather than trying to own every claim themselves.",
  },
];

const FRAMING_RULES = [
  {
    title: "Policy records",
    description:
      "EquityStack treats policy records as the clearest place to inspect action, stated impact direction, status, evidence, and linked historical context.",
  },
  {
    title: "Campaign promises",
    description:
      "Promises are framed as commitments that can be compared with action and outcomes. Delivery status and Black impact are kept related but distinct.",
  },
  {
    title: "Related laws and executive actions",
    description:
      "Legislation and executive actions are connected when current public evidence supports the relationship. Weak or missing lineage should be read as incomplete, not silently resolved.",
  },
  {
    title: "Historical context",
    description:
      "Explainers, narratives, and thematic guides exist to clarify legal, institutional, and historical context around the records. They help users understand why a record matters and what it does not prove on its own.",
  },
];

const LIMITATIONS = [
  "Coverage is uneven across eras, institutions, and topic areas, so absence in the public dataset should not be read as absence in history.",
  "Not every page type carries the same evidentiary depth. Some pages are hubs or summaries, while others are closer to underlying records.",
  "Attribution across branches and over time is difficult, especially when downstream outcomes flow through courts, agencies, or long implementation chains.",
  "Scores, labels, and statuses are structured summaries of the current dataset. They are designed to aid reading, not to replace source review.",
];

const CONFIDENCE_NOTES = [
  "Very low confidence usually means the visible record is still thin and should be treated as provisional.",
  "Low and medium confidence remain public so incomplete or disputed coverage does not disappear from view.",
  "High confidence signals stronger visible support, not absolute certainty or finality.",
];

const SCORE_DIMENSIONS = [
  {
    title: "Black Impact Score",
    description:
      "Presidential score reporting keeps direct impact and systemic impact separate. Direct score tracks direct policy outcomes. Systemic score tracks judicial or other explicitly indirect effects when attribution is defensible.",
  },
  {
    title: "Direction weighting",
    description:
      "Positive, negative, mixed, and blocked outcomes do not contribute equally. Mixed and blocked outcomes remain visible so the score cannot hide uncertainty or constrained delivery.",
  },
  {
    title: "Confidence adjustment",
    description:
      "Source count and source quality influence the confidence layer. Low-coverage records remain in the dataset, but they are visibly dampened for display and labeled with lower confidence.",
  },
  {
    title: "Intent modifier",
    description:
      "When policy intent is deterministically classified, EquityStack can distinguish equity-expanding intent from restrictive intent. Missing intent never gets guessed silently.",
  },
  {
    title: "Promise grading",
    description:
      "Promise status is a public-accountability layer, not a substitute for downstream impact. Delivered, partial, failed, or blocked promise status stays distinct from the Black Impact Score.",
  },
  {
    title: "Time dimension",
    description:
      "Impact start and end dates make it possible to describe when impact occurred, how long it lasted, and how yearly score movement changed over time.",
  },
];

const SOURCE_RULES = [
  "Primary and official sources are preferred: government records, archives, congressional records, court rulings, and similarly authoritative documentation.",
  "Source quality remains visible on outcome and report views so users can distinguish well-supported records from incomplete ones.",
  "Low-source records are not hidden. They stay visible with lower confidence and incomplete-data signals.",
  "Methodology exists to make the system inspectable, not to hide uncertainty behind design or summary language.",
];

const RESPONSIBLE_PATHS = [
  {
    href: "/research",
    title: "Use the research hub for curated entry",
    description:
      "Start with the research hub when the question is broad and you need the strongest route into thematic guides, flagship reports, explainers, and evidence paths.",
  },
  {
    href: "/reports",
    title: "Read reports as synthesis, then open the records underneath",
    description:
      "Reports are useful when you need a shareable summary page, but the next step should usually be the underlying president, promise, policy, or bill record.",
  },
  {
    href: "/sources",
    title: "Inspect the public source library",
    description:
      "Use the source library when you need to understand what kinds of evidence support a record, how often a source is linked, and where verification depth varies.",
  },
  {
    href: "/explainers",
    title: "Use explainers for legal and historical context",
    description:
      "Explainers are strongest when a record needs constitutional, institutional, or historical grounding before it can be interpreted well.",
  },
  {
    href: "/analysis/presidential-impact-on-black-americans",
    title: "Start with a thematic guide when the question is broad",
    description:
      "Analysis pages help users enter the record through a serious research question, then route into the right president, policy, legislation, or report paths.",
  },
];

const TRUST_PAGES = [
  {
    href: "/research",
    title: "Research Hub",
    description:
      "Use the research hub when a reader needs one curated page that bundles major thematic questions, reports, explainers, methods, and sources.",
  },
  {
    href: "/glossary",
    title: "Glossary",
    description:
      "Use the glossary when a reader needs plain-language definitions for page types, terms, and research concepts used across the site.",
  },
  {
    href: "/sources",
    title: "Sources and evidence",
    description:
      "Pair methodology with the source library when you need to inspect publisher mix, source types, and visible record linkage.",
  },
  {
    href: "/start",
    title: "How to use EquityStack",
    description:
      "Use the guided research path when a reader needs a structured orientation before they begin citing reports, records, or explainers.",
  },
  {
    href: "/reports",
    title: "Reports and analysis",
    description:
      "Open reports when you need a synthesized reading layer that still routes back into policies, promises, and supporting evidence.",
  },
  {
    href: "/explainers/equal-protection-under-the-law",
    title: "Flagship explainer: Equal Protection",
    description:
      "This is a strong companion page when a reader needs constitutional context alongside record interpretation.",
  },
];

const CITATION_ROUTING = [
  {
    title: "Cite methodology when the question is about how the site works",
    description:
      "Use this page when the reader needs to understand score construction, confidence, promise grading, limits, and the difference between records, reports, explainers, and thematic guides.",
    href: "/methodology",
  },
  {
    title: "Cite a report when the reader needs a synthesis page first",
    description:
      "Use a report when the task is to share a comparative or summary view, then pair it with methodology or linked records when the argument depends on the model or the evidence base.",
    href: "/reports",
  },
  {
    title: "Cite an explainer when the question is legal or historical context",
    description:
      "Use explainers when the topic needs constitutional, institutional, or long-run historical grounding before the reader can interpret a specific record or report.",
    href: "/explainers",
  },
  {
    title: "Cite the research hub when the reader needs a serious start page",
    description:
      "Use the research hub when the goal is to give someone one strong public gateway into thematic guides, flagship reports, methods, and evidence paths.",
    href: "/research",
  },
];

export default function MethodologyPage() {
  return (
    <main className="space-y-10">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Methodology" }],
            "/methodology"
          ),
          buildWebPageJsonLd({
            title: "How EquityStack organizes and interprets records",
            description:
              "Read how EquityStack organizes presidents, promises, policies, legislation, reports, explainers, narratives, and thematic research pages, and how to interpret scores, evidence, and known limits responsibly.",
            path: "/methodology",
            about: [
              "research methodology",
              "public records interpretation",
              "Black Impact Score",
              "promise grading",
              "source quality",
              "policy impact analysis",
            ],
            keywords: [
              "EquityStack methodology",
              "how EquityStack works",
              "Black Impact Score methodology",
              "promise tracker methodology",
              "policy records methodology",
            ],
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Methodology" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Methodology"
          title="How EquityStack organizes and interprets public records"
          description="EquityStack is a public research platform, not a black box. This page explains what the site measures, how its page types relate to one another, how scores and statuses should be interpreted, and where evidence or coverage limits still matter."
          actions={
            <>
              <Link href="/sources" className="dashboard-button-primary">
                Browse sources
              </Link>
              <Link href="/start" className="dashboard-button-secondary">
                Read the guided research path
              </Link>
            </>
          }
        />
      </section>

      <section className="grid gap-6 border-t border-[var(--line)] pt-6 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-white">What this page is for</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Use this page when you need to understand how EquityStack organizes presidents, promises, policies, bills, reports, explainers, narratives, and thematic research pages into one public reading system.
          </p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Why researchers cite it</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            This is the clearest public reference for how EquityStack defines score construction, promise grading, evidence thresholds, page roles, and known interpretive limits before a metric or summary is cited externally.
          </p>
        </div>
      </section>

      <CitationNote
        title="How to reference the methodology page"
        description="Use this page when citing how EquityStack organizes policy records, builds scores, grades promises, displays uncertainty, and distinguishes between record pages, explainers, reports, and thematic guides. Treat it as the main public reference for how the site should be read and interpreted."
      />

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Citation routing"
          title="Know when to cite methodology and when to cite another page instead"
          description="Methodology is strongest when it clarifies how the site works. It should sit alongside reports, explainers, and the research hub rather than replacing them."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CITATION_ROUTING.map((item) => (
            <Link key={item.href} href={item.href} className="panel-link p-4">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Record surfaces"
          value="8"
          description="Presidents, promises, policies, bills, reports, explainers, narratives, and thematic guides each serve a different interpretive role."
          tone="accent"
        />
        <KpiCard
          label="Score families"
          value="2"
          description="Direct and systemic score families stay separate so judicial downstream effects do not get mixed into direct policy credit."
        />
        <KpiCard
          label="Trust layers"
          value="4"
          description="Confidence, completeness, source quality, and certification status remain visible throughout the public site."
        />
        <KpiCard
          label="Evidence access"
          value="Nearby"
          description="The strongest public pages keep sources, methodology, and linked records close to the headline interpretation."
        />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="What EquityStack organizes"
          title="The site is built from several distinct public page types"
          description="Readers should not treat every page as the same kind of evidence. Some pages are closer to the record layer, while others are context, synthesis, or guided entry points."
        />
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
          {SITE_SURFACES.map((item) => (
            <article key={item.title}>
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="How to read the site"
          title="Different page types serve different interpretive jobs"
          description="EquityStack works best when readers move deliberately between records, context, synthesis, and research-entry pages rather than treating one page type as sufficient by itself."
        />
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-4">
          {READING_LAYERS.map((item) => (
            <article key={item.title}>
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-two-col-rail grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Record framing
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">How records are framed across the site</h2>
          <div className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            {FRAMING_RULES.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4"
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Why methodology matters
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">Context, categories, and limits change how a page should be read</h2>
          <div className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              Categories shape interpretation. A promise page, a policy page, and a report page may discuss the same administration, but they answer different questions.
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              Context matters because public records rarely interpret themselves. Historical explainers and narratives help readers understand significance without replacing documentary evidence.
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              Limits matter because not every historical period, institution, or policy area is equally complete in the current dataset. Transparency is part of the method, not a footnote.
            </div>
          </div>
        </div>
      </section>

      <section className="public-two-col-rail grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Presidential Black Impact Score
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">How presidential scoring works</h2>
          <div className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              Presidential Black Impact Score is derived from tracked policy impacts in the EquityStack dataset. It aggregates measured policy outcomes rather than campaign messaging or general reputation.
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              The score reflects the available structured record, not every action in a presidency. Source coverage, attribution limits, mixed-impact outcomes, and historical dataset gaps all affect interpretation.
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              Direct and systemic score families stay separate so judicial downstream effects do not silently blend into direct presidential policy credit.
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/presidents" className="dashboard-button-primary">
              Browse presidential records
            </Link>
            <Link href="/compare/presidents" className="dashboard-button-secondary">
              Compare presidents
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Source hierarchy
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">How the evidence layer works</h2>
          <ul className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            {SOURCE_RULES.map((item) => (
              <li key={item} className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
            Certification status is a concise trust signal. It reflects current source coverage, how complete the visible verification work is, and how much confidence the available evidence supports in the public dataset.
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Scoring dimensions"
          title="How metrics stay readable without hiding uncertainty"
          description="The site uses visible scoring rules and confidence layers so readers can understand what a metric is trying to summarize and what it cannot settle on its own."
        />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {SCORE_DIMENSIONS.map((item) => (
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

      <section className="public-two-col-rail grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Promise grading
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">Why promise status is shown separately</h2>
          <div className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              Promise tracking is based on documented commitments and observed policy outcomes in the current EquityStack dataset. Promise status tracks whether a public commitment was delivered, blocked, partially fulfilled, still in progress, or failed.
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              Promise status does not automatically mean positive impact. A delivered promise can still have mixed or negative downstream effects, and EquityStack keeps that distinction visible.
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              Promise-status assignments are constrained by available source coverage and implementation evidence. Promise pages therefore sit beside policy and score pages, not on top of them.
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Confidence and review status
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">How uncertainty stays visible</h2>
          <ul className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            {CONFIDENCE_NOTES.map((item) => (
              <li key={item} className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Limits and cautions"
          title="The method is strongest when its boundaries remain visible"
          description="EquityStack is designed to make uncertainty legible instead of hiding it behind a single score, narrative, or summary page."
        />
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
          {LIMITATIONS.map((item) => (
            <article key={item} className="border-l border-[var(--line)] pl-4">
              <p className="text-sm leading-7 text-[var(--ink-soft)]">{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="How to explore responsibly"
          title="Use companion pages to move from summary into verification"
          description="Methodology is most useful when readers pair it with reports, sources, explainers, and thematic guides instead of relying on a single page or one headline metric."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {RESPONSIBLE_PATHS.map((item) => (
            <Link key={item.href} href={item.href} className="panel-link p-4">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Related trust pages"
          title="Pair methodology with these citation-friendly reference pages"
          description="These are the strongest companion pages when you need to explain what EquityStack is, how it should be used, and where readers should verify the public record."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {TRUST_PAGES.map((item) => (
            <Link key={item.href} href={item.href} className="panel-link p-4">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
