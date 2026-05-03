import Link from "next/link";
import CopyShareLinkButton from "@/app/reports/black-impact-score/CopyShareLinkButton";

export default function ShareablePageActions({
  pagePath,
  cardPath = null,
  cardLabel = "View share card",
}) {
  if (!pagePath && !cardPath) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {pagePath ? (
        <CopyShareLinkButton
          path={pagePath}
          defaultLabel="Copy share link"
          copiedLabel="Copied!"
        />
      ) : null}
      {cardPath ? (
        <Link
          href={cardPath}
          className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8"
        >
          {cardLabel}
        </Link>
      ) : null}
    </div>
  );
}
