import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  buildPolicySlug,
  deriveMetricLabel,
  deriveProgramLabel,
  fetchPromisePageData,
  formatConfidenceLabel,
  formatImpactValue,
} from "@/lib/public-site-data";
import {
  buildResearchCoverage,
  buildResearchStrengtheningNote,
  buildEvidenceCoverage,
  buildEvidenceStrengtheningNote,
} from "@/lib/evidenceCoverage";
import {
  countLabel,
  filterParagraphs,
  isThinText,
  sentenceJoin,
} from "@/lib/editorial-depth";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  CitationNote,
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
  SourceTrustPanel,
} from "@/app/components/public/core";
import ResearchCoveragePanel from "@/app/components/public/ResearchCoveragePanel";
import PromiseStatusLegend from "@/app/components/public/PromiseStatusLegend";
import PromiseProvenanceChain from "@/app/components/public/PromiseProvenanceChain";
import WhyThisScorePanel from "@/app/components/public/WhyThisScorePanel";
import DiscoveryGuidancePanel from "@/app/components/public/DiscoveryGuidancePanel";
import LinkedAgendaItemsPanel from "@/app/components/public/LinkedAgendaItemsPanel";
import {
  EvidenceSourceList,
  PolicyCardList,
  PromiseHero,
  PromiseTimeline,
} from "@/app/components/public/entities";
import EquityStackTabbar from "@/app/components/dashboard/EquityStackTabbar";
import {
  MetricCard,
  Panel,
  SectionHeader,
  StatusPill,
  getConfidenceTone,
  getImpactDirectionTone,
  getPromiseStatusTone,
} from "@/app/components/dashboard/primitives";
import {
  buildBreadcrumbJsonLd,
  buildPromiseJsonLd,
} from "@/lib/structured-data";
import ShareCardPanel from "@/app/components/share/ShareCardPanel";
import { buildPromiseCardHref } from "@/lib/shareable-card-links";
import { getLinkedAgendaItemsForEntity } from "@/lib/agendas";

export const dynamic = "force-dynamic";

function formatTermLabel(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;
  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear}`;
  }
  return null;
}

function formatSignedScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "—";
  }

  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2)}`;
}

function formatSourceDateLabel(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function isSupportingDemographicImpact(impact) {
  return /^Supporting evidence\s*-/i.test(String(impact?.metric_name || "").trim());
}

function buildPromiseDemographicImpactSections(impacts = []) {
  const directOutcomeImpacts = impacts.filter((impact) => !isSupportingDemographicImpact(impact));
  const supportingImpacts = impacts.filter((impact) => isSupportingDemographicImpact(impact));
  const sections = [];

  if (directOutcomeImpacts.length) {
    sections.push({
      key: "direct",
      title: "Direct outcomes",
      description: supportingImpacts.length
        ? "These rows capture the clearest direct Black-impact outcomes currently attached to this promise record."
        : null,
      items: directOutcomeImpacts,
    });
  }

  if (supportingImpacts.length) {
    sections.push({
      key: "supporting",
      title: "Supporting evidence",
      description: directOutcomeImpacts.length
        ? "These rows add usage, participation, or implementation context that helps explain the promise's Black-impact read."
        : null,
      items: supportingImpacts,
    });
  }

  return sections;
}

function countUniquePromiseEvidenceSources(promise) {
  const seen = new Set();

  const addSource = (source) => {
    const key = source?.id || source?.source_id || source?.source_url || source?.url || source?.source_title;
    if (key) {
      seen.add(String(key));
    }
  };

  for (const action of promise.actions || []) {
    for (const source of action.action_sources || action.sources || []) {
      addSource(source);
    }
  }

  for (const outcome of promise.outcomes || []) {
    for (const source of outcome.outcome_sources || outcome.sources || []) {
      addSource(source);
    }
  }

  for (const impact of promise.demographic_impacts || []) {
    for (const source of impact.sources || []) {
      addSource(source);
    }
  }

  return seen.size;
}

function buildPromiseDemographicContextBridge(promise, evidenceCount) {
  const explainer = (promise.related_explainers || [])[0] || null;
  const relatedPolicyCount = Number((promise.related_policies || []).length || 0);

  if (!explainer && !relatedPolicyCount && !evidenceCount) {
    return null;
  }

  return {
    explainer,
    relatedPolicyCount,
    evidenceCount,
  };
}

function PromiseDemographicImpactCard({ impact }) {
  const supporting = isSupportingDemographicImpact(impact);
  const metricLabel = deriveMetricLabel(impact.metric_name);

  return (
    <Panel padding="md" className="space-y-5">
      <div className="space-y-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Focus
        </p>
        <h3 className="text-lg font-semibold text-white">
          {deriveProgramLabel(impact.metric_name)}
        </h3>
        {metricLabel ? (
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            {metricLabel}
          </p>
        ) : null}
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {supporting ? "Supporting metric" : "Measured outcome"}
          </dt>
          <dd className="mt-2 text-sm leading-7 text-white">
            {formatImpactValue(impact)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Affected group
          </dt>
          <dd className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
            {impact.demographic_group || "Not specified"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Confidence
          </dt>
          <dd className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
            {formatConfidenceLabel(impact.confidence_score)}
          </dd>
        </div>
        {impact.methodology_note ? (
          <div className="sm:col-span-2">
            <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
              Notes
            </dt>
            <dd className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              {impact.methodology_note}
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            Sources
          </dt>
          {(impact.sources || []).length ? (
            <dd className="mt-3 space-y-3">
              {(impact.sources || []).map((source, index) => (
                <div
                  key={`${source.id || source.source_url || source.source_title}-${index}`}
                  className="space-y-1"
                >
                  <a
                    href={source.source_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium leading-6 text-white underline decoration-white/20 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
                  >
                    {source.source_title || source.source_url || "Source"}
                  </a>
                  <p className="text-sm leading-6 text-[var(--ink-soft)]">
                    {[
                      source.source_role === "primary" ? "Primary source" : null,
                      source.publisher || null,
                      formatSourceDateLabel(source.published_date),
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                  {source.citation_note ? (
                    <p className="text-sm leading-6 text-[var(--ink-soft)]">
                      {source.citation_note}
                    </p>
                  ) : null}
                </div>
              ))}
            </dd>
          ) : (
            <dd className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
              No linked sources are attached to this impact row yet.
            </dd>
          )}
        </div>
      </dl>
    </Panel>
  );
}

function PromisePanel({ children, className = "", ...props }) {
  return (
    <section
      {...props}
      className={`rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4 ${className}`}
    >
      {children}
    </section>
  );
}

function flattenPromiseSources(promise) {
  const items = [];
  for (const action of promise.actions || []) {
    for (const source of action.action_sources || []) {
      items.push(source);
    }
  }
  for (const outcome of promise.outcomes || []) {
    for (const source of outcome.outcome_sources || []) {
      items.push(source);
    }
  }
  return items;
}

const PROMISE_TOPIC_MATTER_NOTES = {
  "Civil Rights":
    "This matters because civil-rights policy changes how strongly equal treatment and federal protection are enforced in practice.",
  "Criminal Justice":
    "This matters because criminal-justice policy can change policing, sentencing, incarceration, and long-term civic consequences.",
  Economy:
    "This matters because economic policy affects jobs, pay, benefits, and who gets access to financial stability.",
  Education:
    "This matters because education policy shapes school access, public investment, and long-term opportunity.",
  Healthcare:
    "This matters because healthcare policy affects coverage, treatment access, and health outcomes.",
  Housing:
    "This matters because housing policy shapes neighborhood access, wealth building, and exposure to discrimination or displacement.",
  Immigration:
    "This matters because immigration policy can change legal status, work access, family stability, and local enforcement pressure.",
  Infrastructure:
    "This matters because infrastructure policy shapes public investment, service access, and who benefits from long-term development.",
  "Public Safety":
    "This matters because public-safety policy can widen or narrow state power over policing, punishment, and community safety.",
  "Voting Rights":
    "This matters because voting rules and district maps can change representation and the strength of Black political power.",
  Workforce:
    "This matters because workforce policy affects hiring, wages, labor protections, and access to jobs.",
};

function normalizeInlineText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureSentence(value) {
  const normalized = normalizeInlineText(value);
  if (!normalized) {
    return null;
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function takeLeadingSentences(value, maxSentences = 2) {
  const normalized = normalizeInlineText(value);
  if (!normalized) {
    return null;
  }

  const matches = normalized.match(/[^.!?]+[.!?]?/g) || [normalized];
  const sentences = matches
    .map((item) => ensureSentence(item))
    .filter(Boolean)
    .slice(0, maxSentences);

  return sentences.length ? sentences.join(" ") : null;
}

function getPromiseEvidenceBaseLabel({ researchCoverage, evidenceCount, actionCount, linkedPolicyCount }) {
  if (researchCoverage?.label === "Well-supported analysis") {
    return "Evidence base: relatively strong";
  }

  if (researchCoverage?.label === "Developing evidence base") {
    return "Evidence base: still developing";
  }

  if (researchCoverage?.label === "Early analysis") {
    return "Evidence base: still thin";
  }

  if (evidenceCount > 0 || actionCount > 0 || linkedPolicyCount > 0) {
    return "Evidence base: limited but visible";
  }

  return "Evidence base: sparse";
}

function buildPromiseShortAnswer(promise) {
  const summaryAnswer = takeLeadingSentences(promise.summary, 2);
  if (summaryAnswer) {
    return summaryAnswer;
  }

  const title = ensureSentence(promise.title);
  if (title) {
    return sentenceJoin([
      `This page tracks ${title}`,
      promise.topic ? `It sits in ${String(promise.topic).toLowerCase()}.` : null,
    ]);
  }

  const topic = promise.topic ? String(promise.topic).toLowerCase() : "this issue";
  return `${promise.president || "This administration"} made a public commitment on ${topic}.`;
}

function inferPromiseMatterNote(promise) {
  if (PROMISE_TOPIC_MATTER_NOTES[promise.topic]) {
    return PROMISE_TOPIC_MATTER_NOTES[promise.topic];
  }

  const combinedText = normalizeInlineText(
    [
      promise.topic,
      promise.title,
      promise.promise_text,
      promise.summary,
      ...(promise.related_policies || []).map((item) => item?.title),
    ]
      .filter(Boolean)
      .join(" ")
  ).toLowerCase();

  if (
    /(section 2|section 5|voting rights|vote-dilution|redistrict|district map|districting|ballot|election|preclearance)/.test(
      combinedText
    )
  ) {
    return PROMISE_TOPIC_MATTER_NOTES["Voting Rights"];
  }

  if (/(civil rights|equal protection|desegreg|discrimination|segregation)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Civil Rights"];
  }

  if (/(criminal justice|sentenc|incarcer|prison|policing|crime)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Criminal Justice"];
  }

  if (/(housing|mortgage|homeownership|redlin|rent|tenant)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Housing"];
  }

  if (/(school|education|student|college|university)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Education"];
  }

  if (/(health|medicaid|medicare|hospital|insurance)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Healthcare"];
  }

  if (/(workforce|employment|hiring|labor|union|wage|job)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Workforce"];
  }

  if (/(economy|economic|tax|income|poverty|benefit|welfare)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Economy"];
  }

  if (/(immigration|border|deport|asylum|citizenship)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Immigration"];
  }

  if (/(infrastructure|transportation|bridge|road|broadband|water system)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Infrastructure"];
  }

  if (/(public safety|law enforcement)/.test(combinedText)) {
    return PROMISE_TOPIC_MATTER_NOTES["Public Safety"];
  }

  return "This matters because the real question is not just what was promised, but whether the statement changed policy or outcomes.";
}

function buildWhyPromiseMatters(
  promise,
  { linkedPolicyCount = 0, outcomeCount = 0 } = {}
) {
  const topicNote = inferPromiseMatterNote(promise);
  const promiseType = String(promise.promise_type || "").toLowerCase();
  const followThroughNote = promiseType.includes("judicial")
    ? "Court rulings can narrow or expand enforcement even when the underlying law stays on the books."
    : linkedPolicyCount > 0 || outcomeCount > 0
      ? "This record already links to visible policy action or outcomes, so the follow-through question is concrete rather than rhetorical."
      : "The public question is whether the statement led to visible follow-through once it met the real policy process.";

  return sentenceJoin([topicNote, followThroughNote]);
}

function buildPromiseCurrentRead({
  promise,
  blackImpactSummary,
  researchCoverage,
  evidenceCount,
  actionCount,
  linkedPolicyCount,
  outcomeCount,
}) {
  const impactRead = blackImpactSummary
    ? `Impact read: ${blackImpactSummary.direction_label}`
    : outcomeCount > 0 || linkedPolicyCount > 0
      ? "Impact read: not yet fully established"
      : "Impact read: not yet developed";

  return [
    promise.status ? `Status: ${promise.status}` : "Status: not yet resolved",
    promise.confidence_label ? `Confidence: ${promise.confidence_label}` : null,
    impactRead,
    getPromiseEvidenceBaseLabel({
      researchCoverage,
      evidenceCount,
      actionCount,
      linkedPolicyCount,
    }),
  ]
    .filter(Boolean)
    .join(". ")
    .concat(".");
}

function buildPromiseNextBestStep({
  promise,
  evidenceCount,
  presidentProfileHref,
}) {
  const firstPolicy = (promise.related_policies || [])[0];
  if (firstPolicy) {
    return {
      href: `/policies/${buildPolicySlug(firstPolicy)}`,
      lead: "Open the linked policy record",
      title: firstPolicy.title,
      description:
        "It is the clearest concrete policy record behind this promise.",
    };
  }

  const firstExplainer = (promise.related_explainers || [])[0];
  if (firstExplainer?.slug) {
    return {
      href: `/explainers/${firstExplainer.slug}`,
      lead: "Read the linked explainer",
      title: firstExplainer.title,
      description:
        firstExplainer.summary ||
        "It adds the broader legal, historical, or policy context behind this record.",
    };
  }

  if (evidenceCount > 0) {
    return {
      href: "#evidence",
      lead: "Inspect the source trail",
      title: "Source trail",
      description:
        "It shows which public sources currently support the status and outcome record.",
    };
  }

  if (presidentProfileHref) {
    return {
      href: presidentProfileHref,
      lead: "Compare with the president profile",
      title: "President profile",
      description:
        "It shows how this single promise fits into the president's broader record.",
    };
  }

  return {
    href: "/promises",
    lead: "Browse related promise records",
    title: "Promise index",
    description:
      "It helps compare this promise against the wider record in the tracker.",
  };
}

function buildPromiseTopline({
  promise,
  blackImpactSummary,
  researchCoverage,
  evidenceCount,
  actionCount,
  linkedPolicyCount,
  outcomeCount,
  presidentProfileHref,
}) {
  return {
    shortAnswer: buildPromiseShortAnswer(promise),
    whyItMatters: buildWhyPromiseMatters(promise, {
      linkedPolicyCount,
      outcomeCount,
    }),
    currentRead: buildPromiseCurrentRead({
      promise,
      blackImpactSummary,
      researchCoverage,
      evidenceCount,
      actionCount,
      linkedPolicyCount,
      outcomeCount,
    }),
    nextBestStep: buildPromiseNextBestStep({
      promise,
      evidenceCount,
      presidentProfileHref,
    }),
  };
}

function buildPromiseOverview(promise) {
  return sentenceJoin([
    promise.promise_type
      ? `This page tracks a ${promise.promise_type.toLowerCase()} public commitment.`
      : "This page tracks a public commitment.",
    promise.topic
      ? `It sits in ${promise.topic.toLowerCase()}.`
      : null,
    "It keeps the original statement separate from the governing record that followed.",
  ]);
}

function buildPromiseComparisonNote(promise) {
  const actions = countLabel((promise.actions || []).length, "action");
  const outcomes = countLabel((promise.outcomes || []).length, "outcome");
  const linkedPolicies = countLabel(
    (promise.related_policies || []).length,
    "linked policy",
    "linked policies"
  );

  return sentenceJoin([
    `Use this page to compare the original commitment against ${actions}, ${outcomes}, and ${linkedPolicies} in the current EquityStack dataset.`,
    promise.confidence_label
      ? `The current evidence confidence is ${promise.confidence_label.toLowerCase()}, so readers should keep the source trail and linked records in view while interpreting the status.`
      : "Keep the linked records and source trail in view while interpreting the current status.",
  ]);
}

function buildPromiseGuideCards(promise) {
  const thinSummary = isThinText(promise.summary, 140);

  return [
    {
      eyebrow: "What this page tracks",
      title: "Promise language, status, and follow-through",
      description: sentenceJoin([
        buildPromiseOverview(promise),
        `The page separates the statement itself from the public record used to classify the promise today.`,
      ]),
    },
    {
      eyebrow: "What to compare",
      title: "Compare the promise against policy action and outcomes",
      description:
        "Do not stop at the status label. Compare the promise text to linked policies, dated actions, and outcome evidence to understand how implementation did or did not take shape.",
    },
    {
      eyebrow: "Coverage note",
      title: thinSummary ? "This record needs surrounding context" : "Use the record as an accountability layer",
      description: thinSummary
        ? buildPromiseComparisonNote(promise)
        : "Even when the summary is stronger, the best use of a promise page is to read it alongside the linked policies, presidential profile, and report or explainer context.",
    },
  ];
}

function buildPromiseContextParagraphs(promise) {
  const actionCount = (promise.actions || []).length;
  const outcomeCount = (promise.outcomes || []).length;
  const policyCount = (promise.related_policies || []).length;
  const explainerCount = (promise.related_explainers || []).length;

  return filterParagraphs([
    sentenceJoin([
      `This page answers a narrower question than a campaign speech or presidency summary: what was promised, how is it currently classified, and what visible record supports that read today?`,
      buildPromiseOverview(promise),
    ]),
    sentenceJoin([
      `The page currently connects ${countLabel(actionCount, "documented action")}, ${countLabel(
        outcomeCount,
        "linked outcome"
      )}, ${countLabel(policyCount, "related policy")}, and ${countLabel(
        explainerCount,
        "related explainer"
      )} where those joins exist in the dataset.`,
      `That makes it more useful as an accountability page than as a stand-alone statement page.`,
    ]),
    sentenceJoin([
      `Status is only one layer of interpretation.`,
      `The stronger read comes from comparing the promise text, status rationale, linked policy record, and source trail together.`,
    ]),
  ]);
}

function buildPromiseRecordSynthesis({
  promise,
  actionCount,
  outcomeCount,
  linkedPolicyCount,
  blackImpactSummary,
  researchCoverage,
}) {
  const downstreamValue = blackImpactSummary
    ? `${blackImpactSummary.direction_label} downstream read`
    : outcomeCount > 0
      ? "Documented downstream record"
      : actionCount > 0 || linkedPolicyCount > 0
        ? "Partial visible follow-through"
        : "Downstream record still limited";
  const downstreamDetail = blackImpactSummary
    ? sentenceJoin([
        blackImpactSummary.explanation_summary || null,
        "This downstream interpretation is derived from linked outcomes and remains separate from the Promise Tracker status label.",
      ])
    : outcomeCount > 0
      ? "The page has linked outcomes or related policies, so the downstream record is more than a status label alone."
      : actionCount > 0 || linkedPolicyCount > 0
        ? "There is some visible implementation or policy linkage, but the fuller downstream outcome record is still limited."
        : "Right now the page is strongest as a commitment-and-status record, not as a fully developed downstream impact record.";

  return {
    summary: sentenceJoin([
      promise.summary || buildPromiseOverview(promise),
      "Use the items below to compare the stated promise, the current status, and the visible follow-through in one place.",
    ]),
    items: [
      {
        label: "What was promised",
        value: promise.status ? `${promise.status} promise record` : "Tracked promise record",
        detail: promise.promise_text || promise.summary || buildPromiseOverview(promise),
      },
      {
        label: "What happened after",
        value: sentenceJoin([
          countLabel(actionCount, "documented action"),
          countLabel(outcomeCount, "linked outcome"),
          countLabel(linkedPolicyCount, "related policy"),
        ]),
        detail:
          "Use the provenance chain below to connect promise language to actions, outcomes, related policies, and any current Black-impact layer.",
      },
      {
        label: "Downstream read",
        value: downstreamValue,
        detail: downstreamDetail,
      },
      researchCoverage
        ? {
            label: "Evidence read",
            value: researchCoverage.label,
            detail: researchCoverage.description,
          }
        : null,
    ].filter(Boolean),
    note:
      "Promise status and downstream Black-impact interpretation are kept separate on purpose. Read them together, not as the same thing.",
  };
}

function buildPromiseReferenceUtility({
  promise,
  actionCount,
  outcomeCount,
  linkedPolicyCount,
  researchCoverage,
}) {
  const termLabel = formatTermLabel(promise.term_start, promise.term_end);
  const referenceLine = [
    promise.title,
    promise.president || null,
    termLabel || null,
    promise.status ? `Status: ${promise.status}` : null,
    researchCoverage?.label || null,
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    description:
      "When referencing this promise record, name the promise, president or administration context, EquityStack, the page URL, and your access date. For a stronger reference, also note the current status, the visible downstream action or outcome trail, and whether the supporting research base is still developing.",
    referenceLine,
    items: [
      {
        label: "Name the promise",
        value: sentenceJoin([
          promise.title,
          promise.promise_type ? `${promise.promise_type} record` : null,
        ]),
        detail:
          "This keeps the reference anchored to the specific promise record rather than to a broader campaign or presidency summary.",
      },
      {
        label: "Anchor the context",
        value:
          sentenceJoin([
            promise.president || null,
            termLabel || null,
            promise.topic || null,
          ]) || "Promise tracker context",
        detail:
          "Use presidency, term, or topic context when you need to place the promise inside a wider administrative or campaign record.",
      },
      {
        label: "Describe the current read",
        value:
          sentenceJoin([
            promise.status ? `Status: ${promise.status}` : null,
            promise.confidence_label ? `${promise.confidence_label} confidence` : null,
          ]) || "Status still limited",
        detail:
          "The status label is a tracker classification. It should be read alongside the evidence and downstream record, not as a full impact judgment.",
      },
      {
        label: "Pair with downstream record",
        value: sentenceJoin([
          countLabel(actionCount, "documented action"),
          countLabel(outcomeCount, "linked outcome"),
          countLabel(linkedPolicyCount, "related policy"),
        ]),
        detail:
          "Use the provenance chain, linked policies, and source trail when precision matters, especially if the record is still developing.",
      },
    ],
  };
}

function buildPromiseContextItems({
  promise,
  presidentPromiseHref,
  presidentProfileHref,
  presidentPoliciesHref,
}) {
  const items = [];
  const seen = new Set();
  const explainer = (promise.related_explainers || []).find((item) => item?.slug && item?.title);

  if (explainer) {
    const href = `/explainers/${explainer.slug}`;
    seen.add(href);
    items.push({
      label: explainer.category || "Context explainer",
      tone: "info",
      title: explainer.title,
      description:
        explainer.summary ||
        "Use the explainer when you need broader historical or legal context around this promise record.",
      href,
    });
  }

  const reportHref = "/reports/black-impact-score";
  if (!seen.has(reportHref)) {
    seen.add(reportHref);
    items.push({
      label: "Flagship report",
      tone: "info",
      title: "Black Impact Score",
      description:
        "Read the flagship report when you want to place this promise inside the wider presidential score and historical policy context.",
      href: reportHref,
    });
  }

  if (presidentProfileHref && !seen.has(presidentProfileHref) && items.length < 4) {
    seen.add(presidentProfileHref);
    items.push({
      label: "President profile",
      tone: "default",
      title: `Read ${promise.president}'s presidential record`,
      description:
        "Move from this single promise into the wider presidential profile, including score context, policy drivers, and broader historical framing.",
      href: presidentProfileHref,
    });
  }

  const firstPolicy = (promise.related_policies || [])[0];
  if (firstPolicy && items.length < 4) {
    const href = `/policies/${buildPolicySlug(firstPolicy)}`;
    if (!seen.has(href)) {
      seen.add(href);
      items.push({
        label: "Related policy",
        tone: "default",
        title: firstPolicy.title,
        description:
          firstPolicy.summary ||
          "Open the clearest linked policy record when you need the concrete implementation or legal record behind this promise.",
        href,
      });
    }
  }

  if (presidentPromiseHref && !seen.has(presidentPromiseHref) && items.length < 4) {
    seen.add(presidentPromiseHref);
    items.push({
      label: "Promise tracker",
      tone: "default",
      title: `Read ${promise.president}'s full promise tracker`,
      description:
        "See how this promise fits into the wider delivered, partial, failed, and blocked record for the same president.",
      href: presidentPromiseHref,
    });
  }

  if (presidentPoliciesHref && !seen.has(presidentPoliciesHref) && items.length < 4) {
    items.push({
      label: "Policy context",
      tone: "default",
      title: "Browse related policy records",
      description:
        "Open the policy explorer to see the legislation, executive actions, and court decisions that help explain this promise record.",
      href: presidentPoliciesHref,
    });
  }

  return items.slice(0, 4);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const promise = await fetchPromisePageData(slug);

  if (!promise) {
    return buildPageMetadata({
      title: "Promise Not Found",
      description: "The requested promise record could not be found.",
      path: `/promises/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${promise.title} | Promise Tracker record`,
    description:
      promise.summary ||
      `Review a promise record from ${promise.president || "the public tracker"} with status rationale, evidence, linked policies, and outcomes affecting Black Americans.`,
    path: `/promises/${slug}`,
    keywords: [
      promise.president,
      promise.topic,
      "campaign promises to Black Americans",
      "promise tracker",
    ].filter(Boolean),
  });
}

export default async function PromiseDetailPage({ params }) {
  const { slug } = await params;
  const promise = await fetchPromisePageData(slug);

  if (!promise) {
    notFound();
  }

  const timelineItems = (promise.actions || []).map((item) => ({
    action_date: item.action_date,
    title: item.title,
    description: item.description,
  }));
  const evidence = flattenPromiseSources(promise);
  const demographicImpacts = Array.isArray(promise.demographic_impacts)
    ? promise.demographic_impacts
    : [];
  const blackImpactSummary =
    promise.black_impact_summary && Number(promise.black_impact_summary.outcome_count || 0) > 0
      ? promise.black_impact_summary
      : null;
  const whyStatus =
    promise.review_summary ||
    promise.summary ||
    "A detailed status rationale has not been written yet for this promise record.";
  const linkedPolicyCount = (promise.related_policies || []).length;
  const policyOutcomeCount = (promise.outcomes || []).length;
  const actionCount = (promise.actions || []).length;
  const guideCards = buildPromiseGuideCards(promise);
  const thinSummary = isThinText(promise.summary, 140);
  const thinRationale = isThinText(promise.review_summary, 120);
  const presidentPromiseHref = promise.president_slug
    ? `/promises/president/${promise.president_slug}`
    : null;
  const presidentProfileHref = promise.president_slug
    ? `/presidents/${promise.president_slug}`
    : null;
  const presidentPoliciesHref = promise.president
    ? `/policies?president=${encodeURIComponent(promise.president)}`
    : "/policies";
  const contextParagraphs = buildPromiseContextParagraphs(promise);
  const localSectionOffsetClass = "scroll-mt-28 md:scroll-mt-32";
  const directDemographicImpactCount = demographicImpacts.filter(
    (impact) => !isSupportingDemographicImpact(impact)
  ).length;
  const supportingDemographicImpactCount = demographicImpacts.length - directDemographicImpactCount;
  const demographicImpactSections = buildPromiseDemographicImpactSections(demographicImpacts);
  const blackImpactEvidenceSourceCount = countUniquePromiseEvidenceSources(promise);
  const blackImpactCoverage =
    blackImpactSummary || demographicImpacts.length
      ? buildEvidenceCoverage({
          sourceCount: blackImpactEvidenceSourceCount,
          demographicImpactCount: demographicImpacts.length,
          directImpactCount: directDemographicImpactCount,
          supportingImpactCount: supportingDemographicImpactCount,
          hasScore: Boolean(blackImpactSummary),
        })
      : null;
  const blackImpactStrengtheningNote = blackImpactCoverage
    ? buildEvidenceStrengtheningNote({
        sourceCount: blackImpactEvidenceSourceCount,
        demographicImpactCount: demographicImpacts.length,
        directImpactCount: directDemographicImpactCount,
        supportingImpactCount: supportingDemographicImpactCount,
        hasScore: Boolean(blackImpactSummary),
      })
    : null;
  const showBlackImpactSection = Boolean(
    blackImpactSummary || demographicImpacts.length || blackImpactCoverage
  );
  const demographicContextBridge = buildPromiseDemographicContextBridge(
    promise,
    blackImpactEvidenceSourceCount
  );
  const researchCoverage = buildResearchCoverage({
    sourceCount:
      (promise.source_summary?.action_sources || 0) +
      (promise.source_summary?.outcome_sources || 0),
    outcomeCount: policyOutcomeCount,
    relatedRecordCount:
      linkedPolicyCount +
      Number((promise.related_explainers || []).length || 0) +
      Number(Boolean(presidentProfileHref)) +
      Number(Boolean(presidentPromiseHref)),
    hasScore: Boolean(blackImpactSummary),
    confidenceLabel: promise.confidence_label || null,
  });
  const researchStrengtheningNote = buildResearchStrengtheningNote({
    sourceCount:
      (promise.source_summary?.action_sources || 0) +
      (promise.source_summary?.outcome_sources || 0),
    outcomeCount: policyOutcomeCount,
    relatedRecordCount:
      linkedPolicyCount +
      Number((promise.related_explainers || []).length || 0) +
      Number(Boolean(presidentProfileHref)) +
      Number(Boolean(presidentPromiseHref)),
    hasScore: Boolean(blackImpactSummary),
  });
  const promiseRecordSynthesis = buildPromiseRecordSynthesis({
    promise,
    actionCount,
    outcomeCount: policyOutcomeCount,
    linkedPolicyCount,
    blackImpactSummary,
    researchCoverage,
  });
  const promiseTopline = buildPromiseTopline({
    promise,
    blackImpactSummary,
    researchCoverage,
    evidenceCount: evidence.length,
    actionCount,
    linkedPolicyCount,
    outcomeCount: policyOutcomeCount,
    presidentProfileHref,
  });
  const promiseReferenceUtility = buildPromiseReferenceUtility({
    promise,
    actionCount,
    outcomeCount: policyOutcomeCount,
    linkedPolicyCount,
    researchCoverage,
  });
  const promiseContextItems = buildPromiseContextItems({
    promise,
    presidentPromiseHref,
    presidentProfileHref,
    presidentPoliciesHref,
  });
  const linkedAgendaItems = getLinkedAgendaItemsForEntity("promise", promise.slug);
  const localNavigationItems = [
    ...(showBlackImpactSection
      ? [
          {
            href: "#black-impact",
            label: "Black impact",
            count: demographicImpacts.length || undefined,
          },
        ]
      : []),
    ...(actionCount || policyOutcomeCount || linkedPolicyCount || showBlackImpactSection
      ? [
          {
            href: "#provenance",
            label: "What happened",
          },
        ]
      : []),
    { href: "#status", label: "Status" },
    ...(evidence.length
      ? [{ href: "#evidence", label: "Evidence", count: evidence.length }]
      : []),
    ...(timelineItems.length
      ? [{ href: "#timeline", label: "Timeline", count: timelineItems.length }]
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
              { href: "/promises", label: "Promises" },
              { label: promise.title },
            ],
            `/promises/${slug}`
          ),
          buildPromiseJsonLd(promise),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/promises", label: "Promises" },
          { label: promise.title },
        ]}
      />

      <PromiseHero
        title={promise.title}
        statement={promise.promise_text || promise.summary}
        status={promise.status}
        president={promise.president}
        termLabel={formatTermLabel(promise.term_start, promise.term_end)}
        badges={[
          promise.topic,
          promise.promise_type,
          promise.campaign_or_official,
          promise.confidence_label ? `Confidence: ${promise.confidence_label}` : null,
        ].filter(Boolean)}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <SectionHeader
          eyebrow="Start here"
          title="Plain-English summary"
          description="What happened, why it matters, what EquityStack currently knows, and the clearest next click."
        />
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Panel padding="md" className="space-y-3">
            <StatusPill tone="info">Short answer</StatusPill>
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              {promiseTopline.shortAnswer}
            </p>
          </Panel>
          <Panel padding="md" className="space-y-3">
            <StatusPill tone="info">Why it matters</StatusPill>
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              {promiseTopline.whyItMatters}
            </p>
          </Panel>
          <Panel padding="md" className="space-y-3">
            <StatusPill tone={getPromiseStatusTone(promise.status)}>
              Current read
            </StatusPill>
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              {promiseTopline.currentRead}
            </p>
            <p className="text-xs leading-6 text-[var(--ink-muted)]">
              Status = whether the promise followed through. Impact = what the
              downstream effects look like so far.
            </p>
          </Panel>
          <Panel padding="md" className="space-y-3">
            <StatusPill tone="info">Next best step</StatusPill>
            <p className="text-sm leading-7 text-[var(--ink-soft)]">
              {promiseTopline.nextBestStep.lead}:{" "}
              <Link
                href={promiseTopline.nextBestStep.href}
                className="font-semibold text-white underline decoration-white/20 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
              >
                {promiseTopline.nextBestStep.title}
              </Link>
              . {promiseTopline.nextBestStep.description}
            </p>
          </Panel>
        </div>
      </Panel>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Current status"
          value={promise.status || "Unknown"}
          description="Whether EquityStack thinks the promise followed through in the current public record."
          tone={getPromiseStatusTone(promise.status)}
          showDot
        />
        <MetricCard
          label="Confidence"
          value={promise.confidence_label || "Not yet available"}
          description="How strong the current evidence trail is for that status."
          tone={getConfidenceTone(promise.confidence_label)}
          showDot
        />
        <MetricCard
          label="Linked policy actions"
          value={linkedPolicyCount}
          description={`${actionCount} documented action record${actionCount === 1 ? "" : "s"} currently attached.`}
          tone="info"
        />
        <MetricCard
          label="Policy outcomes"
          value={policyOutcomeCount}
          description={`${evidence.length} visible evidence source${evidence.length === 1 ? "" : "s"} in the current trail.`}
          tone="verified"
        />
      </section>

      <Panel prominence="primary" className="overflow-hidden">
        <SectionHeader
          eyebrow="Read the full record"
          title="Status, follow-through, and evidence in one frame"
          description="After the plain-English summary above, use this section to inspect how the status was assigned and how much public record supports it."
        />
        <div className="space-y-4 p-4">
          <WhyThisScorePanel
            eyebrow="Record synthesis"
            title="Record snapshot"
            summary={promiseRecordSynthesis.summary}
            items={promiseRecordSynthesis.items}
            note={promiseRecordSynthesis.note}
            actionHref="#provenance"
            actionLabel="Jump to provenance"
          />
          <ResearchCoveragePanel
            coverage={researchCoverage}
            strengtheningNote={researchStrengtheningNote}
          />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
            <div className="space-y-4">
              <Panel padding="md" className="space-y-3">
                <StatusPill tone="info">Record guide</StatusPill>
                <h3 className="text-base font-semibold text-white">
                  How to read the detailed record
                </h3>
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                  Start with the promise language and the plain-English summary
                  above, then compare the current status against linked actions,
                  outcomes, and sources.
                </p>
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                  The key question is not just whether the promise was stated.
                  It is how much visible follow-through the public record
                  currently shows.
                </p>
              </Panel>
              <Panel padding="md" className="space-y-3">
                <StatusPill tone="info">Why this promise matters</StatusPill>
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                  {buildWhyPromiseMatters(promise, {
                    linkedPolicyCount,
                    outcomeCount: policyOutcomeCount,
                  })}
                </p>
                <p className="text-sm leading-6 text-[var(--ink-soft)]">
                  {buildPromiseOverview(promise)}
                </p>
              </Panel>
            </div>
            <div className="space-y-4">
              <PromiseStatusLegend statuses={["Delivered", "In Progress", "Partial", "Blocked", "Failed"]} />
              <PageContextBlock
                title="What the page includes"
                description="This page keeps the original commitment, the current status read, linked actions, and the evidence trail in one place."
                detail="Use it when you want the public record behind one promise without losing sight of the broader presidency or policy context."
              />
            </div>
          </div>
        </div>
      </Panel>

      <ShareCardPanel
        pagePath={`/promises/${slug}`}
        cardPath={buildPromiseCardHref(promise)}
        title="Share this promise record or its card"
        description="Use the page link for the full accountability record, or open the share card for a cleaner stand-alone summary."
      />

      {showLocalNavigation ? (
        <div className="space-y-1.5">
          <p className="px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            On this page
          </p>
          <EquityStackTabbar
            items={localNavigationItems}
            ariaLabel="Promise page sections"
            defaultHref="#status"
          />
        </div>
      ) : null}

      {showBlackImpactSection ? (
        <PromisePanel id="black-impact" className={`${localSectionOffsetClass} space-y-5`}>
          <SectionIntro
            eyebrow="Black impact"
            title="Promise-level Black-impact analysis"
            description="When EquityStack has structured demographic-impact analysis for a promise, it appears here as a bounded evidence layer alongside the tracker status, actions, and outcomes."
          />
          {blackImpactSummary ? (
            <Panel padding="md" prominence="primary" className="space-y-4">
              <StatusPill tone={getImpactDirectionTone(blackImpactSummary.direction)}>
                Black impact
              </StatusPill>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,13rem)_1fr] lg:items-start">
                <div className="space-y-2">
                  <p className="text-3xl font-semibold tracking-[-0.04em] text-white">
                    {blackImpactSummary.direction_label}
                  </p>
                  <p className="text-sm leading-6 text-[var(--ink-soft)]">
                    Outcome-based read across{" "}
                    {countLabel(blackImpactSummary.outcome_count, "scored outcome")}
                  </p>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    Net outcome score {formatSignedScore(blackImpactSummary.total_score)}
                  </p>
                </div>
                <div className="space-y-3">
                  {blackImpactSummary.explanation_summary ? (
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">
                      {blackImpactSummary.explanation_summary}
                    </p>
                  ) : null}
                  <p className="text-sm leading-7 text-[var(--ink-soft)]">
                    This summary is derived from linked promise outcomes and stays separate from the Promise Tracker status label.
                  </p>
                  {blackImpactSummary.confidence_label ? (
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">
                      Current confidence read:{" "}
                      {String(blackImpactSummary.confidence_label).toLowerCase()}.
                    </p>
                  ) : null}
                  {blackImpactSummary.systemic_explanation_summary ? (
                    <p className="text-sm leading-7 text-[var(--ink-soft)]">
                      {blackImpactSummary.systemic_explanation_summary}
                    </p>
                  ) : null}
                </div>
              </div>
            </Panel>
          ) : null}
          {blackImpactCoverage ? (
            <Panel padding="md" className="space-y-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                Analysis coverage
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={blackImpactCoverage.tone}>
                  {blackImpactCoverage.label}
                </StatusPill>
              </div>
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                {blackImpactCoverage.description}
              </p>
              {blackImpactStrengtheningNote ? (
                <div className="space-y-2 border-t border-[var(--line)] pt-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                    {blackImpactStrengtheningNote.title}
                  </p>
                  <p className="text-sm leading-7 text-[var(--ink-soft)]">
                    {blackImpactStrengtheningNote.description}
                  </p>
                </div>
              ) : null}
            </Panel>
          ) : null}
          {demographicImpacts.length ? (
            demographicImpactSections.length > 1 ? (
              <div className="space-y-8">
                {demographicImpactSections.map((section) => (
                  <div key={section.key} className="space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                      {section.description ? (
                        <p className="text-sm leading-7 text-[var(--ink-soft)]">
                          {section.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      {section.items.map((impact) => (
                        <PromiseDemographicImpactCard
                          key={impact.id || `${impact.metric_name}-${impact.demographic_group}`}
                          impact={impact}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {demographicImpacts.map((impact) => (
                  <PromiseDemographicImpactCard
                    key={impact.id || `${impact.metric_name}-${impact.demographic_group}`}
                    impact={impact}
                  />
                ))}
              </div>
            )
          ) : blackImpactSummary ? (
            <Panel padding="md" className="space-y-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                Structured evidence
              </p>
              <p className="text-sm leading-7 text-[var(--ink-soft)]">
                No promise-level demographic-impact rows have been added yet. The outcome-based summary above is derived from linked promise outcomes, and the page is ready to surface structured demographic-impact rows when they are added.
              </p>
            </Panel>
          ) : null}
          {demographicContextBridge ? (
            <Panel padding="md" className="space-y-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                Related context
              </p>
              <div className="space-y-2 text-sm leading-7 text-[var(--ink-soft)]">
                {demographicContextBridge.explainer ? (
                  <p>
                    For broader context, read{" "}
                    <Link
                      href={`/explainers/${demographicContextBridge.explainer.slug}`}
                      className="font-semibold text-white underline decoration-white/20 underline-offset-4 transition-colors hover:text-[var(--accent)] hover:decoration-[var(--accent)]"
                    >
                      {demographicContextBridge.explainer.title}
                    </Link>
                    .
                  </p>
                ) : null}
                {demographicContextBridge.relatedPolicyCount ? (
                  <p>
                    {countLabel(
                      demographicContextBridge.relatedPolicyCount,
                      "linked policy",
                      "linked policies"
                    )}{" "}
                    below carry the concrete implementation record behind this promise where that linkage exists.
                  </p>
                ) : null}
                {demographicContextBridge.evidenceCount ? (
                  <p>
                    The source trail below keeps {countLabel(demographicContextBridge.evidenceCount, "linked source")} visible alongside this analysis.
                  </p>
                ) : null}
              </div>
            </Panel>
          ) : null}
        </PromisePanel>
      ) : (
        <Panel padding="md" className="space-y-3">
          <StatusPill tone="info">Black impact analysis</StatusPill>
          <p className="text-sm leading-7 text-[var(--ink-soft)]">
            Promise-level demographic-impact analysis has not been added to this record yet. Use the linked policies, outcome evidence, and source trail below while this layer is still being built.
          </p>
        </Panel>
      )}

      <PromisePanel id="provenance" className={`${localSectionOffsetClass} space-y-5`}>
        <SectionIntro
          eyebrow="What happened after this promise?"
          title="From promise language to visible consequences"
          description="This chain keeps the promise text, implementation record, related policies, and current Black-impact layer in one compact view."
        />
        <PromiseProvenanceChain
          promise={promise}
          blackImpactSummary={blackImpactSummary}
          demographicImpacts={demographicImpacts}
        />
      </PromisePanel>

      <PromisePanel id="status" className={`${localSectionOffsetClass} space-y-5`}>
        <SectionIntro
          eyebrow="Status details"
          title="Status and rationale"
          description={
            promise.summary ||
            "This promise record does not yet have a long-form rationale summary."
          }
        />
        <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
          <h2 className="text-lg font-semibold text-white">What was promised</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            {promise.promise_text || promise.summary || "No promise statement is currently available."}
          </p>
          {thinSummary ? (
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {buildPromiseOverview(promise)}
            </p>
          ) : null}
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Current Status
              </p>
              <p className="mt-2 text-lg font-medium text-white">{promise.status || "Unknown"}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Confidence
              </p>
              <p className="mt-2 text-lg font-medium text-white">{promise.confidence_label || "Not yet available"}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Linked policy actions
              </p>
              <p className="mt-2 text-lg font-medium text-white">{linkedPolicyCount}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Policy outcomes
              </p>
              <p className="mt-2 text-lg font-medium text-white">{policyOutcomeCount}</p>
            </div>
          </div>
          <h2 className="mt-6 text-lg font-semibold text-white">What actually happened</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            {promise.summary || "No status narrative is currently available."}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            This promise currently has {actionCount} documented action record{actionCount === 1 ? "" : "s"} and {policyOutcomeCount} linked policy outcome{policyOutcomeCount === 1 ? "" : "s"} in the current EquityStack dataset.
          </p>
          {thinSummary ? (
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {buildPromiseComparisonNote(promise)}
            </p>
          ) : null}
          <h2 className="mt-6 text-lg font-semibold text-white">Linked policy actions</h2>
          {(promise.related_policies || []).length ? (
            <div className="mt-3 grid gap-3">
              {(promise.related_policies || []).slice(0, 3).map((item) => (
                <Link
                  key={item.id || item.slug}
                  href={`/policies/${buildPolicySlug(item)}`}
                  className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.52)] p-4 text-sm leading-7 text-[var(--ink-soft)] hover:border-[rgba(132,247,198,0.24)]"
                >
                  <span className="font-medium text-white">{item.title}</span>
                  {item.summary ? <span className="mt-2 block">{item.summary}</span> : null}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              No confirmed policy action is linked to this promise in the current EquityStack dataset.
            </p>
          )}
          <h2 className="mt-6 text-lg font-semibold text-white">Why this status was assigned</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            {whyStatus}
          </p>
          {thinRationale ? (
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              The current rationale is still short, so the most reliable way to read this status is to compare the promise language with the linked policy actions, outcome evidence, and the president&apos;s broader record below.
            </p>
          ) : null}
        </div>
        {timelineItems.length ? (
          <div id="timeline" className={localSectionOffsetClass}>
            <PromiseTimeline items={timelineItems} />
          </div>
        ) : (
          <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
            No status history or dated action timeline is attached to this promise yet.
          </div>
        )}
        <SourceTrustPanel
          sourceCount={(promise.source_summary?.action_sources || 0) + (promise.source_summary?.outcome_sources || 0)}
          sourceQuality={promise.latest_outcome?.source_quality || "Promise evidence trail"}
          confidenceLabel={promise.confidence_label || undefined}
          completenessLabel={`${(promise.actions || []).length} actions / ${(promise.outcomes || []).length} outcomes`}
          summary="Promise pages separate the statement from the action and outcome trail so users can inspect both."
        />
        <CitationNote
          title="How to reference this record"
          description={promiseReferenceUtility.description}
          referenceLine={promiseReferenceUtility.referenceLine}
          items={promiseReferenceUtility.items}
        />
        <MethodologyCallout description="Promise grading and Black Impact Score are related but distinct. A promise can be delivered with mixed or limited downstream impact, and the site keeps those layers separate." />
      </PromisePanel>

      <section className="grid gap-4 md:grid-cols-3">
        {guideCards.map((item) => (
          <Panel key={item.title} padding="md" className="space-y-3">
            <StatusPill tone="info">{item.eyebrow}</StatusPill>
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
          </Panel>
        ))}
      </section>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Context and background"
          title="Extra context when the written narrative is brief"
          description="Use this short framing when the narrative is thin and you need one more layer of context before relying on the status label alone."
        />
        <div className="grid gap-4 p-4">
          {contextParagraphs.map((paragraph, index) => (
            <p key={`${slug}-context-${index}`} className="text-sm leading-7 text-[var(--ink-soft)]">
              {paragraph}
            </p>
          ))}
        </div>
      </Panel>

      <section id="evidence" className={`${localSectionOffsetClass} space-y-5`}>
        <SectionIntro
          eyebrow="Evidence"
          title="Source trail"
          description="This list pulls together action and outcome sources linked to the promise record."
        />
        {evidence.length ? (
          <EvidenceSourceList items={evidence} />
        ) : (
          <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
            No evidence sources are attached to this promise record yet.
          </div>
        )}
      </section>

      <section id="related" className={`${localSectionOffsetClass} space-y-5`}>
        <SectionIntro
          eyebrow="Continue exploring"
          title="Policies and context connected to this promise"
          description="Start with the curated next-step panel first. The linked policy and presidency paths below keep the broader related set visible."
        />
        <DiscoveryGuidancePanel
          eyebrow="Best context to read next"
          title="Start with this curated next step before browsing the full linked set"
          description="Use this short path when you want the clearest next click first. The wider policy, presidency, and context links remain visible below."
          items={promiseContextItems}
        />
        <LinkedAgendaItemsPanel items={linkedAgendaItems} />
        {(promise.related_policies || []).length ? (
          <PolicyCardList
            items={promise.related_policies || []}
            buildHref={(item) => `/policies/${buildPolicySlug(item)}`}
          />
        ) : (
          <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
            No confirmed policy action is linked to this promise in the current EquityStack dataset.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {presidentPromiseHref ? (
            <Link href={presidentPromiseHref} className="panel-link p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Presidency term
              </p>
              <h3 className="mt-3 text-lg font-semibold text-white">
                Read {promise.president}&apos;s full promise tracker
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                See how this promise fits into the wider record of delivered, partial, failed, and blocked promises for the same president.
              </p>
            </Link>
          ) : null}
          {presidentProfileHref ? (
            <Link href={presidentProfileHref} className="panel-link p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                President profile
              </p>
              <h3 className="mt-3 text-lg font-semibold text-white">
                Read {promise.president}&apos;s presidential record
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Move from this single promise into the wider presidential profile, including score context, policy drivers, and broader historical framing.
              </p>
            </Link>
          ) : null}
          <Link href={presidentPoliciesHref} className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Policy context
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">
              Browse related policy records
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Open the policy explorer to see the legislation, executive actions, and court decisions that help explain this promise record.
            </p>
          </Link>
          {(promise.related_explainers || []).map((item) => (
            <Link key={item.slug} href={`/explainers/${item.slug}`} className="panel-link p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                {item.category || "Explainer"}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
            </Link>
          ))}
          <Link href="/reports/black-impact-score" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Related report
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Black Impact Score</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Read the flagship report when you want to place this promise record inside the wider presidential score and historical policy context.
            </p>
          </Link>
          <Link href="/analysis/campaign-promises-to-black-americans" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Thematic guide
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Compare campaign promises and outcomes</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the thematic landing page when you need the broader question behind this one record: what was promised, what followed, and how those paths diverged across administrations.
            </p>
          </Link>
          <Link href="/research" className="panel-link p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Research hub
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Return to the curated research hub</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Move back into the wider research hub when this promise opens into a larger question about presidents, policies, reports, or historical context.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
