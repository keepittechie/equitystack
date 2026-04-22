import Image from "next/image";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchHomePageData, buildPolicySlug } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import {
  SectionIntro,
  KpiCard,
  SourceTrustPanel,
} from "@/app/components/public/core";
import { PolicyCardList } from "@/app/components/public/entities";
import {
  Panel,
  SectionHeader,
  StatusPill,
  getPromiseStatusTone,
} from "@/app/components/dashboard/primitives";
import TrustBar from "@/app/components/public/TrustBar";
import {
  buildCollectionPageJsonLd,
  buildDatasetJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Track promises, policies, and Black impact evidence",
  description:
    "EquityStack connects campaign promises, policy records, Black Impact Score summaries, demographic-impact evidence, and public sources in one research system focused on Black Americans.",
  path: "/",
  imagePath: "/images/hero/civil-rights-march.jpg",
  keywords: [
    "Black impact score",
    "policy impact on Black Americans",
    "campaign promises to Black Americans",
    "demographic impact evidence",
    "public policy research",
  ],
});

const HOW_IT_WORKS_STEPS = [
  {
    title: "Start with a record",
    summary:
      "Open a policy or promise page to see the summary, status, score context, related records, and source trail in one place.",
  },
  {
    title: "Read impact in layers",
    summary:
      "EquityStack keeps direct measured outcomes, supporting demographic evidence, and broader editorial context separate instead of flattening them into one claim.",
  },
  {
    title: "Keep uncertainty visible",
    summary:
      "Evidence coverage labels, confidence notes, and source counts show when analysis is early, developing, or well supported.",
  },
  {
    title: "Compare before concluding",
    summary:
      "Use comparison pages to read score, direction, and evidence side by side rather than relying on rhetoric or isolated anecdotes.",
  },
];

const TRUST_PILLARS = [
  {
    title: "Sources stay attached to the record",
    summary:
      "Policy, promise, and demographic-impact pages keep linked public sources close to the claim instead of hiding the evidence layer behind a separate workflow.",
  },
  {
    title: "Promises and outcomes are not conflated",
    summary:
      "Promise delivery remains an accountability layer. Black impact is evaluated through linked outcomes and evidence, not promise status alone.",
  },
  {
    title: "Weak evidence does not get forced into certainty",
    summary:
      "The system is designed to stop at provisional or mixed analysis when the sourcing or attribution path is still thin.",
  },
];

const ENTRY_POINTS = [
  {
    href: "/policies",
    label: "Policy records",
    tone: "info",
    title: "Explore policies",
    summary:
      "Browse laws, executive actions, court decisions, and agency actions with Black Impact Score framing, demographic-impact evidence, and source-linked context.",
    cta: "Open policy records",
  },
  {
    href: "/promises",
    label: "Promise tracker",
    tone: "verified",
    title: "Track promises",
    summary:
      "Track commitments, delivery status, linked actions, outcomes, and promise-level Black-impact analysis where the evidence is strong enough to support it.",
    cta: "Track promise records",
  },
  {
    href: "/compare/policies",
    label: "Comparison",
    tone: "default",
    title: "Compare impact",
    summary:
      "Read policies side by side by impact score, direction, evidence coverage, and demographic-impact highlights without turning the site into a dashboard.",
    cta: "Compare impact across policies",
  },
  {
    href: "/how-it-works",
    label: "Methodology",
    tone: "default",
    title: "Review methods and evidence",
    summary:
      "See how EquityStack distinguishes direct evidence, supporting context, source quality, incomplete analysis, and limits of attribution.",
    cta: "Read how it works",
  },
];

const FLAGSHIP_EXAMPLES = [
  {
    href: "/policies/160-president-s-budget-fiscal-year-2027",
    label: "Policy record",
    tone: "danger",
    title: "President's Budget, Fiscal Year 2027",
    summary:
      "A current proposed-policy case showing direct funding cuts, supporting demographic evidence, source links, and analysis-coverage treatment in one record.",
    badges: [
      { label: "Proposed", tone: "contested" },
      { label: "Negative impact path", tone: "danger" },
    ],
    cta: "Open the FY2027 budget record",
  },
  {
    href: "/policies/6-voting-rights-act-of-1965",
    label: "Policy record",
    tone: "verified",
    title: "Voting Rights Act of 1965",
    summary:
      "A strong historical example with direct Black voter-registration outcomes and longer-run supporting evidence kept clearly separate.",
    badges: [
      { label: "Historical", tone: "default" },
      { label: "Positive impact", tone: "success" },
    ],
    cta: "Open the Voting Rights Act record",
  },
  {
    href: "/policies/88-g-i-bill-servicemen-s-readjustment-act",
    label: "Policy record",
    tone: "warning",
    title: "G.I. Bill (Servicemen's Readjustment Act)",
    summary:
      "A mixed-impact case showing why EquityStack models gains and unequal access separately instead of forcing one clean conclusion.",
    badges: [
      { label: "Historical", tone: "default" },
      { label: "Mixed impact", tone: "contested" },
    ],
    cta: "Open the G.I. Bill record",
  },
  {
    href: "/promises/johnson-pass-voting-rights-act-after-selma",
    label: "Promise record",
    tone: "verified",
    title: "Pass the Voting Rights Act after Selma",
    summary:
      "A flagship delivered promise connected to a major civil-rights law and promise-level demographic-impact evidence tied to the record it produced.",
    badges: [
      { label: "Delivered", tone: "success" },
      { label: "Voting rights", tone: "default" },
    ],
    cta: "Open the promise record",
  },
  {
    href: "/promises/trump-first-step-act",
    label: "Promise record",
    tone: "verified",
    title: "Pass federal criminal justice reform",
    summary:
      "A delivered promise where the Black-impact case is built from narrow, high-quality sentencing evidence rather than broad criminal-justice claims.",
    badges: [
      { label: "Delivered", tone: "success" },
      { label: "Criminal justice", tone: "default" },
    ],
    cta: "Open the promise record",
  },
  {
    href: "/promises/biden-expand-child-tax-credit",
    label: "Promise record",
    tone: "warning",
    title: "Expand the Child Tax Credit and make it fully refundable",
    summary:
      "A partial-delivery promise showing how EquityStack separates a real temporary Black-impact outcome from the fact that the fuller promise was not made permanent.",
    badges: [
      { label: "Partial", tone: "warning" },
      { label: "Economic policy", tone: "default" },
    ],
    cta: "Open the promise record",
  },
];

const CONTINUE_READING = [
  {
    href: "/research",
    title: "Research hub",
    summary:
      "Use the curated hub when you need the strongest routes into thematic guides, flagship reports, explainers, methods, and source-backed research paths.",
    cta: "Open the research hub",
  },
  {
    href: "/start",
    title: "How to use EquityStack",
    summary:
      "Share the guided reading path when a first-time visitor needs a structured route through the site before opening specific records.",
    cta: "Open the guided path",
  },
  {
    href: "/reports/black-impact-score",
    title: "Black Impact Score report",
    summary:
      "Start here when you want the flagship comparative frame, then move back into policies, promises, and sources underneath the report.",
    cta: "Read the flagship report",
  },
  {
    href: "/about",
    title: "About EquityStack",
    summary:
      "Use the About page when the reader needs a concise explanation of what the platform is, why it exists, and what it does not claim to do.",
    cta: "Read about EquityStack",
  },
];

function pct(value) {
  const numeric = Number(value || 0);
  return `${Math.round(numeric * 100)}%`;
}

function HomeLinkCard({ href, label, tone = "default", title, summary, cta, badges = [] }) {
  return (
    <Panel
      as={Link}
      href={href}
      padding="md"
      interactive
      className="flex h-full flex-col"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusPill tone={tone}>{label}</StatusPill>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
          Open
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{summary}</p>
      {badges.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge) => (
            <StatusPill key={`${title}-${badge.label}`} tone={badge.tone || "default"}>
              {badge.label}
            </StatusPill>
          ))}
        </div>
      ) : null}
      <span className="mt-auto inline-flex pt-4 text-[12px] font-semibold text-[var(--ink-soft)]">
        {cta}
      </span>
    </Panel>
  );
}

function PromisePreviewGrid({ items = [] }) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-[rgba(18,31,49,0.32)] p-4 text-sm leading-7 text-[var(--ink-soft)]">
        No promise records are available in this view yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((item) => (
        <Panel
          key={item.id}
          as={Link}
          href={`/promises/${item.slug}`}
          padding="md"
          interactive
          className="flex h-full flex-col"
        >
          <div className="flex items-start justify-between gap-4">
            <StatusPill tone={getPromiseStatusTone(item.status)}>{item.status || "Promise"}</StatusPill>
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              Open promise
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
          {item.summary ? (
            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{item.summary}</p>
          ) : null}
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <StatusPill tone="default">{item.president || "Presidential record"}</StatusPill>
            {item.topic ? <StatusPill tone="default">{item.topic}</StatusPill> : null}
            <StatusPill tone="info">{item.source_count ?? 0} sources</StatusPill>
          </div>
        </Panel>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const { scores, readiness, featuredPolicies, recentPromises } = await fetchHomePageData();
  const trust = scores.metadata?.trust || {};

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildCollectionPageJsonLd({
            title: "EquityStack home",
            description:
              "A public-interest research platform for tracking campaign promises, policy records, Black Impact Scores, demographic-impact evidence, and public sources related to Black Americans.",
            path: "/",
            about: [
              "Black Americans",
              "campaign promises",
              "policy impact",
              "demographic evidence",
              "public-interest research",
            ],
            keywords: [
              "Black Impact Score",
              "policy impact on Black Americans",
              "campaign promises to Black Americans",
            ],
          }),
          buildDatasetJsonLd({
            title: "EquityStack public policy and promise dataset",
            description:
              "Structured public records used by EquityStack to connect presidents, promises, policies, demographic-impact evidence, reports, and historical context affecting Black Americans.",
            path: "/",
            about: [
              "Black Americans",
              "campaign promises",
              "policy records",
              "demographic impact evidence",
            ],
            keywords: [
              "Black impact evidence",
              "promise tracker",
              "policy impact dataset",
            ],
            variableMeasured: [
              "Black Impact Score",
              "Promise status",
              "Impact direction",
              "Analysis coverage",
              "Source coverage",
            ],
          }),
        ]}
      />

      <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-white/8 bg-[#040911]">
        <div className="absolute inset-0">
          <Image
            src="/images/hero/civil-rights-march.jpg"
            alt=""
            fill
            priority
            aria-hidden="true"
            className="object-cover object-center md:object-[center_38%] scale-[1.02]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[rgba(0,0,0,0.55)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,8,14,0.36),rgba(3,8,14,0.84))]" />
        </div>

        <div className="relative mx-auto flex min-h-[78vh] max-w-[1500px] items-center px-5 py-16 xl:px-8">
          <div className="max-w-4xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              Policies, promises, and evidence
            </p>
            <h1 className="mt-5 max-w-4xl text-[clamp(2.8rem,7vw,6.2rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-white">
              Track how government actions affect Black Americans
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[#d8e2ee] md:text-lg">
              EquityStack connects campaign promises, policy records, Black Impact
              Score summaries, demographic-impact evidence, and public sources in one
              research system. It shows what is well supported, what is still
              developing, and where the analysis stops.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Policies and promises stay linked",
                "Evidence coverage stays visible",
                "Comparison starts from sources",
              ].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-[rgba(4,10,18,0.62)] px-3 py-1.5 text-[11px] font-medium tracking-[0.06em] text-[#d8e2ee] backdrop-blur-sm"
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/policies" className="public-button-primary">
                Explore policies
              </Link>
              <Link href="/promises" className="public-button-secondary">
                Track promises
              </Link>
              <Link href="/compare/policies" className="public-button-secondary">
                Compare impact
              </Link>
              <Link href="/how-it-works" className="public-button-secondary">
                Read how it works
              </Link>
            </div>
          </div>
        </div>

        <p className="absolute bottom-4 right-5 z-10 rounded-full border border-white/10 bg-[rgba(4,10,18,0.72)] px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] text-[#d8e2ee] backdrop-blur-sm xl:right-8">
          March on Washington for Jobs and Freedom, 1963
        </p>
      </section>

      <TrustBar />

      <section>
        <Panel className="overflow-hidden">
          <SectionHeader
            eyebrow="How EquityStack works"
            title="Read promises, policies, outcomes, and evidence without losing the thread"
            description="The site is built to help a new visitor move from a public claim into the underlying record, then into evidence, limits, and comparison. It is not designed to flatten everything into one headline score."
          />
          <div className="grid gap-6 p-4 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              {HOW_IT_WORKS_STEPS.map((item) => (
                <article key={item.title} className="border-l border-[var(--line)] pl-4">
                  <h2 className="text-base font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{item.summary}</p>
                </article>
              ))}
            </div>
            <div className="grid gap-4 border-t border-[var(--line)] pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
              {TRUST_PILLARS.map((item) => (
                <article key={item.title} className="border-l border-[var(--line)] pl-4">
                  <StatusPill tone="verified">Trust signal</StatusPill>
                  <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{item.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Choose your path"
          title="Start with the part of the public record that matches your question"
          description="EquityStack covers both policies and promises, then gives readers a way to compare records and inspect the method behind them."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {ENTRY_POINTS.map((item) => (
            <HomeLinkCard key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Flagship examples"
          title="Open the clearest examples already live in the system"
          description="These records show how EquityStack handles proposed harms, historical gains, reform outcomes, mixed evidence, delivered promises, and partial delivery without forcing one narrative across every case."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FLAGSHIP_EXAMPLES.map((item) => (
            <HomeLinkCard key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Live records"
          title="Open current policy and promise records right away"
          description="The homepage now gives equal visibility to the policy record layer and the promise tracker so new visitors can move directly into the public record."
        />
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <SectionIntro
              eyebrow="Policies"
              title="Top policy records"
              description="These are the strongest currently featured policy records in the live public dataset."
            />
            <PolicyCardList
              items={featuredPolicies.slice(0, 4)}
              buildHref={(item) => `/policies/${buildPolicySlug(item)}`}
            />
          </div>
          <div className="space-y-4">
            <SectionIntro
              eyebrow="Promises"
              title="Current promise records"
              description="These promise records give visitors a direct path into delivery status, linked actions, outcomes, and any promise-level Black-impact analysis already added."
            />
            <PromisePreviewGrid items={recentPromises.slice(0, 4)} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Current public coverage"
          title="See how much of the live record is already measurable and source-backed"
          description="Coverage and trust signals belong on the homepage, but they stay subordinate to the record itself. This is the quickest way to understand how complete the current analytical layer is."
          actions={
            <>
              <Link href="/reports/black-impact-score" className="dashboard-button-secondary">
                Read the flagship report
              </Link>
              <Link href="/sources" className="dashboard-button-secondary">
                Inspect sources
              </Link>
            </>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Tracked outcomes"
            value={readiness.total_policy_outcomes}
            delta={`${readiness.current_admin_outcomes} current-admin / ${readiness.legislative_outcomes} legislative`}
            description="The public scoring and evidence layer runs on unified outcomes rather than disconnected record silos."
            tone="accent"
          />
          <KpiCard
            label="Source coverage"
            value={pct(readiness.source_coverage_pct)}
            delta={`${readiness.sourced_outcomes} sourced`}
            description="Source coverage is visible up front so readers can see how much of the current record is evidence-backed."
          />
          <KpiCard
            label="Intent coverage"
            value={pct(readiness.intent_coverage_pct)}
            delta={`${readiness.intent_classified_policies} classified`}
            description="Policy intent remains distinct from outcome, and missing classifications stay visible rather than guessed."
          />
          <KpiCard
            label="Certification status"
            value={readiness.certification_status}
            delta={`${pct(readiness.high_confidence_outcome_pct)} high confidence`}
            description="Trust status reflects whether the public dataset is complete, sourced, and internally consistent."
          />
        </div>

        <SourceTrustPanel
          sourceCount={readiness.sourced_outcomes}
          sourceQuality="System-wide coverage"
          confidenceLabel={`${pct(readiness.high_confidence_outcome_pct)} high confidence`}
          completenessLabel={`${pct(trust.incomplete_outcome_percentage || 0)} incomplete`}
          includedCount={scores.metadata?.outcomes_included_in_score}
          excludedCount={scores.metadata?.outcomes_excluded_from_score}
          summary={
            scores.metadata?.summary_interpretation ||
            "EquityStack shows source coverage, confidence, and incomplete analysis directly in the public interface so readers can judge how much of the record is ready for interpretation."
          }
        />
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Keep reading"
          title="Use the supporting public pages when you need broader framing or stronger verification"
          description="The homepage should get a new visitor oriented. These pages help when the next step is method, context, explanation, or a stronger research handoff."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CONTINUE_READING.map((item) => (
            <HomeLinkCard
              key={item.href}
              href={item.href}
              label="Public guide"
              tone="default"
              title={item.title}
              summary={item.summary}
              cta={item.cta}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
