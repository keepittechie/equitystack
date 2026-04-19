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
import {
  getBillStatusTone,
  MetricCard,
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";

export const dynamic = "force-dynamic";

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

function ExplainerContentCard({ card, grid = false }) {
  return (
    <Panel as="article" padding="md" className={grid ? "h-full" : ""}>
      <h2 className="text-2xl font-semibold text-white">{card.title}</h2>
      <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[var(--ink-soft)]">
        {card.body}
      </p>
    </Panel>
  );
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
    <Panel
      as={Link}
      href={buildFutureBillDetailHref(item)}
      padding="md"
      interactive
    >
      <div className="flex flex-wrap gap-2">
        <StatusPill tone="info">{item.target_area || "Future bill"}</StatusPill>
        <StatusPill tone="default">{item.priority_level || "Priority pending"}</StatusPill>
      </div>
      <h3 className="mt-2 text-base font-medium text-white">{item.title}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
        {item.problem_statement ||
          "Open the proposal page for the problem statement, linked bills, and related policy context."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone={getBillStatusTone(item.status)}>
          {item.status || "Status pending"}
        </StatusPill>
        <StatusPill tone="info">
          {(item.tracked_bills || []).length} linked tracked bill
          {(item.tracked_bills || []).length === 1 ? "" : "s"}
        </StatusPill>
      </div>
    </Panel>
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
  const explainerContentCards = [
    ...(explainer.intro_text
      ? [
          {
            key: "intro-text",
            title: "Historical framing",
            body: explainer.intro_text,
          },
        ]
      : []),
    ...(explainer.structured_sections || []).map((section) => ({
      key: section.title,
      title: buildStructuredSectionTitle(section.title),
      body: section.body,
    })),
  ];
  const featuredCards = explainerContentCards.slice(0, 2);
  const gridCards = explainerContentCards.slice(2);

  return (
    <main className="space-y-4">
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
        <MetricCard
          label="Linked policies"
          value={relatedPolicies.length}
          description="Policy records tied directly to this explainer."
          tone="info"
          showDot
        />
        <MetricCard
          label="Related promises"
          value={relatedPromises.length}
          description="Promise tracker records that connect to the same subject matter."
        />
        <MetricCard
          label="Tracked bills"
          value={relatedFutureBills.length}
          description="Legislative reform records linked from this explainer."
        />
        <MetricCard
          label="Sources"
          value={explainer.sources?.length || 0}
          description="Cited explainer sources visible alongside the narrative."
          tone="verified"
        />
      </section>

      <Panel padding="md" prominence="primary" className="space-y-4">
        <SectionHeader
          eyebrow={editorial.lens || "Read this for"}
          title="What this explainer helps clarify"
          description={
            editorial.pagePurpose ||
            "The best use of an explainer is to clarify the claim, connect it to Black history or policy history, and make the next evidentiary click obvious."
          }
          bordered={false}
        />
        <div className="grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
          {utilityNotes.map((item) => (
            <Panel key={item} padding="md" className="text-sm leading-7 text-[var(--ink-soft)]">
              {item}
            </Panel>
          ))}
        </div>
        <MethodologyCallout description={buildPageMethodNote()} />
      </Panel>

      {flagshipCards.length ? (
        <section className="grid gap-4 md:grid-cols-3">
          {flagshipCards.map((item) => (
            <Panel as="article" key={item.title} padding="md">
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Panel>
          ))}
        </section>
      ) : null}

      {editorial.questions?.length ? (
        <Panel padding="md" className="space-y-4">
          <SectionHeader
            eyebrow="Questions"
            title="Questions this explainer helps answer"
            description="These prompts clarify the historical or policy question this page is designed to support."
            bordered={false}
          />
          <ThematicQuestionList items={editorial.questions} />
        </Panel>
      ) : null}

      {researchPaths.length ? (
        <Panel padding="md" className="space-y-4">
          <SectionHeader
            eyebrow="Research paths"
            title="Where to go next from this explainer"
            description="These routes help turn one explainer page into a fuller research path across presidents, promises, policies, legislation, reports, and thematic guides."
            bordered={false}
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
        </Panel>
      ) : null}

      {takeaways.length ? (
        <Panel padding="md" className="space-y-4">
          <SectionHeader
            eyebrow="Key takeaways"
            title="What to retain from this page"
            description="These takeaways summarize the core argument before you move into the underlying record."
            bordered={false}
          />
          <div className="grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            {takeaways.map((item) => (
              <Panel key={item} padding="md" className="text-sm leading-7 text-[var(--ink-soft)]">
                {item}
              </Panel>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel padding="md" className="space-y-4">
        {featuredCards.map((card) => (
          <ExplainerContentCard key={card.key} card={card} />
        ))}

        {gridCards.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {gridCards.map((card) => (
              <ExplainerContentCard key={card.key} card={card} grid />
            ))}
          </div>
        ) : null}

        <Panel padding="md" className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Connected records on this page</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Policies"
              value={relatedPolicies.length}
              description="Linked policy records"
              density="compact"
              tone="info"
            />
            <MetricCard
              label="Promises"
              value={relatedPromises.length}
              description="Related promise records"
              density="compact"
            />
            <MetricCard
              label="Reform paths"
              value={relatedFutureBills.length}
              description="Reform or tracked-bill records"
              density="compact"
            />
          </div>
        </Panel>

        <Panel padding="md" className="space-y-4">
          <h2 className="text-xl font-semibold text-white">How to use this page well</h2>
          <div className="grid gap-3">
            {genericResourceLinks.slice(0, 3).map((item) => (
              <Panel
                key={item.href}
                as={Link}
                href={item.href}
                padding="md"
                interactive
              >
                <StatusPill tone="default">{item.eyebrow}</StatusPill>
                <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
              </Panel>
            ))}
          </div>
        </Panel>
      </Panel>

      <Panel padding="md" className="space-y-4">
        <SectionHeader
          eyebrow="Timeline"
          title="Historical sequence"
          description="When timeline data is available, it helps turn the explainer from an argument into a chronological record."
          bordered={false}
        />
        {timelineItems.length ? (
          <PolicyTimeline items={timelineItems} />
        ) : (
          <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
            No structured timeline entries are attached to this explainer yet.
          </Panel>
        )}
      </Panel>

      <Panel padding="md" className="space-y-4">
        <SectionHeader
          eyebrow="Evidence"
          title="Sources and verification"
          description="The explainer layer should never hide the source layer. Use these citations to check the narrative against the record."
          bordered={false}
        />
        {explainer.sources?.length ? (
          <EvidenceSourceList items={explainer.sources} />
        ) : (
          <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
            No structured explainer sources are attached yet.
          </Panel>
        )}
        <SectionHeader
          eyebrow="Related promises"
          title="Promise records tied to this topic"
          description="Promise records help connect the explainer to public commitments and status changes where available."
          bordered={false}
        />
        {relatedPromises.length ? (
          <PromiseResultsTable
            items={relatedPromises}
            buildHref={(item) => `/promises/${item.slug}`}
          />
        ) : (
          <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
            No related promise records were attached to this explainer.
          </Panel>
        )}
      </Panel>

      {(relatedFutureBills.length || connectedPresidents.length) ? (
        <Panel padding="md" className="space-y-4">
          <SectionHeader
            eyebrow="Bills and proposals"
            title="Legislation and reform context linked from this explainer"
            description="These proposal pages extend the topic into current or future legislative paths when the site already has that relationship modeled."
            bordered={false}
          />
          {relatedFutureBills.length ? (
            <div className="grid gap-3">
              {relatedFutureBills.map((item) => (
                <FutureBillCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No reform-proposal or future-bill records are attached to this explainer yet.
            </Panel>
          )}
          <SectionHeader
            eyebrow="Related presidents"
            title="Presidents connected through the linked record"
            description="When promise records tie this topic to a presidency, those profiles are the fastest way to add administration-level context."
            bordered={false}
          />
          {connectedPresidents.length ? (
            <div className="grid gap-3">
              {connectedPresidents.map((item) => (
                <Panel
                  key={item.slug}
                  as={Link}
                  href={`/presidents/${item.slug}`}
                  padding="md"
                  interactive
                >
                  <StatusPill tone="info">President profile</StatusPill>
                  <h3 className="mt-2 text-base font-medium text-white">{item.name}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                    {item.promiseCount} linked promise record{item.promiseCount === 1 ? "" : "s"}
                    {item.promiseTitles[0] ? `, including ${item.promiseTitles[0]}` : ""}.
                  </p>
                </Panel>
              ))}
            </div>
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No presidency-specific promise links are attached to this explainer yet.
            </Panel>
          )}
        </Panel>
      ) : null}

      <Panel padding="md" className="space-y-4">
        <SectionHeader
          eyebrow="Related policies"
          title="Policy records linked from this topic"
          description="These records are usually the fastest route from narrative framing into the underlying policy evidence."
          bordered={false}
        />
        {relatedPolicies.length ? (
          <div className="grid gap-3">
            {relatedPolicies.map((item) => (
              <Panel
                key={item.id}
                as={Link}
                href={`/policies/${buildPolicySlug(item)}`}
                padding="md"
                interactive
              >
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone="default">{item.year_enacted || "Undated"}</StatusPill>
                  <StatusPill tone="info">{item.policy_type || "Policy"}</StatusPill>
                </div>
                <h3 className="mt-2 text-base font-medium text-white">{item.title}</h3>
                {item.primary_party ? (
                  <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                    {item.primary_party}
                  </p>
                ) : null}
              </Panel>
            ))}
          </div>
        ) : (
          <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
            No linked policy records are attached to this explainer yet.
          </Panel>
        )}
        <SectionHeader
          eyebrow="Keep reading"
          title="Related explainers"
          description="Use related explainers when you need adjacent context instead of reopening the same topic from scratch."
          bordered={false}
        />
        <ExplainerIndexGrid items={relatedExplainers} />
      </Panel>

      <Panel padding="md" className="space-y-4">
        <SectionHeader
          eyebrow="Continue exploring"
          title="Move from this explainer into records, reports, and trust pages"
          description="Use these next steps when you want to turn one topic page into a broader research path across records, synthesis, and verification."
          bordered={false}
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
      </Panel>
    </main>
  );
}
