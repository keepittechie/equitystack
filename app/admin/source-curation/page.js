import Link from "next/link";
import SourceCurationWorkspace from "./SourceCurationWorkspace";
import { getSourceCurationWorkspace } from "@/lib/services/sourceCurationService.js";

export const dynamic = "force-dynamic";

export default async function AdminSourceCurationPage() {
  const workspace = await getSourceCurationWorkspace();

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <section className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[var(--admin-text-muted)]">
          Source Curation
        </p>
        <h2 className="text-lg font-semibold text-[var(--admin-text)]">
          Human review queue for source attribution and duplicate-source decisions
        </h2>
        <p className="max-w-5xl text-[12px] text-[var(--admin-text-soft)]">
          This surface is read-only against canonical policy data. It stages confirmed
          curation decisions and explicit source actions so operators can attach existing
          sources, create and attach new sources, review unsafe duplicate clusters, or mark
          unresolved rows reviewed without silently changing trust-critical data.
        </p>
        <div className="flex flex-wrap gap-3 text-[11px]">
          <Link href="/admin/tools" className="text-[var(--admin-link)] underline">
            Open integrity tools
          </Link>
          <Link href="/admin/review-queue" className="text-[var(--admin-link)] underline">
            Open review queue
          </Link>
        </div>
      </section>

      <SourceCurationWorkspace workspace={workspace} />
    </main>
  );
}
