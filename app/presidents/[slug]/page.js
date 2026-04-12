import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { resolvePresidentImageSrc } from "@/lib/president-image-paths";
import { buildPolicySlug, fetchPresidentProfileData } from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CategoryImpactChart, ImpactTrendChart } from "@/app/components/public/charts";
import {
  CitationNote,
  MethodologyCallout,
  PresidentScoreMethodologyNote,
  ScoreBadge,
  SectionIntro,
  SourceTrustPanel,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import PromiseSystemExplanation from "@/app/components/public/PromiseSystemExplanation";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import InsightCard from "@/app/components/public/InsightCard";
import {
  PresidentHero,
  PresidentMetricsRow,
  PresidentPolicyTable,
  PromiseTimeline,
} from "@/app/components/public/entities";
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

function LinkedBillCard({ item }) {
  return (
    <Link
      href={item.detailHref}
      className="flex min-w-0 flex-col rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4 hover:border-[rgba(132,247,198,0.24)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            {item.billNumber}
          </p>
          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-white">
            {item.title}
          </h3>
        </div>
        <ScoreBadge value={String(item.blackImpactScore)} label="Bill BIS" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-muted)]">
        {item.primaryDomain ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            {item.primaryDomain}
          </span>
        ) : null}
        {item.status ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            {item.status}
          </span>
        ) : null}
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          {formatBillRelationshipType(item.relationshipType)}
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
          {item.impactConfidence} confidence
        </span>
      </div>
      <p className="mt-3 line-clamp-4 text-sm leading-7 text-[var(--ink-soft)]">
        {item.whyItMatters || "Open the bill detail page for the full tracked record and linked context."}
      </p>
    </Link>
  );
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

  const { president, promiseTracker, trend, topPolicies, promises, promiseStatusSnapshot, scoreDrivers } = profile;
  const presidentName = president.president || president.president_name || "Unknown president";
  const billInputs = president.bill_impact_inputs || {};
  const imageSrc = resolvePresidentImageSrc({
    presidentSlug: president.president_slug || slug,
    presidentName,
  });
  const presidentPoliciesHref = `/policies?president=${encodeURIComponent(presidentName)}`;
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

  return (
    <main className="space-y-10">
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

      <PresidentHero
        name={presidentName}
        party={president.president_party || promiseTracker.president_party}
        termLabel={formatTermLabel(promiseTracker.term_start, promiseTracker.term_end)}
        summary={president.narrative_summary || "The final Black Impact Score stays anchored in outcome-based evidence, then adds a bounded bill-informed signal when current legislative lineage is strong enough to support it."}
        score={formatScore(president.normalized_score_total ?? president.score ?? president.direct_normalized_score)}
        systemicScore={formatScore(president.systemic_normalized_score)}
        imageSrc={imageSrc}
      />

      <TrustBar />

      <PresidentMetricsRow
        items={[
          {
            label: "Outcome-based confidence",
            value: president.direct_score_confidence || president.score_confidence || "Unknown",
            detail: `The final score remains anchored by ${president.direct_outcome_count ?? president.outcome_count ?? 0} scored outcomes.`,
          },
          {
            label: "Promises tracked",
            value: promiseTracker.visible_promise_count ?? promiseTracker.total_tracked_promises ?? 0,
            detail: `${promiseTracker.visible_outcome_count ?? 0} linked outcomes currently visible.`,
          },
          {
            label: "Delivered promises",
            value: promiseTracker.visible_delivered_count ?? promiseTracker.delivered_count ?? 0,
            detail: "Promise tracker performance stays separate from the impact score.",
          },
          {
            label: "Source references",
            value: promiseTracker.visible_source_count ?? 0,
            detail: "These totals reflect visible promise-tracker source references, not guaranteed unique source rows.",
          },
          {
            label: "Linked bills",
            value: billInputs.linked_bill_count ?? 0,
            detail: `${billInputs.linked_promises_with_bill_support ?? 0} promise-backed bill joins currently support this profile.`,
          },
        ]}
      />

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5 xl:self-start">
          <SectionIntro
            eyebrow="Bill-informed signals"
            title="Legislation linked to this presidential record"
            description="These bill-linked inputs help connect the presidency to legislation, promises, and the wider historical record affecting Black Americans."
          />
          {Number(billInputs.linked_bill_count || 0) > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
                <h3 className="text-lg font-semibold text-white">Bill input summary</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {president.bill_input_summary} The final Black Impact Score blends this bill-informed layer in as a capped modifier rather than letting bill links override the outcome-based record.
                </p>
                <div className="mt-4 grid gap-3 text-sm text-[var(--ink-soft)]">
                  <p>Unweighted avg bill BIS: {formatScore(billInputs.linked_bill_score_avg)}</p>
                  <p>Weighted avg bill BIS: {formatScore(billInputs.linked_bill_score_weighted)}</p>
                  <p>Linked bills influence: {formatScore(billInputs.bill_blend_weight_pct)}%</p>
                  <p>Positive / Mixed / Negative: {billInputs.linked_positive_bill_count || 0} / {billInputs.linked_mixed_bill_count || 0} / {billInputs.linked_negative_bill_count || 0}</p>
                </div>
              </div>
              <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
                <h3 className="text-lg font-semibold text-white">Evidence and domains</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  Join confidence stays bounded by the existing promise lineage and the bill’s own evidence depth.
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                  Bill confidence mix: {formatBillConfidenceSummary(billInputs.linked_bill_confidence_summary)}
                </p>
                <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                  Blend status: {billInputs.bill_influence_label || "No bill-linked inputs"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(billInputs.linked_bill_domains || []).map((item) => (
                    <span key={item.domain} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[var(--ink-soft)]">
                      {item.domain} • {item.count}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
              No tracked bills currently reach this president through supported promise lineage, so no bill-informed inputs are shown yet.
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h3 className="text-lg font-semibold text-white">Top linked bills</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              These are the strongest currently linked bills by bill-level BIS contribution within this president’s existing promise-linked legislative context.
            </p>
            <div className="mt-4 grid gap-3">
              {(billInputs.top_linked_bills || []).length ? (
                billInputs.top_linked_bills.slice(0, 4).map((item) => (
                  <LinkedBillCard key={item.slug || item.id} item={item} />
                ))
              ) : (
                <div className="rounded-[1.1rem] border border-dashed border-white/12 bg-white/4 px-4 py-4 text-sm leading-7 text-[var(--ink-soft)]">
                  No linked bills are available to rank for this profile yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5 xl:self-start">
          <ImpactTrendChart
            data={trend?.score_by_year || []}
            title="Impact over time"
            description={trend?.interpretation || "Read the yearly score path, cumulative movement, and strongest shifts over time."}
          />
          {!trend?.score_by_year?.length ? (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
              No dated outcome series are available for this profile yet.
            </div>
          ) : null}
        </div>
        <div className="space-y-5">
          <CategoryImpactChart
            data={topicData}
            title="Top contributing topics"
            description="Topic contributions explain where the score is actually coming from."
          />
          {!topicData.length ? (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
              Topic-level contribution data is not available for this presidential record yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5 xl:self-start">
          <SectionIntro
            eyebrow="Top records"
            title="Policies and promises shaping this record"
            description="Open the most consequential underlying policies and promises instead of treating the presidential score as self-explanatory."
          />
          {topPolicies.length ? (
            <PresidentPolicyTable
              items={topPolicies}
              buildHref={(item) =>
                item.slug ? `/promises/${item.slug}` : `/policies/${buildPolicySlug(item)}`
              }
            />
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
              No top contributing policy records are attached to this profile yet.
            </div>
          )}
        </div>
        <div className="space-y-5">
          <SourceTrustPanel
            sourceCount={promiseTracker.visible_source_count}
            sourceQuality="Profile evidence references"
            confidenceLabel={president.direct_score_confidence || president.score_confidence}
            completenessLabel={`${promiseTracker.visible_outcome_count || 0} outcomes in visible promise set`}
            summary="The final score remains outcome-anchored. Bill-linked inputs can shift it modestly when promise-backed legislative lineage and bill evidence are strong enough to defend."
          />
          <PresidentScoreMethodologyNote />
          <CitationNote description="When referencing this presidential profile, cite the president name, page title, EquityStack, the page URL, and your access date. Treat the profile as a structured summary of the current dataset and its current evidence coverage." />
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
      </section>

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5 xl:self-start">
          <SectionIntro
            eyebrow="What shaped this score"
            title="Driver visibility"
            description="The presidential score should be readable as a structured result, not a mystery number. These drivers show where the strongest movement came from in the available dataset."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
              <h3 className="text-lg font-semibold text-white">Strongest positive drivers</h3>
              {(scoreDrivers?.strongest_positive || []).length ? (
                <div className="mt-4 grid gap-3">
                  {scoreDrivers.strongest_positive.map((item, index) => (
                    <div key={`${item.slug || item.title}-${index}`} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                        {item.topic || item.category || "Policy record"} • {item.status || item.impact_direction || "Scored record"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                  {scoreDrivers?.score_scope_note || "This score is based on available policy records in the current EquityStack dataset."}
                </p>
              )}
            </div>
            <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
              <h3 className="text-lg font-semibold text-white">Strongest negative drivers</h3>
              {(scoreDrivers?.strongest_negative || []).length ? (
                <div className="mt-4 grid gap-3">
                  {scoreDrivers.strongest_negative.map((item, index) => (
                    <div key={`${item.slug || item.title}-${index}`} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                        {item.topic || item.category || "Policy record"} • {item.status || item.impact_direction || "Scored record"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                  {scoreDrivers?.score_scope_note || "This score is based on available policy records in the current EquityStack dataset."}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h3 className="text-lg font-semibold text-white">Topic contributions</h3>
            {(scoreDrivers?.topic_drivers || []).length ? (
              <div className="mt-4 grid gap-3">
                {scoreDrivers.topic_drivers.map((item) => (
                  <div key={item.topic} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">{item.topic}</p>
                      <span className="text-sm font-medium text-[var(--accent)]">
                        {Number(item.raw_score_total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">
                This score is based on available policy records in the current EquityStack dataset.
              </p>
            )}
          </div>
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h3 className="text-lg font-semibold text-white">Impact Direction mix</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Positive {scoreDrivers?.direction_breakdown?.Positive || 0} • Negative {scoreDrivers?.direction_breakdown?.Negative || 0} • Mixed {scoreDrivers?.direction_breakdown?.Mixed || 0} • Blocked {scoreDrivers?.direction_breakdown?.Blocked || 0}
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Mixed and blocked outcomes stay visible because presidential scores should not hide conflicting or incomplete implementation.
            </p>
          </div>
        </div>
      </section>

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5 xl:self-start">
          <SectionIntro
            eyebrow="Promise tracker snapshot"
            title="Promise tracker context for this president"
            description="Promise status stays visible here because campaign and governing commitments help explain the broader historical record and policy impact on Black Americans."
          />
          <PromiseSystemExplanation />
          <PresidentMetricsRow
            items={[
              {
                label: "Promises tracked",
                value: promiseTracker.visible_promise_count ?? 0,
                detail: "Visible promise records in the current tracker set for this presidential profile.",
              },
              {
                label: "Delivered",
                value: promiseStatusSnapshot.Delivered ?? 0,
                detail: "Promises with documented implemented policy action.",
              },
              {
                label: "In Progress",
                value: promiseStatusSnapshot["In Progress"] ?? 0,
                detail: "Promises with ongoing or incomplete implementation.",
              },
              {
                label: "Partial",
                value: promiseStatusSnapshot.Partial ?? 0,
                detail: "Promises with meaningful but incomplete documented implementation.",
              },
              {
                label: "Blocked",
                value: promiseStatusSnapshot.Blocked ?? 0,
                detail: "Promises that did not reach implementation because of visible barriers.",
              },
              {
                label: "Failed",
                value: promiseStatusSnapshot.Failed ?? 0,
                detail: "Promises not fulfilled in the current documented record.",
              },
            ]}
          />
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h3 className="text-lg font-semibold text-white">How to interpret promise outcomes</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Promise outcomes provide context for how stated goals translated into documented policy action. They help explain implementation, but they are not the same thing as presidential Impact Score.
            </p>
          </div>
        </div>
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Related content"
            title="Where to go next"
            description="Profiles should lead naturally into compare, methodology, and underlying record detail."
          />
          <div className="grid gap-4">
            <Link href={`/compare/presidents?compare=${slug}`} className="panel-link rounded-[1.5rem] p-5">
              <h3 className="text-lg font-semibold text-white">Compare this president</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Add other presidents to compare direct score, systemic score, topic differences, and directional contrast.
              </p>
            </Link>
            <Link href="/methodology" className="panel-link rounded-[1.5rem] p-5">
              <h3 className="text-lg font-semibold text-white">Review the methodology</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Read how low-coverage damping, confidence, evidence, and score-family separation work before drawing conclusions.
              </p>
            </Link>
            <Link href="/reports/black-impact-score" className="panel-link rounded-[1.5rem] p-5">
              <h3 className="text-lg font-semibold text-white">Open the flagship report</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Use the report view when you want broader ranking context or public-facing interpretation across presidents.
              </p>
            </Link>
          </div>
        </div>
      </section>

      <section className="public-two-col-rail grid items-start gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5 xl:self-start">
          <SectionIntro
            eyebrow="Timeline"
            title="Promise and policy chronology"
            description="The profile timeline helps users place campaign promises and policy movement into a clearer historical sequence."
          />
          {timelineItems.length ? (
            <PromiseTimeline items={timelineItems} />
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/4 p-5 text-sm leading-7 text-[var(--ink-soft)]">
              No dated promise records are attached to this profile yet.
            </div>
          )}
        </div>
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Related routes"
            title="Keep researching this president"
            description="Every presidential profile should make it easy to move from summary into promises, legislation, comparison tools, and methodology."
          />
          <div className="grid gap-4">
            <Link href={`/promises/president/${slug}`} className="panel-link rounded-[1.5rem] p-5">
              <h3 className="text-lg font-semibold text-white">Open this president&apos;s promise tracker</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Review delivered, partial, failed, and blocked promises for this presidency term in one place.
              </p>
            </Link>
            <Link href={presidentPoliciesHref} className="panel-link rounded-[1.5rem] p-5">
              <h3 className="text-lg font-semibold text-white">Browse policies under {presidentName}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Open the policy index filtered to this president to study legislation, executive actions, and court-era context tied to this record.
              </p>
            </Link>
            <Link href="/explainers" className="panel-link rounded-[1.5rem] p-5">
              <h3 className="text-lg font-semibold text-white">Read related Black history explainers</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Use explainers when you need more historical or legal context before returning to the president, promise, or policy detail pages.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
