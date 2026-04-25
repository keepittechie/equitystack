import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  buildResearchCoverage,
  buildResearchStrengtheningNote,
} from "@/lib/evidenceCoverage";
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
import { getAgendaOverlapForPromiseRecords } from "@/lib/agendas";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CategoryImpactChart, ImpactTrendChart } from "@/app/components/public/charts";
import {
  CitationNote,
  MethodologyCallout,
  PresidentScoreMethodologyNote,
  SourceTrustPanel,
} from "@/app/components/public/core";
import ResearchCoveragePanel from "@/app/components/public/ResearchCoveragePanel";
import TrustBar from "@/app/components/public/TrustBar";
import PromiseSystemExplanation from "@/app/components/public/PromiseSystemExplanation";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import WhyThisScorePanel from "@/app/components/public/WhyThisScorePanel";
import DiscoveryGuidancePanel from "@/app/components/public/DiscoveryGuidancePanel";
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
import ShareCardPanel from "@/app/components/share/ShareCardPanel";
import { buildPresidentCardHref } from "@/lib/shareable-card-links";
import { getCasesForPolicy } from "@/lib/cases";

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

function truncateText(value, maxLength = 180) {
  const text = String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim().replace(/[.,;:\s]+$/, "")}...`;
}

function buildWhyThisPresidentScore(profile) {
  const { president, scoreComposition, scoreDrivers } = profile;
  const topicLabels = takeLabels(scoreDrivers?.topic_drivers, (item) => item.topic, 3);
  const directOutcomeCount = Number(scoreComposition?.direct?.outcome_count || 0);
  const confidenceLabel =
    president.direct_score_confidence || president.score_confidence || "Unknown";
  const directionCounts = scoreComposition?.direct?.direction_counts || {};
  const dominantDirection = Object.entries(directionCounts)
    .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))[0]?.[0];

  return {
    summary:
      scoreComposition?.summary_line ||
      "The presidential score starts from scored outcomes, then adds bounded intent, systemic, and bill-linked context.",
    items: [
      {
        label: "Main anchor",
        value: `${directOutcomeCount} scored outcomes`,
        detail:
          "The final presidential score starts with documented outcomes before broader interpretation layers are added.",
      },
      dominantDirection
        ? {
            label: "Dominant direction",
            value: `${humanizeToken(dominantDirection)}-leaning record`,
            detail:
              "Direction counts show whether the visible scored record leans more positive, negative, mixed, or blocked.",
          }
        : null,
      topicLabels.length
        ? {
            label: "Strongest topics",
            value: oxfordJoin(topicLabels),
            detail:
              "These issue areas currently do the most visible work in the presidential score narrative.",
          }
        : null,
      {
        label: "Evidence read",
        value: `${confidenceLabel} confidence`,
        detail:
          scoreDrivers?.score_scope_note ||
          "Confidence reflects how much outcome-backed record is currently visible for this profile.",
      },
    ].filter(Boolean),
    note: scoreComposition?.interpretation || null,
  };
}

function buildPresidentReferenceSynthesis(profile, researchCoverage) {
  const { president, promiseTracker, scoreComposition, scoreDrivers } = profile;
  const dominantDirection = Object.entries(scoreComposition?.direct?.direction_counts || {})
    .sort((left, right) => Number(right[1] || 0) - Number(left[1] || 0))[0]?.[0];
  const promiseCount =
    promiseTracker.visible_promise_count ?? promiseTracker.total_tracked_promises ?? 0;
  const outcomeCount = president.direct_outcome_count ?? president.outcome_count ?? 0;
  const topicLabels = takeLabels(scoreDrivers?.topic_drivers, (item) => item.topic, 3);

  return {
    summary:
      sentenceJoin([
        buildPresidentOverview(profile),
        scoreComposition?.summary_line || null,
      ]) ||
      "This profile organizes the visible scored outcomes, tracked promises, and current score context for one presidency.",
    items: [
      {
        label: "What defines this record",
        value: sentenceJoin([
          countLabel(outcomeCount, "scored outcome"),
          countLabel(promiseCount, "tracked promise"),
        ]),
        detail:
          "The profile starts from visible outcome-backed record, then widens into promise and bill-linked context where the current public data supports it.",
      },
      dominantDirection
        ? {
            label: "Current trend",
            value: `${humanizeToken(dominantDirection)}-leaning record`,
            detail:
              "This is the dominant direction in the current direct outcome mix, not a complete judgment of the presidency.",
          }
        : null,
      topicLabels.length
        ? {
            label: "Defining topics",
            value: oxfordJoin(topicLabels),
            detail:
              "These issue areas currently do the most visible work in the public score narrative.",
          }
        : null,
      researchCoverage
        ? {
            label: "Evidence read",
            value: researchCoverage.label,
            detail: researchCoverage.description,
          }
        : null,
    ].filter(Boolean),
    note:
      scoreComposition?.interpretation ||
      "Use the score as a starting point, then move into the underlying promises, policies, and bill context before treating this profile as settled.",
  };
}

function buildPresidentReferenceUtility({ profile, researchCoverage }) {
  const { president, promiseTracker } = profile;
  const presidentName = president.president || president.president_name || "President";
  const termLabel = formatTermLabel(promiseTracker.term_start, promiseTracker.term_end);
  const scoreValue =
    president.normalized_score_total ?? president.score ?? president.direct_normalized_score;
  const confidenceLabel = president.direct_score_confidence || president.score_confidence || null;
  const outcomeCount = president.direct_outcome_count ?? president.outcome_count ?? 0;
  const promiseCount =
    promiseTracker.visible_promise_count ?? promiseTracker.total_tracked_promises ?? 0;
  const referenceLine = [
    presidentName,
    termLabel !== "Historical record" ? termLabel : null,
    Number.isFinite(Number(scoreValue)) ? `Black Impact Score ${formatScore(scoreValue)}` : null,
    confidenceLabel ? `${confidenceLabel} confidence` : null,
    researchCoverage?.label || null,
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    description:
      "When referencing this presidential profile, name the president, EquityStack, the page URL, and your access date. For a stronger reference, also note the visible score context, the current confidence/evidence read, and that the profile is anchored in scored outcomes plus linked promise and legislative context.",
    referenceLine,
    items: [
      {
        label: "Name the profile",
        value: sentenceJoin([presidentName, termLabel !== "Historical record" ? termLabel : null]),
        detail:
          "This keeps the reference anchored to the specific presidential profile rather than to a general administration or era page.",
      },
      {
        label: "Anchor the score",
        value:
          sentenceJoin([
            Number.isFinite(Number(scoreValue)) ? `Black Impact Score ${formatScore(scoreValue)}` : null,
            confidenceLabel ? `${confidenceLabel} confidence` : null,
          ]) || "Score context still limited",
        detail:
          "Treat the score as a structured summary of the current visible dataset, not as a complete judgment of every action in a presidency.",
      },
      {
        label: "Describe the record base",
        value: sentenceJoin([
          countLabel(outcomeCount, "scored outcome"),
          countLabel(promiseCount, "tracked promise"),
        ]),
        detail:
          "These counts help explain what the current public profile is actually built from.",
      },
      {
        label: "Pair with methodology",
        value: researchCoverage?.label || "Coverage still developing",
        detail:
          "Pair the profile with the score methodology or underlying record tables when precision matters, especially if coverage is still developing.",
      },
    ],
  };
}

function buildPresidentNextReviewItems({
  slug,
  presidentName,
  topPolicies = [],
  flagshipEditorial = null,
}) {
  const items = [];
  const seen = new Set();

  const priorityLink = flagshipEditorial?.priorityLinks?.[0];
  if (priorityLink && !seen.has(priorityLink.href) && items.length < 4) {
    seen.add(priorityLink.href);
    items.push({
      label: "Priority path",
      tone: "info",
      title: priorityLink.title,
      description: priorityLink.description,
      href: priorityLink.href,
    });
  }

  const reportHref = "/reports/black-impact-score";
  if (!seen.has(reportHref) && items.length < 4) {
    seen.add(reportHref);
    items.push({
      label: "Flagship report",
      tone: "info",
      title: "Open the flagship report",
      description:
        "Use the report view when you want broader ranking and historical comparison context beyond this single presidential profile.",
      href: reportHref,
    });
  }

  const compareHref = `/compare/presidents?compare=${slug}`;
  if (!seen.has(compareHref) && items.length < 4) {
    seen.add(compareHref);
    items.push({
      label: "Compare presidents",
      tone: "info",
      title: `Compare ${presidentName} against other presidents`,
      description:
        "Use the compare view when you want to test whether this score pattern is distinctive or relatively narrow against other presidencies.",
      href: compareHref,
    });
  }

  const promiseHref = `/promises/president/${slug}`;
  if (!seen.has(promiseHref) && items.length < 4) {
    seen.add(promiseHref);
    items.push({
      label: "Promise tracker",
      tone: "default",
      title: `Open ${presidentName}'s promise tracker`,
      description:
        "Use the promise tracker when you want the fuller delivered, partial, blocked, and failed commitment record behind this profile.",
      href: promiseHref,
    });
  }

  const topRecord = (topPolicies || [])[0];
  if (topRecord && items.length < 4) {
    const href = topRecord.slug ? `/promises/${topRecord.slug}` : `/policies/${buildPolicySlug(topRecord)}`;
    if (!seen.has(href)) {
      seen.add(href);
      items.push({
        label: topRecord.slug ? "Connected promise" : "Underlying policy",
        tone: topRecord.slug ? "default" : "info",
        title: topRecord.title,
        meta: [topRecord.topic || topRecord.category || null, topRecord.status || topRecord.impact_direction || null]
          .filter(Boolean)
          .join(" • "),
        description:
          topRecord.summary ||
          "Open one of the strongest currently surfaced underlying records shaping the visible presidential profile.",
        href,
      });
    }
  }

  return items.slice(0, 4);
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

function formatQuickReadCountList(items = []) {
  return items
    .filter((item) => Number(item.value || 0) > 0)
    .map((item) => `${Number(item.value)} ${item.label}`)
    .join(", ");
}

function buildPresidentQuickRead({
  profile,
  legalContext = null,
  agendaOverlap = null,
}) {
  const {
    president,
    promiseTracker,
    topPolicies = [],
    promises = [],
    scoreComposition,
    scoreDrivers,
  } = profile;
  const promiseCount =
    promiseTracker.visible_promise_count ??
    promiseTracker.total_tracked_promises ??
    0;
  const outcomeCount = president.direct_outcome_count ?? president.outcome_count ?? 0;
  const topicLabels = takeLabels(scoreDrivers?.topic_drivers, (item) => item.topic, 3);
  const promiseTitles = takeLabels(promises, (item) => item.title, 2);
  const topPolicyTitles = takeLabels(topPolicies, (item) => item.title, 2);
  const directionSummary = formatQuickReadCountList([
    {
      label: "positive",
      value: scoreComposition?.direct?.direction_counts?.Positive,
    },
    {
      label: "mixed",
      value: scoreComposition?.direct?.direction_counts?.Mixed,
    },
    {
      label: "negative",
      value: scoreComposition?.direct?.direction_counts?.Negative,
    },
    {
      label: "blocked",
      value: scoreComposition?.direct?.direction_counts?.Blocked,
    },
  ]);
  const promiseStatusSummary = formatQuickReadCountList([
    {
      label: "delivered",
      value:
        promiseTracker.visible_delivered_count ??
        promiseTracker.delivered_count,
    },
    {
      label: "partial",
      value: promiseTracker.visible_partial_count ?? promiseTracker.partial_count,
    },
    {
      label: "blocked",
      value: promiseTracker.visible_blocked_count ?? promiseTracker.blocked_count,
    },
    {
      label: "failed",
      value: promiseTracker.visible_failed_count ?? promiseTracker.failed_count,
    },
  ]);
  const linkedBillCount = Number(president.bill_impact_inputs?.linked_bill_count || 0);
  const blockedOrPartialCount =
    Number(promiseTracker.visible_blocked_count ?? promiseTracker.blocked_count ?? 0) +
    Number(promiseTracker.visible_partial_count ?? promiseTracker.partial_count ?? 0);

  const triedItems = [
    topicLabels.length
      ? `The visible record centers on ${oxfordJoin(topicLabels)}.`
      : null,
    promiseCount > 0
      ? `The promise tracker includes ${countLabel(promiseCount, "commitment")}${
          promiseTitles.length ? `, including ${oxfordJoin(promiseTitles)}` : ""
        }.`
      : null,
    topPolicyTitles.length
      ? `The main policy record surfaces ${oxfordJoin(topPolicyTitles)}.`
      : null,
  ].filter(Boolean).slice(0, 3);

  const happenedItems = [
    outcomeCount > 0
      ? `Documented scoring is anchored in ${countLabel(
          outcomeCount,
          "outcome"
        )}${directionSummary ? `: ${directionSummary}` : ""}.`
      : null,
    promiseStatusSummary
      ? `Promise outcomes currently include ${promiseStatusSummary} records.`
      : null,
    topPolicyTitles.length
      ? `Top visible records include ${oxfordJoin(topPolicyTitles)}.`
      : null,
  ].filter(Boolean).slice(0, 3);

  const meaning = filterParagraphs([
    scoreComposition?.interpretation || scoreComposition?.summary_line || null,
  ]).slice(0, 2);

  const shapedItems = [
    blockedOrPartialCount > 0
      ? `${countLabel(
          blockedOrPartialCount,
          "visible promise"
        )} were blocked or only partly implemented.`
      : null,
    linkedBillCount > 0
      ? `${countLabel(
          linkedBillCount,
          "linked bill"
        )} shape the legislative context without replacing outcome evidence.`
      : null,
    legalContext?.linked_case_count
      ? `${countLabel(
          legalContext.linked_case_count,
          "verified linked case"
        )} add legal context through visible policy records.`
      : null,
    agendaOverlap?.linked_agenda_item_count
      ? `${countLabel(
          agendaOverlap.linked_agenda_item_count,
          "tracked agenda item"
        )} overlap with already linked public records.`
      : null,
  ].filter(Boolean).slice(0, 3);

  if (!triedItems.length || !happenedItems.length || !meaning.length) {
    return null;
  }

  return {
    triedItems,
    happenedItems,
    meaning,
    shapedItems,
  };
}

function QuickReadSection({ title, children }) {
  return (
    <Panel padding="md" className="space-y-3">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {children}
    </Panel>
  );
}

function PresidentQuickReadPanel({ quickRead = null }) {
  if (!quickRead) {
    return null;
  }

  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        eyebrow="Plain-language summary"
        title="Quick Read"
        description="A short readout from the visible promise, policy, outcome, and context data on this page."
      />
      <div className="grid gap-4 p-4 lg:grid-cols-2">
        <QuickReadSection title="What they tried to do">
          <ul className="space-y-2 text-sm leading-7 text-[var(--ink-soft)]">
            {quickRead.triedItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--info)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </QuickReadSection>
        <QuickReadSection title="What actually happened">
          <ul className="space-y-2 text-sm leading-7 text-[var(--ink-soft)]">
            {quickRead.happenedItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--success)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </QuickReadSection>
        <QuickReadSection title="What it meant">
          <div className="space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
            {quickRead.meaning.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </QuickReadSection>
        {quickRead.shapedItems.length ? (
          <QuickReadSection title="What shaped the results">
            <ul className="space-y-2 text-sm leading-7 text-[var(--ink-soft)]">
              {quickRead.shapedItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--warning)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </QuickReadSection>
        ) : null}
      </div>
    </Panel>
  );
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

function AgendaOverlapPanel({ overlap = null }) {
  if (!overlap) {
    return null;
  }

  const topLinkedRecords = overlap.linked_records.slice(0, 3);

  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        eyebrow="Tracked agenda"
        title="Project 2025 overlap"
        description="This is a grounded overlap summary based on already linked public records. It is not a score, and it does not imply that every similar action originated with the agenda."
        action={
          <Link
            href={`/${["agendas", overlap.agenda_slug].join("/")}`}
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
          >
            Open the agenda tracker
          </Link>
        }
      />
      <div className="space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Linked agenda items"
            value={overlap.linked_agenda_item_count}
            description="Tracked agenda items touched by this president’s visible linked records."
            tone="verified"
            density="compact"
            showDot
          />
          <MetricCard
            label="Linked records"
            value={overlap.linked_record_count}
            description="Currently grounded promise-tracker records connected to those agenda items."
            tone="info"
            density="compact"
            showDot
          />
          <MetricCard
            label="Top overlap domain"
            value={overlap.top_domain?.domain || "No dominant area"}
            description={
              overlap.top_domain
                ? `${overlap.top_domain.count} linked agenda item${overlap.top_domain.count === 1 ? "" : "s"} in the strongest visible overlap area.`
                : "Domain concentration is not visible yet."
            }
            tone="default"
            density="compact"
          />
        </div>
        <Panel padding="md" className="space-y-3">
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            This president currently has {overlap.linked_record_count} linked record{overlap.linked_record_count === 1 ? "" : "s"} touching{" "}
            {overlap.linked_agenda_item_count} tracked Project 2025 agenda item{overlap.linked_agenda_item_count === 1 ? "" : "s"}. The overlap reflects existing record links only.
          </p>
          {overlap.top_domains.length ? (
            <div className="flex flex-wrap gap-2">
              {overlap.top_domains.map((item) => (
                <StatusPill key={item.domain} tone="default">
                  {item.domain} {item.count}
                </StatusPill>
              ))}
              {overlap.implemented_agenda_item_count > 0 ? (
                <StatusPill tone="verified">
                  Implemented linked items {overlap.implemented_agenda_item_count}
                </StatusPill>
              ) : null}
            </div>
          ) : null}
          {topLinkedRecords.length ? (
            <div className="grid gap-2 text-sm leading-6 text-[var(--ink-soft)]">
              {topLinkedRecords.map((item) => (
                <p key={item.slug}>
                  <Link href={item.href} className="font-medium text-white hover:text-white">
                    {item.title}
                  </Link>
                  <span className="text-[var(--ink-muted)]">
                    {" "}
                    • {item.linked_agenda_item_count} linked agenda item{item.linked_agenda_item_count === 1 ? "" : "s"}
                  </span>
                  {item.status ? (
                    <span className="text-[var(--ink-muted)]"> • {item.status}</span>
                  ) : null}
                </p>
              ))}
            </div>
          ) : null}
        </Panel>
      </div>
    </Panel>
  );
}

function buildPresidentLegalContext(policyRecords = []) {
  const caseMap = new Map();
  const domainCounts = new Map();

  for (const policy of policyRecords || []) {
    if (policy?.slug || !policy?.id) {
      continue;
    }

    for (const linkedCase of getCasesForPolicy(policy.id)) {
      const key = `${linkedCase.case_id}:${linkedCase.relationship}`;

      if (!caseMap.has(key)) {
        caseMap.set(key, {
          ...linkedCase,
          linked_policy_count: 0,
          linked_policy_titles: [],
        });
      }

      const existing = caseMap.get(key);
      existing.linked_policy_count += 1;

      if (policy.title && existing.linked_policy_titles.length < 3) {
        existing.linked_policy_titles.push(policy.title);
      }
    }
  }

  const linkedCases = [...caseMap.values()].sort((left, right) => {
    if (right.linked_policy_count !== left.linked_policy_count) {
      return right.linked_policy_count - left.linked_policy_count;
    }

    return String(left.title || "").localeCompare(String(right.title || ""));
  });

  for (const linkedCase of linkedCases) {
    for (const domain of linkedCase.domains || []) {
      const label = humanizeToken(domain);
      domainCounts.set(label, Number(domainCounts.get(label) || 0) + 1);
    }
  }

  if (!linkedCases.length) {
    return null;
  }

  const topDomains = [...domainCounts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((left, right) => right.count - left.count || left.domain.localeCompare(right.domain))
    .slice(0, 3);

  return {
    linked_case_count: linkedCases.length,
    top_domains: topDomains,
    top_cases: linkedCases.slice(0, 3),
  };
}

function PresidentLegalContextPanel({ context = null }) {
  if (!context?.linked_case_count) {
    return null;
  }

  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        eyebrow="Legal context"
        title="Related Cases"
        description="Verified linked cases provide related legal context for policy records already visible in this presidential profile."
      />
      <div className="space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard
            label="Linked cases"
            value={context.linked_case_count}
            description="Verified case links attached through this profile's visible policy records."
            tone="info"
            density="compact"
            showDot
          />
          <MetricCard
            label="Top legal domains"
            value={context.top_domains.length ? context.top_domains.map((item) => item.domain).join(", ") : "No dominant area"}
            description="Domains are derived from linked case metadata only."
            tone="default"
            density="compact"
          />
        </div>
        <Panel padding="md" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {context.top_domains.map((item) => (
              <StatusPill key={item.domain} tone="default">
                {item.domain} {item.count}
              </StatusPill>
            ))}
          </div>
          <div className="grid gap-3">
            {context.top_cases.map((item) => (
              <Panel
                key={`${item.case_id}-${item.relationship}`}
                padding="md"
                className="space-y-3"
              >
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone="info">Linked case</StatusPill>
                  {item.type ? (
                    <StatusPill tone="default">{humanizeToken(item.type)}</StatusPill>
                  ) : null}
                  {item.status ? (
                    <StatusPill tone="default">{humanizeToken(item.status)}</StatusPill>
                  ) : null}
                  <StatusPill tone="default">
                    {item.relationship_label || humanizeToken(item.relationship)}
                  </StatusPill>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  {item.summary ? (
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      {truncateText(item.summary)}
                    </p>
                  ) : null}
                  {item.linked_policy_titles.length ? (
                    <p className="mt-2 text-[12px] leading-6 text-[var(--ink-muted)]">
                      Linked policy context: {item.linked_policy_titles.join("; ")}
                    </p>
                  ) : null}
                </div>
              </Panel>
            ))}
          </div>
        </Panel>
      </div>
    </Panel>
  );
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
  const whyThisScore = buildWhyThisPresidentScore(profile);
  const localSectionOffsetClass = "scroll-mt-28 md:scroll-mt-32";
  const visiblePromiseCount =
    promiseTracker.visible_promise_count ?? promiseTracker.total_tracked_promises ?? 0;
  const linkedBillCount = Number(billInputs.linked_bill_count || 0);
  const researchCoverage = buildResearchCoverage({
    sourceCount: promiseTracker.visible_source_count ?? 0,
    outcomeCount: president.direct_outcome_count ?? president.outcome_count ?? 0,
    relatedRecordCount: visiblePromiseCount + linkedBillCount,
    hasScore: Number.isFinite(
      Number(president.normalized_score_total ?? president.score ?? president.direct_normalized_score)
    ),
    confidenceLabel: president.direct_score_confidence || president.score_confidence || null,
  });
  const researchStrengtheningNote = buildResearchStrengtheningNote({
    sourceCount: promiseTracker.visible_source_count ?? 0,
    outcomeCount: president.direct_outcome_count ?? president.outcome_count ?? 0,
    relatedRecordCount: visiblePromiseCount + linkedBillCount,
    hasScore: Number.isFinite(
      Number(president.normalized_score_total ?? president.score ?? president.direct_normalized_score)
    ),
  });
  const presidentReferenceSynthesis = buildPresidentReferenceSynthesis(
    profile,
    researchCoverage
  );
  const presidentReferenceUtility = buildPresidentReferenceUtility({
    profile,
    researchCoverage,
  });
  const bestNextReviewItems = buildPresidentNextReviewItems({
    slug,
    presidentName,
    topPolicies,
    flagshipEditorial,
  });
  const agendaOverlap = getAgendaOverlapForPromiseRecords(promises, "project-2025");
  const legalContext = buildPresidentLegalContext(topPolicies);
  const quickRead = buildPresidentQuickRead({
    profile,
    legalContext,
    agendaOverlap,
  });
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
  const showLocalNavigation = localNavigationItems.length >= 3;

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

      <PresidentQuickReadPanel quickRead={quickRead} />

      {showLocalNavigation ? (
        <div className="space-y-1.5">
          <p className="px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            On this page
          </p>
          <EquityStackTabbar
            items={localNavigationItems}
            ariaLabel="President page sections"
            defaultHref="#overview"
          />
        </div>
      ) : null}

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
          <WhyThisScorePanel
            eyebrow="Profile synthesis"
            title="Read this presidency in one pass"
            summary={presidentReferenceSynthesis.summary}
            items={presidentReferenceSynthesis.items}
            note={presidentReferenceSynthesis.note}
            actionHref={`/compare/presidents?compare=${slug}`}
            actionLabel="Compare this president"
          />
          <WhyThisScorePanel
            summary={whyThisScore.summary}
            items={whyThisScore.items}
            note={whyThisScore.note}
            actionHref="/research/how-black-impact-score-works"
            actionLabel="Read the scoring method"
          />
          <ResearchCoveragePanel
            coverage={researchCoverage}
            strengtheningNote={researchStrengtheningNote}
          />
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

      <ShareCardPanel
        pagePath={`/presidents/${slug}`}
        cardPath={buildPresidentCardHref({ slug })}
        title="Share this presidential profile or its card"
        description="Use the page link when you want the full profile, or open the share card for a cleaner summary view."
      />

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
              title="How to reference this record"
              description={
                flagshipEditorial?.citationDescription ||
                presidentReferenceUtility.description
              }
              referenceLine={presidentReferenceUtility.referenceLine}
              items={presidentReferenceUtility.items}
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

      {agendaOverlap ? <AgendaOverlapPanel overlap={agendaOverlap} /> : null}
      {legalContext ? <PresidentLegalContextPanel context={legalContext} /> : null}

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Continue exploring"
          title="Where to go next from this presidential record"
          description="Start with the curated next-step panel first. The cards below keep the wider set of compare, methodology, report, and research paths visible."
        />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <DiscoveryGuidancePanel
              eyebrow="Best context to read next"
              title="Start with this curated next step before browsing the full linked set"
              description="Use this short path when you want the clearest next click first. The broader compare, report, methodology, and research routes remain visible below."
              items={bestNextReviewItems}
            />
          </div>
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
