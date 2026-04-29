import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPageMetadata } from "@/lib/metadata";
import {
  buildPolicySlug,
  fetchExplainerCategoryData,
  fetchExplainerDetailData,
  fetchExplainersIndexData,
} from "@/lib/public-site-data";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import PageRoleCallout from "@/app/components/public/PageRoleCallout";
import DiscoveryGuidancePanel from "@/app/components/public/DiscoveryGuidancePanel";
import CopyResponseButton from "@/app/components/public/copy-response-button";
import {
  MethodologyCallout,
} from "@/app/components/public/core";
import {
  EvidenceSourceList,
  ExplainerIndexGrid,
  PolicyTimeline,
  PromiseResultsTable,
  ReportCardGrid,
} from "@/app/components/public/entities";
import { getExplainerEditorial } from "@/lib/explainer-editorial";
import {
  buildExplainerCardHref,
  buildFutureBillDetailHref,
} from "@/lib/shareable-card-links";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildExplainerJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";
import {
  getBillStatusTone,
  MetricCard,
  Panel,
  SectionHeader,
  StatusPill,
} from "@/app/components/dashboard/primitives";
import ExplainerArgumentModeToggle from "@/app/components/explainers/ExplainerArgumentModeToggle";

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
          ? `Use this only if you want administration-level context beyond this explainer, including ${president.promiseTitles[0]}.`
          : `Use this only if you want to place the explainer inside a broader presidential record on Black Americans.`,
    });
  }

  if (relatedPromises.length) {
    items.push({
      href: "/promises",
      eyebrow: "Promise tracker",
      title: "Compare promises with follow-through if needed",
      description:
        "This is a deeper follow-up path for readers who want to compare campaign or governing commitments against the public record that followed.",
    });
  }

  items.push(...(editorial.researchPaths || []));

  items.push({
    href: "/policies",
    eyebrow: "Policy explorer",
    title: "Open the underlying policy records only if you want the raw record",
    description:
      "Policy pages expose the laws, executive actions, and court decisions that help verify or complicate the narrative already summarized on this explainer page.",
  });

  items.push({
    href: "/reports",
    eyebrow: "Reports",
    title: "Read report analysis only if you want a broader synthesis",
    description:
      "Reports synthesize patterns across presidents, policies, and time when you need comparison beyond this one topic page.",
  });

  if (relatedFutureBills.length) {
    items.push({
      href: "/future-bills",
      eyebrow: "Legislation and proposals",
      title: "Browse linked reform proposals and tracked bills if you want current follow-on paths",
      description:
        "Use the legislative layer only when this topic leads into current reform ideas, tracked bills, or future-facing policy proposals.",
      note: `${relatedFutureBills.length} related proposal${relatedFutureBills.length === 1 ? "" : "s"} linked on this page.`,
    });
  }

  items.push({
    href: "/sources",
    eyebrow: "Sources",
    title: "Inspect the evidence base only if you want to verify the citations directly",
    description:
      "The source library helps readers move from this explainer's citations into the wider evidence base behind EquityStack's public record.",
  });

  const seen = new Set();
  return items.filter((item) => {
    if (!item?.href || seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

function buildExplainerUtilityNotes(editorial) {
  return [
    editorial.pagePurpose,
    editorial.whyThisMatters,
    "This page should answer the core question on its own. The linked records, reports, and sources are there to verify the answer or take the topic deeper, not to replace the explanation.",
  ].filter(Boolean);
}

function buildPageMethodNote() {
  return (
    "Explainers should give the reader the answer first. Methodology and sources are still necessary, but mainly to verify how strong that answer is and where its limits are."
  );
}

function buildRelatedExplainerResearchPaths() {
  return [
    {
      href: "/research",
      eyebrow: "Research hub",
      title: "Open the research hub only if this topic becomes a broader question",
      description:
        "This is an optional follow-up path when the explainer leads into a wider thematic question and you want the strongest thematic, report, or trust-page route.",
    },
    {
      href: "/reports",
      eyebrow: "Reports",
      title: "Read reports only if you want broader synthesis",
      description:
        "Reports synthesize broader patterns across presidents, policies, and time when you want comparative analysis beyond a single explainer.",
    },
    {
      href: "/policies",
      eyebrow: "Policy explorer",
      title: "Open policy records only if you want the underlying law or action pages",
      description:
        "Policy pages expose the laws, executive actions, and court decisions that help verify or complicate the narrative already summarized on this page.",
    },
    {
      href: "/sources",
      eyebrow: "Sources",
      title: "Inspect the broader source library only if you want deeper citation review",
      description:
        "The source library helps readers move from this explainer's citations into the wider evidence base behind EquityStack's public record.",
    },
    {
      href: "/glossary",
      eyebrow: "Glossary",
      title: "Open the glossary only if you need help with site terms",
      description:
        "The glossary is a support path for readers who want quick definitions for terms like record, report, thematic page, outcome, or source.",
    },
  ];
}

const EXPLAINER_SYSTEM_GUIDANCE = [
  {
    href: "/reports",
    label: "Synthesis",
    tone: "info",
    title: "Reports are optional when you want the broader pattern",
    description:
      "Use reports only when the question becomes comparative, historical across many records, or more analytical than one topic page can hold.",
  },
  {
    href: "/sources",
    label: "Evidence",
    tone: "verified",
    title: "Sources are for direct verification of the record",
    description:
      "Use the source library only when you want to inspect the evidence base supporting the policy, promise, and outcome claims around this topic.",
  },
  {
    href: "/policies",
    label: "Records",
    tone: "default",
    title: "Policy pages expose the concrete records behind the explanation",
    description:
      "Use policy and promise pages only when you want the specific laws, actions, outcomes, and related Black-impact rows underneath the explainer.",
  },
];

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

function ArgumentReadyBreakdown({ breakdown = null }) {
  if (!breakdown) {
    return null;
  }

  const { claim, whyMisleading, dataShows, bottomLine, responseScript, responseContext } =
    breakdown;

  return (
    <Panel className="overflow-hidden">
      <SectionHeader
        eyebrow="Conversation use"
        title="Argument-Ready Breakdown"
        description="Use this module when you need the shortest defensible version of the explainer for a comment, reply, or discussion before opening the full record."
      />
      <div className="space-y-4 p-4">
        {claim || whyMisleading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {claim ? (
              <Panel padding="md" className="h-full">
                <StatusPill tone="warning">The claim</StatusPill>
                <p className="mt-3 text-sm leading-7 text-white">{claim}</p>
              </Panel>
            ) : null}
            {whyMisleading ? (
              <Panel padding="md" className="h-full">
                <StatusPill tone="info">Why it&apos;s misleading</StatusPill>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {whyMisleading}
                </p>
              </Panel>
            ) : null}
          </div>
        ) : null}

        {dataShows?.length ? (
          <Panel padding="md">
            <StatusPill tone="verified">What the data shows</StatusPill>
            <ul className="mt-3 grid gap-2 text-sm leading-7 text-[var(--ink-soft)]">
              {dataShows.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-[var(--line)] bg-[rgba(18,31,49,0.42)] px-3 py-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {bottomLine ? (
          <Panel padding="md">
            <StatusPill tone="default">Bottom line</StatusPill>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
              {bottomLine}
            </p>
          </Panel>
        ) : null}

        {responseScript ? (
          <Panel
            padding="md"
            className="border-[rgba(132,247,198,0.28)] bg-[rgba(132,247,198,0.07)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <StatusPill tone="success">
                If someone says this, you can respond:
              </StatusPill>
              <CopyResponseButton text={responseScript} />
            </div>
            <p className="mt-3 text-sm leading-7 text-white">{responseScript}</p>
            {responseContext ? (
              <p className="mt-3 text-[12px] leading-6 text-[var(--ink-soft)]">
                {responseContext}
              </p>
            ) : null}
          </Panel>
        ) : null}
      </div>
    </Panel>
  );
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const explainer = await fetchExplainerDetailData(slug);

  if (!explainer) {
    const categoryData = await fetchExplainerCategoryData(slug);
    if (categoryData) {
      return buildPageMetadata({
        title: `${categoryData.category.label} explainers`,
        description: `Browse EquityStack explainers in the ${categoryData.category.label} category.`,
        path: `/explainers/${slug}`,
      });
    }

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

function ExplainerCategoryPage({ categoryData, slug }) {
  const categoryLabel = categoryData.category.label;
  const explainers = categoryData.items || [];

  return (
    <main className="space-y-4">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [
              { href: "/", label: "Home" },
              { href: "/explainers", label: "Explainers" },
              { label: categoryLabel },
            ],
            `/explainers/${slug}`
          ),
          buildCollectionPageJsonLd({
            title: `${categoryLabel} explainers`,
            description: `EquityStack explainers grouped under ${categoryLabel}.`,
            path: `/explainers/${slug}`,
            about: [categoryLabel, "Black history", "U.S. policy"],
            keywords: [categoryLabel, "EquityStack explainers"],
          }),
          buildItemListJsonLd({
            title: `${categoryLabel} explainer entries`,
            description: `Published explainers in the ${categoryLabel} category.`,
            path: `/explainers/${slug}`,
            items: explainers.map((item) => ({
              href: `/explainers/${item.slug}`,
              name: item.title,
            })),
          }),
        ]}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/explainers", label: "Explainers" },
          { label: categoryLabel },
        ]}
      />

      <Panel prominence="primary" className="overflow-hidden">
        <SectionHeader
          eyebrow="Explainer category"
          title={`${categoryLabel} explainers`}
          description="Use this category page to browse explainers that share the same editorial pattern. The cards and routes are the same explainer system used across the public library."
        />
        <div className="grid gap-4 p-4 md:grid-cols-3">
          <MetricCard
            label="Category"
            value={categoryLabel}
            description="Editorial grouping used for browsing."
            density="compact"
            showDot
          />
          <MetricCard
            label="Explainers"
            value={explainers.length}
            description="Published explainers in this category."
            density="compact"
            tone="info"
          />
          <MetricCard
            label="Listing"
            value="Filtered"
            description="Uses the same explainer cards as the main archive."
            density="compact"
            tone="verified"
          />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Library"
          title={`Browse ${categoryLabel.toLowerCase()} explainers`}
          description="Open an explainer to see its structured sections, sources, related records, and next-step research paths."
        />
        <div className="p-4">
          <ExplainerIndexGrid items={explainers} />
        </div>
      </Panel>
    </main>
  );
}

export default async function ExplainerDetailPage({ params, searchParams }) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) || {};
  const [explainer, explainersIndex] = await Promise.all([
    fetchExplainerDetailData(slug),
    fetchExplainersIndexData(),
  ]);

  if (!explainer) {
    const categoryData = await fetchExplainerCategoryData(slug);
    if (categoryData) {
      return <ExplainerCategoryPage categoryData={categoryData} slug={slug} />;
    }

    notFound();
  }

  const takeaways = parseTakeaways(explainer.key_takeaways);
  const timelineItems = parseTimeline(explainer.timeline_events);
  const relatedPolicies = explainer.related_policies || [];
  const relatedPromises = explainer.related_promises || [];
  const relatedFutureBills = explainer.related_future_bills || [];
  const relatedReports = explainer.related_reports || [];
  const editorial = getExplainerEditorial(slug);
  const connectedPresidents = buildConnectedPresidents(relatedPromises);
  const researchPaths = buildExplainerResearchPaths({
    editorial,
    connectedPresidents,
    relatedPromises,
    relatedFutureBills,
  });
  const utilityNotes = buildExplainerUtilityNotes(editorial);
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

      <Panel prominence="primary" className="overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 border-b border-[var(--line)] p-4 xl:border-b-0 xl:border-r">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
              {explainer.category || "Explainer"}
            </p>
            <h1 className="mt-3 max-w-4xl text-[clamp(1.9rem,5.5vw,3.7rem)] font-semibold leading-[1] tracking-[-0.04em] text-white">
              {explainer.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--ink-soft)] md:text-base md:leading-7">
              {explainer.summary ||
                "This explainer connects a common public claim to the relevant historical record and linked policy evidence."}
            </p>
            {explainer.tags?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {explainer.tags.map((tag) => (
                  <StatusPill key={tag} tone="default">
                    {tag}
                  </StatusPill>
                ))}
              </div>
            ) : null}
          </div>
          <aside className="grid content-start gap-3 p-4">
            <MetricCard
              label="Primary read"
              value={editorial.lens || "Historical context"}
              description="Start here before opening the linked records."
              density="compact"
              showDot
            />
            <Link
              href="/explainers"
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--line-strong)] bg-[rgba(18,31,49,0.58)] px-3 text-[12px] font-semibold text-white transition-[background-color,border-color,box-shadow] hover:border-[var(--line-strong)] hover:bg-[rgba(18,31,49,0.86)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
            >
              Back to explainers
            </Link>
            <Link
              href={buildExplainerCardHref(explainer)}
              className="inline-flex min-h-9 items-center justify-center rounded-md border border-[rgba(132,247,198,0.72)] bg-[var(--accent)] px-3 text-[12px] font-semibold text-[#051019] transition-[background-color,border-color,box-shadow] hover:border-[var(--accent)] hover:bg-[rgba(132,247,198,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(132,247,198,0.28)]"
            >
              Share card
            </Link>
          </aside>
        </div>
      </Panel>

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

      <ExplainerArgumentModeToggle
        argumentMode={explainer.argument_mode}
        argumentReadyBreakdown={explainer.argument_ready_breakdown}
        explainerTitle={explainer.title}
        explainerSlug={slug}
        explainerSummary={explainer.summary}
        initialMode={resolvedSearchParams.mode === "argument" ? "argument" : "explainer"}
      />

      <PageRoleCallout
        title="Use explainers as the answer-first layer"
        description="Explainers should answer the main legal, historical, or policy question on-page. Linked records, reports, and sources are for verification, comparison, or deeper follow-up when the reader wants more than the direct answer."
        links={[
          { href: "/reports", label: "Reports" },
          { href: "/sources", label: "Sources" },
          { href: "/policies", label: "Policy records" },
        ]}
      />

      <ArgumentReadyBreakdown breakdown={explainer.argument_ready_breakdown} />

      <Panel prominence="primary" className="overflow-hidden">
        <SectionHeader
          eyebrow={editorial.lens || "Read this for"}
          title="What this explainer answers first"
          description={
            editorial.pagePurpose ||
            "The best use of an explainer is to answer the core claim clearly, connect it to Black history or policy history, and make verification possible without forcing extra clicks."
          }
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            {utilityNotes.map((item) => (
              <Panel key={item} padding="md" className="text-sm leading-7 text-[var(--ink-soft)]">
                {item}
              </Panel>
            ))}
          </div>
          <DiscoveryGuidancePanel
            eyebrow="How this explainer supports the platform"
            title="Use linked records only when you want deeper verification"
            description="This explainer should stand on its own first. The surrounding records, reports, and sources are there when a reader wants more detail or wants to inspect the evidence directly."
            items={EXPLAINER_SYSTEM_GUIDANCE}
          />
          <MethodologyCallout description={buildPageMethodNote()} />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Page structure"
          title="The answer, explained"
          description="Start here for the full explanation. Linked records appear later on the page for verification or deeper research, not because this page is supposed to leave the question unanswered."
        />
        <div className="space-y-4 p-4">
          {featuredCards.map((card) => (
            <Panel as="article" key={card.key} padding="md">
              <h2 className="text-2xl font-semibold text-white">{card.title}</h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[var(--ink-soft)]">
                {card.body}
              </p>
            </Panel>
          ))}

          {gridCards.length ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {gridCards.map((card) => (
                <Panel as="article" key={card.key} padding="md" className="h-full">
                  <h2 className="text-2xl font-semibold text-white">{card.title}</h2>
                  <p className="mt-4 whitespace-pre-line text-sm leading-8 text-[var(--ink-soft)]">
                    {card.body}
                  </p>
                </Panel>
              ))}
            </div>
          ) : null}

          <Panel padding="md" className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Verification paths attached to this page</h2>
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
            <h2 className="text-xl font-semibold text-white">Optional next steps</h2>
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
        </div>
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
        <Panel className="overflow-hidden">
          <SectionHeader
            eyebrow="Questions"
            title="Questions this explainer helps answer"
            description="These prompts clarify the historical or policy question this page is designed to support."
          />
          <div className="grid gap-3 p-4">
            {editorial.questions.map((item) => (
              <Panel key={item} padding="md" className="text-sm leading-7 text-[var(--ink-soft)]">
                {item}
              </Panel>
            ))}
          </div>
        </Panel>
      ) : null}

      {researchPaths.length ? (
        <Panel className="overflow-hidden">
          <SectionHeader
            eyebrow="Optional research paths"
            title="Go deeper only if you need more than the explainer"
            description="These routes are follow-up paths for readers who want adjacent records, broader comparison, or primary-source verification after reading the answer on this page."
          />
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {researchPaths.map((item) => (
              <Panel
                key={item.href}
                href={item.href}
                as={Link}
                padding="md"
                interactive
              >
                <StatusPill tone="info">{item.eyebrow}</StatusPill>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                  {item.description}
                </p>
                {item.note ? (
                  <p className="mt-3 text-[12px] leading-5 text-[var(--ink-muted)]">
                    {item.note}
                  </p>
                ) : null}
              </Panel>
            ))}
          </div>
        </Panel>
      ) : null}

      {takeaways.length ? (
        <Panel className="overflow-hidden">
          <SectionHeader
            eyebrow="Key takeaways"
            title="What to retain from this page"
            description="These takeaways summarize the core argument before you move into the underlying record."
          />
          <div className="grid gap-3 p-4 text-sm leading-7 text-[var(--ink-soft)]">
            {takeaways.map((item) => (
              <Panel key={item} padding="md" className="text-sm leading-7 text-[var(--ink-soft)]">
                {item}
              </Panel>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Timeline"
          title="Historical sequence"
          description="When timeline data is available, it helps turn the explainer from an argument into a chronological record."
        />
        <div className="p-4">
          {timelineItems.length ? (
            <PolicyTimeline items={timelineItems} />
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No structured timeline entries are attached to this explainer yet.
            </Panel>
          )}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Evidence"
          title="Sources and verification"
          description="The explainer layer should never hide the source layer. Use these citations to check the narrative against the record."
        />
        <div className="p-4">
          {explainer.sources?.length ? (
            <EvidenceSourceList items={explainer.sources} />
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No structured explainer sources are attached yet.
            </Panel>
          )}
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Related promises"
          title="Promise records tied to this topic"
          description="Promise records help connect the explainer to public commitments and status changes where available."
        />
        <div className="p-4">
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
        </div>
      </Panel>

      {(relatedFutureBills.length || connectedPresidents.length) ? (
        <>
          <Panel className="overflow-hidden">
            <SectionHeader
              eyebrow="Bills and proposals"
              title="Legislation and reform context linked from this explainer"
              description="These proposal pages extend the topic into current or future legislative paths when the site already has that relationship modeled."
            />
            <div className="p-4">
              {relatedFutureBills.length ? (
                <div className="grid gap-3">
                  {relatedFutureBills.map((item) => (
                    <Panel
                      key={item.id}
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
                  ))}
                </div>
              ) : (
                <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
                  No reform-proposal or future-bill records are attached to this explainer yet.
                </Panel>
              )}
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <SectionHeader
              eyebrow="Related presidents"
              title="Presidents connected through the linked record"
              description="When promise records tie this topic to a presidency, those profiles are the fastest way to add administration-level context."
            />
            <div className="p-4">
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
            </div>
          </Panel>
        </>
      ) : null}

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Related policies"
          title="Policy records linked from this topic"
          description="These records are usually the fastest route from narrative framing into the underlying policy evidence."
        />
        <div className="p-4">
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
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Keep reading"
          title="Related explainers"
          description="Use related explainers when you need adjacent context instead of reopening the same topic from scratch."
        />
        <div className="p-4">
          {relatedExplainers.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {relatedExplainers.map((item) => (
                <Panel
                  key={item.slug}
                  as={Link}
                  href={`/explainers/${item.slug}`}
                  padding="md"
                  interactive
                  className="flex h-full flex-col"
                >
                  <StatusPill tone="default">{item.category || "Explainer"}</StatusPill>
                  <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 line-clamp-4 text-sm leading-7 text-[var(--ink-soft)]">
                    {item.summary}
                  </p>
                  <p className="mt-auto pt-4 text-[12px] font-semibold text-[var(--ink-soft)]">
                    Read historical context and linked records
                  </p>
                </Panel>
              ))}
            </div>
          ) : (
            <Panel padding="md" className="border-dashed text-sm leading-7 text-[var(--ink-soft)]">
              No related explainers are attached to this topic yet.
            </Panel>
          )}
        </div>
      </Panel>

      {relatedReports.length ? (
        <Panel className="overflow-hidden">
          <SectionHeader
            eyebrow="Related reports"
            title="Related reports"
            description="Use these reports when the explainer leads into synthesis or comparative analysis built from the wider public record."
          />
          <div className="p-4">
            <ReportCardGrid items={relatedReports} />
          </div>
        </Panel>
      ) : null}

      <Panel className="overflow-hidden">
        <SectionHeader
          eyebrow="Continue exploring"
          title="Broader site paths if you want to keep going"
          description="These are optional site-wide routes for readers who want broader browsing after the explainer, not prerequisites for understanding the topic."
        />
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          {genericResourceLinks.slice(0, 4).map((item) => (
            <Panel
              key={item.href}
              href={item.href}
              as={Link}
              padding="md"
              interactive
            >
              <StatusPill tone="default">{item.eyebrow}</StatusPill>
              <h3 className="mt-3 text-lg font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                {item.description}
              </p>
              {item.note ? (
                <p className="mt-3 text-[12px] leading-5 text-[var(--ink-muted)]">
                  {item.note}
                </p>
              ) : null}
            </Panel>
          ))}
        </div>
      </Panel>
    </main>
  );
}
