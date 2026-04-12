import Link from "next/link";
import { SectionIntro } from "@/app/components/public/core";

export function ThematicHubCard({
  eyebrow,
  title,
  description,
  href,
  note = null,
}) {
  const content = (
    <>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-4 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      {note ? (
        <p className="mt-4 text-xs leading-6 text-[var(--ink-muted)]">{note}</p>
      ) : null}
    </>
  );

  if (!href) {
    return (
      <article className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5">
        {content}
      </article>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-[1.6rem] border border-white/8 bg-[rgba(8,14,24,0.92)] p-5 hover:border-[rgba(132,247,198,0.24)]"
    >
      {content}
    </Link>
  );
}

export function ThematicQuestionList({ items = [] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item}
          className="rounded-[1.2rem] border border-white/8 bg-[rgba(8,14,24,0.92)] px-4 py-4 text-sm leading-7 text-[var(--ink-soft)]"
        >
          {item}
        </div>
      ))}
    </div>
  );
}

export function RelatedThematicPages({
  eyebrow = "Related thematic guides",
  title = "Continue through related research themes",
  description = "These pages approach the same subject from different angles so users can choose the frame that best fits their question.",
  items = [],
}) {
  if (!items.length) {
    return null;
  }

  const gridClassName =
    items.length > 2 ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4 md:grid-cols-2";

  return (
    <section className="space-y-5">
      <SectionIntro
        eyebrow={eyebrow}
        title={title}
        description={description}
      />
      <div className={gridClassName}>
        {items.map((item) => (
          <ThematicHubCard
            key={item.href}
            eyebrow={item.eyebrow || "Related theme"}
            title={item.title}
            description={item.description}
            note={item.note}
            href={item.href}
          />
        ))}
      </div>
    </section>
  );
}
