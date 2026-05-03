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
  title: "Campaign Promises to Black Americans",
  description:
    "A promises-and-follow-through guide to studying campaign promises to Black Americans through promise records, presidential context, policy outcomes, legislation, reports, and historical explainers on EquityStack.",
  path: "/analysis/campaign-promises-to-black-americans",
  imagePath: "/images/hero/civil-rights-march.jpg",
  keywords: [
    "campaign promises to Black Americans",
    "promises made to Black voters",
    "presidential promises and Black communities",
    "Black voter promises by president",
    "campaign promises vs outcomes for Black Americans",
  ],
});

const WHY_PROMISES_MATTER = [
  {
    title: "Promises shape public expectations",
    body:
      "Campaign promises help define what candidates say they will pursue for Black Americans, civil rights, economic access, voting rights, education, housing, and related policy areas once in office.",
  },
  {
    title: "Promises can be compared with action",
    body:
      "A promise becomes more useful as a research question when it can be compared with legislation, executive action, implementation, blocked proposals, or missing follow-through in the public record.",
  },
  {
    title: "Promises are one layer of a larger record",
    body:
      "Promises matter, but they are not the whole presidency. EquityStack keeps promises connected to policies, bills, reports, and presidential context so users can move from rhetoric to the broader historical record.",
  },
];

const HOW_TO_USE = [
  {
    title: "Start with promises for commitment-level research",
    body:
      "Use Promise Tracker when the first question is what a president or campaign said it would do for Black Americans and how that commitment is currently classified.",
  },
  {
    title: "Move to policies and bills for follow-through",
    body:
      "Policy and bill pages help answer whether a promise was tied to legislation, executive action, enforcement, or other measurable government activity after the campaign period.",
  },
  {
    title: "Add presidents, reports, and explainers for context",
    body:
      "President profiles, reports, and explainers help place individual commitments inside the wider administration record, historical context, and patterns across presidencies.",
  },
];

const START_HERE_PATHS = [
  {
    href: "/promises",
    eyebrow: "Start with promise records",
    title: "Review presidential promise records",
    description:
      "Use Promise Tracker to inspect campaign and governing commitments tied to Black Americans, current status labels, linked actions, and the visible evidence trail.",
    note: "Best first stop for statement-level and follow-through questions.",
  },
  {
    href: "/presidents",
    eyebrow: "Start with administrations",
    title: "Explore presidential context around major commitments",
    description:
      "Go to presidential profiles when you need to place promises inside the larger administration record, including policy direction, score context, and related historical material.",
    note: "Best first stop for presidency-level comparison.",
  },
  {
    href: "/policies",
    eyebrow: "Start with outcomes",
    title: "Compare promises with policy outcomes",
    description:
      "Move into policy records when the core question is whether a commitment turned into implementation, measurable change, mixed results, or visible blockage.",
    note: "Best first stop for evidence-first follow-through research.",
  },
];

const CORE_RESEARCH_PATHS = [
  {
    href: "/promises",
    eyebrow: "Promises",
    title: "Review promise records tied to Black Americans",
    description:
      "Browse promise records by president, status, and topic when you want the clearest entry point into campaign commitments and documented follow-through.",
  },
  {
    href: "/presidents",
    eyebrow: "Presidents",
    title: "Explore presidential context for campaign commitments",
    description:
      "Use presidential profiles to connect promise records to administration-level policy drivers, broader historical framing, and Black Impact Score context.",
  },
  {
    href: "/policies",
    eyebrow: "Policies",
    title: "Compare promises with policy outcomes",
    description:
      "Use policy records to study whether a commitment was matched by implementation, longer-term administrative action, or a more mixed public record.",
  },
  {
    href: "/bills",
    eyebrow: "Bills",
    title: "Explore legislation connected to major commitments",
    description:
      "The bills layer helps when a promise turned on proposed legislation, congressional strategy, or reform efforts that mattered to Black communities.",
  },
  {
    href: "/reports",
    eyebrow: "Reports",
    title: "Use reports to identify broader promise patterns",
    description:
      "Reports help compare commitment, delivery, mixed outcomes, and administration-level patterns before you return to individual promise records.",
  },
  {
    href: "/explainers",
    eyebrow: "Explainers",
    title: "Read explainers for historical context",
    description:
      "Historical explainers help place specific promises inside longer debates about rights, access, enforcement, and federal responsibility.",
  },
];

const CONTEXT_PATHS = [
  {
    href: "/current-administration",
    eyebrow: "Current administration",
    title: "Follow current promise movement and recent updates",
    description:
      "Use the current-administration overview when you want a faster route into recently updated commitments, actions, and public-facing outcomes.",
  },
  {
    href: "/compare/presidents",
    eyebrow: "Comparison",
    title: "Compare administrations when promise records diverge",
    description:
      "Use the comparison tool when you want to move from one promise record into broader administration-level differences in score context, promises, and policy direction.",
  },
  {
    href: "/methodology",
    eyebrow: "Methodology",
    title: "Review how promise grading and evidence rules work",
    description:
      "Methodology explains how statuses, rationale, supporting sources, and score boundaries are interpreted before you draw larger conclusions.",
  },
  {
    href: "/sources",
    eyebrow: "Sources",
    title: "Inspect the evidence behind promise and policy records",
    description:
      "Use the source library when you want to verify the record behind a promise page, a linked policy, or a report before going further.",
  },
];

const QUESTIONS = [
  "What promises were made to Black Americans during presidential campaigns?",
  "How do campaign promises compare with actual records, policy action, or partial follow-through?",
  "Which commitments were tied to legislation, executive action, or implementation choices?",
  "Where did rhetoric and outcomes diverge in the documented record?",
  "When should a researcher start with promises instead of a president, a policy page, or a report?",
];

const RELATED_DESTINATIONS = [
  {
    href: "/research",
    title: "Use the research hub for broader follow-through research",
    description:
      "Open the research hub when this promise lens leads into a wider question about presidents, legislation, reports, explainers, or methods.",
  },
  {
    href: "/promises",
    title: "Review promise records",
    description:
      "Use the promise tracker as the direct entry point for this theme, especially when the question starts with campaign commitments or promise status.",
  },
  {
    href: "/presidents",
    title: "Explore presidential context",
    description:
      "President profiles help place commitments inside broader administration records, policy direction, and historical comparison.",
  },
  {
    href: "/policies",
    title: "Read policy analysis tied to follow-through",
    description:
      "Policy pages help determine whether a commitment turned into implementation, measurable outcomes, or a more complicated record.",
  },
  {
    href: "/reports",
    title: "Read reports and score-based analysis",
    description:
      "Reports provide a broader analytical frame when you want to compare promise delivery and policy outcomes across presidencies or issue areas.",
  },
  {
    href: "/bills",
    title: "Browse legislation connected to major commitments",
    description:
      "Move into bills when the promise depended on congressional action, proposed reform, or legal change affecting Black Americans.",
  },
];

const RELATED_THEMATIC_PAGES = getRelatedThematicPages(
  "campaignPromisesToBlackAmericans"
);

export default function CampaignPromisesToBlackAmericansPage() {
  return (
    <main className="space-y-4">
      <StructuredData
        data={buildThematicLandingJsonLd({
          title: "Campaign Promises to Black Americans",
          description:
            "A public-interest guide to studying campaign promises to Black Americans through promise records, presidents, policies, bills, reports, and explainers.",
          path: "/analysis/campaign-promises-to-black-americans",
          imagePath: "/images/hero/civil-rights-march.jpg",
          about: [
            "campaign promises",
            "Black Americans",
            "U.S. presidents",
            "policy outcomes",
            "historical policy impact",
          ],
          keywords: [
            "campaign promises to Black Americans",
            "promises made to Black voters",
            "presidential promises and Black communities",
            "Black voter promises by president",
            "campaign promises vs outcomes for Black Americans",
          ],
        })}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Campaign Promises to Black Americans" },
        ]}
      />

      <section className="hero-panel p-4">
        <SectionIntro
          as="h1"
          eyebrow="Editorial guide"
          title="Campaign Promises to Black Americans"
          description="This is the promises-and-follow-through guide for readers asking what presidents or campaigns promised Black Americans and what the documented record shows afterward. It focuses on commitments, promise grading, linked policy action, and later evidence."
          actions={
            <>
              <Link href="/promises" className="dashboard-button-primary">
                Review promise records
              </Link>
              <Link href="/presidents" className="dashboard-button-secondary">
                Explore presidential context
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="public-two-col-rail grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          title="What this page is for"
          description="Use this page when the search intent is about promises made to Black Americans, Black voter commitments, or the gap between rhetoric and later follow-through."
          detail="This page owns the commitments-and-outcomes lens. It should summarize broader impact questions, but route users upward when they need synthesis and outward when they need record interpretation."
        />
        <MethodologyCallout
          title="How to use this guide"
          description="Start with promises when the question is about commitments, move to policies or bills for follow-through, and move up to the impact or overview pages when the question becomes broader than campaign commitments."
          linkLabel="Review promise methodology"
        />
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Why promises matter"
          title="Why promises matter in this research question"
          description="Promises are useful because they make expectations visible. Once they are tied to evidence, they can be compared with policy action, legislation, implementation, or documented non-delivery."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHY_PROMISES_MATTER.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4"
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
          title="How to evaluate promises using the public record"
          description="The site works best when users move from the promise tracker into presidents, policies, bills, reports, and explainers instead of treating one promise statement as the whole story."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {HOW_TO_USE.map((item) => (
            <article
              key={item.title}
              className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4"
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
          title="Three strong ways to begin promise-focused research"
          description="Most visitors arrive with a commitment question, an administration question, or a follow-through question. These paths are designed to make that first click more useful."
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
          eyebrow="Key research paths"
          title="The main destinations for studying commitments and follow-through"
          description="These routes are the strongest next steps when the question is about campaign promises to Black Americans, delivery, implementation, and historical context."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CORE_RESEARCH_PATHS.map((item) => (
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
          title="Use methodology, recent activity, and sources to add depth"
          description="These supporting routes help readers move from a promise claim into broader context, current activity, and the underlying evidence base."
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
          title="Questions this site helps you explore"
          description="These are research prompts for using the site, not conclusions about any campaign or presidency."
        />
        <ThematicQuestionList items={QUESTIONS} />
      </section>

      <RelatedThematicPages
        items={RELATED_THEMATIC_PAGES}
        description="These related guides move from campaign commitments into broader impact framing, broad overview context, and evidence-focused record review."
      />

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Related destinations across the public site"
          description="These routes are useful next steps when you want to move deeper into promises, presidents, policies, reports, explainers, or legislation."
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
