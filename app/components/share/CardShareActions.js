"use client";

import Link from "next/link";
import CopyShareLinkButton from "@/app/reports/black-impact-score/CopyShareLinkButton";
import { toAbsoluteUrl } from "@/lib/structured-data";

export default function CardShareActions({ path, title }) {
  const absoluteUrl = toAbsoluteUrl(path);
  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedTitle = encodeURIComponent(title || "EquityStack Card");

  return (
    <div className="flex flex-wrap gap-2">
      <CopyShareLinkButton
        path={path}
        defaultLabel="Copy Card Link"
        copiedLabel="Copied!"
      />
      <Link
        href={`https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-4 py-2 text-sm font-medium"
      >
        Share to X
      </Link>
      <Link
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-[rgba(120,53,15,0.18)] bg-white/80 px-4 py-2 text-sm font-medium"
      >
        Share to LinkedIn
      </Link>
    </div>
  );
}
