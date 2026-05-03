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
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8"
      >
        Share to X
      </Link>
      <Link
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:border-white/20 hover:bg-white/8"
      >
        Share to LinkedIn
      </Link>
    </div>
  );
}
