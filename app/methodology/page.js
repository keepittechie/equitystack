import { buildPageMetadata } from "@/lib/metadata";
import Link from "next/link";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { KpiCard, SectionIntro } from "@/app/components/public/core";

export const metadata = buildPageMetadata({
  title: "Methodology",
  description:
    "Read how EquityStack handles Black Impact Score logic, promise grading, confidence, source quality, and known limitations.",
  path: "/methodology",
});

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
  "Methodology pages exist to make the system auditable, not to hide uncertainty behind design.",
];

const LIMITATIONS = [
  "The dataset is still incomplete in some historical periods and policy areas.",
  "Intent coverage is improving, but not every historical policy is classified yet.",
  "Judicial attribution is handled separately because appointment-driven downstream effects should not be blended into direct policy credit.",
  "A score is a structured summary, not a replacement for reading the underlying record and sources.",
];

const DATA_LIMITATION_SECTIONS = [
  {
    title: "Dataset incompleteness",
    description:
      "Coverage varies across time, topic, and institution. Some historical periods have stronger documentation and curation than others, so absence in the dataset should not be read as absence in history.",
  },
  {
    title: "Interpretation limits",
    description:
      "Scores and statuses summarize the current structured record. They help compare patterns in documented policy impact, but they do not replace reading the underlying policy record, evidence, and historical context.",
  },
  {
    title: "Attribution challenges",
    description:
      "Attributing policy impact across branches and over time is difficult. EquityStack separates direct and systemic score families, keeps judicial attribution distinct, and does not silently resolve ambiguous causality.",
  },
];

const CONFIDENCE_NOTES = [
  "Very low confidence usually means the score rests on one or two included outcomes and should be treated as provisional.",
  "Low and medium confidence still appear publicly so incomplete records remain inspectable instead of disappearing from view.",
  "High confidence means the included outcomes have stronger source support, better completeness, and enough coverage to reduce volatility.",
];

export default function MethodologyPage() {
  return (
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Methodology" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          eyebrow="Methodology"
          title="Transparent scoring, visible uncertainty, and evidence-first interpretation."
          description="EquityStack is built as a public civic intelligence platform, which means every headline metric must stay close to methodology, evidence, and known limitations. This page explains the scoring architecture the site uses and what it does not claim."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Score families" value="2" description="Direct and systemic scores stay separate so judicial downstream effects do not get mixed into direct presidential policy credit." tone="accent" />
        <KpiCard label="Trust layers" value="4" description="Confidence, completeness, source quality, and certification status remain visible throughout the public site." />
        <KpiCard label="Time-aware" value="Yes" description="Outcomes can be read by year, date range, duration estimate, and change-over-time summaries." />
        <KpiCard label="Evidence access" value="Nearby" description="Every score-oriented page keeps evidence and methodology links close to the headline number." />
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {SCORE_DIMENSIONS.map((item) => (
          <article key={item.title} className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[1.8rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Presidential Black Impact Score</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">How presidential scoring works</h2>
          <div className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Presidential Black Impact Score is derived from tracked policy impacts in the EquityStack dataset. It aggregates measured policy outcomes rather than campaign messaging or general reputation.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              The score reflects the available structured record, not every action in a presidency. Source coverage, attribution limits, mixed-impact outcomes, and historical dataset gaps all affect interpretation.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Direct and systemic score families stay separate so judicial downstream effects do not silently blend into direct presidential policy credit.
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/presidents" className="public-button-primary">
              Open presidential ranking
            </Link>
            <Link href="/compare/presidents" className="public-button-secondary">
              Compare presidents
            </Link>
          </div>
        </div>
        <div className="rounded-[1.8rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Source hierarchy</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">How the evidence layer works</h2>
          <ul className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            {SOURCE_RULES.map((item) => (
              <li key={item} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1.8rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Limitations</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">What the site does not pretend away</h2>
          <ul className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            {LIMITATIONS.map((item) => (
              <li key={item} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Data limitations"
          title="Limits that matter when reading the site"
          description="EquityStack is designed to make uncertainty and incomplete coverage visible rather than burying them."
        />
        <div className="grid gap-5 md:grid-cols-3">
          {DATA_LIMITATION_SECTIONS.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-[1.8rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Promise grading</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">Why promise status is shown separately</h2>
          <div className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Promise status tracks whether a public commitment was delivered, blocked, partially fulfilled, still in progress, or failed.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Promise status does not automatically mean positive impact. A delivered promise can still have mixed or negative downstream effects, and EquityStack keeps that distinction visible.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              Promise pages therefore sit beside policy and score pages, not on top of them.
            </div>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Confidence and review status</p>
          <h2 className="mt-4 text-2xl font-semibold text-white">How uncertainty stays visible</h2>
          <ul className="mt-5 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            {CONFIDENCE_NOTES.map((item) => (
              <li key={item} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
