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
import { buildBreadcrumbJsonLd, buildWebPageJsonLd } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "How the Black Impact Score Works | EquityStack",
  description:
    "A public, structured explanation of what the Black Impact Score measures, how it is calculated, what data it uses, what it excludes, and where uncertainty still matters.",
  path: "/research/how-black-impact-score-works",
  keywords: [
    "how the Black Impact Score works",
    "Black Impact Score methodology",
    "EquityStack score transparency",
    "policy outcome scoring",
    "Black policy impact score explanation",
  ],
});

const DIRECT_IMPACT_ITEMS = [
  {
    label: "Positive",
    value: "1.00",
    tone: "positive",
    description: "Documented outcomes that moved conditions in a more beneficial direction for Black Americans.",
  },
  {
    label: "Negative",
    value: "-1.00",
    tone: "negative",
    description: "Documented outcomes that harmed conditions, protections, access, or institutional standing.",
  },
  {
    label: "Mixed",
    value: "0.25",
    tone: "mixed",
    description: "Outcomes with real gains and real harms, or outcomes where the current record does not justify a full directional claim.",
  },
  {
    label: "Blocked",
    value: "0.00",
    tone: "blocked",
    description: "Blocked or failed outcomes remain visible, but they do not receive a positive or negative direct directional contribution.",
  },
];

const INTENT_ITEMS = [
  {
    label: "equity_expanding",
    modifier: "1.10x",
    tone: "positive",
    description: "The policy was designed to expand rights, access, protection, or material support.",
  },
  {
    label: "equity_restricting",
    modifier: "0.90x",
    tone: "negative",
    description: "The policy was designed to restrict rights, access, protections, or equal standing.",
  },
  {
    label: "neutral_administrative",
    modifier: "1.00x",
    tone: "default",
    description: "The policy mostly changed administrative structure, procedure, or implementation mechanics without a clear equity-expanding or restrictive aim.",
  },
  {
    label: "mixed_or_competing",
    modifier: "0.95x",
    tone: "mixed",
    description: "The policy had competing aims or the available record supports more than one plausible intent interpretation.",
  },
  {
    label: "unclear",
    modifier: "1.00x",
    tone: "blocked",
    description: "Intent has not been deterministically classified or the evidence is too thin to support a stronger claim.",
  },
];

const SYSTEMIC_ITEMS = [
  {
    label: "limited",
    multiplier: "0.90x",
    tone: "blocked",
    description: "Bounded institutional effect with narrower long-run spillover.",
  },
  {
    label: "standard",
    multiplier: "1.00x",
    tone: "default",
    description: "Default setting when no stronger long-run structural case has been curated.",
  },
  {
    label: "strong",
    multiplier: "1.15x",
    tone: "positive",
    description: "Durable institutional or doctrinal effect across many people, years, or policy domains.",
  },
  {
    label: "transformational",
    multiplier: "1.30x",
    tone: "positive",
    description: "Foundational structural shift that changed a long-run legal, administrative, or enforcement framework.",
  },
  {
    label: "unclear",
    multiplier: "1.00x",
    tone: "mixed",
    description: "Reserved for rows where a stronger systemic claim is not yet justified.",
  },
];

const SCORE_COMPONENTS = [
  {
    title: "Direct impact",
    value: "impact score + direction",
    description:
      "The score starts with the measured outcome itself: what happened, how large the documented effect is, and whether it moved in a positive, negative, mixed, or blocked direction.",
  },
  {
    title: "Confidence",
    value: "0.60, 0.80, or 1.00",
    description:
      "Current production reporting scales confidence from linked evidence. Rows with zero linked sources are dampened most, one-source rows are dampened moderately, and rows with two or more linked sources receive full confidence weight.",
  },
  {
    title: "Intent modifier",
    value: "0.90x to 1.10x",
    description:
      "Intent changes interpretation, not the underlying reality. It adjusts how strongly the model reads a scored outcome once intent has been deterministically curated.",
  },
  {
    title: "Systemic multiplier",
    value: "0.90x to 1.30x",
    description:
      "Systemic weighting is a separate layer for durable structural effects. It defaults to 1.00 and is only applied when policy-level systemic metadata has been curated.",
  },
  {
    title: "Policy type weight",
    value: "current_admin 1.00",
    description:
      "Policy-type weighting keeps different outcome families from being treated as interchangeable. The live president score currently uses direct current-admin outcomes as the primary headline family.",
  },
];

const DATA_SOURCES = [
  {
    title: "Policies",
    description:
      "The policy record carries the law, executive action, or court decision title, year, category, impact direction context, intent category, and any curated systemic metadata.",
  },
  {
    title: "Policy outcomes",
    description:
      "This is the canonical scoring layer. Each scored row is a documented outcome with an outcome summary, impact direction, source linkage, and score-ready metadata.",
  },
  {
    title: "Sources and evidence",
    description:
      "Linked sources determine whether an outcome is eligible for numeric scoring and affect the confidence layer. Source presence is not cosmetic; it changes whether a row can count.",
  },
  {
    title: "Promise actions for modern administrations",
    description:
      "For current-administration scoring, promise actions provide the canonical bridge from modern administration outcomes back to related historical policies so intent and systemic metadata can be resolved safely.",
  },
];

const INCLUDED_ITEMS = [
  "Documented outcomes with a written outcome summary, a recognized impact direction, and canonical source linkage.",
  "Current-administration outcomes that have a grounded path into the scoring layer through Promise Tracker records and evidence.",
  "Rows whose intent or systemic metadata can be resolved deterministically from a linked policy.",
];

const EXCLUDED_ITEMS = [
  "Outcomes without clear source-backed outcome detail or without a canonical evidence link.",
  "Policies that are classified for intent or systemic significance but do not yet have a scored outcome path.",
  "Legislative rows that exist in the unified outcome model but are still outside per-president scoring because deterministic attribution is not yet available.",
  "Any apparent match created only by numeric `policy_id` overlap rather than a real canonical relationship.",
];

const MISSING_REASON_ITEMS = [
  {
    title: "Missing canonical linkage",
    description:
      "A policy may be classified for intent or systemic effect but still not contribute if the score path cannot safely connect it to a current scored outcome.",
  },
  {
    title: "Outside the current score family",
    description:
      "Some rows belong to policy families that are intentionally not folded into the direct presidential headline score under the current model.",
  },
  {
    title: "No scored outcome materialized yet",
    description:
      "A historically important policy can exist in the policy layer without a current scored `policy_outcomes` row. Classification alone does not force it into the score.",
  },
];

const LIMITATION_ITEMS = [
  "Intent classification is curated, not guessed. Some rows remain `unclear`, and the model treats that as neutral rather than inventing confidence it does not have.",
  "Systemic coverage is still expanding. A policy can be historically central and still not carry systemic weighting if the structural case has not been curated yet.",
  "Some policies are classified but not scored because their canonical linkage path is still missing or because they remain outside the current president-scoring family.",
  "Judicial effects are handled separately from the direct headline score when explicit attribution exists. They matter, but they are not silently blended into direct presidential credit.",
];

const INTERPRETATION_ITEMS = [
  "A higher score means the current model reads the available evidence as more positive for Black Americans under that presidency. A lower score means the opposite.",
  "The score is comparative and model-bound. It is useful for structured comparison, not as an absolute moral verdict or a complete history of a presidency.",
  "Context still matters. One high-impact law, one long negative doctrine, or one thinly documented period can change how a score should be interpreted.",
  "The right way to use the score is to read the number, then inspect the linked outcomes, evidence, exclusions, and methodology around it.",
];

const NEXT_STEPS = [
  {
    href: "/reports/black-impact-score",
    title: "See the score in action",
    description: "Open the live Black Impact Score report and inspect how the model behaves on real records.",
  },
  {
    href: "/methodology",
    title: "Site methodology",
    description: "Read the broader site-wide methodology and page-type rules.",
  },
  {
    href: "/sources",
    title: "Sources and evidence",
    description: "Inspect the public evidence library behind the record layer.",
  },
  {
    href: "/research",
    title: "Research hub",
    description: "Return to the broader research navigation layer.",
  },
];

function badgeClasses(tone = "default") {
  if (tone === "positive") {
    return "border-[rgba(132,247,198,0.22)] bg-[rgba(11,58,50,0.62)] text-[var(--success)]";
  }
  if (tone === "negative") {
    return "border-[rgba(255,138,138,0.22)] bg-[rgba(63,16,24,0.62)] text-[var(--danger)]";
  }
  if (tone === "mixed") {
    return "border-[rgba(245,203,92,0.24)] bg-[rgba(61,46,9,0.62)] text-[var(--warning)]";
  }
  if (tone === "blocked") {
    return "border-white/10 bg-white/5 text-[var(--ink-soft)]";
  }
  return "border-[rgba(96,165,250,0.18)] bg-[rgba(7,32,52,0.72)] text-[var(--accent)]";
}

function InlineBadge({ children, tone = "default" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${badgeClasses(tone)}`}>
      {children}
    </span>
  );
}

function SurfaceCard({ children, className = "" }) {
  return (
    <div className={`rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 ${className}`}>
      {children}
    </div>
  );
}

function MetaGrid({ items, valueKey }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <SurfaceCard key={item.label} className="h-full">
          <div className="flex flex-wrap items-center gap-2">
            <InlineBadge tone={item.tone}>{item.label}</InlineBadge>
            <span className="text-sm font-semibold text-white">{item[valueKey]}</span>
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
        </SurfaceCard>
      ))}
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul className="space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
      {items.map((item) => (
        <li key={item} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-3">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function HowBlackImpactScoreWorksPage() {
  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/research", label: "Research Hub" },
              { label: "How the Black Impact Score Works" },
            ],
            "/research/how-black-impact-score-works"
          ),
          buildWebPageJsonLd({
            title: "How the Black Impact Score Works",
            description:
              "A public explanation of what the Black Impact Score measures, how it is calculated, what it includes, what it excludes, and where uncertainty still matters.",
            path: "/research/how-black-impact-score-works",
            about: [
              "Black Impact Score",
              "policy outcomes",
              "policy intent",
              "systemic impact",
              "source-backed scoring",
            ],
            keywords: [
              "How the Black Impact Score works",
              "Black Impact Score methodology",
              "policy outcome scoring",
              "systemic impact weighting",
            ],
          }),
        ]}
      />

      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/research", label: "Research Hub" },
          { label: "How the Black Impact Score Works" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Score Transparency"
          title="How the Black Impact Score works"
          description="The Black Impact Score exists to answer a simple question: what did policies actually do, not just what was promised, and how did those outcomes affect Black Americans over time? This page explains the score as a public model, not as branding language. It shows what the score measures, how the calculation works, what data it depends on, what the score excludes, and where uncertainty still matters."
          actions={
            <>
              <Link href="/reports/black-impact-score" className="public-button-primary">
                See the score in action
              </Link>
              <Link href="/methodology" className="public-button-secondary">
                Read broader methodology
              </Link>
            </>
          }
        />
      </section>

      <section className="public-two-col-rail grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          title="This page describes the canonical production model"
          description="The Black Impact Score is built around documented policy outcomes affecting Black Americans. It is not a sentiment score, not a partisan score, and not a substitute for reading the underlying evidence."
          detail="The live score uses a canonical outcome layer, deterministic policy intent where available, and curated systemic weighting where a policy had durable structural effects. It also keeps some score families separate instead of blending them together."
        />
        <CitationNote
          title="Why this page exists"
          description="EquityStack should be explainable without hand-waving. This page is here so a skeptical reader can see the moving parts of the score, understand what is missing, and evaluate the system on its actual rules rather than on summary language alone."
        />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="1. What it measures"
          title="The score measures documented policy outcomes affecting Black Americans"
          description="The Black Impact Score is outcome-first. It asks what happened in the public record, what effect that outcome had on Black Americans, how strong the evidence is, what the underlying policy appears to have intended, and whether the policy had broader structural consequences beyond the immediate outcome."
        />
        <SurfaceCard>
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            The core unit is not a speech, a slogan, or a campaign promise by itself. The core unit is a documented
            policy outcome. Promise Tracker records matter because they help connect modern administrations to actions
            and outcomes, but the score is anchored in what actually happened and what can be supported with linked evidence.
          </p>
        </SurfaceCard>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="2. Three layers"
          title="The model reads each outcome through direct impact, intent, and systemic effect"
          description="These layers do different jobs. Direct impact measures the outcome itself. Intent changes interpretation when it is known. Systemic weighting captures durable structural effect when the case for that weighting has been curated."
        />

        <SurfaceCard>
          <h2 className="text-2xl font-semibold text-white">A. Direct impact</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Direct impact asks what the recorded outcome did in the world represented by the dataset. Positive and
            negative outcomes carry the full sign of the score. Mixed and blocked outcomes remain visible, but they do
            not get treated like clear full-direction wins or harms.
          </p>
          <div className="mt-5">
            <MetaGrid items={DIRECT_IMPACT_ITEMS} valueKey="value" />
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="text-2xl font-semibold text-white">B. Policy intent</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Intent is not used to deny reality. If a policy had harmful effects, the score still reads those effects as
            harmful. Intent matters because two policies can produce similar visible outcomes while aiming at very
            different ends. In this model, intent modifies interpretation after the outcome is already on the table.
          </p>
          <div className="mt-5">
            <MetaGrid items={INTENT_ITEMS} valueKey="modifier" />
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <h2 className="text-2xl font-semibold text-white">C. Systemic impact</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Systemic impact is reserved for policies and decisions with durable structural consequences: enforcement
            architecture, doctrine, voting-rights infrastructure, anti-discrimination frameworks, long-run healthcare
            systems, and similar institutional effects. Most rows stay at the default `standard` level.
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            Policies can have both immediate and long-term effects. The model separates direct outcomes from systemic
            impact so that short-term results do not overshadow durable structural consequences.
          </p>
          <div className="mt-5">
            <MetaGrid items={SYSTEMIC_ITEMS} valueKey="multiplier" />
          </div>
        </SurfaceCard>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="3. Calculation"
          title="The score is a weighted outcome formula, not a black box"
          description="For direct scored outcomes, the production model applies direct impact, confidence, intent, systemic weighting, and policy-family weighting in sequence."
        />
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SurfaceCard>
            <div className="rounded-[1.2rem] border border-[rgba(132,247,198,0.16)] bg-[rgba(7,32,52,0.5)] px-5 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Conceptual formula
              </p>
              <p className="mt-3 text-xl font-semibold leading-8 text-white md:text-2xl">
                Final score = Direct impact × Confidence × Intent modifier × Systemic multiplier × Policy type weight
              </p>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                This formula is not meant to obscure how the score works. It exists to make each part of the evaluation
                explicit and auditable.
              </p>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {SCORE_COMPONENTS.map((item) => (
                <div key={item.title} className="rounded-[1.2rem] border border-white/8 bg-white/5 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">{item.title}</p>
                  <p className="mt-2 text-base font-semibold text-white">{item.value}</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-7 text-[var(--ink-soft)]">
              Two implementation details matter. First, current production president scoring uses direct current-administration
              outcomes as the main headline score family. Second, judicial outcomes are handled as a separate systemic score
              family when explicit attribution exists, rather than being silently folded into the direct presidential score.
            </p>
          </SurfaceCard>

          <SurfaceCard>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              Example breakdown
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">One row, step by step</h2>
            <div className="mt-4 rounded-[1.2rem] border border-[rgba(132,247,198,0.16)] bg-[rgba(7,32,52,0.42)] px-4 py-4">
              <p className="text-sm font-semibold text-white">Real example: Civil Rights Act of 1964</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                This policy scores strongly in the current model because it combines a strong positive direct outcome,
                high confidence from extensive historical evidence, an `equity_expanding` intent classification, and a
                `transformational` systemic classification tied to long-run civil-rights enforcement and anti-discrimination
                architecture.
              </p>
            </div>
            <div className="mt-4 grid gap-3">
              {[
                { title: "Direct impact", detail: "A scored outcome has an `impact_score` of 0.80 and a Positive direction, so the directional base remains positive." },
                { title: "Confidence", detail: "The row has two linked sources, so the confidence multiplier stays at 1.00 instead of being dampened." },
                { title: "Intent", detail: "If the linked policy is classified `equity_expanding`, the intent modifier becomes 1.10x." },
                { title: "Systemic", detail: "If the linked policy is classified `strong`, the systemic multiplier becomes 1.15x." },
                { title: "Final contribution", detail: "0.80 × 1.00 × 1.10 × 1.15 × 1.00 = 1.012. That is the row’s scored contribution before aggregation." },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{item.detail}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="4. Data"
          title="The score uses structured policies, outcomes, and evidence"
          description="The model depends on a small set of canonical record types rather than on vague narrative summaries."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {DATA_SOURCES.map((item) => (
            <SurfaceCard key={item.title}>
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </SurfaceCard>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="5. Scope"
          title="What is included, and what is not"
          description="The model is intentionally narrower than history itself. Inclusion requires a real scored-outcome path and grounded evidence."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <SurfaceCard>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              Included
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">What can count</h2>
            <div className="mt-4">
              <BulletList items={INCLUDED_ITEMS} />
            </div>
          </SurfaceCard>
          <SurfaceCard>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
              Not included
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">What does not count yet</h2>
            <div className="mt-4">
              <BulletList items={EXCLUDED_ITEMS} />
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              Some historically important policies may be classified for intent or systemic significance but still not
              appear in the current score because their canonical scoring path has not been materialized.
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              If a policy does not appear in the score, it is not being ignored. It means the policy does not yet meet
              the criteria required for a reliable, evidence-based evaluation in the live scoring model.
            </p>
          </SurfaceCard>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="6. Missing rows"
          title="Why some policies do not appear in scores"
          description="A policy can matter historically and still be absent from the live score. That absence usually means the model is refusing to guess."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {MISSING_REASON_ITEMS.map((item) => (
            <SurfaceCard key={item.title}>
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </SurfaceCard>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="7. Limits"
          title="Confidence and limitations remain part of the public model"
          description="The score is designed to improve as curation improves. It does not pretend the current dataset is complete."
        />
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <SurfaceCard>
            <BulletList items={LIMITATION_ITEMS} />
          </SurfaceCard>
          <MethodologyCallout
            title="Why limits stay visible"
            description="EquityStack keeps incomplete, mixed, and blocked records visible so uncertainty does not disappear from public view. The trust model is to show the gap, not to smooth it away."
            href="/methodology"
            linkLabel="Open methodology"
          />
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="8. Interpretation"
          title="How to read the score responsibly"
          description="The score is strongest when used as a structured comparison tool backed by record-level inspection."
        />
        <SurfaceCard>
          <BulletList items={INTERPRETATION_ITEMS} />
        </SurfaceCard>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Next steps"
          title="See the score, then inspect the records beneath it"
          description="This page is meant to increase trust in the system by making it inspectable. The next step is to open the live score, then read the report, the evidence, and the broader methods together."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {NEXT_STEPS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 hover:border-[rgba(132,247,198,0.24)]"
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
