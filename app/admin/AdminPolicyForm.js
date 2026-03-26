"use client";

import { useState } from "react";

const emptySource = {
  source_title: "",
  source_url: "",
  source_type: "Government",
  publisher: "",
  published_date: "",
  notes: "",
};

const emptyMetric = {
  metric_name: "",
  demographic_group: "Black Americans",
  before_value: "",
  after_value: "",
  unit: "",
  geography: "",
  year_before: "",
  year_after: "",
  methodology_note: "",
};

export default function AdminPolicyForm({ lookups }) {
  const [form, setForm] = useState({
    title: "",
    policy_type: "Law",
    summary: "",
    year_enacted: "",
    date_enacted: "",
    era_id: "",
    president_id: "",
    house_party_id: "",
    senate_party_id: "",
    primary_party_id: "",
    bipartisan: false,
    direct_black_impact: false,
    outcome_summary: "",
    status: "Active",
    impact_direction: "Positive",
    impact_notes: "",
    category_ids: [],
    scores: {
      directness_score: 0,
      material_impact_score: 0,
      evidence_score: 0,
      durability_score: 0,
      equity_score: 0,
      harm_offset_score: 0,
      notes: "",
    },
    sources: [{ ...emptySource }],
    metrics: [{ ...emptyMetric }],
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function updateScoreField(name, value) {
    setForm((prev) => ({
      ...prev,
      scores: {
        ...prev.scores,
        [name]: value,
      },
    }));
  }

  function toggleCategory(id) {
    setForm((prev) => {
      const exists = prev.category_ids.includes(id);

      return {
        ...prev,
        category_ids: exists
          ? prev.category_ids.filter((catId) => catId !== id)
          : [...prev.category_ids, id],
      };
    });
  }

  function updateSource(index, field, value) {
    setForm((prev) => {
      const nextSources = [...prev.sources];
      nextSources[index] = {
        ...nextSources[index],
        [field]: value,
      };
      return {
        ...prev,
        sources: nextSources,
      };
    });
  }

  function addSource() {
    setForm((prev) => ({
      ...prev,
      sources: [...prev.sources, { ...emptySource }],
    }));
  }

  function removeSource(index) {
    setForm((prev) => ({
      ...prev,
      sources: prev.sources.filter((_, i) => i !== index),
    }));
  }

  function updateMetric(index, field, value) {
    setForm((prev) => {
      const nextMetrics = [...prev.metrics];
      nextMetrics[index] = {
        ...nextMetrics[index],
        [field]: value,
      };
      return {
        ...prev,
        metrics: nextMetrics,
      };
    });
  }

  function addMetric() {
    setForm((prev) => ({
      ...prev,
      metrics: [...prev.metrics, { ...emptyMetric }],
    }));
  }

  function removeMetric(index) {
    setForm((prev) => ({
      ...prev,
      metrics: prev.metrics.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        year_enacted: form.year_enacted ? Number(form.year_enacted) : "",
        era_id: form.era_id ? Number(form.era_id) : "",
        president_id: form.president_id ? Number(form.president_id) : null,
        house_party_id: form.house_party_id ? Number(form.house_party_id) : null,
        senate_party_id: form.senate_party_id ? Number(form.senate_party_id) : null,
        primary_party_id: form.primary_party_id ? Number(form.primary_party_id) : null,
        category_ids: form.category_ids,
        scores: {
          ...form.scores,
          directness_score: Number(form.scores.directness_score),
          material_impact_score: Number(form.scores.material_impact_score),
          evidence_score: Number(form.scores.evidence_score),
          durability_score: Number(form.scores.durability_score),
          equity_score: Number(form.scores.equity_score),
          harm_offset_score: Number(form.scores.harm_offset_score),
        },
      };

      const res = await fetch("/api/admin/policies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.errors) ? data.errors.join(" ") : data.error || "Failed to create policy"
        );
      }

      setMessage(`Policy created successfully. New policy ID: ${data.policy_id}`);

      setForm({
        title: "",
        policy_type: "Law",
        summary: "",
        year_enacted: "",
        date_enacted: "",
        era_id: "",
        president_id: "",
        house_party_id: "",
        senate_party_id: "",
        primary_party_id: "",
        bipartisan: false,
        direct_black_impact: false,
        outcome_summary: "",
        status: "Active",
        impact_direction: "Positive",
        impact_notes: "",
        category_ids: [],
        scores: {
          directness_score: 0,
          material_impact_score: 0,
          evidence_score: 0,
          durability_score: 0,
          equity_score: 0,
          harm_offset_score: 0,
          notes: "",
        },
        sources: [{ ...emptySource }],
        metrics: [{ ...emptyMetric }],
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 border rounded-2xl p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => updateField("title", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Policy Type</label>
          <select
            value={form.policy_type}
            onChange={(e) => updateField("policy_type", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="Law">Law</option>
            <option value="Executive Order">Executive Order</option>
            <option value="Amendment">Amendment</option>
            <option value="Court Case">Court Case</option>
            <option value="Program">Program</option>
            <option value="Agency Action">Agency Action</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Year Enacted</label>
          <input
            type="number"
            value={form.year_enacted}
            onChange={(e) => updateField("year_enacted", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Date Enacted</label>
          <input
            type="date"
            value={form.date_enacted}
            onChange={(e) => updateField("date_enacted", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Era</label>
          <select
            value={form.era_id}
            onChange={(e) => updateField("era_id", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          >
            <option value="">Select era</option>
            {lookups.eras.map((era) => (
              <option key={era.id} value={era.id}>
                {era.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">President</label>
          <select
            value={form.president_id}
            onChange={(e) => updateField("president_id", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">None</option>
            {lookups.presidents.map((president) => (
              <option key={president.id} value={president.id}>
                {president.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Primary Party</label>
          <select
            value={form.primary_party_id}
            onChange={(e) => updateField("primary_party_id", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">No Primary Party</option>
            {lookups.parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">House Party</label>
          <select
            value={form.house_party_id}
            onChange={(e) => updateField("house_party_id", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">None</option>
            {lookups.parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Senate Party</label>
          <select
            value={form.senate_party_id}
            onChange={(e) => updateField("senate_party_id", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">None</option>
            {lookups.parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => updateField("status", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="Active">Active</option>
            <option value="Repealed">Repealed</option>
            <option value="Partially Active">Partially Active</option>
            <option value="Proposed">Proposed</option>
            <option value="Blocked">Blocked</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Impact Direction</label>
          <select
            value={form.impact_direction}
            onChange={(e) => updateField("impact_direction", e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="Positive">Positive</option>
            <option value="Negative">Negative</option>
            <option value="Mixed">Mixed</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.bipartisan}
            onChange={(e) => updateField("bipartisan", e.target.checked)}
          />
          Bipartisan
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.direct_black_impact}
            onChange={(e) => updateField("direct_black_impact", e.target.checked)}
          />
          Direct Black Impact
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Categories</label>
        <div className="grid gap-2 md:grid-cols-3">
          {lookups.categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.category_ids.includes(category.id)}
                onChange={() => toggleCategory(category.id)}
              />
              {category.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Summary</label>
        <textarea
          value={form.summary}
          onChange={(e) => updateField("summary", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 min-h-24"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Outcome Summary</label>
        <textarea
          value={form.outcome_summary}
          onChange={(e) => updateField("outcome_summary", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 min-h-24"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Impact Notes</label>
        <textarea
          value={form.impact_notes}
          onChange={(e) => updateField("impact_notes", e.target.value)}
          className="w-full border rounded-lg px-3 py-2 min-h-24"
        />
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Scores</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["directness_score", "Directness"],
            ["material_impact_score", "Material Impact"],
            ["evidence_score", "Evidence"],
            ["durability_score", "Durability"],
            ["equity_score", "Equity"],
            ["harm_offset_score", "Harm Offset"],
          ].map(([field, label]) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type="number"
                min="0"
                max="5"
                value={form.scores[field]}
                onChange={(e) => updateScoreField(field, e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Score Notes</label>
          <textarea
            value={form.scores.notes}
            onChange={(e) => updateScoreField("notes", e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-24"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Sources</h2>
          <button
            type="button"
            onClick={addSource}
            className="border rounded-lg px-3 py-2"
          >
            Add Source
          </button>
        </div>

        {form.sources.map((source, index) => (
          <div key={index} className="border rounded-xl p-4 space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Source Title</label>
                <input
                  type="text"
                  value={source.source_title}
                  onChange={(e) => updateSource(index, "source_title", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Source URL</label>
                <input
                  type="text"
                  value={source.source_url}
                  onChange={(e) => updateSource(index, "source_url", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Source Type</label>
                <select
                  value={source.source_type}
                  onChange={(e) => updateSource(index, "source_type", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="Government">Government</option>
                  <option value="Academic">Academic</option>
                  <option value="News">News</option>
                  <option value="Archive">Archive</option>
                  <option value="Nonprofit">Nonprofit</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Publisher</label>
                <input
                  type="text"
                  value={source.publisher}
                  onChange={(e) => updateSource(index, "publisher", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Published Date</label>
                <input
                  type="date"
                  value={source.published_date}
                  onChange={(e) => updateSource(index, "published_date", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={source.notes}
                onChange={(e) => updateSource(index, "notes", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-20"
              />
            </div>

            {form.sources.length > 1 && (
              <button
                type="button"
                onClick={() => removeSource(index)}
                className="border rounded-lg px-3 py-2"
              >
                Remove Source
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Metrics</h2>
          <button
            type="button"
            onClick={addMetric}
            className="border rounded-lg px-3 py-2"
          >
            Add Metric
          </button>
        </div>

        {form.metrics.map((metric, index) => (
          <div key={index} className="border rounded-xl p-4 space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Metric Name</label>
                <input
                  type="text"
                  value={metric.metric_name}
                  onChange={(e) => updateMetric(index, "metric_name", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Demographic Group</label>
                <input
                  type="text"
                  value={metric.demographic_group}
                  onChange={(e) => updateMetric(index, "demographic_group", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Before Value</label>
                <input
                  type="text"
                  value={metric.before_value}
                  onChange={(e) => updateMetric(index, "before_value", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">After Value</label>
                <input
                  type="text"
                  value={metric.after_value}
                  onChange={(e) => updateMetric(index, "after_value", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Unit</label>
                <input
                  type="text"
                  value={metric.unit}
                  onChange={(e) => updateMetric(index, "unit", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Geography</label>
                <input
                  type="text"
                  value={metric.geography}
                  onChange={(e) => updateMetric(index, "geography", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Year Before</label>
                <input
                  type="number"
                  value={metric.year_before}
                  onChange={(e) => updateMetric(index, "year_before", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Year After</label>
                <input
                  type="number"
                  value={metric.year_after}
                  onChange={(e) => updateMetric(index, "year_after", e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Methodology Note</label>
              <textarea
                value={metric.methodology_note}
                onChange={(e) => updateMetric(index, "methodology_note", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-20"
              />
            </div>

            {form.metrics.length > 1 && (
              <button
                type="button"
                onClick={() => removeMetric(index)}
                className="border rounded-lg px-3 py-2"
              >
                Remove Metric
              </button>
            )}
          </div>
        ))}
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="border rounded-lg px-4 py-2 font-medium hover:shadow disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Create Policy"}
        </button>

        {message && <p className="text-sm">{message}</p>}
      </div>
    </form>
  );
}
