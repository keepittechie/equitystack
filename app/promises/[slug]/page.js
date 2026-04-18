import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPolicySlug, fetchPromisePageData } from "@/lib/public-site-data";
import {
  countLabel,
  filterParagraphs,
  isThinText,
  sentenceJoin,
} from "@/lib/editorial-depth";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
  SourceTrustPanel,
} from "@/app/components/public/core";
import PromiseStatusLegend from "@/app/components/public/PromiseStatusLegend";
import PromiseSystemExplanation from "@/app/components/public/PromiseSystemExplanation";
import {
  EvidenceSourceList,
  PolicyCardList,
  PromiseHero,
  PromiseTimeline,
} from "@/app/components/public/entities";
import {
  buildBreadcrumbJsonLd,
  buildPromiseJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

function formatTermLabel(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;
  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear}`;
  }
  return null;
}

function PromisePanel({ children, className = "" }) {
  return (
    <section
      className={`rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6 ${className}`}
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

function buildWhyPromiseMatters(promise) {
  const president = promise.president || "the relevant administration";
  const topic = promise.topic || "Black policy priorities";
  const status = promise.status || "an unresolved";

  return `Promise records matter because they connect public commitments to documented implementation. This page helps readers study how ${president} handled ${topic.toLowerCase()}, why the promise is currently marked ${status.toLowerCase()}, and which policy actions or outcomes currently support that reading.`;
}

function buildPromiseOverview(promise) {
  return sentenceJoin([
    promise.promise_type
      ? `This is a ${promise.promise_type.toLowerCase()} tracked in the public promise layer.`
      : "This is a tracked promise record in the public promise layer.",
    promise.campaign_or_official
      ? `${promise.campaign_or_official} framing matters here because the page separates pre-office rhetoric from documented governing follow-through.`
      : null,
    promise.topic
      ? `The record sits in the ${promise.topic.toLowerCase()} topic area.`
      : null,
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
      `This promise page is designed to answer a narrower question than a campaign summary or thematic guide: what was promised, how is it currently classified, and what visible record supports that reading today?`,
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
      `That makes it more useful as an accountability record than as a stand-alone statement page.`,
    ]),
    sentenceJoin([
      `Promise status is only one layer of interpretation.`,
      `The stronger reading comes from comparing the promise text, the status rationale, the linked policy record, and the source trail together.`,
    ]),
  ]);
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

  return (
    <main className="space-y-10">
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

      <PromisePanel className="space-y-5">
        <PromiseSystemExplanation />
        <PromiseStatusLegend statuses={["Delivered", "In Progress", "Partial", "Blocked", "Failed"]} />
      </PromisePanel>

      <PromisePanel className="space-y-5">
        <PageContextBlock
          description="This page is the landing point for a single promise record: the original commitment, the current status, the linked policy actions, and the evidence used to justify the classification."
          detail="Use it when you want to move from a broad question about campaign promises to Black Americans into the specific public record behind one promise."
        />
        <PageContextBlock
          title="Why this promise matters"
          description={buildWhyPromiseMatters(promise)}
        />
      </PromisePanel>

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

      <PromisePanel>
        <SectionIntro
          eyebrow="Context and background"
          title="How to interpret this promise when the narrative is brief"
          description="This framing keeps shorter promise summaries from feeling thin by tying them back to the actions, outcomes, linked policies, and surrounding research paths already visible on the page."
        />
        <div className="mt-5 grid gap-4">
          {contextParagraphs.map((paragraph, index) => (
            <p key={`${slug}-context-${index}`} className="text-sm leading-8 text-[var(--ink-soft)]">
              {paragraph}
            </p>
          ))}
        </div>
      </PromisePanel>

      <PromisePanel className="space-y-5">
        <SectionIntro
          eyebrow="What this means"
          title="Status and rationale"
          description={
            promise.summary ||
            "This promise record does not yet have a long-form rationale summary."
          }
        />
        <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
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
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Current Status
              </p>
              <p className="mt-2 text-lg font-medium text-white">{promise.status || "Unknown"}</p>
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Confidence
              </p>
              <p className="mt-2 text-lg font-medium text-white">{promise.confidence_label || "Not yet available"}</p>
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Linked policy actions
              </p>
              <p className="mt-2 text-lg font-medium text-white">{linkedPolicyCount}</p>
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                Policy Outcomes
              </p>
              <p className="mt-2 text-lg font-medium text-white">{policyOutcomeCount}</p>
            </div>
          </div>
          <h2 className="mt-6 text-lg font-semibold text-white">What actually happened</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            {promise.summary || "No status narrative is currently available."}
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
            This Promise currently has {actionCount} documented action record{actionCount === 1 ? "" : "s"} and {policyOutcomeCount} linked Policy Outcome{policyOutcomeCount === 1 ? "" : "s"} in the current EquityStack dataset.
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
                  className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4 text-sm leading-7 text-[var(--ink-soft)] hover:border-[rgba(132,247,198,0.24)]"
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
          <PromiseTimeline items={timelineItems} />
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
            No status history or dated action timeline is attached to this promise yet.
          </div>
        )}
        <SourceTrustPanel
          sourceCount={(promise.source_summary?.action_sources || 0) + (promise.source_summary?.outcome_sources || 0)}
          sourceQuality={promise.latest_outcome?.source_quality || "Promise evidence trail"}
          confidenceLabel={promise.confidence_label || undefined}
          completenessLabel={`${(promise.actions || []).length} actions / ${(promise.outcomes || []).length} outcomes`}
          summary="Promise pages separate the statement from the underlying action and outcome evidence so users can inspect both."
        />
        <MethodologyCallout description="Promise grading and Black Impact Score are related but distinct. A promise can be delivered with mixed or limited downstream impact, and the site keeps those layers separate." />
      </PromisePanel>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Evidence"
          title="Source trail"
          description="This list pulls together action and outcome sources linked to the promise record."
        />
        {evidence.length ? (
          <EvidenceSourceList items={evidence} />
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
            No evidence sources are attached to this promise record yet.
          </div>
        )}
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Policies and context connected to this promise"
          description="Policy links help users move from campaign or governing statements into administrative records, legislation, and broader historical context."
        />
        {(promise.related_policies || []).length ? (
          <PolicyCardList
            items={promise.related_policies || []}
            buildHref={(item) => `/policies/${buildPolicySlug(item)}`}
          />
        ) : (
          <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
            No confirmed policy action is linked to this promise in the current EquityStack dataset.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {presidentPromiseHref ? (
            <Link href={presidentPromiseHref} className="panel-link rounded-[1.4rem] p-5">
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
            <Link href={presidentProfileHref} className="panel-link rounded-[1.4rem] p-5">
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
          <Link href={presidentPoliciesHref} className="panel-link rounded-[1.4rem] p-5">
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
            <Link key={item.slug} href={`/explainers/${item.slug}`} className="panel-link rounded-[1.4rem] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                {item.category || "Explainer"}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.summary}</p>
            </Link>
          ))}
          <Link href="/reports/black-impact-score" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Related report
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Black Impact Score</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Read the flagship report when you want to place this promise record inside the wider presidential score and historical policy context.
            </p>
          </Link>
          <Link href="/analysis/campaign-promises-to-black-americans" className="panel-link rounded-[1.4rem] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              Thematic guide
            </p>
            <h3 className="mt-3 text-lg font-semibold text-white">Compare campaign promises and outcomes</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Use the thematic landing page when you need the broader question behind this one record: what was promised, what followed, and how those paths diverged across administrations.
            </p>
          </Link>
          <Link href="/research" className="panel-link rounded-[1.4rem] p-5">
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
