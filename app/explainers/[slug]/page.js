import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  buildPolicySlug,
  fetchExplainerDetailData,
  fetchExplainersIndexData,
} from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
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
import {
  ThematicHubCard,
  ThematicQuestionList,
} from "@/app/components/public/thematic";
import { getExplainerEditorial } from "@/lib/explainer-editorial";
import {
  buildExplainerCardHref,
  buildFutureBillDetailHref,
} from "@/lib/shareable-card-links";
import {
  buildBreadcrumbJsonLd,
  buildExplainerJsonLd,
} from "@/lib/structured-data";

export const dynamic = "force-dynamic";

function ExplainerPanel({ children, className = "" }) {
  return (
    <section
      className={`rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 md:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function buildStructuredSectionTitle(title) {
  const map = {
    "Common claim": "Claim or misconception",
    "What actually happened": "Historical record",
    "Why it matters": "Why this matters in policy terms",
    "Key policies": "Policy and legal anchors",
    "Why it still matters": "Why the issue still matters",
    "Sources note": "How to read the source base",
  };

  return map[title] || title;
}

function buildConnectedPresidents(relatedPromises = []) {
  const presidents = new Map();

  for (const promise of relatedPromises) {
    if (!promise?.president_slug || !promise?.president) continue;

    if (!presidents.has(promise.president_slug)) {
      presidents.set(promise.president_slug, {
        slug: promise.president_slug,
        name: promise.president,
        promiseCount: 0,
        promiseTitles: [],
      });
    }

    const entry = presidents.get(promise.president_slug);
    entry.promiseCount += 1;
    if (promise.title && entry.promiseTitles.length < 2) {
      entry.promiseTitles.push(promise.title);
    }
  }

  return Array.from(presidents.values());
}

function buildExplainerResearchPaths({
  editorial,
  connectedPresidents,
  relatedPromises,
  relatedFutureBills,
}) {
  const items = [];

  for (const president of connectedPresidents.slice(0, 2)) {
    items.push({
      href: `/presidents/${president.slug}`,
      eyebrow: "President profile",
      title: `Review ${president.name}'s broader presidential record`,
      description:
        president.promiseTitles[0]
          ? `This explainer already connects to promise and policy context under ${president.name}, including ${president.promiseTitles[0]}.`
          : `Open ${president.name}'s profile to place this topic inside a fuller presidential record on Black Americans.`,
    });
  }

  if (relatedPromises.length) {
    items.push({
      href: "/promises",
      eyebrow: "Promise tracker",
      title: "Compare promises with follow-through",
      description:
        "Use the promise tracker to compare campaign or governing commitments against the public record that followed.",
    });
  }

  items.push(...(editorial.researchPaths || []));

  items.push({
    href: "/policies",
    eyebrow: "Policy explorer",
    title: "Browse the underlying policy records",
    description:
      "Policy pages expose the laws, executive actions, and court decisions that help verify or complicate the narrative on this explainer page.",
  });

  items.push({
    href: "/reports",
    eyebrow: "Reports",
    title: "Read report analysis built from the same public record",
    description:
      "Reports synthesize patterns across presidents, policies, and time when you need comparison rather than one topic page.",
  });

  if (relatedFutureBills.length) {
    items.push({
      href: "/future-bills",
      eyebrow: "Legislation and proposals",
      title: "Browse linked reform proposals and tracked bills",
      description:
        "Use the legislative layer when this topic leads into current reform ideas, tracked bills, or future-facing policy proposals.",
      note: `${relatedFutureBills.length} related proposal${relatedFutureBills.length === 1 ? "" : "s"} linked on this page.`,
    });
  }

  items.push({
    href: "/sources",
    eyebrow: "Sources",
    title: "Inspect the evidence base behind this topic",
    description:
      "The source library helps readers move from one explainer's citations into the wider evidence base behind EquityStack's public record.",
  });

  const seen = new Set();
  return items.filter((item) => {
    if (!item?.href || seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

function FutureBillCard({ item }) {
  return (
    <Link
      href={buildFutureBillDetailHref(item)}
      className="rounded-[1.2rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-4 hover:border-[rgba(132,247,198,0.24)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
        {item.target_area || "Future bill"} • {item.priority_level || "Priority pending"}
      </p>
      <h3 className="mt-2 text-base font-medium text-white">{item.title}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
        {item.problem_statement ||
          "Open the proposal page for the problem statement, linked bills, and related policy context."}
      </p>
      <p className="mt-3 text-xs leading-6 text-[var(--ink-muted)]">
        {item.status || "Status pending"} • {(item.tracked_bills || []).length} linked tracked bill
        {(item.tracked_bills || []).length === 1 ? "" : "s"}
      </p>
    </Link>
  );
}

function buildExplainerUtilityNotes(explainer, editorial) {
  return [
    editorial.pagePurpose,
    editorial.whyThisMatters,
    `This page currently connects to ${explainer.related_policies?.length || 0} policy record${
      (explainer.related_policies?.length || 0) === 1 ? "" : "s"
    }, ${explainer.related_promises?.length || 0} promise record${
      (explainer.related_promises?.length || 0) === 1 ? "" : "s"
    }, and ${explainer.related_future_bills?.length || 0} reform or bill path${
      (explainer.related_future_bills?.length || 0) === 1 ? "" : "s"
    }.`,
  ].filter(Boolean);
}

function buildPageMethodNote() {
  return (
    "Explainers are interpretation layers. They help frame the record, but methodology and sources still determine how much weight a reader should place on the claim."
  );
}

function buildRelatedExplainerResearchPaths() {
  return [
    {
      href: "/research",
      eyebrow: "Research hub",
      title: "Return to the curated research hub",
      description:
        "Use the research hub when this topic opens into a broader question and you need the strongest thematic, report, or trust-page path.",
    },
    {
      href: "/reports",
      eyebrow: "Reports",
      title: "Read reports built from the same public record",
      description:
        "Reports synthesize broader patterns across presidents, policies, and time, making them the next step when you need comparative analysis instead of a single explainer.",
    },
    {
      href: "/policies",
      eyebrow: "Policy explorer",
      title: "Browse the underlying policy records",
      description:
        "Policy pages expose the laws, executive actions, and court decisions that help verify or complicate the narrative on this explainer page.",
    },
    {
      href: "/sources",
      eyebrow: "Sources",
      title: "Inspect the broader source library",
      description:
        "The source library helps readers move from one explainer's citations into the wider evidence base behind EquityStack's public record.",
    },
    {
      href: "/glossary",
      eyebrow: "Glossary",
      title: "Clarify the site’s key concepts and page types",
      description:
        "Use the glossary when you need quick definitions for terms like record, report, thematic page, outcome, or source before moving deeper into the site.",
    },
  ];
}

function buildFlagshipExplainerCards(editorial) {
  return Array.isArray(editorial.referenceCards) ? editorial.referenceCards : [];
}

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
    title: `${explainer.title} | Black history explainer`,
    description:
      explainer.summary ||
      "Evidence-backed explainer connecting Black history, policy history, public claims, and related records.",
    path: `/explainers/${slug}`,
    imagePath: `${buildExplainerCardHref(explainer)}/opengraph-image`,
    type: "article",
    keywords: [
      explainer.category,
      "Black history explainer",
      "civil rights policy explainer",
    ].filter(Boolean),
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
  const editorial = getExplainerEditorial(slug);
  const connectedPresidents = buildConnectedPresidents(relatedPromises);
  const researchPaths = buildExplainerResearchPaths({
    editorial,
    connectedPresidents,
    relatedPromises,
    relatedFutureBills,
  });
  const utilityNotes = buildExplainerUtilityNotes(explainer, editorial);
  const flagshipCards = buildFlagshipExplainerCards(editorial);
  const genericResourceLinks = buildRelatedExplainerResearchPaths();
  const relatedExplainers =
    explainer.related_explainers?.length
      ? explainer.related_explainers
      : (explainersIndex.items || [])
          .filter((item) => item.slug !== slug)
          .slice(0, 3);

  return (
    <main className="space-y-10">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/explainers", label: "Explainers" },
              { label: explainer.title },
            ],
            `/explainers/${slug}`
          ),
          buildExplainerJsonLd(explainer),
        ]}
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

      <section className="space-y-5">
        <ExplainerPanel className="space-y-5">
          <SectionIntro
            eyebrow={editorial.lens || "Read this for"}
            title="What this explainer helps clarify"
            description={
              editorial.pagePurpose ||
              "The best use of an explainer is to clarify the claim, connect it to Black history or policy history, and make the next evidentiary click obvious."
            }
          />
          <div className="grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            {utilityNotes.map((item) => (
              <div
                key={item}
                className="rounded-[1.1rem] border border-white/8 bg-[rgba(8,14,24,0.92)] px-4 py-4"
              >
                {item}
              </div>
            ))}
          </div>
          <MethodologyCallout description={buildPageMethodNote()} />
        </ExplainerPanel>
      </section>

      {flagshipCards.length ? (
        <section className="grid gap-4 md:grid-cols-3">
          {flagshipCards.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.4rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </section>
      ) : null}

      {editorial.questions?.length ? (
        <section className="space-y-5">
          <SectionIntro
            eyebrow="Questions"
            title="Questions this explainer helps answer"
            description="These prompts clarify the historical or policy question this page is designed to support."
          />
          <ThematicQuestionList items={editorial.questions} />
        </section>
      ) : null}

      {researchPaths.length ? (
        <section className="space-y-5">
          <SectionIntro
            eyebrow="Research paths"
            title="Where to go next from this explainer"
            description="These routes help turn one explainer page into a fuller research path across presidents, promises, policies, legislation, reports, and thematic guides."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {researchPaths.map((item) => (
              <ThematicHubCard
                key={item.href}
                eyebrow={item.eyebrow}
                title={item.title}
                description={item.description}
                note={item.note}
                href={item.href}
              />
            ))}
          </div>
        </section>
      ) : null}

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

      <section className="space-y-5">
        <ExplainerPanel className="space-y-5">
          {explainer.intro_text ? (
            <article className="rounded-[1.3rem] border border-white/8 bg-white/5 p-5">
              <h2 className="text-2xl font-semibold text-white">Historical framing</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[var(--ink-soft)]">
                {explainer.intro_text}
              </p>
            </article>
          ) : null}

          {(explainer.structured_sections || []).map((section) => (
            <article
              key={section.title}
              className="rounded-[1.3rem] border border-white/8 bg-white/5 p-5"
            >
              <h2 className="text-2xl font-semibold text-white">
                {buildStructuredSectionTitle(section.title)}
              </h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[var(--ink-soft)]">
                {section.body}
              </p>
            </article>
          ))}

          <div className="rounded-[1.3rem] border border-white/8 bg-white/5 p-5">
            <h2 className="text-xl font-semibold text-white">Connected records on this page</h2>
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

          <div className="rounded-[1.3rem] border border-white/8 bg-white/5 p-5">
            <h2 className="text-xl font-semibold text-white">How to use this page well</h2>
            <div className="mt-4 grid gap-3">
              {genericResourceLinks.slice(0, 3).map((item) => (
                <Link key={item.href} href={item.href} className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4 hover:border-[rgba(132,247,198,0.24)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                    {item.eyebrow}
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
        </ExplainerPanel>
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

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Evidence"
          title="Sources and verification"
          description="The explainer layer should never hide the source layer. Use these citations to check the narrative against the record."
        />
        <ExplainerPanel className="space-y-5">
          {explainer.sources?.length ? (
            <EvidenceSourceList items={explainer.sources} />
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
              No structured explainer sources are attached yet.
            </div>
          )}
          <SectionIntro
            eyebrow="Related promises"
            title="Promise records tied to this topic"
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
        </ExplainerPanel>
      </section>

      {(relatedFutureBills.length || connectedPresidents.length) ? (
        <section className="space-y-5">
          <ExplainerPanel className="space-y-5">
            <SectionIntro
              eyebrow="Bills and proposals"
              title="Legislation and reform context linked from this explainer"
              description="These proposal pages extend the topic into current or future legislative paths when the site already has that relationship modeled."
            />
            {relatedFutureBills.length ? (
              <div className="grid gap-3">
                {relatedFutureBills.map((item) => (
                  <FutureBillCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
                No reform-proposal or future-bill records are attached to this explainer yet.
              </div>
            )}
            <SectionIntro
              eyebrow="Related presidents"
              title="Presidents connected through the linked record"
              description="When promise records tie this topic to a presidency, those profiles are the fastest way to add administration-level context."
            />
            {connectedPresidents.length ? (
              <div className="grid gap-3">
                {connectedPresidents.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/presidents/${item.slug}`}
                    className="rounded-[1.2rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-4 hover:border-[rgba(132,247,198,0.24)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
                      President profile
                    </p>
                    <h3 className="mt-2 text-base font-medium text-white">{item.name}</h3>
                    <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                      {item.promiseCount} linked promise record{item.promiseCount === 1 ? "" : "s"}
                      {item.promiseTitles[0] ? `, including ${item.promiseTitles[0]}` : ""}.
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.6rem] border border-dashed border-white/12 bg-white/4 p-6 text-sm leading-7 text-[var(--ink-soft)]">
                No presidency-specific promise links are attached to this explainer yet.
              </div>
            )}
          </ExplainerPanel>
        </section>
      ) : null}

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Related policies"
          title="Policy records linked from this topic"
          description="These records are usually the fastest route from narrative framing into the underlying policy evidence."
        />
        <ExplainerPanel className="space-y-5">
          {relatedPolicies.length ? (
            <div className="grid gap-3">
              {relatedPolicies.map((item) => (
                <Link
                  key={item.id}
                  href={`/policies/${buildPolicySlug(item)}`}
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
          <SectionIntro
            eyebrow="Keep reading"
            title="Related explainers"
            description="Use related explainers when you need adjacent context instead of reopening the same topic from scratch."
          />
          <ExplainerIndexGrid items={relatedExplainers} />
        </ExplainerPanel>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Move from this explainer into records, reports, and trust pages"
          description="Use these next steps when you want to turn one topic page into a broader research path across records, synthesis, and verification."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {genericResourceLinks.slice(0, 4).map((item) => (
            <ThematicHubCard
              key={item.href}
              eyebrow={item.eyebrow}
              title={item.title}
              description={item.description}
              note={item.note}
              href={item.href}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
