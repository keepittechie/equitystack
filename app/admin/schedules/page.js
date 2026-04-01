import { listSchedulableActions, listOperatorSchedules } from "@/lib/server/admin-operator/schedulerService.js";
import OperatorPageAutoRefresh from "@/app/admin/components/OperatorPageAutoRefresh";
import ScheduleManager from "./ScheduleManager";

export const dynamic = "force-dynamic";

export default async function AdminSchedulesPage() {
  const [initialSchedules, initialActions] = await Promise.all([
    listOperatorSchedules(),
    listSchedulableActions(),
  ]);

  return (
    <main className="mx-auto max-w-[1700px] space-y-4 px-4 py-4">
      <OperatorPageAutoRefresh />

      <section className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-[#6B7280]">Schedules</p>
        <h1 className="text-lg font-semibold text-[#1F2937]">Scheduled workflow preparation</h1>
        <p className="max-w-5xl text-[12px] text-[#4B5563]">
          Schedules can queue only explicitly allowed safe preparation steps. Every scheduled run still creates a normal broker-backed job and stops at human checkpoints.
        </p>
      </section>

      <ScheduleManager initialSchedules={initialSchedules} initialActions={initialActions} />
    </main>
  );
}
