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
  title: "Civil Rights Laws by President",
  description:
    "A legislation-focused guide to studying civil-rights laws by president through federal legislation, policies, administration context, reports, and explainers on EquityStack.",
  path: "/analysis/civil-rights-laws-by-president",
  imagePath: "/images/hero/civil-rights-march.jpg",
  keywords: [
    "civil rights laws by president",
    "civil rights legislation by president",
    "laws affecting Black Americans",
    "civil rights history by administration",
    "federal laws impacting Black Americans",
  ],
});

const WHY_IT_MATTERS = [
  {
    title: "Laws shape rights over time",
    body:
      "Federal legislation can change rights, enforcement tools, funding priorities, access to institutions, and the legal boundaries of discrimination. Studying civil-rights laws by administration helps readers follow those changes over time.",
  },
  {
    title: "Presidents influence legislation in multiple ways",
    body:
      "Administrations can shape the legislative record through support, opposition, veto decisions, implementation priorities, and enforcement posture after a law is signed. That broader context matters when reading the effect of any one statute.",
  },
  {
    title: "Legislation and outcomes are not the same thing",
    body:
      "A law can be significant without being fully enforced, and an administration can influence implementation beyond the text of a bill. EquityStack keeps legislation, policy records, and administration context visible together so users can compare them more carefully.",
  },
];

const HOW_TO_USE = [
  {
    title: "Start with bills when the question is legislative",
    body:
      "Use the bills section to inspect tracked legislation, where it sits in the process, and how a bill connects to broader public context affecting Black Americans.",
  },
  {
    title: "Move to policies for implementation and outcomes",
    body:
      "Policy records are the best place to study what happened after legislation, including impact direction, source-backed evidence, and the wider historical thread.",
  },
  {
    title: "Add presidents, reports, and explainers for context",
    body:
      "President profiles, reports, and explainers help place civil-rights legislation inside administration-level history, public analysis, and longer legal context.",
  },
];

const START_HERE_PATHS = [
  {
    href: "/bills",
    eyebrow: "Start with legislation",
    title: "Browse civil-rights legislation affecting Black Americans",
    description:
      "Use the bills tracker when the first question is about federal legislation, tracked reform efforts, and how legislative records connect to broader civil-rights context.",
    note: "Best first stop for bill-level research.",
  },
  {
    href: "/policies",
    eyebrow: "Start with implementation",
    title: "Explore policy outcomes tied to civil-rights enforcement",
    description:
      "Move into policy records when you need more than the bill itself, including implementation, impact direction, and related historical evidence.",
    note: "Best first stop for enforcement and outcome questions.",
  },
  {
    href: "/presidents",
    eyebrow: "Start with administrations",
    title: "Review presidential records and legislative context",
    description:
      "Use presidential profiles when the core question is how administrations shaped civil-rights history through legislation, policy priorities, promises, and broader governing context.",
    note: "Best first stop for administration-level comparison.",
  },
];

const CORE_RESEARCH_PATHS = [
  {
    href: "/bills",
    eyebrow: "Bills",
    title: "Browse civil-rights legislation",
    description:
      "Track public bills, legislative status, and the current context around federal laws and reform proposals affecting Black Americans.",
  },
  {
    href: "/policies",
    eyebrow: "Policies",
    title: "Explore policy outcomes and enforcement history",
    description:
      "Study legislation, executive actions, and court decisions together when you need to compare enacted law with policy implementation and longer-term outcomes.",
  },
  {
    href: "/presidents",
    eyebrow: "Presidents",
    title: "Review presidential context for legislation",
    description:
      "Compare administrations and identify which presidential records, policy drivers, and historical contexts are most relevant to civil-rights legislation.",
  },
  {
    href: "/reports",
    eyebrow: "Reports",
    title: "Read reports analyzing policy impact",
    description:
      "Use the report layer for broader synthesis across laws, administrations, and issue areas before returning to the underlying records.",
  },
  {
    href: "/explainers",
    eyebrow: "Explainers",
    title: "Read historical explainers for legal context",
    description:
      "Explainers help connect legislation to longer histories of rights, enforcement, exclusion, and reform without losing the evidence path.",
  },
  {
    href: "/compare/policies",
    eyebrow: "Comparison",
    title: "Compare policy records side by side",
    description:
      "Use the comparison tool when you want a tighter read on how civil-rights laws or related policies differ by score, evidence, timing, and direction.",
  },
];

const CONTEXT_PATHS = [
  {
    href: "/reports/civil-rights-timeline",
    eyebrow: "Timeline",
    title: "Follow civil-rights history chronologically",
    description:
      "Use the timeline when sequence matters most, especially for following how legislation, judicial shifts, and enforcement patterns accumulated over time.",
  },
  {
    href: "/narratives",
    eyebrow: "Narratives",
    title: "Follow historical policy threads",
    description:
      "Narratives group records into broader arcs such as rights expansion, rollback, stalled reform, and longer-term legal change.",
  },
  {
    href: "/methodology",
    eyebrow: "Methodology",
    title: "Review how laws and policies are interpreted on the site",
    description:
      "Methodology explains how EquityStack separates legislation, policy outcomes, evidence strength, and score language before you draw conclusions.",
  },
  {
    href: "/sources",
    eyebrow: "Sources",
    title: "Inspect the evidence behind legislative and policy records",
    description:
      "Use the source library when you want to verify the records behind a law, a policy page, or a report before moving further.",
  },
];

const QUESTIONS = [
  "What major civil-rights laws were passed under different presidents?",
  "How did administrations influence civil-rights enforcement after legislation passed?",
  "Which laws had long-term effects on Black communities?",
  "How do legislation and policy outcomes differ across administrations?",
  "Where should a researcher begin when the question is about law, but the answer may depend on implementation and context?",
];

const RELATED_DESTINATIONS = [
  {
    href: "/research",
    title: "Use the research hub for related questions",
    description:
      "Open the research hub when this legislation-focused guide leads into a broader question about presidents, policy impact, reports, or historical context.",
  },
  {
    href: "/bills",
    title: "Browse legislation and tracked bills",
    description:
      "Use the bills section as the direct legislative entry point for this theme, especially when the question starts with Congress, bill text, or tracked reform proposals.",
  },
  {
    href: "/policies",
    title: "Explore policy outcomes tied to legislation",
    description:
      "Move into policy records when you want to study implementation, impact direction, and the longer-term public record around civil-rights law.",
  },
  {
    href: "/presidents",
    title: "Review presidential records and legislative context",
    description:
      "President profiles help connect civil-rights legislation to broader administration history, promise context, and score interpretation.",
  },
  {
    href: "/reports/black-impact-score",
    title: "Read the Black Impact Score report",
    description:
      "Use the flagship report for a broader synthesis across administrations before returning to legislation, policy, and president-level detail pages.",
  },
];

const FLAGSHIP_SUPPORT = [
  {
    title: "Why readers use this page",
    description:
      "This is the clearest thematic entry point when the search starts with law rather than presidency alone. It helps readers move from civil-rights legislation into implementation, enforcement, and administration context.",
  },
  {
    title: "What this guide covers best",
    description:
      "Use this page for the legal and legislative pathway first. It is strongest when paired with bill, policy, and president pages rather than treated as the full answer to every broader impact question.",
  },
  {
    title: "Best way to cite or share it",
    description:
      "Share this page when a reader needs a serious guide to civil-rights law by administration, then pair it with the specific law or policy page when the claim depends on one statute, court decision, or enforcement record.",
  },
];

const RELATED_THEMATIC_PAGES = getRelatedThematicPages("civilRightsLawsByPresident");

export default function CivilRightsLawsByPresidentPage() {
  return (
    <main className="space-y-10">
      <StructuredData
        data={buildThematicLandingJsonLd({
          title: "Civil Rights Laws by President",
          description:
            "A public-interest guide to studying civil-rights laws by president through legislation, policy records, administration context, reports, and explainers.",
          path: "/analysis/civil-rights-laws-by-president",
          imagePath: "/images/hero/civil-rights-march.jpg",
          about: [
            "civil rights laws",
            "U.S. presidents",
            "Black Americans",
            "federal legislation",
            "historical policy impact",
          ],
          keywords: [
            "civil rights laws by president",
            "civil rights legislation by president",
            "laws affecting Black Americans",
            "federal laws impacting Black Americans",
          ],
        })}
      />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Civil Rights Laws by President" },
        ]}
      />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Editorial guide"
          title="Civil Rights Laws by President"
          description="This is the legislation-first guide for readers asking about civil-rights laws by president. It focuses on federal law, enforcement, implementation, and how administrations shaped the legal record affecting Black Americans."
          actions={
            <>
              <Link href="/bills" className="public-button-primary">
                Browse civil-rights legislation
              </Link>
              <Link href="/policies" className="public-button-secondary">
                Explore policy outcomes
              </Link>
            </>
          }
        />
      </section>

      <TrustBar />

      <section className="public-two-col-rail grid items-start gap-6 md:grid-cols-2 xl:grid-cols-[1.05fr_0.95fr]">
        <PageContextBlock
          title="What this page is for"
          description="Use this page when the search intent is primarily legislative: civil-rights laws by president, civil-rights legislation by administration, or federal laws affecting Black Americans."
          detail="This page owns the law-and-enforcement lens. It should summarize broader impact questions, but route users outward when they need promises, opportunity systems, or top-level presidential synthesis."
        />
        <MethodologyCallout
          title="How to use this guide"
          description="Start with bills when the question is legal, move to policy records when implementation matters, and move up to the impact or overview pages when the question becomes broader than legislation."
          linkLabel="Review methodology"
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FLAGSHIP_SUPPORT.map((item) => (
          <article
            key={item.title}
            className="rounded-[1.4rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5"
          >
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{item.description}</p>
          </article>
        ))}
      </section>

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Start here"
          title="Three strong ways to begin civil-rights legislation research"
          description="Most visitors arrive with either a bill-level question, an implementation question, or an administration-level question. These paths make the first step clearer."
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
          eyebrow="Why civil-rights legislation matters"
          title="Why laws, administrations, and enforcement need to be studied together"
          description="Civil-rights history is not only about whether a law passed. It is also about how administrations shaped support, veto decisions, implementation, enforcement, and the longer-term policy environment."
        />
        <div className="grid gap-4 md:grid-cols-3">
          {WHY_IT_MATTERS.map((item) => (
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
          title="A practical way to move from law to administration context"
          description="EquityStack is most useful when users move between legislation, policy outcomes, administration context, and historical explanation deliberately."
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
          eyebrow="Key research paths"
          title="The main destinations for civil-rights legislation research"
          description="These are the strongest routes for moving from a broad search query into bills, policy outcomes, presidents, reports, and historical context."
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
          title="Use timeline, explainers, and methodology to add historical depth"
          description="These supporting routes help readers place civil-rights laws inside longer political, legal, and policy histories without leaving the evidence trail behind."
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
          description="These are research prompts for using the site, not claims or conclusions."
        />
        <ThematicQuestionList items={QUESTIONS} />
      </section>

      <RelatedThematicPages
        items={RELATED_THEMATIC_PAGES}
        description="These related guides move from the legislation lens into broader impact framing, overview context, and promise follow-through."
      />

      <section className="space-y-5">
        <SectionIntro
          eyebrow="Continue exploring"
          title="Related destinations across the public site"
          description="These routes are good next steps when you want to move deeper into bills, policy outcomes, presidential context, or broader analysis."
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
