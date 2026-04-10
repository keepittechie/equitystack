import Image from "next/image";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchHomePageData, buildPolicySlug } from "@/lib/public-site-data";
import { SectionIntro, KpiCard, MethodologyCallout, SourceTrustPanel } from "@/app/components/public/core";
import { CategoryImpactChart, DirectionBreakdownChart, ImpactTrendChart } from "@/app/components/public/charts";
import { PolicyCardList, PresidentCardGrid, RecentPolicyChangesTable } from "@/app/components/public/entities";
import TrustBar from "@/app/components/public/TrustBar";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Measure how government actions impact Black Americans",
  description:
    "A data-first civic intelligence platform tracking policies, promises, evidence, and measurable impact on Black Americans.",
  path: "/",
  imagePath: "/images/hero/civil-rights-march.jpg",
});

function pct(value) {
  const numeric = Number(value || 0);
  return `${Math.round(numeric * 100)}%`;
}

export default async function HomePage() {
  const { scores, readiness, featuredPolicies, recentPromises, presidents, categorySummary } = await fetchHomePageData();
  const trend = scores.metadata?.impact_trend || { score_by_year: [] };
  const trust = scores.metadata?.trust || {};
  const directionData = ["Positive", "Mixed", "Negative", "Blocked"].map((name, index) => ({
    name,
    value: Number(
      scores.records.reduce(
        (total, row) => total + Number(row.breakdown_by_direction?.[name] || 0),
        0
      )
    ),
    color: ["#84f7c6", "#fbbf24", "#ff8a8a", "#8da1b9"][index],
  }));
  const topicData = (categorySummary || [])
    .slice(0, 6)
    .map((item) => ({
      name: item.name,
      score: Number(item.net_weighted_impact || 0),
    }));

  return (
    <main className="space-y-10">
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
              Public civic intelligence
            </p>
            <h1 className="mt-5 max-w-4xl text-[clamp(2.8rem,7vw,6.2rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-white">
              Measure how government actions impact Black Americans
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[#d8e2ee] md:text-lg">
              EquityStack measures how documented government actions changed outcomes for
              Black Americans across administrations, legislatures, and historical records.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/policies" className="public-button-primary">
                Explore Policies
              </Link>
              <Link href="/presidents" className="public-button-secondary">
                View Presidents
              </Link>
              <Link href="/promises" className="public-button-secondary">
                See Promise Tracker
              </Link>
            </div>
          </div>
        </div>

        <p className="absolute bottom-4 right-5 z-10 rounded-full border border-white/10 bg-[rgba(4,10,18,0.72)] px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] text-[#d8e2ee] backdrop-blur-sm xl:right-8">
          March on Washington for Jobs and Freedom, 1963
        </p>
      </section>

      <TrustBar />

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Tracks real policies",
            summary:
              "EquityStack organizes federal laws, executive actions, and related outcomes into a searchable public record instead of a generic issue feed.",
          },
          {
            title: "Measures measurable impact",
            summary:
              "Scores, direction labels, time windows, and trend summaries keep the focus on documented effects rather than rhetoric alone.",
          },
          {
            title: "Shows the evidence",
            summary:
              "Sources, confidence, completeness, and methodology remain close to every major metric so users can inspect trust directly.",
          },
        ].map((item) => (
          <article key={item.title} className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Platform logic</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">{item.title}</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Unified outcomes"
          value={readiness.total_policy_outcomes}
          delta={`${readiness.current_admin_outcomes} current-admin / ${readiness.legislative_outcomes} legislative`}
          description="The public scoring and evidence layer runs on unified policy outcomes rather than disconnected record silos."
          tone="accent"
        />
        <KpiCard
          label="Source coverage"
          value={pct(readiness.source_coverage_pct)}
          delta={`${readiness.sourced_outcomes} sourced`}
          description="Source coverage is visible up front so users know how much of the dataset is evidence-backed."
        />
        <KpiCard
          label="Intent coverage"
          value={pct(readiness.intent_coverage_pct)}
          delta={`${readiness.intent_classified_policies} classified`}
          description="Policy intent remains distinct from outcome, and missing classifications stay visible rather than guessed."
        />
        <KpiCard
          label="Certification"
          value={readiness.certification_status}
          delta={`${pct(readiness.high_confidence_outcome_pct)} high confidence`}
          description="Trust status reflects whether the public dataset is complete, sourced, and internally consistent."
        />
      </section>

      <SourceTrustPanel
        sourceCount={readiness.sourced_outcomes}
        sourceQuality="System-wide coverage"
        confidenceLabel={`${pct(readiness.high_confidence_outcome_pct)} high confidence`}
        completenessLabel={`${pct(trust.incomplete_outcome_percentage || 0)} incomplete`}
        includedCount={scores.metadata?.outcomes_included_in_score}
        excludedCount={scores.metadata?.outcomes_excluded_from_score}
        summary={scores.metadata?.summary_interpretation}
      />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <ImpactTrendChart
          data={trend.score_by_year || []}
          title="How impact changed over time"
          description={trend.interpretation || "Track yearly change and cumulative movement across scored outcomes."}
        />
        <DirectionBreakdownChart
          data={directionData}
          title="Direction of documented outcomes"
          description="Positive, negative, mixed, and blocked outcomes are counted separately so the headline score never hides distribution."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <CategoryImpactChart
          data={topicData}
          title="Leading category contributions"
          description="Top policy categories currently shaping the measured dataset-wide impact."
        />
        <MethodologyCallout description="The Black Impact Score is always paired with inclusion counts, confidence, source coverage, and limitations. Read the method before treating a number as a conclusion." />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="What changed recently"
          title="Latest promise and policy movement"
          description="Recent records give you the fastest path from system summary into underlying detail and evidence."
        />
        <RecentPolicyChangesTable
          items={[
            ...recentPromises.slice(0, 5).map((item) => ({
              ...item,
              record_type: "Promise",
            })),
            ...featuredPolicies.slice(0, 5).map((item) => ({
              ...item,
              record_type: "Policy",
            })),
          ].slice(0, 8)}
          buildHref={(item) => (item.slug ? `/promises/${item.slug}` : `/policies/${buildPolicySlug(item)}`)}
        />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Policy explorer"
          title="Start with the highest-impact documented records"
          description="Open a policy record to read the summary, score, evidence, time window, related promises, and sources without losing context."
          actions={<Link href="/policies" className="public-button-secondary">Browse all policies</Link>}
        />
        <PolicyCardList items={featuredPolicies.slice(0, 6)} buildHref={(item) => `/policies/${buildPolicySlug(item)}`} />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Entity hubs"
          title="Navigate by president, policy, promise, or report"
          description="The public site is organized like a civic data platform: summary first, then filters, then evidence-backed detail pages."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/presidents", title: "Presidents", summary: "Rankings, profiles, timelines, and compare flows." },
            { href: "/policies", title: "Policies", summary: "Browse the structured policy record with filters, direction, evidence, and related history." },
            { href: "/promises", title: "Promises", summary: "Track statements, statuses, rationale, and linked policy outcomes." },
            { href: "/methodology", title: "Methodology", summary: "Read how the Black Impact Score, promise grading, confidence, and evidence rules actually work." },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 hover:border-[rgba(132,247,198,0.24)]">
              <h3 className="text-xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Presidential records"
          title="Who drives the score"
          description="President profiles combine direct impact scoring, confidence, promise-tracker context, and evidence-linked policy records."
          actions={<Link href="/presidents" className="public-button-secondary">View ranking</Link>}
        />
        <PresidentCardGrid items={presidents.slice(0, 6)} buildHref={(item) => `/presidents/${item.slug}`} />
      </section>
    </main>
  );
}
