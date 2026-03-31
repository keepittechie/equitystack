import Link from "next/link";
import { listReviewQueueItems } from "@/lib/server/admin-operator/workflowData.js";
import { getReviewQueueActionDescriptors } from "@/lib/server/admin-operator/operatorActionDescriptors.js";
import OperatorPageAutoRefresh from "@/app/admin/components/OperatorPageAutoRefresh";
import CompactActionSelect from "@/app/admin/components/CompactActionSelect";

function toWorkflowLabel(value) {
  if (value === "current-admin") {
    return "Current Admin";
  }
  if (value === "legislative") {
    return "Legislative";
  }
  return value || "Unknown";
}

export default async function AdminReviewQueuePage() {
  const items = await listReviewQueueItems();

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <OperatorPageAutoRefresh />

      <section className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-wide text-gray-600">Review Queue</p>
        <h2 className="text-lg font-semibold">Pending operator review work</h2>
        <p className="max-w-5xl text-[12px] text-gray-700">
          This page keeps decision-critical workflow facts inline and pushes deeper inspection to
          the canonical review surfaces and session inspector.
        </p>
      </section>

      <section className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="min-w-[1320px] w-full text-[11px]">
          <thead className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-600">
            <tr>
              <th className="border-b border-zinc-200 px-2 py-1">Workflow</th>
              <th className="border-b border-zinc-200 px-2 py-1">Queue Type</th>
              <th className="border-b border-zinc-200 px-2 py-1">Record</th>
              <th className="border-b border-zinc-200 px-2 py-1">Key Facts</th>
              <th className="border-b border-zinc-200 px-2 py-1">Reason</th>
              <th className="border-b border-zinc-200 px-2 py-1">Risk</th>
              <th className="border-b border-zinc-200 px-2 py-1">Decision</th>
              <th className="border-b border-zinc-200 px-2 py-1">Details</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const actions = getReviewQueueActionDescriptors(item);

              return (
                <tr key={item.id} className="align-top odd:bg-white even:bg-zinc-50/40">
                  <td className="border-b border-zinc-200 px-2 py-1">{toWorkflowLabel(item.workflowFamily)}</td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <div className="font-medium">{item.queueType}</div>
                    <div className="font-mono text-[10px] text-zinc-500">{item.id}</div>
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-0.5 max-w-[220px] truncate text-zinc-700" title={item.detail}>
                      {item.detail}
                    </div>
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1 text-zinc-700">
                    <div className="max-w-[220px] truncate" title={item.explanation?.expectedAction || ""}>
                      expected: {item.explanation?.expectedAction || "inspect canonical workflow"}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                      session: {item.sessionId}
                    </div>
                    <div className="mt-0.5 max-w-[220px] truncate font-mono text-[10px] text-zinc-500" title={item.artifactPath || ""}>
                      {item.artifactPath || "no artifact path"}
                    </div>
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <div className="max-w-[260px] truncate text-zinc-700" title={item.explanation?.whyExists || item.detail}>
                      {item.explanation?.whyExists || item.detail}
                    </div>
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <span className="rounded border border-zinc-300 bg-zinc-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-700">
                      {item.riskLevel || "medium"}
                    </span>
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <CompactActionSelect actions={actions} />
                  </td>
                  <td className="border-b border-zinc-200 px-2 py-1">
                    <div className="flex flex-wrap gap-2">
                      <Link href={item.href} className="text-[11px] underline">
                        Workflow
                      </Link>
                      <Link href={`/admin/workflows/${encodeURIComponent(item.sessionId)}`} className="text-[11px] underline">
                        Inspect
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!items.length ? (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-[11px] text-zinc-600">
                  No pending review items were found in the canonical artifacts.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
