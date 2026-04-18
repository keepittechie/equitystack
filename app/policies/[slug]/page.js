import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPolicySlug, fetchPolicyDetailBySlug } from "@/lib/public-site-data";
import {
  countLabel,
  filterParagraphs,
  isThinText,
  oxfordJoin,
  sentenceJoin,
  takeLabels,
} from "@/lib/editorial-depth";
import { getFlagshipPolicyEditorial } from "@/lib/flagship-editorial";
import {
  formatSystemicImpactLabel,
  isNonStandardSystemicImpact,
  shouldRenderSystemicImpact,
  systemicMultiplierFor,
} from "@/lib/systemicImpact";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
  SourceTrustPanel,
  CitationNote,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import {
  EvidenceSourceList,
  PolicyHero,
  PolicyTimeline,
  PromiseResultsTable,
} from "@/app/components/public/entities";
import {
  buildBreadcrumbJsonLd,
  buildPolicyJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return numeric.toFixed(2);
}

function formatSystemicMultiplier(value) {
  return `${Number(value || 1).toFixed(2)}x`;
}

function buildSystemicImpactCard(policy) {
  if (!shouldRenderSystemicImpact(policy?.systemic_impact_category, policy?.systemic_impact_summary)) {
    return null;
  }

  const category = policy?.systemic_impact_category || "standard";
  const label = formatSystemicImpactLabel(category);
  const multiplier = systemicMultiplierFor(category);

  return {
    label,
    multiplier,
    summary:
      policy?.systemic_impact_summary ||
      "This record carries a documented systemic weighting because its effects extended beyond the immediate outcome into durable institutions, doctrine, or enforcement capacity.",
  };
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

function buildPolicyRecordOverview(policy, editorial = null) {
  const categoryLabels = takeLabels(policy.categories, (item) => item.name, 3);

  return sentenceJoin([
    policy.president
      ? `${policy.title} is tracked here inside the ${policy.president} record.`
      : `${policy.title} is tracked here as part of the public historical policy record.`,
    policy.year_enacted
      ? `The page anchors the record in ${policy.year_enacted}${policy.policy_type ? ` as a ${policy.policy_type.toLowerCase()}` : ""}.`
      : policy.policy_type
        ? `The page treats it as a ${policy.policy_type.toLowerCase()} record.`
        : null,
    categoryLabels.length
      ? `Its clearest topical connections in the current dataset are ${oxfordJoin(categoryLabels)}.`
      : null,
    editorial?.overviewSuffix || null,
  ]);
}

function buildPolicyCoverageNote(policy) {
  const sourceCount = Number(policy.evidence_summary?.total_sources || 0);
  const evidenceStrength = policy.evidence_summary?.evidence_strength || "limited";

  return sentenceJoin([
    `This page is designed to stay useful even when the narrative summary is short.`,
    `Use the score, source trail, and related records together rather than relying on one paragraph alone.`,
    `${countLabel(sourceCount, "source")} currently support this record, with ${String(
      evidenceStrength
    ).toLowerCase()} evidence strength in the public view.`,
  ]);
}

function buildPolicyGuideCards(policy, editorial = null) {
  const thinNarrative =
    isThinText(policy.summary, 140) || isThinText(policy.outcome_summary, 140);

  return [
    {
      eyebrow: "What this record covers",
      title: "A single policy, law, order, or court-era record",
      description:
        buildPolicyRecordOverview(policy, editorial) ||
        "This page organizes one policy record with score, evidence, and related context.",
    },
    {
      eyebrow: "How to use it",
      title: "Read the record before drawing broader conclusions",
      description:
        "Start with the summary and outcome language, then compare the source trail, linked promises, and related policies before moving into reports or thematic pages.",
    },
    {
      eyebrow: "Coverage note",
      title: thinNarrative ? "This record needs context around a short narrative" : "Use this page as the evidence layer",
      description: thinNarrative
        ? buildPolicyCoverageNote(policy)
        : "This record already has a fuller narrative, but it is still best read alongside the source list, related policies, and broader presidential or thematic context.",
    },
  ];
}

function buildPolicyContextParagraphs(policy, editorial = null) {
  const categoryLabels = takeLabels(policy.categories, (item) => item.name, 4);
  const sourceCount = Number(policy.evidence_summary?.total_sources || 0);
  const relatedPromiseCount = Number((policy.related_promises || []).length || 0);
  const relatedExplainerCount = Number((policy.related_explainers || []).length || 0);

  return filterParagraphs([
    sentenceJoin([
      `${policy.title} is treated here as one evidence-bearing policy record inside the broader EquityStack research graph.`,
      policy.president ? `The page currently connects it to ${policy.president}'s presidential context.` : null,
      categoryLabels.length
        ? `Its clearest public topic links are ${oxfordJoin(categoryLabels)}.`
        : null,
    ]),
    sentenceJoin([
      `${countLabel(sourceCount, "source")} currently support the public evidence layer on this page, alongside ${countLabel(
        relatedPromiseCount,
        "related promise"
      )} and ${countLabel(relatedExplainerCount, "related explainer")}.`,
      `That surrounding structure matters most when the written summary or outcome note is still short.`,
    ]),
    sentenceJoin([
      `The strongest reading comes from comparing the summary, outcome language, source trail, and related records together.`,
      editorial?.overviewSuffix ||
        "That keeps the interpretation tied to the visible record instead of leaning on one paragraph alone.",
    ]),
  ]);
}

function buildPolicyThematicPath(policy, editorial = null) {
  if (editorial?.priorityPath) {
    return editorial.priorityPath;
  }

  const signals = [
    policy.policy_type,
    policy.impact_direction,
    ...(policy.categories || []).map((item) => item.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /law|amendment|voting|rights|civil|court/.test(signals)
  ) {
    return {
      href: "/analysis/civil-rights-laws-by-president",
      label: "Legislation lens",
      title: "Trace civil-rights laws across administrations",
      description:
        "Use the legislation pathway when this record matters most as part of the longer legal history affecting Black Americans.",
    };
  }

  if (
    /housing|education|labor|employment|economic|business|bank|mortgage|opportunity|wealth/.test(
      signals
    )
  ) {
    return {
      href: "/analysis/how-presidents-shaped-black-opportunity",
      label: "Opportunity pathway",
      title: "Review policies affecting access and advancement",
      description:
        "Use the opportunity pathway when the question is about housing, labor, education, investment, or federal access over time.",
    };
  }

  return {
    href: "/analysis/presidential-impact-on-black-americans",
    label: "Impact pathway",
    title: "Explore broader presidential impact on Black Americans",
    description:
      "Use the broader impact page when this policy should be read inside a larger administration-level or cross-administration pattern.",
  };
}

function buildResearchPaths(policy, editorial = null) {
  const paths = [buildPolicyThematicPath(policy, editorial)];

  if (policy.president) {
    paths.push({
      href: `/policies?president=${encodeURIComponent(policy.president)}`,
      label: "Presidential context",
      title: `Browse more policy records under ${policy.president}`,
      description:
        "Use the filtered policy index to see whether this record fits a broader presidential pattern on Black rights, access, or public investment.",
    });
  }

  paths.push({
    href: "/narratives",
    label: "Historical threads",
    title: "Read narrative policy threads",
    description:
      "Narrative pages group policies into larger historical patterns, making it easier to place one record inside a broader Black history or civil-rights arc.",
  });

  paths.push({
    href: "/reports",
    label: "Analysis layer",
    title: "Continue into reports and comparative analysis",
    description:
      "Reports help move from one policy record into cross-administration patterns, score context, and higher-level historical interpretation.",
  });

  paths.push({
    href: "/research",
    label: "Research hub",
    title: "Return to the curated research hub",
    description:
      "Use the research hub when this policy opens into a broader question and you need the strongest next explainer, report, or thematic path.",
  });

  return paths;
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
      `Review a policy record on ${policy.title} with impact score, evidence, and historical context affecting Black Americans.`,
    path: `/policies/${policy.slug}`,
    keywords: [
      policy.policy_type,
      policy.president,
      policy.era,
      "legislation affecting Black Americans",
    ].filter(Boolean),
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
  const policyPath = `/policies/${policy.slug}`;
  const flagshipEditorial = getFlagshipPolicyEditorial(policy.id);
  const researchPaths = buildResearchPaths(policy, flagshipEditorial);
  const guideCards = buildPolicyGuideCards(policy, flagshipEditorial);
  const thinSummary = isThinText(policy.summary, 140);
  const thinOutcome = isThinText(policy.outcome_summary, 140);
  const contextParagraphs = buildPolicyContextParagraphs(policy, flagshipEditorial);
  const systemicImpact = buildSystemicImpactCard(policy);
  const badges = [
    policy.year_enacted ? `Year ${policy.year_enacted}` : null,
    policy.president ? `President: ${policy.president}` : null,
    policy.era ? `Era: ${policy.era}` : null,
    policy.primary_party ? `Party: ${policy.primary_party}` : null,
    policy.policy_type,
    policy.impact_direction,
    isNonStandardSystemicImpact(policy.systemic_impact_category)
      ? `Systemic: ${formatSystemicImpactLabel(policy.systemic_impact_category)}`
      : null,
  ].filter(Boolean);

  return (
    <main className="space-y-10">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/policies", label: "Policies" },
              { label: policy.title },
            ],
            policyPath
          ),
          buildPolicyJsonLd(policy, policy.slug, score),
        ]}
      />
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

      <section className="grid items-start gap-6 2xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          description="Policy detail pages are the core evidence layer of EquityStack. Each one is meant to answer what happened, how the record is classified, and why it matters for Black Americans."
          detail="Use this page when you want to verify a law, executive action, or court decision directly before moving into broader presidential, legislative, or historical comparisons."
        />
        <div className="rounded-[1.6rem] border border-[rgba(132,247,198,0.18)] bg-[linear-gradient(145deg,rgba(14,36,33,0.72),rgba(8,14,24,0.96))] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            Why this page matters
          </p>
          <h2 className="mt-4 text-2xl font-semibold text-white">Policy history with public evidence attached</h2>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
            Search visitors often arrive with a broad question about civil-rights law, presidential impact, or historical harm. This page is where that question should become concrete through summary, score, sources, and related records.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {guideCards.map((item) => (
          <div
            key={item.title}
            className="rounded-[1.4rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              {item.eyebrow}
            </p>
            <h2 className="mt-3 text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
        <SectionIntro
          eyebrow="Context and background"
          title="What this policy page adds beyond the headline summary"
          description="This section helps keep shorter policy narratives useful by framing them with the supporting evidence, relationships, and record structure already present on the page."
        />
        <div className="mt-5 grid gap-4">
          {contextParagraphs.map((paragraph, index) => (
            <p key={`${policy.id}-context-${index}`} className="text-sm leading-8 text-[var(--ink-soft)]">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      <section className="public-two-col-rail grid gap-6 2xl:grid-cols-[1.08fr_0.92fr]">
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
            {thinSummary ? (
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {buildPolicyRecordOverview(policy, flagshipEditorial)}
              </p>
            ) : null}
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Why it matters</p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {buildWhyItMatters(policy)}
            </p>
            {thinSummary || thinOutcome ? (
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {buildPolicyCoverageNote(policy)}
              </p>
            ) : null}
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
            {thinOutcome ? (
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {sentenceJoin([
                  buildPolicyRecordOverview(policy, flagshipEditorial),
                  "Use the related promises, reports, and policy lineage below if you need fuller context than the current outcome summary provides.",
                ])}
              </p>
            ) : null}
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
          {systemicImpact ? (
            <div className="rounded-[1.6rem] border border-[rgba(132,247,198,0.18)] bg-[linear-gradient(145deg,rgba(14,36,33,0.72),rgba(8,14,24,0.96))] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
                Systemic impact
              </p>
              <h3 className="mt-3 text-lg font-semibold text-white">
                {systemicImpact.label} structural weight
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[var(--ink-soft)]">
                  {systemicImpact.label}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[var(--ink-soft)]">
                  Systemic multiplier {formatSystemicMultiplier(systemicImpact.multiplier)}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                {systemicImpact.summary}
              </p>
            </div>
          ) : null}
          <CitationNote
            description={
              flagshipEditorial?.citationDescription ||
              "When referencing this policy page externally, cite the policy title, EquityStack, the page URL, and your access date. Treat the page as a structured public record summary and pair it with linked sources or methodology when precision matters."
            }
          />
          <MethodologyCallout description="Impact Score is a structured record-level metric. The presidential Black Impact Score is a separate aggregate model built from outcomes, confidence, and time normalization." />
        </div>
      </section>

      <section className="grid items-start gap-6 2xl:grid-cols-[1.08fr_0.92fr]">
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
            eyebrow="Continue exploring"
            title="Promises, explainers, reports, and research paths"
            description="Related records make it easier to move from a single policy into campaign promises, Black history explainers, and broader presidential or administrative context."
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
                Move from this policy proof page into the flagship report when you want presidential or historical comparison context.
              </p>
            </Link>
            {researchPaths.map((item) => (
              <Link key={item.href} href={item.href} className="panel-link rounded-[1.4rem] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                  {item.label}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
              </Link>
            ))}
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
