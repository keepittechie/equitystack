import Link from "next/link";
import { buildPageMetadata } from "@/lib/metadata";
import { Breadcrumbs } from "@/app/components/public/chrome";
import { MethodologyCallout, PageContextBlock, SectionIntro } from "@/app/components/public/core";
import TrustBar from "@/app/components/public/TrustBar";
import ScoreExplanation from "@/app/components/public/ScoreExplanation";

export const metadata = buildPageMetadata({
  title: "Compare",
  description:
    "Compare presidents or policies using shared public metrics, evidence context, and methodology-aware interpretation.",
  path: "/compare",
});

function CompareHubCard({ title, description, href, label }) {
  return (
    <Link
      href={href}
      className="rounded-[1.7rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-6 hover:border-[rgba(132,247,198,0.24)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
        Comparison path
      </p>
      <h2 className="mt-4 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      <span className="mt-5 inline-flex text-sm font-medium text-[var(--accent)]">
        {label}
      </span>
    </Link>
  );
}

export default function ComparePage() {
  return (
    <main className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Compare" }]} />

      <section className="hero-panel p-8 md:p-10 xl:p-14">
        <SectionIntro
          as="h1"
          eyebrow="Compare"
          title="Compare presidents and policies without flattening away context."
          description="Comparison pages help users read differences in score, confidence, evidence, and direction mix more carefully. They are designed for public-interest research, not ranking gimmicks."
        />
      </section>

      <TrustBar />

      <section className="public-two-col-rail grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-6 md:grid-cols-2">
          <CompareHubCard
            title="Compare presidents"
            description="Read direct score, systemic score, confidence, promise throughput, and directional mix across up to four presidents to study presidential records on Black issues."
            href="/compare/presidents"
            label="Compare presidential records"
          />
          <CompareHubCard
            title="Compare policies"
            description="Put policy records side by side by impact score, direction, evidence depth, topic, timing, and source count to study legislation and executive action more carefully."
            href="/compare/policies"
            label="Compare policy records"
          />
        </div>
        <div className="space-y-5">
          <PageContextBlock
            description="This hub explains what can be compared and sends users into the president and policy comparison tools."
            detail="Comparison works best when score, evidence depth, and Confidence are read together instead of treated as a single headline number."
          />
          <MethodologyCallout description="Comparison pages keep the same core rule as the rest of the site: summary should never outrun evidence. When coverage is thin, that stays visible." />
          <ScoreExplanation title="How to interpret comparison score labels" />
        </div>
      </section>
    </main>
  );
}
