import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import StructuredData from "@/app/components/public/StructuredData";
import { Breadcrumbs } from "@/app/components/public/chrome";
import {
  MethodologyCallout,
  PageContextBlock,
  SectionIntro,
} from "@/app/components/public/core";
import {
  RelatedThematicPages,
  ThematicHubCard,
  ThematicQuestionList,
} from "@/app/components/public/thematic";
import TrustBar from "@/app/components/public/TrustBar";
import { getRelatedThematicPages } from "@/lib/thematic-pages";
import { buildThematicLandingJsonLd } from "@/lib/structured-data";

export const metadata = buildPageMetadata({
  title: "Presidential Records on Black Opportunity",
  description:
    "An evidence-focused guide to reviewing presidential records on Black opportunity through policies, promises, legislation, reports, and historical context on EquityStack.",
  path: "/analysis/presidential-records-on-black-opportunity",
  imagePath: "/images/hero/civil-rights-march.jpg",
  keywords: [
    "presidential records on Black opportunity",
    "presidents and Black opportunity records",
    "policy records affecting Black opportunity",
    "presidential record on Black economic opportunity",
    "administration records on Black Americans",
  ],
});

const WHAT_COUNTS_AS_A_RECORD = [
  {
    title: "Policy and executive action",
    body:
      "A presidential record can include policy actions, executive orders, agency directives, court-linked outcomes, and other formal government actions that shaped access, rights, and opportunity for Black Americans.",
  },
  {
    title: "Legislation, support, and opposition",
    body:
      "It can also include legislation signed, supported, opposed, or advanced through an administration's agenda, along with the broader enforcement or implementation choices that followed.",
  },
  {
    title: "Commitments, follow-through, and outcomes",
    body:
      "Promise records, public commitments, documented follow-through, and reportable outcomes are part of the record as well, especially when they can be tied to visible evidence and historical interpretation.",
  },
];

const WHY_RECORDS_MATTER = [
  {
    title: "Claims are easier than documentation",
    body:
      "Public debate often turns on broad claims about whether an administration helped or harmed Black Americans. Records matter because they let users study documented actions rather than rhetoric alone.",
  },
  {
    title: "Evidence trails make comparison possible",
    body:
      "Presidential records become more useful when they can be compared across policies, promises, legislation, timing, and source-backed outcomes. EquityStack is designed to keep those links visible.",
  },
  {
    title: "No single record tells the whole story",
    body:
      "A presidency may contain mixed policy directions, incomplete implementation, blocked proposals, and uneven outcomes. This page is meant to help users review the record, not compress it into a verdict.",
  },
];

const HOW_TO_USE = [
  {
    title: "Start with president profiles for the administration record",
    body:
      "President pages are the main route when the question is how one administration's documented record shaped Black opportunity across multiple policy areas.",
  },
  {
    title: "Use promises, policies, and bills for evidence detail",
    body:
      "Move into promise records, policy pages, and bills when you need to inspect the evidence layer behind a claim about follow-through, reform, or legal change.",
  },
  {
    title: "Use reports, explainers, and methodology for interpretation",
    body:
      "Reports synthesize patterns, explainers add historical grounding, and methodology clarifies how records, scores, and evidence labels are organized across the site.",
  },
];

const START_HERE_PATHS = [
  {
    href: "/presidents",
    eyebrow: "Start with administrations",
    title: "Review presidential records",
    description:
      "Use presidential profiles when you want the clearest administration-level record of policies, promises, score context, and linked evidence affecting Black opportunity.",
    note: "Best first stop for presidency-level record review.",
  },
  {
    href: "/policies",
    eyebrow: "Start with evidence",
    title: "Review policy records affecting Black opportunity",
    description:
      "Move into policy records when the main question is which documented actions, enforcement choices, and outcomes shaped access, rights, or advancement.",
    note: "Best first stop for evidence-first research.",
  },
  {
    href: "/promises",
    eyebrow: "Start with follow-through",
    title: "Compare promises and policy follow-through",
    description:
      "Use Promise Tracker when the question turns on what an administration said it would do and how that commitment compares with later policy records.",
    note: "Best first stop for commitment-versus-record questions.",
  },
];

const KEY_EVIDENCE_PATHS = [
  {
    href: "/presidents",
    eyebrow: "President profiles",
    title: "Review presidential records",
    description:
      "Compare administrations and inspect the public record through presidential profiles, score context, linked policy drivers, and connected promise records.",
  },
  {
    href: "/promises",
    eyebrow: "Promise records",
    title: "Compare promises with policy follow-through",
    description:
      "Use promise records to study whether commitments tied to Black opportunity were documented as delivered, partial, blocked, failed, or still in progress.",
  },
  {
    href: "/bills",
    eyebrow: "Bills and legislation",
    title: "Examine legislation affecting opportunity",
    description:
      "Use the legislative layer when the record depends on federal law, reform proposals, or congressional action tied to opportunity and rights.",
  },
  {
    href: "/reports",
    eyebrow: "Report analysis",
    title: "Read report analysis across administrations",
    description:
      "Reports help synthesize long-term patterns across presidents and issue areas before you return to the underlying documentary record.",
  },
  {
    href: "/explainers",
    eyebrow: "Historical context",
    title: "Use explainers and narratives to place records in context",
    description:
      "Historical explainers and narratives help place individual records inside broader legal, social, and policy histories rather than treating each record in isolation.",
  },
  {
    href: "/methodology",
    eyebrow: "Methodology",
    title: "Review EquityStack methodology",
    description:
      "Methodology explains how policy records, promise statuses, scores, evidence strength, and confidence labels are organized and interpreted.",
  },
];

const CONTEXT_PATHS = [
  {
    href: "/reports/black-impact-score",
    eyebrow: "Flagship report",
    title: "Read the Black Impact Score report",
    description:
      "Use the flagship report for a broader comparative frame across administrations before drilling down into specific policies, promises, or presidential records.",
  },
  {
    href: "/compare/presidents",
    eyebrow: "Comparison",
    title: "Compare administrations side by side",
    description:
      "Use the comparison tool when you want a tighter read across presidencies, score context, promise throughput, and overall directional mix.",
  },
  {
    href: "/narratives",
    eyebrow: "Narratives",
    title: "Follow long-form historical pathways",
    description:
      "Narratives help connect documented actions into longer arcs of expansion, rollback, delay, and uneven opportunity across eras.",
  },
  {
    href: "/sources",
    eyebrow: "Sources",
    title: "Inspect the evidence behind the records",
    description:
      "Use the source library when you want to verify the evidence base behind a policy page, report, promise record, or presidential profile.",
  },
];

const QUESTIONS = [
  "What documented actions affected Black opportunity under each administration?",
  "How do promises compare with actual records, policy action, and follow-through?",
  "What legislation and policy records shaped long-term opportunity?",
  "How should users interpret records across different presidencies without reducing them to a single verdict?",
  "Which page type should a researcher use first when the question is about evidence rather than broad framing?",
];

const RELATED_DESTINATIONS = [
  {
    href: "/research",
    title: "Use the research hub for broader evidence paths",
    description:
      "Open the research hub when this records page leads into a larger question and you need a curated route across themes, reports, explainers, and methods.",
  },
  {
    href: "/presidents",
    title: "Review presidential records",
    description:
      "Use presidential profiles as the main administration-level entry point when the question is about documentary and policy records tied to Black opportunity.",
  },
  {
    href: "/promises",
    title: "Compare promises and policy follow-through",
    description:
      "Promise Tracker is useful when the question turns on how public commitments compared with the documented record that followed.",
  },
  {
    href: "/policies",
    title: "Review policy records affecting opportunity",
    description:
      "Move into policy records when you want the evidence-bearing layer behind claims about access, rights, advancement, and government action.",
  },
  {
    href: "/bills",
    title: "Examine legislation affecting opportunity",
    description:
      "Use the bills section when the question depends on statutory change, congressional action, or reform proposals shaping Black opportunity.",
  },
  {
    href: "/reports",
    title: "Read report analysis",
    description:
      "Reports provide a broader analytical frame across presidencies and issue areas before you return to the underlying public record.",
  },
];

const RELATED_THEMATIC_PAGES = getRelatedThematicPages(
  "presidentialRecordsOnBlackOpportunity"
);

export default function PresidentialRecordsOnBlackOpportunityPage() {
  return (
    <main className="space-y-10">
      <StructuredData
        data={buildThematicLandingJsonLd({
          title: "Presidential Records on Black Opportunity",
          description:
            "A public-interest guide to reviewing presidential records on Black opportunity through policies, promises, legislation, reports, and historical context.",
          path: "/analysis/presidential-records-on-black-opportunity",
          imagePath: "/images/hero/civil-rights-march.jpg",
          about: [
            "presidential records",
            "Black opportunity",
            "U.S. presidents",
            "public policy",
            "historical policy impact",
          ],
          keywords: [
            "presidential records on Black opportunity",
            "policy records affecting Black opportunity",
            "presidential record on Black economic opportunity",
            "presidents and Black opportunity records",
            "administration records on Black Americans",
          ],
        })}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Presidential Records on Black Opportunity" },
        ]}
      />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Editorial guide"
          title="Presidential Records on Black Opportunity"
          description="This is the evidence-and-records guide for readers who want documentary review rather than broad framing. It focuses on policies, promises, legislation, outcomes, and the linked evidence trail behind claims about Black opportunity."
          actions={
            <>
              <Link href="/presidents" className="public-button-primary">
                Review presidential records
              </Link>
              <Link href="/policies" className="public-button-secondary">
                Review policy records affecting opportunity
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="public-two-col-rail grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          title="What this page is for"
          description="Use this page when the search intent is about documentary evidence, administration records, policy records, or how to interpret the record behind Black opportunity claims."
          detail="This page owns the records-and-evidence lens. It should summarize broader impact questions, but route users upward when they need synthesis and sideways when they need opportunity mechanisms."
        />
        <MethodologyCallout
          title="How to use this guide"
          description="Start here when the question is about evidence trails, then move into profiles, policies, promises, and bills as needed. Use the impact hub when the question becomes broader than documentary review."
          linkLabel="Review EquityStack methodology"
        />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="What counts as a record"
          title="What counts as a presidential record here"
          description="On this page, presidential records are treated as documented actions, commitments, legal change, implementation choices, and reportable outcomes that can be followed across the site."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHAT_COUNTS_AS_A_RECORD.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Why records matter"
          title="Why records matter in evaluating Black opportunity"
          description="Documented records make it easier to study administrations through evidence, patterns, and linked public actions instead of relying on broad claims alone."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHY_RECORDS_MATTER.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="How EquityStack helps"
          title="How to review records on EquityStack"
          description="The site works best when users move deliberately between president profiles, promise records, policy records, bills, reports, explainers, and methodology rather than relying on one page alone."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_TO_USE.map((item) => (
            <article
              key={item.title}
              className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6"
            >
              <h2 className="text-xl font-semibold text-white">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Start here"
          title="Three strong ways to begin a records review"
          description="Most visitors arrive with an administration question, an evidence question, or a follow-through question. These paths are designed to make the first click more useful."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {START_HERE_PATHS.map((item) => (
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

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Key evidence paths"
          title="The main routes for reviewing documentary and policy records"
          description="These routes are the strongest next steps when the question is about evidence trails, measurable records, and how administrations shaped Black opportunity."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {KEY_EVIDENCE_PATHS.map((item) => (
            <ThematicHubCard
              key={item.href}
              eyebrow={item.eyebrow}
              title={item.title}
              description={item.description}
              href={item.href}
            />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Context and verification"
          title="Use reports, comparison, narratives, and sources to add depth"
          description="These supporting routes help readers test interpretations, compare administrations, and inspect the evidence behind the record."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CONTEXT_PATHS.map((item) => (
            <ThematicHubCard
              key={item.href}
              eyebrow={item.eyebrow}
              title={item.title}
              description={item.description}
              href={item.href}
            />
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Suggested questions"
          title="Questions this site can help answer"
          description="These are research prompts for using the site, not conclusions or rankings."
        />
        <ThematicQuestionList items={QUESTIONS} />
      </section>

      <RelatedThematicPages
        items={RELATED_THEMATIC_PAGES}
        description="These related guides move from evidence review into broader impact framing, opportunity mechanisms, and the legislation lens."
      />

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Related destinations across the public site"
          description="These routes are useful next steps when you want to move deeper into presidents, promises, policies, bills, reports, explainers, or methodology."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {RELATED_DESTINATIONS.map((item) => (
            <ThematicHubCard
              key={item.href}
              eyebrow="Related destination"
              title={item.title}
              description={item.description}
              href={item.href}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
