import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  countLabel,
  filterParagraphs,
  isThinText,
  oxfordJoin,
  sentenceJoin,
  takeLabels,
} from "@/lib/editorial-depth";
import { getFlagshipPresidentEditorial } from "@/lib/flagship-editorial";
import { resolvePresidentImageSrc } from "@/lib/president-image-paths";
import { buildPolicySlug, fetchPresidentProfileData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CategoryImpactChart, ImpactTrendChart } from "@/app/components/public/charts";
import {
  CitationNote,
  MethodologyCallout,
  PresidentScoreMethodologyNote,
  SourceTrustPanel,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import PromiseSystemExplanation from "@/app/components/public/PromiseSystemExplanation";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import InsightCard from "@/app/components/public/InsightCard";
import {
  PresidentPolicyTable,
  PromiseTimeline,
} from "@/app/components/public/entities";
import {
  getBillStatusTone,
  getConfidenceTone,
  getImpactDirectionTone,
  getPromiseStatusTone,
  MetricCard,
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import EquityStackTabbar from "@/app/components/dashboard/EquityStackTabbar";
import {
  buildBreadcrumbJsonLd,
  buildProfilePageJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

function formatScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return numeric.toFixed(2);
}

function formatSystemicIndex(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return `${numeric.toFixed(2)}x`;
}

function formatSystemicContextLabel(value) {
  const label = String(value || "").trim();
  if (!label) {
    return null;
  }
  if (label === "Standard" || label === "Moderate" || label === "Strong") {
    return `${label} impact`;
  }
  return label;
}

function formatTermLabel(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;
  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear}`;
  }
  if (Number.isFinite(startYear)) {
    return `${startYear}-present`;
  }
  return "Historical record";
}

function formatBillConfidenceSummary(summary = {}) {
  return ["High", "Medium", "Low"]
    .map((label) => `${label} ${Number(summary[label] || 0)}`)
    .join(" • ");
}

function formatBillRelationshipType(type) {
  return String(type || "linked_context")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function humanizeToken(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildPresidentOverview(profile, editorial = null) {
  const { president, promiseTracker, scoreDrivers } = profile;
  const topicLabels = takeLabels(
    scoreDrivers?.topic_drivers,
    (item) => item.topic,
    3
  );
  const outcomes = countLabel(
    president.direct_outcome_count ?? president.outcome_count ?? 0,
    "scored outcome"
  );
  const promises = countLabel(
    promiseTracker.visible_promise_count ?? promiseTracker.total_tracked_promises ?? 0,
    "tracked promise"
  );

  return sentenceJoin([
    `This profile organizes ${outcomes}, ${promises}, and the supporting score context for ${president.president || president.name || "this presidency"}.`,
    topicLabels.length
      ? `The clearest documented movement in the current dataset appears in ${oxfordJoin(
          topicLabels
        )}.`
      : null,
    Number(president.linked_bill_count || 0) > 0
      ? `${countLabel(
          president.linked_bill_count,
          "linked bill"
        )} currently add legislative context through supported promise lineage.`
      : "No supported bill lineage is attached yet, so this profile leans more heavily on promise and outcome records.",
    editorial?.summarySuffix || null,
  ]);
}

function buildPresidentGuideCards(profile, editorial = null) {
  const { president, promiseTracker } = profile;
  const thinNarrative = isThinText(president.narrative_summary, 180);

  return [
    {
      eyebrow: "What this profile covers",
      title: "Score, promise tracker, and legislative context",
      description:
        buildPresidentOverview(profile, editorial) ||
        "This profile combines outcome evidence, promise records, and linked legislative context.",
    },
    {
      eyebrow: "How to use it",
      title: "Move from the headline score into the underlying record",
      description:
        "Use the score as a starting point, then inspect the driver tables, linked promises, policy records, and bill context before treating the profile as a settled historical judgment.",
    },
    {
      eyebrow: "Coverage note",
      title: thinNarrative ? "The narrative summary is shorter than the underlying record" : "The narrative summary sits on top of a larger record set",
      description: thinNarrative
        ? sentenceJoin([
            "Some presidential pages still depend on structured records more than long-form narrative text.",
            `${countLabel(
              promiseTracker.visible_source_count || 0,
              "source reference"
            )} and the linked tables below provide the fuller trail for this profile.`,
          ])
        : "Even when the summary is stronger, the best use of a profile is to compare the written framing with the visible promises, topic drivers, and source-backed score context below.",
    },
  ];
}

function buildPresidentContextParagraphs(profile, editorial = null) {
  const { president, promiseTracker, scoreDrivers } = profile;
  const presidentName = president.president || president.president_name || "this presidency";
  const topicLabels = takeLabels(scoreDrivers?.topic_drivers, (item) => item.topic, 4);
  const visibleStatuses = [
    { label: "delivered", value: promiseTracker.visible_delivered_count ?? promiseTracker.delivered_count ?? 0 },
    { label: "partial", value: promiseTracker.visible_partial_count ?? promiseTracker.partial_count ?? 0 },
    { label: "blocked", value: promiseTracker.visible_blocked_count ?? promiseTracker.blocked_count ?? 0 },
    { label: "failed", value: promiseTracker.visible_failed_count ?? promiseTracker.failed_count ?? 0 },
  ]
    .filter((item) => item.value > 0)
    .map((item) => item.label)
    .slice(0, 3);

  return filterParagraphs([
    sentenceJoin([
      `${presidentName}'s profile is meant to function as a structured research page, not just a score card.`,
      topicLabels.length
        ? `Within the current public dataset, the clearest issue areas are ${oxfordJoin(topicLabels)}.`
        : null,
    ]),
    sentenceJoin([
      `The page keeps ${countLabel(
        promiseTracker.visible_promise_count ?? promiseTracker.total_tracked_promises ?? 0,
        "tracked promise"
      )}, ${countLabel(
        president.direct_outcome_count ?? president.outcome_count ?? 0,
        "scored outcome"
      )}, and ${countLabel(president.linked_bill_count || 0, "linked bill")} in the same frame so readers can move from summary into underlying records.`,
      visibleStatuses.length
        ? `Visible promise results currently include ${oxfordJoin(visibleStatuses)} records.`
        : null,
    ]),
    sentenceJoin([
      `This page is strongest when read alongside the linked promise tracker, policy routes, and methodology notes below.`,
      editorial?.summarySuffix ||
        "If the narrative summary feels brief, the surrounding tables and linked routes carry more of the explanatory depth.",
    ]),
  ]);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const profile = await fetchPresidentProfileData(slug);

  if (!profile) {
    return buildPageMetadata({
      title: "President Not Found",
      description: "The requested presidential record could not be found.",
      path: `/presidents/${slug}`,
    });
  }

  const name = profile.president.president || profile.president.president_name || slug;
  const imagePath = resolvePresidentImageSrc({
    presidentSlug: profile.president.president_slug || slug,
    presidentName: name,
  });

  return buildPageMetadata({
    title: `${name} and Black Americans`,
    description:
      profile.president.narrative_summary ||
      `Review ${name}'s EquityStack profile for presidential policy impact on Black Americans, linked promises, legislation, and Black Impact Score context.`,
    path: `/presidents/${slug}`,
    imagePath,
    keywords: [
      `${name} Black history`,
      `${name} civil rights policy`,
      `${name} Black Impact Score`,
    ],
  });
}

export default async function PresidentProfilePage({ params }) {
  const { slug } = await params;
  const profile = await fetchPresidentProfileData(slug);

  if (!profile) {
    notFound();
  }

  const {
    president,
    promiseTracker,
    trend,
    topPolicies,
    promises,
    promiseStatusSnapshot,
    scoreDrivers,
    scoreComposition,
  } = profile;
  const presidentName = president.president || president.president_name || "Unknown president";
  const billInputs = president.bill_impact_inputs || {};
  const imageSrc = resolvePresidentImageSrc({
    presidentSlug: president.president_slug || slug,
    presidentName,
  });
  const presidentPoliciesHref = `/policies?president=${encodeURIComponent(presidentName)}`;
  const flagshipEditorial = getFlagshipPresidentEditorial(slug);
  const thinNarrative = isThinText(president.narrative_summary, 180);
  const contextParagraphs = buildPresidentContextParagraphs(profile, flagshipEditorial);
  const topicData = (president.score_by_topic || president.breakdowns?.by_topic || [])
    .slice(0, 6)
    .map((item) => ({
      name: item.topic,
      score: Number(item.raw_score_total ?? item.raw_score ?? item.score ?? 0),
    }));
  const timelineItems = promises
    .slice()
    .sort((left, right) => String(right.promise_date || "").localeCompare(String(left.promise_date || "")))
    .slice(0, 8)
    .map((item) => ({
      action_date: item.promise_date,
      title: item.title,
      description: item.summary || `${item.status} promise in ${item.topic || "uncategorized"} policy.`,
    }));
  const localSectionOffsetClass = "scroll-mt-28 md:scroll-mt-32";
  const visiblePromiseCount =
    promiseTracker.visible_promise_count ?? promiseTracker.total_tracked_promises ?? 0;
  const linkedBillCount = Number(billInputs.linked_bill_count || 0);
  const localNavigationItems = [
    { href: "#overview", label: "Overview" },
    ...(timelineItems.length
      ? [{ href: "#timeline", label: "Timeline", count: timelineItems.length }]
      : []),
    ...(visiblePromiseCount > 0
      ? [{ href: "#promises", label: "Promises", count: visiblePromiseCount }]
      : []),
    ...(linkedBillCount > 0
      ? [{ href: "#bills", label: "Bills", count: linkedBillCount }]
      : []),
    { href: "#related", label: "Related" },
  ];

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/presidents", label: "Presidents" },
              { label: presidentName },
            ],
            `/presidents/${slug}`
          ),
          buildProfilePageJsonLd({
            title: `${presidentName} and Black Americans`,
            description:
              president.narrative_summary ||
              `An EquityStack presidential profile covering ${presidentName}'s promises, policy record, Black Impact Score, and historical impact on Black Americans.`,
            path: `/presidents/${slug}`,
            imagePath: imageSrc,
            entityName: presidentName,
            entityDescription:
              president.narrative_summary ||
              `Presidential profile for ${presidentName} on EquityStack.`,
            about: [
              "U.S. presidents",
              "Black Americans",
              "civil rights policy",
              "historical policy impact",
            ],
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/presidents", label: "Presidents" },
          { label: presidentName },
        ]}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 border-b border-[var(--line)] p-4 xl:border-b-0 xl:border-r">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              {president.president_party || promiseTracker.president_party || "Administration profile"}
            </p>
            <h1 className="mt-3 max-w-4xl text-[clamp(1.9rem,5.5vw,3.7rem)] font-semibold leading-[1] tracking-[-0.04em] text-white">
              {presidentName}
            </h1>
            <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              {formatTermLabel(promiseTracker.term_start, promiseTracker.term_end)}
            </p>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--ink-soft)] md:text-base md:leading-7">
              {president.narrative_summary
                ? thinNarrative
                  ? sentenceJoin([
                      president.narrative_summary,
                      buildPresidentOverview(profile, flagshipEditorial),
                    ])
                  : president.narrative_summary
                : buildPresidentOverview(profile, flagshipEditorial) ||
                  "The final Black Impact Score stays anchored in outcome-based evidence, then adds a bounded bill-informed signal when current legislative lineage is strong enough to support it."}
            </p>
          </div>
          <aside className="grid content-start gap-3 p-4">
            {imageSrc ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.5)]">
                <Image src={imageSrc} alt={presidentName} fill className="object-cover object-top" />
              </div>
            ) : null}
            <MetricCard
              label="Black Impact Score"
              value={formatScore(president.normalized_score_total ?? president.score ?? president.direct_normalized_score)}
              description="Outcome-based presidential aggregate."
              prominence="primary"
              tone="info"
              showDot
            />
            {formatSystemicIndex(
              president.systemic_index ?? president.systemic_normalized_score
            ) != null ? (
              <MetricCard
                label="Systemic context"
                value={formatSystemicIndex(
                  president.systemic_index ?? president.systemic_normalized_score
                )}
                description={formatSystemicContextLabel(president.systemic_category_label) || "Structural impact context."}
                density="compact"
                tone="verified"
              />
            ) : null}
          </aside>
        </div>
      </Panel>

      <TrustBar />

      <div className="space-y-2">
        <p className="px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          On this page
        </p>
        <EquityStackTabbar
          items={localNavigationItems}
          ariaLabel="President page sections"
          defaultHref="#overview"
        />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Outcome confidence"
          value={president.direct_score_confidence || president.score_confidence || "Unknown"}
          description={`Anchored by ${president.direct_outcome_count ?? president.outcome_count ?? 0} scored outcomes.`}
          tone={getConfidenceTone(president.direct_score_confidence || president.score_confidence)}
          showDot
        />
        <MetricCard
          label="Promises tracked"
          value={promiseTracker.visible_promise_count ?? promiseTracker.total_tracked_promises ?? 0}
          description={`${promiseTracker.visible_outcome_count ?? 0} linked outcomes currently visible.`}
          tone="info"
        />
        <MetricCard
          label="Delivered"
          value={promiseTracker.visible_delivered_count ?? promiseTracker.delivered_count ?? 0}
          description="Promise performance stays separate from impact scoring."
          tone="success"
        />
        <MetricCard
          label="Source references"
          value={promiseTracker.visible_source_count ?? 0}
          description="Visible promise-tracker references, not unique source rows."
          tone="verified"
        />
        <MetricCard
          label="Linked bills"
          value={billInputs.linked_bill_count ?? 0}
          description={`${billInputs.linked_promises_with_bill_support ?? 0} promise-backed bill joins.`}
          tone="default"
        />
      </section>

      <Panel id="overview" prominence="primary" className={`${localSectionOffsetClass} overflow-hidden`}>
        <SectionHeader
          eyebrow="Score breakdown"
          title="Why this president has this score"
          description={scoreComposition.summary_line}
          action={
            <Link
              href="/research/how-black-impact-score-works"
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
            >
              Read the full scoring methodology
            </Link>
          }
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <MetricCard
              label="Direct impact"
              value={`${scoreComposition.direct.outcome_count} outcomes`}
              description="What actually happened in the scored outcome record before broader interpretation."
              tone="verified"
              prominence="primary"
            >
              <div className="flex flex-wrap gap-2">
                {Object.entries(scoreComposition.direct.direction_counts || {}).map(([label, value]) => (
                  <StatusPill key={label} tone={getImpactDirectionTone(label)}>
                    {humanizeToken(label)} {value}
                  </StatusPill>
                ))}
              </div>
            </MetricCard>

            <MetricCard
              label="Intent"
              value={`${scoreComposition.intent.classified_outcome_count} classified`}
              description="How linked policies behind scored outcomes are classified without replacing the outcome record."
              tone="info"
            >
              <div className="flex flex-wrap gap-2">
                {Object.entries(scoreComposition.intent.counts || {}).map(([label, value]) => (
                  <StatusPill key={label}>
                    {humanizeToken(label)} {value}
                  </StatusPill>
                ))}
              </div>
            </MetricCard>

            <MetricCard
              label="Systemic effect"
              value={`${scoreComposition.systemic.weighted_outcome_count} weighted`}
              description="Long-run institutional effect, with most rows remaining standard unless curated otherwise."
              tone="default"
            >
              <div className="flex flex-wrap gap-2">
                {Object.entries(scoreComposition.systemic.counts || {}).map(([label, value]) => (
                  <StatusPill key={label}>
                    {humanizeToken(label)} {value}
                  </StatusPill>
                ))}
              </div>
            </MetricCard>
          </div>
          <Panel padding="md" className="space-y-2">
            <StatusPill tone="info">What this means</StatusPill>
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              {scoreComposition.interpretation}
            </p>
          </Panel>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-3">
        {buildPresidentGuideCards(profile, flagshipEditorial).map((item) => (
          <Panel
            key={item.title}
            padding="md"
            className="space-y-3"
          >
            <StatusPill tone="info">{item.eyebrow}</StatusPill>
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
          </Panel>
        ))}
      </section>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Context and background"
          title="What this presidential page shows in practice"
          description="This added context is meant to keep shorter profile narratives anchored in the visible promise, policy, and bill record already attached to the page."
        />
        <div className="grid gap-4 p-4">
          {contextParagraphs.map((paragraph, index) => (
            <p key={`${slug}-context-${index}`} className="text-sm leading-8 text-[var(--ink-soft)]">
              {paragraph}
            </p>
          ))}
        </div>
      </Panel>

      <Panel id="bills" className={`${localSectionOffsetClass} overflow-hidden`}>
        <SectionHeader
          eyebrow="Bill-informed signals"
          title="Legislation linked to this presidential record"
          description="These bill-linked inputs help connect the presidency to legislation, promises, and the wider historical record affecting Black Americans."
        />
        <div className="space-y-4 p-4">
          {Number(billInputs.linked_bill_count || 0) > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Panel padding="md" className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Bill input summary</h3>
                  <p className="text-sm leading-7 text-[var(--ink-soft)]">
                    {president.bill_input_summary} The final Black Impact Score blends this bill-informed layer in as a capped modifier rather than letting bill links override the outcome-based record.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard
                      label="Unweighted bill BIS"
                      value={formatScore(billInputs.linked_bill_score_avg)}
                      density="compact"
                    />
                    <MetricCard
                      label="Weighted bill BIS"
                      value={formatScore(billInputs.linked_bill_score_weighted)}
                      density="compact"
                    />
                    <MetricCard
                      label="Bill influence"
                      value={`${formatScore(billInputs.bill_blend_weight_pct)}%`}
                      density="compact"
                      tone="info"
                    />
                    <MetricCard
                      label="Direction mix"
                      value={`${billInputs.linked_positive_bill_count || 0} / ${billInputs.linked_mixed_bill_count || 0} / ${billInputs.linked_negative_bill_count || 0}`}
                      description="Positive / mixed / negative linked bills"
                      density="compact"
                    />
                  </div>
                </Panel>
                <Panel padding="md" className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Evidence and domains</h3>
                  <p className="text-sm leading-7 text-[var(--ink-soft)]">
                    Join confidence stays bounded by the existing promise lineage and the bill’s own evidence depth.
                  </p>
                  <p className="text-sm leading-7 text-[var(--ink-soft)]">
                    Bill confidence mix: {formatBillConfidenceSummary(billInputs.linked_bill_confidence_summary)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill tone="info">
                      Blend status: {billInputs.bill_influence_label || "No bill-linked inputs"}
                    </StatusPill>
                    {(billInputs.linked_bill_domains || []).map((item) => (
                      <StatusPill key={item.domain} tone="default">
                        {item.domain} {item.count}
                      </StatusPill>
                    ))}
                  </div>
                </Panel>
              </div>
              <Panel padding="md">
                <h3 className="text-lg font-semibold text-white">Top linked bills</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  These are the strongest currently linked bills by bill-level BIS contribution within this president’s existing promise-linked legislative context.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(billInputs.top_linked_bills || []).length ? (
                  billInputs.top_linked_bills.slice(0, 4).map((item) => (
                    <Panel
                      key={item.slug || item.id}
                      as={Link}
                      href={item.detailHref}
                      padding="md"
                      interactive
                      className="flex min-w-0 flex-col"
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                            {item.billNumber}
                          </p>
                          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-white">
                            {item.title}
                          </h3>
                        </div>
                        <MetricCard
                          label="Bill BIS"
                          value={formatScore(item.blackImpactScore)}
                          density="compact"
                          tone="info"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.primaryDomain ? (
                          <StatusPill tone="default">
                            {item.primaryDomain}
                          </StatusPill>
                        ) : null}
                        {item.status ? (
                          <StatusPill tone={getBillStatusTone(item.status)}>
                            {item.status}
                          </StatusPill>
                        ) : null}
                        <StatusPill tone="info">
                          {formatBillRelationshipType(item.relationshipType)}
                        </StatusPill>
                        <StatusPill tone={getConfidenceTone(item.impactConfidence)}>
                          {item.impactConfidence} confidence
                        </StatusPill>
                      </div>
                      <p className="mt-3 line-clamp-4 text-sm leading-7 text-[var(--ink-soft)]">
                        {item.whyItMatters || "Open the bill detail page for the full tracked record and linked context."}
                      </p>
                    </Panel>
                  ))
                ) : (
                    <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)] md:col-span-2">
                      No linked bills are available to rank for this profile yet.
                    </Panel>
                  )}
                </div>
              </Panel>
            </>
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No tracked bills currently reach this president through supported promise lineage, so no bill-informed inputs are shown yet.
            </Panel>
          )}
        </div>
      </Panel>

      <section className="grid items-start gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 2xl:self-start">
          <ImpactTrendChart
            data={trend?.score_by_year || []}
            title="Impact over time"
            description={trend?.interpretation || "Read the yearly score path, cumulative movement, and strongest shifts over time."}
          />
          {!trend?.score_by_year?.length ? (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No dated outcome series are available for this profile yet.
            </Panel>
          ) : null}
        </div>
        <div className="space-y-4">
          <CategoryImpactChart
            data={topicData}
            title="Top contributing topics"
            description="Topic contributions explain where the score is actually coming from."
          />
          {!topicData.length ? (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              Topic-level contribution data is not available for this presidential record yet.
            </Panel>
          ) : null}
        </div>
      </section>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Top records"
          title="Policies and promises shaping this record"
          description="Open the most consequential underlying policies and promises instead of treating the presidential score as self-explanatory."
        />
        <div className="space-y-4 p-4">
          {topPolicies.length ? (
            <PresidentPolicyTable
              items={topPolicies}
              buildHref={(item) =>
                item.slug ? `/promises/${item.slug}` : `/policies/${buildPolicySlug(item)}`
              }
            />
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No top contributing policy records are attached to this profile yet.
            </Panel>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <SourceTrustPanel
              sourceCount={promiseTracker.visible_source_count}
              sourceQuality="Profile evidence references"
              confidenceLabel={president.direct_score_confidence || president.score_confidence}
              completenessLabel={`${promiseTracker.visible_outcome_count || 0} outcomes in visible promise set`}
              summary="The final score remains outcome-anchored. Bill-linked inputs can shift it modestly when promise-backed legislative lineage and bill evidence are strong enough to defend."
            />
            <PresidentScoreMethodologyNote />
            <CitationNote
              description={
                flagshipEditorial?.citationDescription ||
                "When referencing this presidential profile, cite the president name, page title, EquityStack, the page URL, and your access date. Treat the profile as a structured summary of the current dataset and its current evidence coverage."
              }
            />
            <ScoreExplanation title="How to interpret this presidential profile" />
            {profile.profileInsight ? (
              <InsightCard
                title={profile.profileInsight.title}
                text={profile.profileInsight.text}
              />
            ) : null}
            <MethodologyCallout
              description="Outcome-based score remains the anchor. Bill-informed inputs now add a bounded supporting modifier when the current Bills → Promises → Presidents lineage is strong enough to support it. Systemic score remains separate."
              linkLabel="Read score architecture"
            />
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="What shaped this score"
          title="Driver visibility"
          description="The presidential score should be readable as a structured result, not a mystery number. These drivers show where the strongest movement came from in the available dataset."
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel padding="md">
              <h3 className="text-lg font-semibold text-white">Strongest positive drivers</h3>
              {(scoreDrivers?.strongest_positive || []).length ? (
                <div className="mt-4 grid gap-3">
                  {scoreDrivers.strongest_positive.map((item, index) => (
                    <Panel key={`${item.slug || item.title}-${index}`} padding="md">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill tone="default">
                          {item.topic || item.category || "Policy record"}
                        </StatusPill>
                        <StatusPill tone={getImpactDirectionTone(item.status || item.impact_direction)}>
                          {item.status || item.impact_direction || "Scored record"}
                        </StatusPill>
                      </div>
                    </Panel>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                  {scoreDrivers?.score_scope_note || "This score is based on available policy records in the current EquityStack dataset."}
                </p>
              )}
            </Panel>
            <Panel padding="md">
              <h3 className="text-lg font-semibold text-white">Strongest negative drivers</h3>
              {(scoreDrivers?.strongest_negative || []).length ? (
                <div className="mt-4 grid gap-3">
                  {scoreDrivers.strongest_negative.map((item, index) => (
                    <Panel key={`${item.slug || item.title}-${index}`} padding="md">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusPill tone="default">
                          {item.topic || item.category || "Policy record"}
                        </StatusPill>
                        <StatusPill tone={getImpactDirectionTone(item.status || item.impact_direction)}>
                          {item.status || item.impact_direction || "Scored record"}
                        </StatusPill>
                      </div>
                    </Panel>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                  {scoreDrivers?.score_scope_note || "This score is based on available policy records in the current EquityStack dataset."}
                </p>
              )}
            </Panel>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel padding="md">
              <h3 className="text-lg font-semibold text-white">Topic contributions</h3>
              {(scoreDrivers?.topic_drivers || []).length ? (
                <div className="mt-4 grid gap-3">
                  {scoreDrivers.topic_drivers.map((item) => (
                    <Panel key={item.topic} padding="md">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-white">{item.topic}</p>
                        <span className="text-sm font-medium text-[var(--info)]">
                          {Number(item.raw_score_total || 0).toFixed(2)}
                        </span>
                      </div>
                    </Panel>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                  This score is based on available policy records in the current EquityStack dataset.
                </p>
              )}
            </Panel>
            <Panel padding="md" className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Impact Direction mix</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries({
                  Positive: scoreDrivers?.direction_breakdown?.Positive || 0,
                  Negative: scoreDrivers?.direction_breakdown?.Negative || 0,
                  Mixed: scoreDrivers?.direction_breakdown?.Mixed || 0,
                  Blocked: scoreDrivers?.direction_breakdown?.Blocked || 0,
                }).map(([label, value]) => (
                  <StatusPill key={label} tone={getImpactDirectionTone(label)}>
                    {humanizeToken(label)} {value}
                  </StatusPill>
                ))}
              </div>
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                Mixed and blocked outcomes stay visible because presidential scores should not hide conflicting or incomplete implementation.
              </p>
            </Panel>
          </div>
        </div>
      </Panel>

      <Panel id="promises" className={`${localSectionOffsetClass} overflow-hidden`}>
        <SectionHeader
          eyebrow="Promise tracker snapshot"
          title="Promise tracker context for this president"
          description="Promise status stays visible here because campaign and governing commitments help explain the broader historical record and policy impact on Black Americans."
        />
        <div className="space-y-4 p-4">
          <PromiseSystemExplanation />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Promises tracked"
              value={promiseTracker.visible_promise_count ?? 0}
              description="Visible promise records in the current tracker set."
              tone="info"
              density="compact"
            />
            {[
              ["Delivered", "Promises with documented implemented policy action."],
              ["In Progress", "Promises with ongoing or incomplete implementation."],
              ["Partial", "Meaningful but incomplete documented implementation."],
              ["Blocked", "Did not reach implementation because of visible barriers."],
              ["Failed", "Not fulfilled in the current documented record."],
            ].map(([label, description]) => (
              <MetricCard
                key={label}
                label={label}
                value={promiseStatusSnapshot[label] ?? 0}
                description={description}
                tone={getPromiseStatusTone(label)}
                density="compact"
              />
            ))}
          </div>
          <Panel padding="md" className="space-y-3">
            <h3 className="text-lg font-semibold text-white">How to interpret promise outcomes</h3>
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              Promise outcomes provide context for how stated goals translated into documented policy action. They help explain implementation, but they are not the same thing as presidential Impact Score.
            </p>
          </Panel>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Continue exploring"
          title="Where to go next from this presidential record"
          description="Profiles should lead naturally into compare, methodology, and underlying record detail."
        />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {(flagshipEditorial?.priorityLinks || []).map((item) => (
            <Panel
              key={item.href}
              as={Link}
              href={item.href}
              padding="md"
              interactive
            >
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.description}
              </p>
            </Panel>
          ))}
          <Panel as={Link} href="/research" padding="md" interactive>
            <h3 className="text-lg font-semibold text-white">Return to the research hub</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the curated research hub when this profile opens into a larger question about civil-rights law, thematic analysis, explainers, or public methods.
            </p>
          </Panel>
          <Panel as={Link} href="/analysis/presidential-impact-on-black-americans" padding="md" interactive>
            <h3 className="text-lg font-semibold text-white">Explore presidential impact on Black Americans</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Move into the broader synthesis page when you want to compare this presidency against the wider historical impact question rather than this profile alone.
            </p>
          </Panel>
          <Panel as={Link} href={`/compare/presidents?compare=${slug}`} padding="md" interactive>
            <h3 className="text-lg font-semibold text-white">Compare this president</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Add other presidents to compare direct score, systemic score, topic differences, and directional contrast.
            </p>
          </Panel>
          <Panel as={Link} href="/methodology" padding="md" interactive>
            <h3 className="text-lg font-semibold text-white">Review the methodology</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Read how low-coverage damping, confidence, evidence, and score-family separation work before drawing conclusions.
            </p>
          </Panel>
          <Panel as={Link} href="/reports/black-impact-score" padding="md" interactive>
            <h3 className="text-lg font-semibold text-white">Open the flagship report</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the report view when you want broader ranking context or public-facing interpretation across presidents.
            </p>
          </Panel>
        </div>
      </Panel>

      <Panel id="timeline" className={`${localSectionOffsetClass} overflow-hidden`}>
        <SectionHeader
          eyebrow="Timeline"
          title="Promise and policy chronology"
          description="The profile timeline helps users place campaign promises and policy movement into a clearer historical sequence."
        />
        <div className="p-4">
          {timelineItems.length ? (
            <PromiseTimeline items={timelineItems} />
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No dated promise records are attached to this profile yet.
            </Panel>
          )}
        </div>
      </Panel>

      <Panel id="related" className={`${localSectionOffsetClass} overflow-hidden`}>
        <SectionHeader
          eyebrow="Related routes"
          title="Keep researching this president through linked records"
          description="Every presidential profile should make it easy to move from summary into promises, legislation, comparison tools, and methodology."
        />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Panel as={Link} href={`/promises/president/${slug}`} padding="md" interactive>
            <h3 className="text-lg font-semibold text-white">Open this president&apos;s promise tracker</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Review delivered, partial, failed, and blocked promises for this presidency term in one place.
            </p>
          </Panel>
          <Panel as={Link} href={presidentPoliciesHref} padding="md" interactive>
            <h3 className="text-lg font-semibold text-white">Browse policies under {presidentName}</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Open the policy index filtered to this president to study legislation, executive actions, and court-era context tied to this record.
            </p>
          </Panel>
          <Panel as={Link} href="/explainers" padding="md" interactive>
            <h3 className="text-lg font-semibold text-white">Read related Black history explainers</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use explainers when you need more historical or legal context before returning to the president, promise, or policy detail pages.
            </p>
          </Panel>
        </div>
      </Panel>
    </main>
  );
}
