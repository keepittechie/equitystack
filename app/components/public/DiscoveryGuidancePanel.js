import Link from "next/link";
import { Panel, StatusPill } from "@/app/components/dashboard/primitives";

export default function DiscoveryGuidancePanel({
  eyebrow = "Guidance",
  title,
  description = null,
  items = [],
}) {
  if (!title || !items.length) {
    return null;
  }

  return (
    <Panel padding="md" className="space-y-4 h-full">
      <div className="space-y-2">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          {eyebrow}
        </p>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? (
          <p className="text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-3">
        {items.map((item, index) => {
          const content = (
            <>
              <div className="flex flex-wrap gap-2">
                {item.label ? (
                  <StatusPill tone={item.tone || "default"}>{item.label}</StatusPill>
                ) : null}
                {item.meta ? (
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--ink-muted)]">
                    {item.meta}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 text-base font-semibold text-white">{item.title}</h3>
              {item.description ? (
                <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
                  {item.description}
                </p>
              ) : null}
            </>
          );

          return item.href ? (
            <Link
              key={`${item.href}-${index}`}
              href={item.href}
              className="rounded-lg border border-white/8 bg-[rgba(18,31,49,0.52)] px-4 py-3 transition-[border-color,background-color] hover:border-[rgba(132,247,198,0.24)] hover:bg-[rgba(18,31,49,0.8)]"
            >
              {content}
            </Link>
          ) : (
            <div
              key={`${item.title}-${index}`}
              className="rounded-lg border border-white/8 bg-[rgba(18,31,49,0.52)] px-4 py-3"
            >
              {content}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
