import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { resolvePresidentImageSrc } from "@/lib/president-image-paths";
import { buildPolicySlug, fetchPresidentProfileData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CategoryImpactChart, ImpactTrendChart } from "@/app/components/public/charts";
import {
  CitationNote,
  MethodologyCallout,
  PresidentScoreMethodologyNote,
  SectionIntro,
  SourceTrustPanel,
} from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import PromiseSystemExplanation from "@/app/components/public/PromiseSystemExplanation";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";
import {
  PresidentHero,
  PresidentMetricsRow,
  PresidentPolicyTable,
  PromiseTimeline,
} from "@/app/components/public/entities";

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

  return buildPageMetadata({
    title: `${name}`,
    description:
      profile.president.narrative_summary ||
      "Review a presidential impact profile with direct score, trend, policy drivers, and promise context.",
    path: `/presidents/${slug}`,
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
  const imageSrc = resolvePresidentImageSrc({
    presidentSlug: president.president_slug || slug,
    presidentName,
  });
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
        summary={president.narrative_summary || "Direct and systemic scores are shown separately so users can compare policy action with longer downstream institutional effects."}
        score={formatScore(president.direct_normalized_score)}
        systemicScore={formatScore(president.systemic_normalized_score)}
        imageSrc={imageSrc}
      />

      <TrustBar />

      <PresidentMetricsRow
        items={[
          {
            label: "Direct confidence",
            value: president.direct_score_confidence || president.score_confidence || "Unknown",
            detail: `Based on ${president.direct_outcome_count ?? president.outcome_count ?? 0} scored outcomes.`,
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
            label: "Source footprint",
            value: promiseTracker.visible_source_count ?? 0,
            detail: "Evidence access stays visible on the profile rather than buried in methodology.",
          },
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
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

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Top records"
            title="Policies and promises driving this profile"
            description="Open the most consequential underlying records instead of treating the score as self-explanatory."
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
            sourceQuality="Profile evidence footprint"
            confidenceLabel={president.direct_score_confidence || president.score_confidence}
            completenessLabel={`${promiseTracker.visible_outcome_count || 0} outcomes in visible promise set`}
            summary="Direct score remains the headline metric. Systemic score is shown nearby when downstream judicial attribution exists and is strong enough to defend."
          />
          <PresidentScoreMethodologyNote />
          <CitationNote description="When referencing this presidential profile, cite the president name, page title, EquityStack, the page URL, and your access date. Treat the profile as a structured summary of the current dataset and its current evidence coverage." />
          <ScoreExplanation title="How to interpret this presidential profile" />
          <MethodologyCallout
            description="Direct score reflects direct policy action. Systemic score reflects judicial or appointment-driven downstream impact. They stay separate on purpose."
            linkLabel="Read score architecture"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Promise tracker snapshot"
            title="Status mix for this presidential record"
            description="Promise status stays visible on the profile because delivery, blockage, and partial fulfillment help explain the shape of the broader governing record."
          />
          <PromiseSystemExplanation />
          <PresidentMetricsRow
            items={Object.entries(promiseStatusSnapshot || {}).map(([label, value]) => ({
              label,
              value,
              detail: "Promise status count in the currently visible tracker set.",
            }))}
          />
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
            <h3 className="text-lg font-semibold text-white">How to interpret promise outcomes</h3>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              Promise outcomes provide context for how stated goals translated into policy action. They help explain implementation, but they are not the same thing as presidential Impact Score.
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

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Timeline"
            title="Promise and impact chronology"
            description="The profile timeline helps users place scoring movement against dated promise records."
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
            title="Keep moving through the public record"
            description="Every profile should make it easy to move from summary to compare, promise detail, and methodology."
          />
          <div className="grid gap-4">
            <Link href="/promises" className="panel-link rounded-[1.5rem] p-5">
              <h3 className="text-lg font-semibold text-white">Open the promise tracker</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                Use the promise index to see the full delivery, partial, failed, and blocked record behind this profile.
              </p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
