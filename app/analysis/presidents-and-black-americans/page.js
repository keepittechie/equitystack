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
  title: "Presidents and Black Americans",
  description:
    "A broad entry guide to researching presidents and Black Americans through presidential profiles, policies, promises, legislation, reports, and historical context on EquityStack.",
  path: "/analysis/presidents-and-black-americans",
  imagePath: "/images/hero/civil-rights-march.jpg",
  keywords: [
    "presidents and Black Americans",
    "Black history by president",
    "U.S. presidents and Black Americans",
    "presidential history and Black Americans",
    "Black history under U.S. presidents",
  ],
});

const WHY_IT_MATTERS = [
  {
    title: "Presidents shape federal priorities",
    body:
      "Administrations can influence civil-rights enforcement, appointments, executive action, agency priorities, and the public direction of federal policy. Studying presidents alongside Black history helps readers connect those choices to documented policy records.",
  },
  {
    title: "The record is larger than rhetoric",
    body:
      "A presidency can be studied through promises, enacted policy, blocked proposals, court-era context, and later consequences. EquityStack is built to keep those layers visible together instead of reducing them to slogans or one-line judgments.",
  },
  {
    title: "Historical comparison requires context",
    body:
      "Questions about who helped or harmed Black Americans depend on time period, policy area, evidence quality, and the difference between stated goals and measurable outcomes. This page is a guide to those research paths, not a final verdict.",
  },
];

const HOW_TO_USE = [
  {
    title: "Start with presidential profiles",
    body:
      "Use the presidents index and individual profiles to compare administrations, read Black Impact Score context, and identify the strongest documented policy drivers.",
  },
  {
    title: "Verify with policy and bill records",
    body:
      "Move from a broad presidency question into laws, executive actions, court decisions, and tracked bills when you need record-level evidence.",
  },
  {
    title: "Add promises, reports, and explainers",
    body:
      "Promise Tracker helps separate intent from outcome, reports synthesize patterns across administrations, and explainers or narratives provide historical framing around the same public record.",
  },
];

const START_HERE_PATHS = [
  {
    href: "/presidents",
    eyebrow: "Start with profiles",
    title: "Trace presidential records affecting Black Americans",
    description:
      "Go straight to presidential profiles when you want to compare administrations, read score context, and identify which policies or promises shaped the record.",
    note: "Best first stop for broad comparison questions.",
  },
  {
    href: "/policies",
    eyebrow: "Start with policy evidence",
    title: "Review civil-rights policy by president and era",
    description:
      "Use the policy explorer when the real question is about laws, executive actions, or court decisions rather than the presidency as an abstract whole.",
    note: "Best first stop for evidence-first research.",
  },
  {
    href: "/promises",
    eyebrow: "Start with accountability",
    title: "Compare campaign promises with documented outcomes",
    description:
      "Promise Tracker is the clearest route when you want to know what presidents promised Black Americans and what the public record currently shows happened next.",
    note: "Best first stop for intent-versus-outcome questions.",
  },
];

const CORE_RESEARCH_PATHS = [
  {
    href: "/presidents",
    eyebrow: "Presidential records",
    title: "Explore presidential records",
    description:
      "Compare presidents, review profile pages, and study how policy records, promises, and historical context connect to Black Americans.",
  },
  {
    href: "/policies",
    eyebrow: "Civil-rights policy",
    title: "Review policy records by president and era",
    description:
      "Browse laws, executive actions, and court decisions affecting Black Americans, then filter by president, category, direction, or time period.",
  },
  {
    href: "/promises",
    eyebrow: "Campaign promises",
    title: "Compare campaign promises with outcomes",
    description:
      "Use Promise Tracker to study what presidents said they would do, how those commitments were graded, and which actions or outcomes were linked later.",
  },
  {
    href: "/bills",
    eyebrow: "Legislation and bills",
    title: "Browse legislation and tracked bills",
    description:
      "Use the legislative layer to inspect current or recent bills, their estimated impact framing, and how they connect to presidents, promises, and broader policy history.",
  },
  {
    href: "/compare/presidents",
    eyebrow: "Comparative research",
    title: "Compare presidential records side by side",
    description:
      "Use the comparison tool when you need a tighter analytical read across administrations, score confidence, promise throughput, and directional mix.",
  },
];

const CONTEXT_PATHS = [
  {
    href: "/reports",
    eyebrow: "Reports",
    title: "Read reports and public analysis",
    description:
      "Reports help synthesize patterns across administrations and policy areas before you move back into the underlying records and evidence.",
  },
  {
    href: "/scorecards",
    eyebrow: "Reports and scorecards",
    title: "Review legislator scorecards tied to public context",
    description:
      "Scorecards add congressional context where legislative sponsorship and public reform records matter to the broader presidential story.",
  },
  {
    href: "/explainers",
    eyebrow: "Historical explainers",
    title: "Read historical explainers",
    description:
      "Use explainers when you need legal, historical, or policy background before returning to a president, promise, or policy record.",
  },
  {
    href: "/narratives",
    eyebrow: "Narratives",
    title: "Follow historical policy threads",
    description:
      "Narratives group records into broader arcs such as rights expansion, rollback, unresolved harm, and court impact across eras.",
  },
  {
    href: "/methodology",
    eyebrow: "Methodology",
    title: "Review how the public record is built",
    description:
      "Methodology explains how scoring, promise grading, source use, and confidence labels work before you draw larger conclusions about presidential records.",
  },
];

const QUESTIONS = [
  "How did different presidents shape policy affecting Black Americans?",
  "Which administrations expanded rights, and which ones restricted them or oversaw rollback?",
  "What laws, executive actions, court decisions, or bills had lasting effects on Black communities?",
  "How do campaign promises compare with the documented records that followed?",
  "Where should a researcher start when the question is broader than a single president or policy?",
];

const RELATED_DESTINATIONS = [
  {
    href: "/research",
    title: "Use the research hub for broader navigation",
    description:
      "Open the research hub when this overview leads into a larger question and you want a curated path across thematic guides, reports, explainers, and methods.",
  },
  {
    href: "/reports/black-impact-score",
    title: "Read the Black Impact Score report",
    description:
      "Use the flagship report for a higher-level comparative view across presidents before drilling down into profile, policy, and promise detail pages.",
  },
  {
    href: "/compare/presidents",
    title: "Compare presidential records side by side",
    description:
      "Put presidents next to one another when you want to compare score, confidence, promise throughput, and directional mix more directly.",
  },
  {
    href: "/methodology",
    title: "Review the methodology behind the public record",
    description:
      "Read how scoring, promise grading, source rules, and confidence labels work before treating any one metric as a conclusion.",
  },
  {
    href: "/sources",
    title: "Browse the source library behind the site",
    description:
      "Use the source library to inspect the evidence base behind policy, promise, and report pages linked from this guide.",
  },
];

const FLAGSHIP_SUPPORT = [
  {
    title: "Why readers use this guide first",
    description:
      "This page is the broadest thematic entry point for the question of presidents and Black Americans. It works best when the reader needs orientation before choosing a narrower path like law, promises, or evidence-heavy record review.",
  },
  {
    title: "What this guide covers and does not cover",
    description:
      "It covers the main research lenses across presidents, policy, promises, legislation, and historical context. It does not try to resolve every presidency or legal question on its own.",
  },
  {
    title: "Best way to cite or share it",
    description:
      "Share this page when someone needs a serious starting point for the topic, then pair it with a president profile, flagship report, or methodology page when the next step requires evidence or interpretive detail.",
  },
];

const RELATED_THEMATIC_PAGES = getRelatedThematicPages("presidentsAndBlackAmericans");

export default function PresidentsAndBlackAmericansPage() {
  return (
    <main className="space-y-10">
      <StructuredData
        data={buildThematicLandingJsonLd({
          title: "Presidents and Black Americans",
          description:
            "A public-interest editorial guide for researching presidents, Black Americans, civil-rights policy, campaign promises, legislation, and historical context on EquityStack.",
          path: "/analysis/presidents-and-black-americans",
          imagePath: "/images/hero/civil-rights-march.jpg",
          about: [
            "U.S. presidents",
            "Black Americans",
            "Black history",
            "civil rights policy",
            "historical policy impact",
          ],
          keywords: [
            "presidents and Black Americans",
            "Black history by president",
            "presidential record on Black issues",
            "civil rights policy by president",
          ],
        })}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Presidents and Black Americans" },
        ]}
      />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Editorial guide"
          title="Presidents and Black Americans"
          description="This is the broad entry guide for readers starting with the overall question of presidents and Black Americans. It helps users orient themselves across presidential profiles, policies, promises, legislation, reports, and historical context before moving into narrower specialist pages."
          actions={
            <>
              <Link href="/presidents" className="dashboard-button-primary">
                Explore presidential records
              </Link>
              <Link href="/reports/black-impact-score" className="dashboard-button-secondary">
                Read the Black Impact Score report
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="public-two-col-rail grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          title="What this page is for"
          description="Start here when the search intent is broad and comparative: presidents and Black Americans, Black history by president, or the overall relationship between administrations and Black communities."
          detail="This page should orient the question and route readers into the right specialist lens. It is not the main destination for legislation-only, promises-only, or evidence-interpretation questions."
        />
        <MethodologyCallout
          title="How to use this guide"
          description="Start with the presidents index when the question is comparative, move into policy or bill records when you need evidence, and use the impact, law, or promises guides when the question becomes more specific."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FLAGSHIP_SUPPORT.map((item) => (
          <article
            key={item.title}
            className="rounded-lg border border-[var(--line)] bg-[rgba(11,20,33,0.92)] p-4"
          >
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Start here"
          title="Three strong ways to begin this research"
          description="Most visitors arrive with either a comparison question, an evidence question, or an accountability question. These paths are designed to make the first click more useful."
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
          eyebrow="Why this question matters"
          title="Why people study presidents and Black history together"
          description="Presidencies matter because administrations can shape rights, access, enforcement, appointments, public investment, and the federal response to harm. But those effects need to be read through records, not slogans."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHY_IT_MATTERS.map((item) => (
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
          title="A practical way to move from question to record"
          description="EquityStack is most useful when visitors move between summaries and records deliberately. Start with the question you have, then follow the most relevant path."
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
          eyebrow="Core research paths"
          title="The main destinations for this theme"
          description="These are the strongest internal hubs for moving from a broad thematic question into presidential records, policy evidence, promises, legislation, and direct comparison."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          title="Use reports, explainers, narratives, and methodology to add context"
          description="These supporting routes help visitors interpret what they find in the record layer without losing the ability to verify it."
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
          title="Questions this site can help you explore"
          description="This page is meant to orient first-time visitors and point them toward the parts of the site most useful for answering historically grounded public-interest questions."
        />
        <ThematicQuestionList items={QUESTIONS} />
      </section>

      <RelatedThematicPages
        items={RELATED_THEMATIC_PAGES}
        description="These related guides take the broad overview into three more specific directions: impact synthesis, civil-rights law, and campaign follow-through."
      />

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Related destinations across the public site"
          description="These are useful next steps once you know whether you need comparison, methodology, source review, or a more guided reading path."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
