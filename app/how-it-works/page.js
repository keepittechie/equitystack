import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
} from "@/app/components/public/core";
import { Panel, StatusPill } from "@/app/components/dashboard/primitives";
import TrustBar from "@/app/components/public/TrustBar";
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "How EquityStack Works",
  description:
    "A public explanation of how EquityStack evaluates policies and promises, structures evidence, uses Black Impact Score context, and shows incomplete analysis without overclaiming.",
  path: "/how-it-works",
  keywords: [
    "how EquityStack works",
    "Black Impact Score explained",
    "policy evidence methodology",
    "promise tracker methodology",
    "evidence coverage explained",
  ],
});

const WHAT_EQUITYSTACK_DOES = [
  {
    title: "Tracks promises through action and outcome",
    description:
      "EquityStack follows public commitments into linked actions, policy records, and outcome evidence so readers can see what was promised, what happened, and what can actually be supported.",
  },
  {
    title: "Connects claims to evidence",
    description:
      "The site keeps source-linked evidence close to policy and promise pages. That makes it possible to move from a summary or score into the supporting record without leaving the public page flow.",
  },
  {
    title: "Compares impact instead of rhetoric",
    description:
      "Comparison pages are built to inspect direction, evidence depth, and demographic-impact context side by side. They are meant to test political claims, not repeat them.",
  },
];

const POLICY_EVALUATION = [
  {
    title: "Black Impact Score",
    description:
      "The score is a compact summary of the current structured record. It uses documented outcomes and related evidence to help readers compare policies, but it is not meant to replace the underlying record.",
  },
  {
    title: "Impact direction",
    description:
      "Policies can be read as positive, negative, mixed, or blocked. This keeps the site from flattening every record into a simple good-or-bad claim when the documented effects are more uneven.",
  },
  {
    title: "Demographic-impact rows",
    description:
      "These rows show the clearest measurable Black-impact facts attached to the policy: direct outcomes when available, plus supporting demographic or program evidence when that is the stronger path.",
  },
];

const PROMISE_EVALUATION = [
  {
    title: "Promises are not scored as slogans",
    description:
      "A promise page starts with the commitment and its delivery status, but the Black-impact layer comes from linked actions, outcomes, and evidence rather than from the promise text alone.",
  },
  {
    title: "Impact is derived from real actions and results",
    description:
      "When a promise is tied to a policy or a measurable outcome, EquityStack can show Black-impact context through that delivery path. When the path is weak or incomplete, the site leaves that visible instead of guessing.",
  },
];

const EVIDENCE_TYPES = [
  {
    label: "Direct outcome evidence",
    tone: "verified",
    description:
      "These are the strongest rows: measured changes in coverage, participation, sentencing, registration, poverty, or other outcomes that can be tied to the record with credible sources.",
  },
  {
    label: "Supporting and contextual evidence",
    tone: "info",
    description:
      "These rows help explain why a policy or promise matters for Black Americans when the best available data is a usage pattern, beneficiary share, exposure pattern, or other narrower contextual signal.",
  },
];

const COVERAGE_LEVELS = [
  {
    label: "Early analysis",
    tone: "warning",
    description:
      "Some structured evidence has been added, but the record is still thin. Readers should treat the interpretation as provisional and expect more sourcing or stronger program-level evidence to be needed.",
  },
  {
    label: "Developing evidence base",
    tone: "info",
    description:
      "The record has a meaningful evidence layer, but it is still incomplete. There may be solid direct evidence, supporting evidence, or score coverage, but not yet the full combination.",
  },
  {
    label: "Well-supported analysis",
    tone: "verified",
    description:
      "The page has a stronger combination of score coverage, demographic-impact rows, and linked sources. This signals a fuller public analytical layer, not a guarantee that every historical question has been closed.",
  },
];

const DOES_NOT_DO = [
  "It does not force a conclusion when the evidence is weak, thin, or too causally indirect.",
  "It does not treat promise delivery as proof of positive impact on its own.",
  "It does not assume causality where a source only supports broader context or partial attribution.",
  "It does not hide gaps. Missing coverage, limited evidence, and developing analysis remain visible on the page.",
];

const POLICY_PAGE_STEPS = [
  {
    title: "Start with the score and direction",
    description:
      "These give a quick read of the current record, but they are only the top layer of the page.",
  },
  {
    title: "Read the demographic-impact section",
    description:
      "Look for direct outcome rows first, then supporting evidence. The distinction matters because not every strong interpretation starts from the same kind of proof.",
  },
  {
    title: "Check sources and notes",
    description:
      "Every impact row should have linked sources, with notes that explain what the source supports and what it does not.",
  },
  {
    title: "Use the coverage label",
    description:
      "Coverage tells you how complete the analysis is so far. It is a statement about the state of the evidence layer, not about whether a policy is morally right or wrong.",
  },
];

function TextCard({ title, description, eyebrow = null }) {
  return (
    <Panel padding="md" className="h-full">
      {eyebrow ? (
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
    </Panel>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "How it works" }],
            "/how-it-works"
          ),
          buildWebPageJsonLd({
            title: "How EquityStack Works",
            description:
              "A reader-facing explanation of how EquityStack evaluates policies and promises, structures evidence, uses Black Impact Score context, and handles incomplete analysis.",
            path: "/how-it-works",
            about: [
              "Black Impact Score",
              "policy evaluation",
              "promise tracking",
              "demographic impact evidence",
              "evidence coverage",
            ],
            keywords: [
              "how EquityStack works",
              "Black Impact Score explained",
              "policy evidence methodology",
              "promise analysis methodology",
            ],
          }),
        ]}
      />

      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "How it works" }]} />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="How EquityStack works"
          title="A public guide to scoring, evidence, and incomplete analysis"
          description="EquityStack is designed to show how promises, policies, outcomes, and public evidence connect. This page explains the system in plain language: what gets evaluated, what the score means, how evidence is structured, and why some records remain intentionally incomplete."
          actions={
            <>
              <Link href="/research/how-black-impact-score-works" className="dashboard-button-primary">
                Read the score explainer
              </Link>
              <Link href="/methodology" className="dashboard-button-secondary">
                Open full methodology
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
          <SectionIntro
            eyebrow="What EquityStack does"
            title="It follows the public record from promise to impact"
            description="The site is built to help readers trace a political claim into the record, then into the evidence underneath it."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {WHAT_EQUITYSTACK_DOES.map((item) => (
              <TextCard key={item.title} title={item.title} description={item.description} />
            ))}
          </div>
        </div>
        <PageContextBlock
          title="What this page is for"
          description="Use this page when you need the clearest public explanation of how EquityStack reads policies and promises without turning the site into a technical manual."
          detail="If you need the deeper rules behind site architecture, scoring inputs, or model boundaries, the full methodology and score-explainer pages go further."
        />
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Policies"
          title="How policies are evaluated"
          description="A policy page combines score context, impact direction, demographic-impact rows, and linked sources. The goal is to help readers understand what the record shows, not just how the policy was described politically."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {POLICY_EVALUATION.map((item) => (
            <TextCard key={item.title} title={item.title} description={item.description} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Promises"
          title="How promises are evaluated"
          description="Promise pages are accountability pages first. They show whether a commitment was delivered, partially delivered, blocked, or broken, while the Black-impact layer comes from outcomes and evidence tied to what actually happened."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {PROMISE_EVALUATION.map((item) => (
            <TextCard key={item.title} title={item.title} description={item.description} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Evidence"
          title="How evidence works"
          description="EquityStack uses more than one kind of evidence, but it does not treat every type as interchangeable. That distinction helps the site stay readable without overstating what a source proves."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {EVIDENCE_TYPES.map((item) => (
            <Panel key={item.label} padding="md" className="h-full">
              <StatusPill tone={item.tone}>{item.label}</StatusPill>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Panel>
          ))}
        </div>
        <MethodologyCallout
          title="Why this distinction matters"
          description="Direct outcome evidence usually carries the clearest causal or measured signal. Supporting evidence can still be important, but it is labeled as supporting or contextual so the reader can see how far the claim really goes."
          href="/sources"
          linkLabel="Browse public sources"
        />
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Evidence coverage"
          title="What evidence coverage means"
          description="Coverage labels describe how complete the visible analytical layer is so far. They do not tell readers what conclusion they must reach."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {COVERAGE_LEVELS.map((item) => (
            <Panel key={item.label} padding="md" className="h-full">
              <StatusPill tone={item.tone}>{item.label}</StatusPill>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Panel>
          ))}
        </div>
        <CitationNote
          title="How to read the coverage label"
          description="Treat evidence coverage as a statement about completeness, not correctness. A well-supported analysis can still be debated. An early analysis may still point in a serious direction, but the site is telling you the record is not fully built out yet."
        />
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Limits"
          title="What this system does not do"
          description="The site is more trustworthy when it is clear about its limits. EquityStack is built to keep gaps and uncertainty visible rather than smoothing them away."
        />
        <ul className="grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
          {DOES_NOT_DO.map((item) => (
            <li
              key={item}
              className="rounded-[1.2rem] border border-[var(--line)] bg-[rgba(11,20,33,0.92)] px-4 py-4"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Reading guide"
          title="How to read a policy page"
          description="A policy page works best when it is read top to bottom: summary first, then score context, then the demographic-impact evidence, then the source trail."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {POLICY_PAGE_STEPS.map((item) => (
            <TextCard
              key={item.title}
              title={item.title}
              description={item.description}
              eyebrow="Policy page"
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel padding="md">
          <h2 className="text-xl font-semibold text-white">Read next</h2>
          <div className="mt-4 grid gap-3">
            <Link href="/research/how-black-impact-score-works" className="panel-link p-4">
              <h3 className="text-lg font-semibold text-white">How the Black Impact Score Works</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Use the score explainer when you want the deeper public explanation of how the score is built without reading internal implementation code.
              </p>
            </Link>
            <Link href="/methodology" className="panel-link p-4">
              <h3 className="text-lg font-semibold text-white">Full methodology</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Open the broader methodology page when the question turns to page types, site structure, research layers, or wider methodological rules.
              </p>
            </Link>
          </div>
        </Panel>
        <Panel padding="md">
          <h2 className="text-xl font-semibold text-white">Good companion pages</h2>
          <div className="mt-4 grid gap-3">
            <Link href="/sources" className="panel-link p-4">
              <h3 className="text-lg font-semibold text-white">Sources</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Inspect the public source layer when you want to verify the evidence attached to records rather than relying on summary text alone.
              </p>
            </Link>
            <Link href="/research" className="panel-link p-4">
              <h3 className="text-lg font-semibold text-white">Research hub</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                Return to the research hub when you want the strongest route into thematic guides, flagship reports, explainers, and methods.
              </p>
            </Link>
          </div>
        </Panel>
      </section>
    </main>
  );
}
