import Link from "next/link";
import CardShareActions from "@/app/components/share/CardShareActions";
import { toAbsoluteUrl } from "@/lib/structured-data";

function formatSourceDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function KeyDataItem({ label, value }) {
  return (
    <div className="card-muted rounded-[1.15rem] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--accent)]">{label}</p>
      <p className="text-base font-semibold mt-2">{value}</p>
    </div>
  );
}

export function buildCardMetadata(card) {
  const description = card.summary || `${card.title} on EquityStack.`;
  const image = toAbsoluteUrl(`${card.sharePath}/opengraph-image`);

  return {
    title: card.title,
    description,
    alternates: {
      canonical: card.canonicalPath,
    },
    openGraph: {
      title: card.title,
      description,
      type: "article",
      url: card.canonicalPath,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: card.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: card.title,
      description,
      images: [image],
    },
  };
}

export default function CardPage({ card, backHref, backLabel }) {
  const absoluteUrl = toAbsoluteUrl(card.sharePath);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--accent)]"
        >
          {backLabel}
        </Link>
        <span className="inline-flex items-center rounded-full border border-[rgba(120,53,15,0.12)] bg-white/80 px-3 py-1 text-xs text-[var(--ink-soft)]">
          Shareable Card
        </span>
      </div>

      <article className="card-surface rounded-[1.8rem] p-7 md:p-9 space-y-7">
        <header className="space-y-3">
          <p className="eyebrow">{card.category}</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{card.title}</h1>
          <p className="text-lg text-[var(--ink-soft)] leading-8">
            {card.summary}
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {card.keyData.map((item) => (
            <KeyDataItem key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
          ))}
        </section>

        {card.impactContext ? (
          <section className="card-muted rounded-[1.4rem] p-5">
            <h2 className="text-lg font-semibold">Impact Context</h2>
            <p className="text-sm text-[var(--ink-soft)] mt-3 leading-7">{card.impactContext}</p>
          </section>
        ) : null}

        {card.sections?.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-2xl font-semibold">{section.title}</h2>
            <p className="text-[var(--ink-soft)] leading-8 whitespace-pre-line">{section.body}</p>
          </section>
        ))}

        {card.linkedRecords?.length ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Evidence and Linked Records</h2>
            <div className="grid gap-3">
              {card.linkedRecords.map((item) => (
                <div
                  key={`${item.title}-${item.detail}`}
                  className="card-muted rounded-[1.2rem] p-4"
                >
                  <p className="font-semibold">{item.title}</p>
                  {item.detail ? (
                    <p className="text-sm text-[var(--ink-soft)] mt-2">{item.detail}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold">Share This Card</h2>
              <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">
                This page is meant to stand alone. The URL is stable and readable out of context.
              </p>
            </div>
            <CardShareActions path={card.sharePath} title={card.title} />
          </div>
          <div className="rounded-[1rem] border border-[rgba(120,53,15,0.12)] bg-white/80 px-4 py-3 text-sm text-[var(--ink-soft)] break-all">
            {absoluteUrl}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Sources</h2>
          {card.sources?.length ? (
            <div className="space-y-3">
              {card.sources.map((source) => (
                <div key={`${source.title}-${source.url || source.publisher || ""}`} className="card-muted rounded-[1.2rem] p-4">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold accent-link"
                    >
                      {source.title}
                    </a>
                  ) : (
                    <p className="font-semibold">{source.title}</p>
                  )}
                  <p className="text-sm text-[var(--ink-soft)] mt-2">
                    {[source.publisher, source.type, formatSourceDate(source.date)].filter(Boolean).join(" • ")}
                  </p>
                  {source.notes ? (
                    <p className="text-sm text-[var(--ink-soft)] mt-2 leading-7">{source.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--ink-soft)]">No public source links are listed for this card yet.</p>
          )}
        </section>
      </article>
    </main>
  );
}
