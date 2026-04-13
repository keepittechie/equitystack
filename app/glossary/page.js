import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { CitationNote, SectionIntro } from "@/app/components/public/core";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
  buildItemListJsonLd,
} from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Glossary | EquityStack concepts and terms",
  description:
    "Read clear definitions for the main concepts, page types, and research terms used across EquityStack, including presidents, promises, policies, bills, reports, explainers, methodology, and sources.",
  path: "/glossary",
  keywords: [
    "EquityStack glossary",
    "EquityStack terms",
    "Black policy research glossary",
    "presidents promises policies glossary",
  ],
});

const KEY_CONCEPTS = [
  {
    title: "Presidents",
    description:
      "President pages gather administration-level records, scores, promises, policies, and linked evidence into one public profile.",
    href: "/presidents",
  },
  {
    title: "Administration or presidency",
    description:
      "An administration is the period and governing context tied to a president’s term, including executive priorities, appointments, and related records.",
    href: "/administrations",
  },
  {
    title: "Promises",
    description:
      "Promises are public commitments that EquityStack tracks alongside actions, outcomes, and related policy records.",
    href: "/promises",
  },
  {
    title: "Policies",
    description:
      "Policy pages are the main record layer for laws, executive actions, court decisions, and other documented actions with public impact context.",
    href: "/policies",
  },
  {
    title: "Bills or legislation",
    description:
      "Bills add the legislative pathway, including enacted laws, proposed reforms, and bill-level detail where the public record supports the connection.",
    href: "/bills",
  },
  {
    title: "Reports",
    description:
      "Reports synthesize many records into a more shareable analysis layer, but they should still lead readers back into underlying records and evidence.",
    href: "/reports",
  },
  {
    title: "Explainers",
    description:
      "Explainers provide legal, historical, and policy context so readers can interpret a topic without relying on summary language alone.",
    href: "/explainers",
  },
  {
    title: "Narratives",
    description:
      "Narratives group long-run change into broader historical arcs such as expansion, rollback, and institutional continuity.",
    href: "/narratives",
  },
  {
    title: "Thematic pages",
    description:
      "Thematic pages are guided entry points built around major research questions rather than one individual record.",
    href: "/research",
  },
  {
    title: "Methodology",
    description:
      "Methodology explains how EquityStack organizes records, interprets page types, and handles scores, evidence, and known limits.",
    href: "/methodology",
  },
  {
    title: "Sources",
    description:
      "Sources are the public evidence layer behind records, reports, and explainers. The source library shows visible documentation and linkage.",
    href: "/sources",
  },
  {
    title: "Records",
    description:
      "A record is a structured public entry such as a policy, promise, bill, or president profile that can be inspected directly.",
    href: "/policies",
  },
  {
    title: "Outcomes",
    description:
      "Outcomes are the documented effects or consequences attached to a policy or administration-level record in the current public dataset.",
    href: "/reports/black-impact-score",
  },
  {
    title: "Context",
    description:
      "Context is the historical, legal, or institutional framing that helps a reader interpret a record without overstating what the record proves.",
    href: "/explainers",
  },
  {
    title: "Analysis",
    description:
      "Analysis refers to the synthesis layer, especially reports and thematic pages, where EquityStack compares patterns across many records.",
    href: "/reports",
  },
];

const PAGE_TYPE_GUIDE = [
  {
    title: "Record page",
    description:
      "A record page is closest to the public data layer. Policy, promise, bill, and president pages usually belong here.",
  },
  {
    title: "Explainer",
    description:
      "An explainer adds historical or legal grounding. It helps interpret the record layer but does not replace it.",
  },
  {
    title: "Report",
    description:
      "A report is a synthesis page that summarizes patterns across multiple records and often works well as a shareable analytical entry point.",
  },
  {
    title: "Thematic page",
    description:
      "A thematic page is a research guide organized around a major question, such as presidents and Black Americans or civil-rights laws by president.",
  },
  {
    title: "Methodology page",
    description:
      "A methodology page explains how the site should be read, how terms are used, and how evidence, limits, and interpretation are handled.",
  },
];

const BROWSING_GUIDE = [
  {
    title: "Start broad when the question is broad",
    description:
      "Use the research hub or a thematic page when you are starting with a major historical or policy question rather than one specific record.",
  },
  {
    title: "Move into records when precision matters",
    description:
      "Open president, policy, promise, or bill pages when you need the closest available link between a claim and the public record.",
  },
  {
    title: "Use reports for synthesis",
    description:
      "Reports are useful when you need a stronger summary or comparison layer before drilling into underlying records.",
  },
  {
    title: "Use explainers and sources for interpretation and verification",
    description:
      "Explainers add context. Sources help verify what documentation is visible behind a record or report.",
  },
];

const RELATED_PAGES = [
  {
    href: "/start",
    title: "How to Use EquityStack",
    description:
      "Use the guided start page when a first-time reader needs a structured reading path through the site.",
  },
  {
    href: "/methodology",
    title: "Methodology",
    description:
      "Read methodology when you need a fuller explanation of how EquityStack organizes and interprets records.",
  },
  {
    href: "/research",
    title: "Research Hub",
    description:
      "Open the research hub when you need a curated gateway to thematic pages, reports, explainers, and methods.",
  },
  {
    href: "/sources",
    title: "Sources",
    description:
      "Use the source library when you need to inspect the visible evidence base behind a topic or record.",
  },
  {
    href: "/analysis/presidential-impact-on-black-americans",
    title: "Presidential Impact on Black Americans",
    description:
      "A strong thematic guide for readers who want a broad synthesis page after learning the site’s core terms.",
  },
];

const GLOSSARY_USE_CASES = [
  {
    title: "Best for first-time readers",
    description:
      "Use the glossary when someone has reached a report, explainer, or thematic page and needs quick clarity on page types, record terms, or site language before going further.",
  },
  {
    title: "Best for teachers and editors",
    description:
      "Share this page when readers need a neutral reference for how EquityStack uses terms like record, report, explainer, source, and thematic page.",
  },
  {
    title: "Best as a companion page",
    description:
      "The glossary works best alongside methodology, the research hub, or a flagship explainer rather than as the first page for a broad historical question.",
  },
];

export default function GlossaryPage() {
  return (
    <main className="space-y-10">
      <StructuredData
        data={[
          buildBreadcrumbJsonLd(
            [{ href: "/", label: "Home" }, { label: "Glossary" }],
            "/glossary"
          ),
          buildCollectionPageJsonLd({
            title: "EquityStack glossary",
            description:
              "A practical reference page defining the main concepts, page types, and research terms used across EquityStack.",
            path: "/glossary",
            about: [
              "research concepts",
              "public records",
              "Black policy research",
              "site terminology",
            ],
            keywords: [
              "EquityStack glossary",
              "EquityStack terms",
              "Black policy research glossary",
            ],
          }),
          buildItemListJsonLd({
            title: "Key concepts in the EquityStack glossary",
            description:
              "The main concepts and page types defined on the EquityStack glossary page.",
            path: "/glossary",
            items: KEY_CONCEPTS.map((item) => ({
              href: item.href,
              name: item.title,
            })),
          }),
        ]}
      />
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Glossary" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Glossary"
          title="Concepts and terms used across EquityStack"
          description="This page defines common terms, page types, and research concepts used across the public site. It is designed to help first-time readers understand how the platform is organized and how its major categories relate to one another."
          actions={
            <>
              <Link href="/methodology" className="public-button-primary">
                Read methodology
              </Link>
              <Link href="/research" className="public-button-secondary">
                Open the research hub
              </Link>
            </>
          }
        />
      </section>

      <section className="public-two-col-rail grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <CitationNote
          title="Why this page is useful"
          description="Use the glossary when a reader needs quick clarification about how EquityStack uses terms like policy, promise, report, record, source, explainer, or thematic page before moving deeper into the site."
        />
        <div className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">
            What this page does
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white">A practical reference, not a jargon list</h2>
          <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--ink-soft)]">
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              It explains the site’s main categories in plain language.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              It clarifies how page types differ so users can choose the right starting point.
            </div>
            <div className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-4">
              It links outward to the pages that actually use these concepts in practice.
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="When to use this page"
          title="The glossary is a companion reference, not a destination by itself"
          description="This page is most useful when a reader needs fast clarity on EquityStack’s terms before returning to a report, explainer, thematic page, or record page."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {GLOSSARY_USE_CASES.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Key site concepts"
          title="The main terms you will see across the public site"
          description="These definitions are short by design. The goal is to make the site easier to read and navigate, not to overwhelm readers with theory."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {KEY_CONCEPTS.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 hover:border-[rgba(132,247,198,0.24)]"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="How page types differ"
          title="Not every page on EquityStack is doing the same job"
          description="Understanding the difference between records, explainers, reports, thematic pages, and methodology makes the site easier to use and interpret responsibly."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {PAGE_TYPE_GUIDE.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="How to use these concepts while browsing"
          title="Choose the page type that fits the question you have"
          description="The same topic may appear in several parts of the site. The right next step depends on whether you need context, records, synthesis, or verification."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BROWSING_GUIDE.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Related pages"
          title="Use these pages alongside the glossary"
          description="These are the strongest next destinations when a reader wants orientation, methodology, curated discovery, evidence inspection, or a major thematic guide."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {RELATED_PAGES.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 hover:border-[rgba(132,247,198,0.24)]"
            >
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
