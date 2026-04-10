import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPolicySlug, fetchPolicyDetailBySlug } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  MethodologyCallout,
  SectionIntro,
  SourceTrustPanel,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import {
  EvidenceSourceList,
  PolicyHero,
  PolicyTimeline,
  PromiseResultsTable,
} from "@/app/components/public/entities";

export const dynamic = "force-dynamic";

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return numeric.toFixed(2);
}

function computePolicyScore(policy) {
  if (!policy?.scores) {
    return null;
  }

  return (
    Number(policy.scores.directness_score || 0) +
    Number(policy.scores.material_impact_score || 0) +
    Number(policy.scores.evidence_score || 0) +
    Number(policy.scores.durability_score || 0) +
    Number(policy.scores.equity_score || 0) -
    Number(policy.scores.harm_offset_score || 0)
  );
}

function buildTimeline(policy) {
  const events = [];

  if (policy.year_enacted) {
    events.push({
      year: policy.year_enacted,
      summary: policy.summary || "Policy enters the public historical record.",
    });
  }

  if (policy.outcome_summary) {
    events.push({
      label: "Outcome",
      summary: policy.outcome_summary,
    });
  }

  if (policy.source_mix_summary?.newest_source_date) {
    events.push({
      date: policy.source_mix_summary.newest_source_date,
      summary: "Latest source linked to this policy record.",
    });
  }

  if (policy.era_navigation?.previous?.title) {
    events.push({
      label: "Era context",
      summary: `Previous era-adjacent record: ${policy.era_navigation.previous.title}.`,
    });
  }

  return events;
}

function buildWhatItMeans(policy) {
  if (policy.outcome_summary) {
    return policy.outcome_summary;
  }

  if (policy.summary) {
    return policy.summary;
  }

  return "This record is in the dataset, but the Black-community impact narrative has not been fully written yet.";
}

function buildWhyItMatters(policy) {
  const direction = policy.impact_direction || "Unknown";
  const evidence = policy.evidence_summary?.evidence_strength || "Limited";
  return `EquityStack classifies this policy as ${direction.toLowerCase()} impact with ${evidence.toLowerCase()} supporting evidence. The record matters because it helps explain how government action shaped Black Americans' rights, resources, exposure to harm, or access to institutions.`;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const policy = await fetchPolicyDetailBySlug(slug);

  if (!policy) {
    return buildPageMetadata({
      title: "Policy Not Found",
      description: "The requested policy record could not be found.",
      path: `/policies/${slug}`,
    });
  }

  return buildPageMetadata({
    title: policy.title,
    description:
      policy.summary ||
      "Review a policy record with score, impact narrative, evidence, and linked records.",
    path: `/policies/${policy.slug}`,
  });
}

export default async function PolicyDetailPage({ params }) {
  const { slug } = await params;
  const policy = await fetchPolicyDetailBySlug(slug);

  if (!policy) {
    notFound();
  }

  const timeline = buildTimeline(policy);
  const score = computePolicyScore(policy);
  const badges = [
    policy.year_enacted ? `Year ${policy.year_enacted}` : null,
    policy.president ? `President: ${policy.president}` : null,
    policy.era ? `Era: ${policy.era}` : null,
    policy.primary_party ? `Party: ${policy.primary_party}` : null,
    policy.policy_type,
    policy.impact_direction,
  ].filter(Boolean);

  return (
    <main className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/policies", label: "Policies" },
          { label: policy.title },
        ]}
      />

      <PolicyHero
        title={policy.title}
        summary={policy.summary || policy.outcome_summary}
        score={formatScore(score)}
        scoreLabel="Impact Score"
        badges={badges}
      />

      <TrustBar />

      <section className="public-two-col-rail grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Plain-language summary"
            title="What happened and why it matters"
            description="This page is the proof layer of the public site. It should let a reader move from score into explanation, evidence, and related records without guessing."
          />
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">What happened</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {policy.summary || "A plain-language summary has not been published for this record yet."}
            </p>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Why it matters</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {buildWhyItMatters(policy)}
            </p>
            {policy.categories?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {policy.categories.map((category) => (
                  <span key={category.name} className="public-pill">
                    {category.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.6rem] border border-[rgba(132,247,198,0.18)] bg-[linear-gradient(145deg,rgba(14,36,33,0.72),rgba(8,14,24,0.96))] p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">What this means</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">Impact on Black Americans</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
              {buildWhatItMeans(policy)}
            </p>
          </div>

          {timeline.length ? <PolicyTimeline items={timeline} /> : null}
        </div>

        <div className="space-y-5">
          <SourceTrustPanel
            sourceCount={policy.evidence_summary?.total_sources}
            sourceQuality={policy.evidence_summary?.evidence_strength}
            completenessLabel={policy.completeness_summary?.status}
            summary="Policy pages keep score, evidence, and completeness side by side so users can evaluate what is known, what is sourced, and what still needs work."
          />
          <ScoreExplanation title="How to interpret this policy record" />
          <MethodologyCallout description="Impact Score is a structured record-level metric. The presidential Black Impact Score is a separate aggregate model built from outcomes, confidence, and time normalization." />
        </div>
      </section>

      <section className="public-two-col-rail grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Evidence"
            title="Source trail"
            description="Evidence should be visible immediately, not hidden behind a second click. Open the source list first if you want to verify the record before reading related content."
          />
          {policy.sources?.length ? (
            <EvidenceSourceList items={policy.sources} />
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
              No evidence sources are attached to this policy record yet. Use related records or methodology for broader context.
            </div>
          )}
        </div>
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Related records"
            title="Promises, explainers, and report paths"
            description="Related records make it easier to move from a single policy into the broader public narrative or administrative context."
          />
          {(policy.related_promises || []).length ? (
            <PromiseResultsTable items={policy.related_promises} buildHref={(item) => `/promises/${item.slug}`} />
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
              No related promise records are linked to this policy yet.
            </div>
          )}
          <div className="grid gap-4">
            {(policy.related_explainers || []).map((item) => (
              <Link key={item.slug} href={`/explainers/${item.slug}`} className="panel-link rounded-[1.4rem] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                  {item.category || "Explainer"}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
              </Link>
            ))}
            <Link href="/reports/black-impact-score" className="panel-link rounded-[1.4rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">Related report</p>
              <h3 className="mt-3 text-lg font-semibold text-white">Black Impact Score</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Move from the policy proof page into the flagship report when you want presidential or historical comparison context.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {(policy.relationships || []).length ? (
        <section className="space-y-5">
          <SectionIntro
            eyebrow="Policy lineage"
            title="Related policies in the same historical thread"
            description="Use related records to move across expansions, restrictions, responses, and later reversals instead of reading this policy in isolation."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {policy.relationships.map((item) => (
              <Link
                key={`${item.related_policy_id}-${item.relationship_type}`}
                href={`/policies/${buildPolicySlug({ id: item.related_policy_id, title: item.related_policy_title })}`}
                className="panel-link rounded-[1.4rem] p-5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                  {item.relationship_type || "Related"} • {item.related_policy_year || "Undated"}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.related_policy_title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item.notes || "Open the related record for the full relationship context and source trail."}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
