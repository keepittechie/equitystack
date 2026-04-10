import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { buildPolicySlug, fetchPromisePageData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  MethodologyCallout,
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

export const dynamic = "force-dynamic";

function formatTermLabel(start, end) {
  const startYear = start ? new Date(start).getFullYear() : null;
  const endYear = end ? new Date(end).getFullYear() : null;
  if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
    return `${startYear}-${endYear}`;
  }
  return null;
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
    title: promise.title,
    description:
      promise.summary ||
      "Review a promise record with statement, status rationale, evidence, and linked policies.",
    path: `/promises/${slug}`,
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

  return (
    <main className="space-y-10">
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

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <PromiseSystemExplanation />
        <PromiseStatusLegend statuses={["Delivered", "In Progress", "Partial", "Blocked", "Failed"]} />
      </section>

      <section className="public-two-col-rail grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="What this means"
            title="Status and rationale"
            description={promise.summary || "This promise record does not yet have a long-form rationale summary."}
          />
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
            <h2 className="text-lg font-semibold text-white">What was promised</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {promise.promise_text || promise.summary || "No promise statement is currently available."}
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
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
          </div>
          {timelineItems.length ? (
            <PromiseTimeline items={timelineItems} />
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
              No status history or dated action timeline is attached to this promise yet.
            </div>
          )}
        </div>
        <div className="space-y-5">
          <SourceTrustPanel
            sourceCount={(promise.source_summary?.action_sources || 0) + (promise.source_summary?.outcome_sources || 0)}
            sourceQuality={promise.latest_outcome?.source_quality || "Promise evidence trail"}
            confidenceLabel={promise.confidence_label || undefined}
            completenessLabel={`${(promise.actions || []).length} actions / ${(promise.outcomes || []).length} outcomes`}
            summary="Promise pages separate the statement from the underlying action and outcome evidence so users can inspect both."
          />
          <MethodologyCallout description="Promise grading and Black Impact Score are related but distinct. A promise can be delivered with mixed or limited downstream impact, and the site keeps those layers separate." />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
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
        </div>
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Linked policies"
            title="Policies connected to this promise"
            description="Policy links help users move from campaign or governing statement into administrative or statutory records."
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
          <div className="grid gap-4">
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
                Open the flagship report when you want to place this promise record inside the wider presidential score context.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
