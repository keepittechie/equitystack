import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  fetchExplainerDetailData,
  fetchExplainersIndexData,
} from "@/lib/public-site-data";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  KpiCard,
  MethodologyCallout,
  SectionIntro,
} from "@/app/components/public/core";
import {
  EvidenceSourceList,
  ExplainerIndexGrid,
  PolicyTimeline,
  PromiseResultsTable,
} from "@/app/components/public/entities";
import { buildExplainerCardHref } from "@/lib/shareable-card-links";
import {
  buildExplainerJsonLd,
  serializeJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

function parseTakeaways(text) {
  return String(text || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTimeline(text) {
  return String(text || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split("|");
      return {
        label: label?.trim(),
        summary: rest.join("|").trim() || line,
      };
    });
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const explainer = await fetchExplainerDetailData(slug);

  if (!explainer) {
    return buildPageMetadata({
      title: "Explainer Not Found",
      description: "The requested explainer could not be found.",
      path: `/explainers/${slug}`,
    });
  }

  return buildPageMetadata({
    title: `${explainer.title} | Explainers`,
    description:
      explainer.summary ||
      "Evidence-backed explainer connecting policy history, public claims, and related records.",
    path: `/explainers/${slug}`,
    imagePath: `${buildExplainerCardHref(explainer)}/opengraph-image`,
    type: "article",
  });
}

export default async function ExplainerDetailPage({ params }) {
  const { slug } = await params;
  const [explainer, explainersIndex] = await Promise.all([
    fetchExplainerDetailData(slug),
    fetchExplainersIndexData(),
  ]);

  if (!explainer) {
    notFound();
  }

  const takeaways = parseTakeaways(explainer.key_takeaways);
  const timelineItems = parseTimeline(explainer.timeline_events);
  const relatedPolicies = explainer.related_policies || [];
  const relatedPromises = explainer.related_promises || [];
  const relatedFutureBills = explainer.related_future_bills || [];
  const relatedExplainers =
    explainer.related_explainers?.length
      ? explainer.related_explainers
      : (explainersIndex.items || [])
          .filter((item) => item.slug !== slug)
          .slice(0, 3);

  return (
    <main className="space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(buildExplainerJsonLd(explainer)),
        }}
      />

      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/explainers", label: "Explainers" },
          { label: explainer.title },
        ]}
      />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow={explainer.category || "Explainer"}
          title={explainer.title}
          description={
            explainer.summary ||
            "This explainer connects a common public claim to the relevant historical record and linked policy evidence."
          }
          actions={
            <>
              <Link href="/explainers" className="public-button-secondary">
                Back to explainers
              </Link>
              <Link
                href={buildExplainerCardHref(explainer)}
                className="public-button-primary"
              >
                Share card
              </Link>
            </>
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Linked policies"
          value={relatedPolicies.length}
          description="Policy records tied directly to this explainer."
          tone="accent"
        />
        <KpiCard
          label="Related promises"
          value={relatedPromises.length}
          description="Promise tracker records that connect to the same subject matter."
        />
        <KpiCard
          label="Tracked bills"
          value={relatedFutureBills.length}
          description="Legislative reform records linked from this explainer."
        />
        <KpiCard
          label="Sources"
          value={explainer.sources?.length || 0}
          description="Cited explainer sources visible alongside the narrative."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Read this for"
            title="What the explainer is doing"
            description="The best use of an explainer is to clarify the claim, connect it to history, and make the next evidentiary click obvious."
          />
          <div className="grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="rounded-[1.1rem] border border-white/8 bg-[rgba(8,14,24,0.92)] px-4 py-4">
              Use this explainer to understand the topic before jumping into linked policies or promise records.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-[rgba(8,14,24,0.92)] px-4 py-4">
              The linked records below are where the public evidence trail becomes concrete.
            </div>
          </div>
        </div>
        <MethodologyCallout description="Explainers are interpretation layers. They help frame the record, but methodology and sources still determine how much weight a reader should place on the claim." />
      </section>

      {takeaways.length ? (
        <section className="space-y-5">
          <SectionIntro
            eyebrow="Key takeaways"
            title="What to retain from this page"
            description="These takeaways summarize the core argument before you move into the underlying record."
          />
          <div className="grid gap-3">
            {takeaways.map((item) => (
              <div
                key={item}
                className="rounded-[1.2rem] border border-white/8 bg-[rgba(8,14,24,0.92)] px-4 py-4 text-sm leading-7 text-[var(--ink-soft)]"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          {explainer.intro_text ? (
            <article className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
              <h2 className="text-2xl font-semibold text-white">Introduction</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[var(--ink-soft)]">
                {explainer.intro_text}
              </p>
            </article>
          ) : null}

          {(explainer.structured_sections || []).map((section) => (
            <article
              key={section.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6"
            >
              <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[var(--ink-soft)]">
                {section.body}
              </p>
            </article>
          ))}
        </div>

        <div className="space-y-5">
          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
            <h2 className="text-xl font-semibold text-white">What this connects to</h2>
            <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
              <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                {relatedPolicies.length} linked policy records
              </div>
              <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                {relatedPromises.length} related promise records
              </div>
              <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
                {relatedFutureBills.length} reform or tracked-bill records
              </div>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
            <h2 className="text-xl font-semibold text-white">Related links</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/reports" className="public-button-secondary">
                Open reports
              </Link>
              <Link href="/policies" className="public-button-secondary">
                Browse policies
              </Link>
              <Link href="/sources" className="public-button-secondary">
                Open sources
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Timeline"
          title="Historical sequence"
          description="When timeline data is available, it helps turn the explainer from an argument into a chronological record."
        />
        {timelineItems.length ? (
          <PolicyTimeline items={timelineItems} />
        ) : (
          <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
            No structured timeline entries are attached to this explainer yet.
          </div>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Evidence"
            title="Sources stay nearby"
            description="The explainer layer should never hide the source layer. Use these citations to check the narrative against the record."
          />
          {explainer.sources?.length ? (
            <EvidenceSourceList items={explainer.sources} />
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
              No structured explainer sources are attached yet.
            </div>
          )}
        </div>

        <div className="space-y-5">
          <SectionIntro
            eyebrow="Related promises"
            title="Promise tracker context"
            description="Promise records help connect the explainer to public commitments and status changes where available."
          />
          {relatedPromises.length ? (
            <PromiseResultsTable
              items={relatedPromises}
              buildHref={(item) => `/promises/${item.slug}`}
            />
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
              No related promise records were attached to this explainer.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <SectionIntro
            eyebrow="Related policies"
            title="Policy records linked from this explainer"
            description="These records are usually the fastest route from narrative framing into the underlying policy evidence."
          />
          {relatedPolicies.length ? (
            <div className="grid gap-3">
              {relatedPolicies.map((item) => (
                <Link
                  key={item.id}
                  href={`/policies/${item.id}`}
                  className="rounded-[1.2rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-4 hover:border-[rgba(132,247,198,0.24)]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    {item.year_enacted || "Undated"} • {item.policy_type || "Policy"}
                  </p>
                  <h3 className="mt-2 text-base font-medium text-white">{item.title}</h3>
                  {item.primary_party ? (
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      {item.primary_party}
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
              No linked policy records are attached to this explainer yet.
            </div>
          )}
        </div>

        <div className="space-y-5">
          <SectionIntro
            eyebrow="Keep reading"
            title="Related explainers"
            description="Use related explainers when you need adjacent context instead of reopening the same topic from scratch."
          />
          <ExplainerIndexGrid items={relatedExplainers} />
        </div>
      </section>
    </main>
  );
}
