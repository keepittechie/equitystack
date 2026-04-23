import { Panel } from "@/app/components/dashboard/primitives";
import ShareablePageActions from "@/app/components/share/ShareablePageActions";

export default function ShareCardPanel({
  pagePath,
  cardPath = null,
  title = "Share this record or its card",
  description = "Use the page link when you want the full record, or open the share card for a cleaner stand-alone summary.",
  cardLabel = "View share card",
  className = "",
}) {
  if (!pagePath && !cardPath) {
    return null;
  }

  return (
    <Panel
      padding="md"
      className={`flex flex-wrap items-start justify-between gap-4 ${className}`.trim()}
    >
      <div className="max-w-2xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Share
        </p>
        <h2 className="mt-2 text-base font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{description}</p>
      </div>
      <ShareablePageActions
        pagePath={pagePath}
        cardPath={cardPath}
        cardLabel={cardLabel}
      />
    </Panel>
  );
}
