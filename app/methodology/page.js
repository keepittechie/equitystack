import { buildPageMetadata } from "@/lib/metadata";

export const metadata = buildPageMetadata({
  title: "Methodology",
  description:
    "Learn how EquityStack categorizes, scores, and interprets policies, evidence, and historical impact.",
  path: "/methodology",
});

function StatCard({ title, value, subtitle }) {
  return (
    <div className="metric-card p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">{title}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {subtitle ? <p className="text-sm text-[var(--ink-soft)] mt-2">{subtitle}</p> : null}
    </div>
  );
}

function ScoreCard({ title, description }) {
  return (
    <div className="card-surface rounded-[1.5rem] p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">{description}</p>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <main className="max-w-7xl mx-auto p-6 space-y-10">
      <section className="hero-panel p-8 md:p-10">
        <p className="eyebrow mb-4">
          Research Framework
        </p>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Methodology</h1>
        <p className="text-[var(--ink-soft)] text-lg max-w-3xl leading-8">
          EquityStack is designed to document, compare, and analyze
          U.S. laws, executive actions, amendments, court cases, and major policy
          decisions based on their material effect on Black Americans. This page
          explains how entries are categorized, scored, and interpreted across the site.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Core Focus"
          value="Impact"
          subtitle="The project prioritizes measurable policy effect over symbolism."
        />
        <StatCard
          title="Scoring Scale"
          value="0–5"
          subtitle="Most score fields are evaluated on a structured 0 to 5 scale."
        />
        <StatCard
          title="Primary Lens"
          value="Black Americans"
          subtitle="Entries are assessed through their documented effect on Black communities."
        />
        <StatCard
          title="Evidence Priority"
          value="Sources + Metrics"
          subtitle="Government, archival, academic, and measurable outcomes are preferred."
        />
      </section>

      <section className="card-surface rounded-[1.6rem] p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Purpose</h2>
          <p className="text-[var(--ink-soft)] leading-8">
            The goal of EquityStack is not just to list policies, but to
            organize them into a structured historical framework. The project is meant
            to help readers examine patterns over time, compare policy eras, and
            understand how reforms, rollbacks, court rulings, and blocked legislation
            shaped outcomes for Black Americans.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">How policies are categorized</h2>
          <p className="text-[var(--ink-soft)] leading-8">
            Each policy is tagged by era, party association where appropriate, policy type,
            and one or more issue categories such as voting rights, housing, healthcare,
            education, criminal justice, labor, HBCUs, and related areas. Court cases and
            some nonpartisan actions may be listed under no primary party when assigning
            a partisan label would be misleading.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">How impact direction is assigned</h2>
          <p className="text-[var(--ink-soft)] leading-8">
            Each entry is also assigned an impact direction such as positive, negative,
            mixed, or blocked. These labels are based on the documented effect of the action,
            not simply the language used to promote it. A policy may be classified as mixed
            when it produced both meaningful gains and major harms, limitations, exclusions,
            or uneven enforcement.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Scoring Framework</h2>
          <p className="text-sm text-[var(--ink-soft)] mt-1">
            Each policy can receive scores from 0 to 5 across the following dimensions.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ScoreCard
            title="Directness"
            description="How explicitly the policy targeted, protected, excluded, or otherwise affected Black Americans."
          />
          <ScoreCard
            title="Material Impact"
            description="Whether the policy changed rights, money, legal treatment, access, safety, or opportunity in a meaningful real-world way."
          />
          <ScoreCard
            title="Evidence"
            description="The strength of the historical sourcing and measurable support for the claimed impact."
          />
          <ScoreCard
            title="Durability"
            description="Whether the policy’s effects lasted over time or were quickly undermined, weakened, reversed, or limited."
          />
          <ScoreCard
            title="Equity"
            description="Whether the policy helped reduce racial disparities, expand equal access, or improve fairness in practice."
          />
          <ScoreCard
            title="Harm Offset"
            description="The degree to which limitations, exclusions, weak enforcement, tradeoffs, or contradictory outcomes reduced the policy’s net benefit."
          />
        </div>
      </section>

      <section className="card-surface rounded-[1.6rem] p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">How total policy impact is interpreted</h2>
          <p className="text-[var(--ink-soft)] leading-8">
            Composite scores are intended to make comparison easier, but they are not a
            substitute for reading the policy record itself. A high score suggests broad,
            durable, and well-supported impact. A lower score may reflect limited reach,
            incomplete enforcement, or mixed outcomes. Negative and blocked entries are also
            important because they help explain losses, gaps, and missed opportunities.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Party attribution</h2>
          <p className="text-[var(--ink-soft)] leading-8">
            Party attribution reflects the party most associated with passage,
            sponsorship, or executive approval at the time. Historical party
            labels are not treated as ideologically fixed across all eras.
            Reconstruction-era Republicans and modern Republicans are not assumed
            to represent identical coalitions, and the same caution applies to
            Democrats across different periods.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Evidence standards</h2>
          <p className="text-[var(--ink-soft)] leading-8">
            Wherever possible, entries should be supported by primary government sources,
            archival materials, academic research, and measurable outcomes. Symbolic rhetoric,
            campaign language, or retrospective partisan claims are not treated as sufficient
            evidence on their own. The strongest entries combine primary sources with metrics
            or well-established historical analysis.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-2">Scope</h2>
          <p className="text-[var(--ink-soft)] leading-8">
            The project focuses primarily on federal actions, major court rulings,
            and significant policy developments tied to Black political, civil, social,
            and economic outcomes. It may expand over time to include more enforcement
            history, additional federal programs, and selected state-level patterns where
            those patterns materially shaped national outcomes.
          </p>
        </div>
      </section>

      <section className="card-surface-strong rounded-[1.6rem] p-6">
        <h2 className="text-2xl font-semibold mb-3">Interpretation Note</h2>
        <p className="text-[var(--ink-soft)] leading-8">
          This site is a structured historical analysis tool. It is designed to help users
          interpret patterns in policy impact, not to reduce history to a single number or
          a simplistic partisan ranking. Scores, categories, and labels should be read together
          with the underlying summaries, sources, metrics, and historical context.
        </p>
      </section>
    </main>
  );
}
