import AdminEditPolicyForm from "./AdminEditPolicyForm";
import SuggestedRelationshipsPanel from "@/app/policies/[id]/SuggestedRelationshipsPanel";
import { fetchInternalJson } from "@/lib/api";

async function getLookups() {
  return fetchInternalJson("/api/admin/lookups", {
    errorMessage: "Failed to fetch admin lookups",
  });
}

async function getPolicy(id) {
  return fetchInternalJson(`/api/admin/policies/${id}`, {
    errorMessage: "Failed to fetch policy",
  });
}

async function getSuggestedRelationships(id) {
  return fetchInternalJson(`/api/policies/${id}/suggested-relationships`, {
    errorMessage: "Failed to fetch suggested relationships",
  });
}

export default async function AdminEditPolicyPage({ params }) {
  const { id } = await params;

  const [lookups, policy, suggestedRelationships] = await Promise.all([
    getLookups(),
    getPolicy(id),
    getSuggestedRelationships(id),
  ]);

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Edit Policy</h1>
        <p className="text-gray-700">Update policy record #{id}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AdminEditPolicyForm lookups={lookups} policy={policy} />
        </div>

        <aside className="space-y-6">
          <section className="border rounded-2xl p-5 bg-white shadow-sm">
            <h2 className="text-lg font-semibold mb-3">Current Policy</h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Title:</strong> {policy.title}</p>
              <p><strong>Year:</strong> {policy.year_enacted}</p>
              <p><strong>Type:</strong> {policy.policy_type}</p>
              <p><strong>Status:</strong> {policy.status}</p>
              <p><strong>Impact:</strong> {policy.impact_direction}</p>
            </div>
          </section>

          <SuggestedRelationshipsPanel
            policyId={Number(id)}
            suggestedRelationships={suggestedRelationships}
          />
        </aside>
      </div>
    </main>
  );
}
