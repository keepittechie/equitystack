import Link from "next/link";
import { fetchInternalJson } from "@/lib/api";

async function getPolicies(searchParams) {
  const params = new URLSearchParams();

  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.party) params.set("party", searchParams.party);
  if (searchParams.era) params.set("era", searchParams.era);
  if (searchParams.archived) params.set("archived", searchParams.archived);

  const queryString = params.toString();
  const url = `/api/admin/policies/list${queryString ? `?${queryString}` : ""}`;
  return fetchInternalJson(url, { errorMessage: "Failed to fetch admin policies" });
}

export default async function AdminPoliciesPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const policies = await getPolicies(resolvedSearchParams);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Policies</h1>

      <div className="mb-6 flex gap-3 flex-wrap">
        <Link href="/admin" className="border rounded-lg px-4 py-2 inline-block">
          Add New Policy
        </Link>
      </div>

      <form method="GET" className="grid gap-4 md:grid-cols-4 mb-8 border rounded-2xl p-4">
        <div>
          <label className="block text-sm font-medium mb-1">Search Title</label>
          <input
            type="text"
            name="q"
            defaultValue={resolvedSearchParams.q || ""}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Search title..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Party</label>
          <select
            name="party"
            defaultValue={resolvedSearchParams.party || ""}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">All</option>
            <option value="Democratic Party">Democratic Party</option>
            <option value="Republican Party">Republican Party</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Era</label>
          <select
            name="era"
            defaultValue={resolvedSearchParams.era || ""}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">All</option>
            <option value="Civil War and Reconstruction">Civil War and Reconstruction</option>
            <option value="Jim Crow and Disenfranchisement">Jim Crow and Disenfranchisement</option>
            <option value="Civil Rights Era">Civil Rights Era</option>
            <option value="Post Civil Rights Era">Post Civil Rights Era</option>
            <option value="Contemporary Era">Contemporary Era</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Archived</label>
          <select
            name="archived"
            defaultValue={resolvedSearchParams.archived || "false"}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="false">Active Only</option>
            <option value="true">Archived Only</option>
            <option value="">All</option>
          </select>
        </div>

        <div className="md:col-span-4 flex gap-3">
          <button type="submit" className="border rounded-lg px-4 py-2">
            Apply Filters
          </button>
          <Link href="/admin/policies" className="border rounded-lg px-4 py-2">
            Reset
          </Link>
        </div>
      </form>

      <div className="space-y-4">
        {policies.map((policy) => (
          <Link
            key={policy.id}
            href={`/admin/policies/${policy.id}`}
            className="block border rounded-2xl p-5 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold">{policy.title}</h2>
            <p className="text-sm text-gray-600">
              {policy.year_enacted} • {policy.policy_type} • {policy.primary_party || "Unknown party"}
            </p>
            <p className="text-sm text-gray-600">
              {policy.era || "Unknown era"} • {policy.status} • {policy.impact_direction}
              {policy.is_archived ? " • Archived" : ""}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
