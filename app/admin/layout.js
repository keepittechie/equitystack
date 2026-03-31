import OperatorAdminNav from "./components/OperatorAdminNav";
import Link from "next/link";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 text-[13px] leading-5">
      <header className="border-b border-zinc-300 bg-zinc-200/90">
        <div className="mx-auto max-w-[1700px] px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
                EquityStack Admin
              </p>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">Operator Command Center</h1>
              <p className="mt-1 max-w-5xl text-[12px] text-zinc-700">
                Wrapped operator surface on top of the canonical Python CLI workflows and artifacts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded border border-zinc-400 bg-zinc-100 px-2 py-1 font-mono text-zinc-700">
                protected by basic auth
              </span>
              <Link href="/admin/current-admin-review" className="rounded border border-zinc-400 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50">
                current-admin surface
              </Link>
              <Link href="/admin/legislative-workflow" className="rounded border border-zinc-400 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50">
                legislative surface
              </Link>
              <Link href="/admin/logout" className="rounded border border-zinc-400 bg-white px-2 py-1 text-zinc-700 hover:bg-zinc-50">
                logout
              </Link>
            </div>
          </div>
          <p className="mt-2 max-w-6xl text-[12px] text-zinc-600">
            This admin surface wraps the canonical Python workflows and artifacts. It does not
            replace the CLI, bypass review guardrails, or create direct write paths around the
            pipeline.
          </p>
        </div>
      </header>
      <OperatorAdminNav />
      {children}
    </div>
  );
}
