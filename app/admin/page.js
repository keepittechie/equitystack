import Link from "next/link";
import AdminPolicyForm from "./AdminPolicyForm";
import { fetchInternalJson } from "@/lib/api";

async function getLookups() {
  return fetchInternalJson("/api/admin/lookups", {
    errorMessage: "Failed to fetch admin lookups",
  });
}

export default async function AdminPage() {
  const lookups = await getLookups();

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Admin</h1>
      <p className="text-gray-700 mb-8">
        Add a new policy record to the Black Policy Tracker database.
      </p>

      <div className="mb-8 flex flex-wrap gap-3">
        <Link href="/admin/review" className="border rounded-lg px-4 py-2">
          Review Queue
        </Link>
        <Link
          href="/admin/promises/current-administration"
          className="border rounded-lg px-4 py-2"
        >
          Current-Administration Review
        </Link>
      </div>

      <AdminPolicyForm lookups={lookups} />
    </main>
  );
}
