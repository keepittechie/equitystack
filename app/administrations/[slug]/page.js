import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import { fetchAdministrationDetailData } from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CategoryImpactChart, DirectionBreakdownChart } from "@/app/components/public/charts";
import { PresidentMetricsRow, PromiseResultsTable } from "@/app/components/public/entities";
import { MethodologyCallout, SectionIntro } from "@/app/components/public/core";

export const dynamic = "force-dynamic";

function formatDirectionData(impactBreakdown = {}) {
  return [
    { name: "Positive", value: Number(impactBreakdown.Positive || 0), color: "#84f7c6" },
    { name: "Mixed", value: Number(impactBreakdown.Mixed || 0), color: "#fbbf24" },
    { name: "Negative", value: Number(impactBreakdown.Negative || 0), color: "#ff8a8a" },
    { name: "Blocked", value: Number(impactBreakdown.Blocked || 0), color: "#8da1b9" },
  ];
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const detail = await fetchAdministrationDetailData(slug);

  if (!detail) {
    return buildPageMetadata({
      title: "Administration Not Found",
      description: "The requested administration record could not be found.",
      path: `/administrations/${slug}`,
    });
  }

  const title =
    detail.administration?.administration_name ||
    `${detail.presidentProfile?.president?.president || slug} administration`;

  return buildPageMetadata({
    title,
    description:
      "Open an administration profile with summary metrics, impact breakdown, and linked policy feed.",
    path: `/administrations/${slug}`,
  });
}

export default async function AdministrationDetailPage({ params }) {
  const { slug } = await params;
  const detail = await fetchAdministrationDetailData(slug);

  if (!detail) {
    notFound();
  }

  const administration = detail.administration;
  const profile = detail.presidentProfile;
  const title =
    administration?.administration_name ||
    `${profile?.president?.president || "Administration"} administration`;
  const directScore = profile?.president?.direct_normalized_score;
  const topTopics = (administration?.top_topics || []).map((item) => ({
    name: item.topic,
    score: Number(item.action_count || item.promise_count || 0),
  }));

  return (
    <main className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/administrations", label: "Administrations" },
          { label: title },
        ]}
      />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Administration profile"
          title={title}
          description="Administration pages summarize governing activity, promise throughput, and directional outcome mix in one place, then point back into the underlying promise and policy record."
          actions={
            profile?.president?.president_slug ? (
              <Link href={`/presidents/${profile.president.president_slug}`} className="dashboard-button-secondary">
                Open the full president profile
              </Link>
            ) : null
          }
        />
        {directScore != null ? (
          <p className="mt-6 text-sm leading-7 text-[var(--ink-soft)]">
            Direct Black Impact Score: <span className="font-semibold text-white">{Number(directScore).toFixed(2)}</span>
          </p>
        ) : null}
      </section>

      <PresidentMetricsRow
        items={[
          {
            label: "Promises tracked",
            value: administration?.total_promises ?? profile?.promiseTracker?.visible_promise_count ?? 0,
            detail: "Administration throughput starts with promises tracked in the public record.",
          },
          {
            label: "Actions logged",
            value: administration?.total_actions ?? 0,
            detail: "Administrative, statutory, or public-record actions linked to those promises.",
          },
          {
            label: "Outcomes logged",
            value: administration?.total_outcomes ?? profile?.promiseTracker?.visible_outcome_count ?? 0,
            detail: "Outcome counts remain visible even when impact direction is mixed or blocked.",
          },
          {
            label: "Recent activity",
            value: administration?.recent_activity?.length ?? 0,
            detail: "Recent activity highlights where the administration moved most recently.",
          },
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <DirectionBreakdownChart
            data={formatDirectionData(administration?.impact_breakdown)}
            title="Administration outcome direction"
            description="Direction mix helps users see whether the administration feed skews positive, negative, mixed, or blocked."
          />
          {!administration?.impact_breakdown ? (
            <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
              No administration-level direction breakdown is currently available.
            </div>
          ) : null}
        </div>
        <div className="space-y-5">
          <CategoryImpactChart
            data={topTopics}
            title="Top issue areas"
            description="Topic buckets summarize where this administration’s visible promise activity is concentrated."
            dataKey="score"
          />
          {!topTopics.length ? (
            <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
              No topic concentration data is currently available for this administration.
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Linked feed"
            title="Featured administration records"
            description="Open the featured feed for the most useful entry points into the administration’s promise tracker and related public record."
          />
          <PromiseResultsTable
            items={administration?.featured_records || []}
            buildHref={(item) => `/promises/${item.slug}`}
          />
          {(detail.linkedPolicyFeed || []).length ? (
            <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
              <h3 className="text-lg font-semibold text-white">Linked policy feed</h3>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                These policy records help connect the administration summary to legislation, executive action, and other documented policy changes.
              </p>
              <div className="mt-4 grid gap-3">
                {detail.linkedPolicyFeed.slice(0, 5).map((item) => (
                  <Link
                    key={item.slug || item.id}
                    href={`/policies/${item.slug}`}
                    className="rounded-[1.2rem] border border-white/8 bg-white/5 px-4 py-4"
                  >
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      {item.year_enacted || "Undated"} • {item.impact_direction || "Impact tracked"} • {Number(item.impact_score || 0).toFixed(2)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="dashboard-empty-state text-sm leading-7 text-[var(--ink-soft)]">
              No linked policy feed is currently available for this administration.
            </div>
          )}
        </div>
        <div className="space-y-5">
          <MethodologyCallout description="Administration views are descriptive operating summaries. Presidential score pages remain the place to read the Black Impact Score itself." />
          <div className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4">
            <h2 className="text-lg font-semibold text-white">Keep researching this administration</h2>
            <div className="mt-4 grid gap-3">
              <Link href="/promises" className="panel-link p-4">
                <h3 className="text-base font-semibold text-white">Open the full promise tracker</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  Move from this administration summary into the broader promise library when you want cross-president comparison.
                </p>
              </Link>
              {profile?.president?.president_slug ? (
                <Link href={`/presidents/${profile.president.president_slug}`} className="panel-link p-4">
                  <h3 className="text-base font-semibold text-white">Open the president profile</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                    Use the president page for Black Impact Score context, score drivers, and deeper historical interpretation.
                  </p>
                </Link>
              ) : null}
            </div>
          </div>
          <SectionIntro
            eyebrow="Recent activity"
            title="Latest administration updates"
            description="Recent activity keeps users close to the newest promise and action movement inside this administration."
          />
          <div className="grid gap-4">
            {(administration?.recent_activity || []).slice(0, 6).map((item) => (
              <Link key={item.slug} href={`/promises/${item.slug}`} className="panel-link p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                  {item.latest_action_date || item.promise_date || "Record"}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item.latest_action_description || item.summary}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
