import Image from "next/image";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchHomePageData } from "@/lib/public-site-data";
import { resolvePresidentImageSrc } from "@/lib/president-image-paths";
import StructuredData from "@/app/components/public/StructuredData";
import { ScoreBadge, SectionIntro } from "@/app/components/public/core";
import { PresidentPortrait } from "@/app/components/public/entities";
import {
  getImpactDirectionTone,
  getPromiseStatusTone,
  MetricCard,
  Panel,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import TrustBar from "@/app/components/public/TrustBar";
import {
  buildCollectionPageJsonLd,
  buildDatasetJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Black history, presidents, promises, and policy impact",
  description:
    "Research Black history by president, campaign promises, civil rights policy, legislation, and measured policy impact on Black Americans.",
  path: "/",
  imagePath: "/images/hero/civil-rights-march.jpg",
  keywords: [
    "Black history by president",
    "presidents and Black Americans",
    "campaign promises to Black Americans",
    "civil rights policy",
    "legislation affecting Black Americans",
  ],
});

const HOME_EXPLAINER_PRIORITY = [
  "crime-statistics-context-and-misuse",
  "mass-incarceration-policy-history",
  "white-house-dei-economic-study",
  "hiring-discrimination-and-anti-dei-rollbacks",
  "government-benefits-racial-gap",
  "bootstraps-vs-policy-reality",
];

const START_HERE_STEPS = [
  {
    href: "/research/how-black-impact-score-works",
    step: "01",
    title: "Understand the Score",
    description:
      "See how policies, promises, sources, and outcomes are weighted.",
    cta: "Read score methodology",
  },
  {
    href: "/presidents",
    step: "02",
    title: "Explore a President",
    description:
      "Start with a presidential record and follow the receipts.",
    cta: "Explore presidential records",
  },
  {
    href: "/policies",
    step: "03",
    title: "Track Policy Impact",
    description:
      "Move from promises to policies and see what changed.",
    cta: "Open policy records",
  },
  {
    href: "/explainers",
    step: "04",
    title: "Break Down a Claim",
    description:
      "Use explainers to challenge common narratives with context and receipts.",
    cta: "Browse explainers",
  },
  {
    href: "/promises",
    step: "05",
    title: "Follow a Promise",
    description:
      "See how campaign commitments turn into actions, delays, and outcomes.",
    cta: "Open promise tracker",
  },
  {
    href: "/sources",
    step: "06",
    title: "Check the Sources",
    description:
      "Verify the evidence trail behind the records, arguments, and summaries.",
    cta: "Browse sources",
  },
];

const COUNT_FORMATTER = new Intl.NumberFormat("en-US");
const CURRENT_YEAR = new Date().getFullYear();
const HERO_TEXT_LINK_CLASS =
  "font-semibold text-white underline decoration-white/20 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(4,10,18,0.72)]";

function formatCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? COUNT_FORMATTER.format(numeric) : null;
}

function formatScore(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return value ?? "-";
  }

  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function getImpactTone(score) {
  const numeric = Number(score);

  if (!Number.isFinite(numeric)) {
    return "default";
  }

  if (numeric > 0) {
    return "positive";
  }

  if (numeric < 0) {
    return "negative";
  }

  return "default";
}

function getImpactLabel(score) {
  const numeric = Number(score);

  if (!Number.isFinite(numeric)) {
    return "Neutral or not yet measurable";
  }

  if (numeric >= 50) {
    return "Strong positive impact";
  }

  if (numeric >= 15) {
    return "Moderate positive impact";
  }

  if (numeric > 0) {
    return "Low positive impact";
  }

  if (numeric === 0) {
    return "Neutral or not yet measurable";
  }

  return "Negative impact range";
}

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTermLabel(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;

  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear}`;
  }

  if (Number.isFinite(startYear)) {
    return `${startYear}-Present`;
  }

  return null;
}

function termRecencyValue(termLabel = "") {
  if (!termLabel) {
    return 0;
  }

  if (/present/i.test(termLabel)) {
    return CURRENT_YEAR + 1;
  }

  const years = String(termLabel).match(/\d{4}/g) || [];
  const latestYear = Number(years[years.length - 1]);

  return Number.isFinite(latestYear) ? latestYear : 0;
}

function sortPresidentsByRecency(items = []) {
  return items.slice().sort((left, right) => {
    const yearDifference =
      termRecencyValue(right.termLabel) - termRecencyValue(left.termLabel);

    if (yearDifference !== 0) {
      return yearDifference;
    }

    return String(left.name || left.president || "").localeCompare(
      String(right.name || right.president || "")
    );
  });
}

function getCurrentStatusMeta({ overview = null, score = null } = {}) {
  const breakdown = overview?.impact_breakdown || {};
  const directionRows = ["Positive", "Negative", "Mixed", "Blocked"].map((direction) => ({
    direction,
    count: Number(breakdown[direction] || 0),
  }));
  const totalOutcomes = directionRows.reduce((total, item) => total + item.count, 0);

  if (totalOutcomes > 0) {
    const top = directionRows.slice().sort((left, right) => right.count - left.count)[0];
    const tieCount = directionRows.filter(
      (item) => item.count > 0 && item.count === top.count
    ).length;

    if (tieCount > 1 || top.direction === "Mixed") {
      return { label: "Mixed Outcomes", tone: "contested" };
    }

    if (top.direction === "Positive") {
      return { label: "Positive Direction", tone: "success" };
    }

    if (top.direction === "Negative") {
      return { label: "Negative Direction", tone: "danger" };
    }

    return { label: "Still Developing", tone: "info" };
  }

  const numericScore = Number(score);
  if (!Number.isFinite(numericScore) || numericScore === 0) {
    return { label: "Still Developing", tone: "info" };
  }

  return numericScore > 0
    ? { label: "Positive Direction", tone: "success" }
    : { label: "Negative Direction", tone: "danger" };
}

function getTopPolicyArea(currentSpotlight = {}) {
  const currentTopic = currentSpotlight.overview?.top_topics?.[0];

  if (currentTopic?.topic) {
    const evidencePoints = [
      currentTopic.action_count ? `${formatCount(currentTopic.action_count)} actions` : null,
      currentTopic.promise_count ? `${formatCount(currentTopic.promise_count)} promises` : null,
      currentTopic.summary || null,
    ].filter(Boolean);

    return {
      topic: currentTopic.topic,
      detail: evidencePoints.join(" | "),
    };
  }

  const scoredTopic = currentSpotlight.president?.top_topics?.[0];
  if (scoredTopic?.topic) {
    return {
      topic: scoredTopic.topic,
      detail: "Highest visible scored topic in this record.",
    };
  }

  return null;
}

function getCurrentRecordSummary({
  overview = null,
  president = null,
  score = null,
  topPolicyArea = null,
} = {}) {
  const impactLabel = getImpactLabel(score).toLowerCase();

  if (overview && topPolicyArea?.topic) {
    return `So far, this administration shows ${impactLabel}, with the most visible activity in ${topPolicyArea.topic} and tracked outcomes still developing.`;
  }

  if (overview) {
    return `So far, this administration shows ${impactLabel}, with tracked promises, actions, and documented outcomes still being reviewed.`;
  }

  if (president) {
    return `This most recent scored record currently reads as ${impactLabel}, with linked promises, actions, and documented outcomes still being reviewed.`;
  }

  return "This record is still developing.";
}

function selectFeaturedExplainers(items = [], limit = 4) {
  const explainersBySlug = new Map(
    items.filter((item) => item?.slug).map((item) => [item.slug, item])
  );
  const selected = [];
  const seen = new Set();

  for (const slug of HOME_EXPLAINER_PRIORITY) {
    const item = explainersBySlug.get(slug);
    if (item && !seen.has(item.slug)) {
      selected.push(item);
      seen.add(item.slug);
    }
    if (selected.length >= limit) {
      return selected;
    }
  }

  const fallbackItems = items
    .filter((item) => item?.slug && !seen.has(item.slug))
    .sort((left, right) => {
      const leftRank = left.argument_ready ? 1 : 0;
      const rightRank = right.argument_ready ? 1 : 0;

      if (rightRank !== leftRank) {
        return rightRank - leftRank;
      }

      return String(left.title || "").localeCompare(String(right.title || ""));
    });

  for (const item of fallbackItems) {
    selected.push(item);
    seen.add(item.slug);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function selectCurrentSpotlight(presidents = [], currentAdministration = null) {
  const presidentsBySlug = new Map(
    presidents.map((item) => [item.slug || item.president_slug, item])
  );

  if (currentAdministration?.president?.slug) {
    const scoredRecord = presidentsBySlug.get(currentAdministration.president.slug);

    return {
      president: {
        ...currentAdministration.president,
        ...scoredRecord,
        slug: scoredRecord?.slug || currentAdministration.president.slug,
        name:
          scoredRecord?.name ||
          currentAdministration.president.president ||
          currentAdministration.administration_name,
        party:
          scoredRecord?.party ||
          currentAdministration.president.president_party ||
          null,
        termLabel:
          scoredRecord?.termLabel ||
          formatTermLabel(
            currentAdministration.president.term_start,
            currentAdministration.president.term_end
          ),
      },
      overview: currentAdministration,
      usedFallback: false,
    };
  }

  // Prefer the most recent scored presidential record if the dedicated
  // current-administration overview is unavailable instead of hardcoding a term.
  const fallbackPresident = sortPresidentsByRecency(presidents)[0] || null;

  return {
    president: fallbackPresident,
    overview: null,
    usedFallback: Boolean(fallbackPresident),
  };
}

function PresidentRecordCard({ president }) {
  const imageSrc = resolvePresidentImageSrc({
    presidentSlug: president.slug || president.president_slug,
    presidentName: president.name || president.president,
  });
  const scoreValue =
    president.score ?? president.normalized_score_total ?? president.direct_normalized_score;
  const summaryMetric =
    scoreValue != null
      ? {
          label: "Impact score",
          value: formatScore(scoreValue),
        }
      : president.outcome_count != null
        ? {
            label: "Documented outcomes",
            value: formatCount(president.outcome_count),
          }
        : null;
  const metaLine = [president.party, president.termLabel].filter(Boolean).join(" | ");
  const presidentHref = `/presidents/${president.slug || president.president_slug}`;

  return (
    <Panel
      as={Link}
      href={presidentHref}
      padding="md"
      interactive
      className="flex h-full flex-col"
    >
      <div className="flex items-start gap-4">
        <PresidentPortrait
          imageSrc={imageSrc}
          alt={`${president.name || president.president} portrait`}
          context="card"
        />
        <div className="min-w-0">
          {metaLine ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              {metaLine}
            </p>
          ) : null}
          <h3 className="mt-2 text-base font-semibold text-white">
            {president.name || president.president}
          </h3>
          {president.narrative_summary ? (
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--ink-soft)]">
              {president.narrative_summary}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {summaryMetric?.label || "Presidential record"}
          </p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-white">
            {summaryMetric?.value || "Open"}
          </p>
        </div>
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
          View record
        </span>
      </div>
    </Panel>
  );
}

export default async function HomePage() {
  const { readiness, presidents, currentAdministration, explainers } =
    await fetchHomePageData();

  const featuredPresidents = sortPresidentsByRecency(presidents).slice(0, 10);
  const featuredExplainers = selectFeaturedExplainers(explainers, 4);
  const currentSpotlight = selectCurrentSpotlight(presidents, currentAdministration);
  const spotlightPresident = currentSpotlight.president;
  const spotlightImageSrc = spotlightPresident
    ? resolvePresidentImageSrc({
        presidentSlug: spotlightPresident.slug || spotlightPresident.president_slug,
        presidentName: spotlightPresident.name || spotlightPresident.president,
      })
    : null;
  const spotlightScore =
    spotlightPresident?.score ??
    spotlightPresident?.normalized_score_total ??
    spotlightPresident?.direct_normalized_score;
  const spotlightImpactLabel = getImpactLabel(spotlightScore);
  const spotlightStatus = getCurrentStatusMeta({
    overview: currentSpotlight.overview,
    score: spotlightScore,
  });
  const spotlightTopPolicyArea = getTopPolicyArea(currentSpotlight);
  const spotlightLatestDate = currentSpotlight.overview?.recent_activity?.find(
    (item) => item.latest_action_date
  )?.latest_action_date;
  const spotlightFeaturedRecords = (
    currentSpotlight.overview?.featured_records || []
  ).slice(0, 3);
  const spotlightStats = currentSpotlight.overview
    ? [
        {
          label: "Tracked promises",
          value: formatCount(currentSpotlight.overview.total_promises),
        },
        {
          label: "Actions recorded",
          value: formatCount(currentSpotlight.overview.total_actions),
        },
        {
          label: "Outcomes documented",
          value: formatCount(currentSpotlight.overview.total_outcomes),
        },
      ]
    : [
        spotlightPresident?.promise_count != null
          ? {
              label: "Tracked promises",
              value: formatCount(spotlightPresident.promise_count),
            }
          : null,
        spotlightPresident?.outcome_count != null
          ? {
              label: "Documented outcomes",
              value: formatCount(spotlightPresident.outcome_count),
            }
          : null,
        spotlightPresident?.linked_bill_count != null
          ? {
              label: "Linked bills",
              value: formatCount(spotlightPresident.linked_bill_count),
            }
          : null,
      ].filter(Boolean);
  const spotlightSummary = getCurrentRecordSummary({
    overview: currentSpotlight.overview,
    president: spotlightPresident,
    score: spotlightScore,
    topPolicyArea: spotlightTopPolicyArea,
  });
  const dataTools = [
    {
      href: "/presidents",
      title: "Presidential Records",
      summary:
        "Compare presidents through scores, timelines, promises, and linked policy records.",
      detail: presidents.length
        ? `${formatCount(presidents.length)} presidencies scored`
        : null,
    },
    {
      href: "/policies",
      title: "Policy Explorer",
      summary:
        "Open laws, executive actions, and court-linked records when you want the underlying evidence layer.",
      detail:
        readiness?.total_policy_outcomes != null
          ? `${formatCount(readiness.total_policy_outcomes)} documented outcomes`
          : null,
    },
    {
      href: "/promises",
      title: "Promise Tracker",
      summary:
        "Follow commitments, delivery status, and linked outcomes across administrations.",
      detail: currentSpotlight.overview?.total_promises
        ? `${formatCount(currentSpotlight.overview.total_promises)} current-term promises visible`
        : null,
    },
    {
      href: "/reports",
      title: "Reports",
      summary:
        "Use the synthesis layer when you want a broader narrative before returning to records and sources.",
      detail: null,
    },
  ];

  return (
    <main className="space-y-8 md:space-y-10">
      <StructuredData
        data={[
          buildCollectionPageJsonLd({
            title: "EquityStack home",
            description:
              "A public-interest research platform for Black history, U.S. presidents, campaign promises, legislation, and policy impact on Black Americans.",
            path: "/",
            about: [
              "Black history",
              "U.S. presidents",
              "campaign promises",
              "civil rights policy",
              "legislation affecting Black Americans",
            ],
            keywords: [
              "Black history by president",
              "Black policy research site",
              "policy impact on Black communities",
            ],
          }),
          buildDatasetJsonLd({
            title: "EquityStack public policy and promise dataset",
            description:
              "Structured public records used by EquityStack to connect presidents, policies, promises, reports, and historical context affecting Black Americans.",
            path: "/",
            about: [
              "Black Americans",
              "civil rights policy",
              "campaign promises",
              "historical legislation",
            ],
            keywords: [
              "presidential record on Black issues",
              "historical policy impact",
            ],
            variableMeasured: [
              "Black Impact Score",
              "Promise status",
              "Impact direction",
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
            className="scale-[1.02] object-cover object-center md:object-[center_38%]"
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
              EquityStack is a public-interest research platform for studying Black
              history through{" "}
              <Link href="/presidents" className={HERO_TEXT_LINK_CLASS}>
                presidents
              </Link>
              ,{" "}
              <Link href="/promises" className={HERO_TEXT_LINK_CLASS}>
                promises
              </Link>
              ,{" "}
              <Link href="/policies" className={HERO_TEXT_LINK_CLASS}>
                legislation
              </Link>
              , executive actions, and the documented{" "}
              <Link href="/reports/black-impact-score" className={HERO_TEXT_LINK_CLASS}>
                policy impact
              </Link>{" "}
              of government decisions on Black Americans.
            </p>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-white/80">
              No spin. Just receipts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#start-here" className="public-button-primary">
                Start Here
              </Link>
              <Link href="/presidents" className="public-button-secondary">
                Explore Presidents
              </Link>
            </div>
          </div>
        </div>

        <p className="absolute bottom-4 right-5 z-10 rounded-full border border-white/10 bg-[rgba(4,10,18,0.72)] px-3 py-1.5 text-[11px] font-medium tracking-[0.08em] text-[#d8e2ee] backdrop-blur-sm xl:right-8">
          March on Washington for Jobs and Freedom, 1963
        </p>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Presidential records"
          title="Track the Impact of U.S. Presidents"
          description="Compare presidential records through policies, promises, outcomes, and documented sources."
          actions={
            <Link href="/presidents" className="dashboard-button-secondary">
              View All Presidents
            </Link>
          }
        />
        {featuredPresidents.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {featuredPresidents.map((president) => (
              <PresidentRecordCard
                key={president.slug || president.president_slug}
                president={president}
              />
            ))}
          </div>
        ) : (
          <Panel padding="md">
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              Presidential records are not available in the current homepage payload
              yet. Open the presidents archive to continue into the full record set.
            </p>
          </Panel>
        )}
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Current context"
          title="What's Happening Right Now"
          description="Start with the current administration, see where the record is most active, then trace how promises and policies are changing over time."
        />
        {spotlightPresident ? (
          <Panel padding="md" className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <PresidentPortrait
                  imageSrc={spotlightImageSrc}
                  alt={`${spotlightPresident.name || spotlightPresident.president} portrait`}
                  context="hero"
                />
                <div className="min-w-0 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={currentSpotlight.overview ? "info" : "default"}>
                      {currentSpotlight.overview ? "Current administration" : "Most recent record"}
                    </StatusPill>
                    <StatusPill tone={spotlightStatus.tone}>
                      {spotlightStatus.label}
                    </StatusPill>
                    {spotlightPresident.party ? (
                      <StatusPill tone="default">{spotlightPresident.party}</StatusPill>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
                    {spotlightPresident.name || spotlightPresident.president}
                  </h2>
                  {spotlightPresident.termLabel ? (
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                      {spotlightPresident.termLabel}
                    </p>
                  ) : null}
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ink-soft)] md:text-base">
                    {spotlightSummary}
                  </p>
                  {spotlightTopPolicyArea ? (
                    <p className="mt-3 text-xs leading-6 text-[var(--ink-muted)]">
                      Most visible area right now: {spotlightTopPolicyArea.topic}
                      {spotlightTopPolicyArea.detail
                        ? ` | ${spotlightTopPolicyArea.detail}`
                        : ""}
                    </p>
                  ) : null}
                  {spotlightLatestDate ? (
                    <p className="mt-2 text-xs leading-6 text-[var(--ink-muted)]">
                      Latest reviewed update: {formatDate(spotlightLatestDate)}
                    </p>
                  ) : currentSpotlight.usedFallback ? (
                    <p className="mt-2 text-xs leading-6 text-[var(--ink-muted)]">
                      Current-administration overview unavailable in this build. Showing the most recent scored presidential record instead.
                    </p>
                  ) : null}
                </div>
              </div>
              {spotlightScore != null ? (
                <ScoreBadge
                  value={formatScore(spotlightScore)}
                  label="Black Impact Score"
                  tone={getImpactTone(spotlightScore)}
                  context={spotlightImpactLabel}
                />
              ) : null}
            </div>

            {spotlightStats.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {spotlightStats.map((item) => (
                  <MetricCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    density="compact"
                    tone="default"
                  />
                ))}
              </div>
            ) : null}

            {spotlightFeaturedRecords.length ? (
              <div className="space-y-3 border-t border-[var(--line)] pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Open the current record trail
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                    These are a few of the clearest current-term records to open next.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {spotlightFeaturedRecords.map((record) => (
                    <Link
                      key={record.slug}
                      href={`/promises/${record.slug}`}
                      className="panel-link p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {record.topic ? (
                          <StatusPill tone="default">{record.topic}</StatusPill>
                        ) : null}
                        {record.status ? (
                          <StatusPill tone={getPromiseStatusTone(record.status)}>
                            {record.status}
                          </StatusPill>
                        ) : null}
                        {record.impact_direction_for_curation ? (
                          <StatusPill
                            tone={getImpactDirectionTone(
                              record.impact_direction_for_curation
                            )}
                          >
                            {record.impact_direction_for_curation}
                          </StatusPill>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-white">
                        {record.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--ink-soft)]">
                        {record.summary ||
                          "Open the record for actions, outcomes, and linked sources."}
                      </p>
                      <span className="mt-4 block text-[12px] font-semibold text-[var(--ink-soft)]">
                        Open promise record
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <Link
                href={
                  currentSpotlight.overview
                    ? "/current-administration"
                    : `/presidents/${
                        spotlightPresident.slug || spotlightPresident.president_slug
                      }`
                }
                className="dashboard-button-secondary"
              >
                Explore Full Record -&gt;
              </Link>
            </div>
          </Panel>
        ) : (
          <Panel padding="md">
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              A current-administration spotlight is not available yet. Use the presidents
              archive to continue into the latest scored record.
            </p>
          </Panel>
        )}
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Narrative breakers"
          title="Breaking Down the Narratives"
          description="Quick, sourced explainers built to help people challenge misleading claims with context, data, and receipts."
          actions={
            <Link href="/explainers" className="dashboard-button-secondary">
              View All Explainers
            </Link>
          }
        />
        {featuredExplainers.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {featuredExplainers.map((item) => {
              const signalLabel =
                item.argument_signal_label ||
                (item.argument_ready ? "Argument-ready" : "Narrative breaker");
              const signalTone =
                item.argument_signal_label
                  ? item.argument_signal_tone || "info"
                  : item.argument_ready
                    ? "info"
                    : "default";

              return (
                <Panel
                  key={item.slug}
                  as={Link}
                  href={`/explainers/${item.slug}`}
                  padding="md"
                  interactive
                  className="flex h-full flex-col"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone="default">
                      {item.category || item.editorial_category_label || "Explainer"}
                    </StatusPill>
                    <StatusPill tone={signalTone}>{signalLabel}</StatusPill>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--ink-soft)]">
                    {item.summary ||
                      "Open the explainer for context, linked records, and supporting sources."}
                  </p>
                  <span className="mt-auto pt-4 text-[12px] font-semibold text-[var(--ink-soft)]">
                    Read explainer
                  </span>
                </Panel>
              );
            })}
          </div>
        ) : (
          <Panel padding="md">
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              Explainer records are not available in the current homepage payload yet.
              Use the explainer archive to continue into the published narrative library.
            </p>
          </Panel>
        )}
      </section>

      <section id="start-here" className="scroll-mt-32 space-y-4">
        <SectionIntro
          eyebrow="Guided path"
          title="New to EquityStack? Start Here."
          description="Follow a simple path from score and presidential context into policy, explainers, promises, and source verification."
          actions={
            <Link href="/start" className="dashboard-button-secondary">
              Open the full reading guide
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {START_HERE_STEPS.map((item) => (
            <Panel
              key={item.step}
              as={Link}
              href={item.href}
              padding="md"
              interactive
              className="flex h-full flex-col"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(132,247,198,0.24)] bg-[rgba(132,247,198,0.08)] text-sm font-semibold text-[var(--accent)]">
                {item.step}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                {item.description}
              </p>
              <span className="mt-auto pt-4 text-[12px] font-semibold text-[var(--ink-soft)]">
                {item.cta}
              </span>
            </Panel>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          eyebrow="Deeper tools"
          title="Dive Into the Data"
          description="Use the research tools when you're ready to go deeper."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dataTools.map((item) => (
            <Panel
              key={item.href}
              as={Link}
              href={item.href}
              padding="md"
              interactive
              className="flex h-full flex-col"
            >
              <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
                {item.summary}
              </p>
              {item.detail ? (
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                  {item.detail}
                </p>
              ) : null}
              <span className="mt-auto pt-4 text-[12px] font-semibold text-[var(--ink-soft)]">
                Open tool
              </span>
            </Panel>
          ))}
        </div>
        <TrustBar />
      </section>
    </main>
  );
}
