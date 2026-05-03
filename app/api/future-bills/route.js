import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function buildLatestUpdateLabel(dateValue) {
  if (!dateValue) return "No action date";

  const actionDate = new Date(dateValue);
  if (Number.isNaN(actionDate.getTime())) return String(dateValue);

  const now = new Date();
  const diffMs = now.getTime() - actionDate.getTime();
  const diffDays = Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0);

  if (diffDays === 0) return "Updated today";
  if (diffDays === 1) return "Updated 1 day ago";
  if (diffDays < 30) return `Updated ${diffDays} days ago`;
  if (diffDays < 365) return `Updated ${Math.floor(diffDays / 30)} months ago`;
  return `Updated ${Math.floor(diffDays / 365)} years ago`;
}

export async function GET() {
  try {
    const db = getDb();

    const [futureBillRows] = await db.query(`
      SELECT
        id,
        title,
        problem_statement,
        proposed_solution,
        target_area,
        priority_level,
        status,
        created_at
      FROM future_bills
      ORDER BY
        FIELD(priority_level, 'Critical', 'High', 'Medium', 'Low'),
        title ASC
    `);

    const [trackedRows] = await db.query(`
      SELECT
        fb.id,
        fbl.id AS link_id,
        fbl.link_type,
        fbl.notes AS link_notes,

        tb.id AS tracked_id,
        tb.jurisdiction,
        tb.chamber,
        tb.session_label,
        tb.bill_number,
        tb.title AS bill_title,
        tb.bill_status,
        tb.sponsor_name,
        tb.sponsor_party,
        tb.sponsor_state,
        tb.official_summary,
        tb.bill_url,
        tb.last_action,
        tb.introduced_date,
        tb.latest_action_date,
        tb.source_system,
        tb.active,
        tb.match_confidence
      FROM future_bills fb
      LEFT JOIN future_bill_links fbl
        ON fb.id = fbl.future_bill_id
      LEFT JOIN tracked_bills tb
        ON fbl.tracked_bill_id = tb.id
      ORDER BY
        FIELD(fb.priority_level, 'Critical', 'High', 'Medium', 'Low'),
        fb.title ASC,
        tb.latest_action_date DESC,
        tb.bill_number ASC
    `);

    const [explainerRows] = await db.query(`
      SELECT
        efbl.future_bill_id,
        e.id AS explainer_id,
        e.slug AS explainer_slug,
        e.title AS explainer_title,
        e.summary AS explainer_summary,
        e.category AS explainer_category
      FROM explainer_future_bill_links efbl
      JOIN explainers e
        ON efbl.explainer_id = e.id
       AND e.published = 1
      ORDER BY efbl.future_bill_id ASC, e.title ASC
    `);

    const [policyRows] = await db.query(`
      SELECT DISTINCT
        efbl.future_bill_id,
        p.id AS policy_id,
        p.title AS policy_title,
        p.year_enacted,
        p.policy_type,
        p.status AS policy_status,
        p.impact_direction,
        pr.slug AS president_slug,
        pr.full_name AS president_name
      FROM explainer_future_bill_links efbl
      JOIN explainer_policy_links epl
        ON epl.explainer_id = efbl.explainer_id
      JOIN policies p
        ON p.id = epl.policy_id
       AND p.is_archived = 0
      LEFT JOIN presidents pr
        ON pr.id = p.president_id
      ORDER BY efbl.future_bill_id ASC, p.year_enacted DESC, p.title ASC
    `);

    const [promiseRows] = await db.query(`
      SELECT DISTINCT
        links.future_bill_id,
        p.id AS promise_id,
        p.slug AS promise_slug,
        p.title AS promise_title,
        p.topic AS promise_topic,
        p.status AS promise_status,
        p.summary AS promise_summary,
        pr.slug AS president_slug,
        pr.full_name AS president_name,
        links.relationship_type
      FROM (
        SELECT DISTINCT
          efbl.future_bill_id,
          pact.promise_id,
          'explainer_context' AS relationship_type
        FROM explainer_future_bill_links efbl
        JOIN promise_actions pact
          ON pact.related_explainer_id = efbl.explainer_id

        UNION

        SELECT DISTINCT
          efbl.future_bill_id,
          pact.promise_id,
          'policy_lineage' AS relationship_type
        FROM explainer_future_bill_links efbl
        JOIN explainer_policy_links epl
          ON epl.explainer_id = efbl.explainer_id
        JOIN promise_actions pact
          ON pact.related_policy_id = epl.policy_id
      ) links
      JOIN promises p
        ON p.id = links.promise_id
      JOIN presidents pr
        ON pr.id = p.president_id
      ORDER BY links.future_bill_id ASC, p.promise_date DESC, p.title ASC
    `);

    const trackedIds = trackedRows
      .map((row) => row.tracked_id)
      .filter(Boolean);

    const uniqueTrackedIds = [...new Set(trackedIds)];

    let actionRows = [];
    let sponsorRows = [];
    let legislatorRows = [];

    if (uniqueTrackedIds.length > 0) {
      const [actionResult] = await db.query(
        `
        SELECT
          id,
          tracked_bill_id,
          action_date,
          action_text,
          action_type,
          chamber,
          committee_name,
          source_url,
          created_at
        FROM tracked_bill_actions
        WHERE tracked_bill_id IN (?)
        ORDER BY tracked_bill_id ASC, action_date DESC, created_at DESC, id DESC
        `,
        [uniqueTrackedIds]
      );
      actionRows = actionResult;

      const [sponsorResult] = await db.query(
        `
        SELECT
          id,
          tracked_bill_id,
          legislator_name,
          party,
          state,
          role,
          created_at
        FROM tracked_bill_sponsors
        WHERE tracked_bill_id IN (?)
        ORDER BY
          tracked_bill_id ASC,
          FIELD(role, 'Primary Sponsor', 'Cosponsor'),
          legislator_name ASC
        `,
        [uniqueTrackedIds]
      );
      sponsorRows = sponsorResult;

      const [legislatorResult] = await db.query(
        `
        SELECT
          ltr.tracked_bill_id,
          l.id AS legislator_id,
          l.full_name,
          l.chamber,
          l.party,
          l.state,
          ltr.role,
          lss.net_weighted_impact,
          lss.avg_policy_impact_score,
          lss.total_tracked_bills
        FROM legislator_tracked_bill_roles ltr
        JOIN legislators l
          ON l.id = ltr.legislator_id
        LEFT JOIN legislator_scorecard_snapshots lss
          ON lss.legislator_id = l.id
         AND lss.snapshot_label = 'Current'
        WHERE ltr.tracked_bill_id IN (?)
        ORDER BY
          ltr.tracked_bill_id ASC,
          FIELD(ltr.role, 'Primary Sponsor', 'Cosponsor', 'Committee Chair', 'Committee Member'),
          COALESCE(lss.net_weighted_impact, 0) DESC,
          l.full_name ASC
        `,
        [uniqueTrackedIds]
      );
      legislatorRows = legislatorResult;
    }

    const actionsByTrackedId = new Map();
    for (const row of actionRows) {
      if (!actionsByTrackedId.has(row.tracked_bill_id)) {
        actionsByTrackedId.set(row.tracked_bill_id, []);
      }
      actionsByTrackedId.get(row.tracked_bill_id).push({
        id: row.id,
        date: row.action_date,
        text: row.action_text,
        type: row.action_type,
        chamber: row.chamber,
        committee_name: row.committee_name,
        source_url: row.source_url,
        created_at: row.created_at,
      });
    }

    const sponsorsByTrackedId = new Map();
    for (const row of sponsorRows) {
      if (!sponsorsByTrackedId.has(row.tracked_bill_id)) {
        sponsorsByTrackedId.set(row.tracked_bill_id, []);
      }
      sponsorsByTrackedId.get(row.tracked_bill_id).push({
        id: row.id,
        name: row.legislator_name,
        party: row.party,
        state: row.state,
        role: row.role,
        created_at: row.created_at,
      });
    }

    const legislatorsByTrackedId = new Map();
    for (const row of legislatorRows) {
      if (!legislatorsByTrackedId.has(row.tracked_bill_id)) {
        legislatorsByTrackedId.set(row.tracked_bill_id, []);
      }
      legislatorsByTrackedId.get(row.tracked_bill_id).push({
        id: row.legislator_id,
        full_name: row.full_name,
        chamber: row.chamber,
        party: row.party,
        state: row.state,
        role: row.role,
        net_weighted_impact: row.net_weighted_impact,
        avg_policy_impact_score: row.avg_policy_impact_score,
        total_tracked_bills: row.total_tracked_bills,
      });
    }

    const bills = new Map();

    for (const row of futureBillRows) {
      bills.set(row.id, {
        id: row.id,
        title: row.title,
        problem_statement: row.problem_statement,
        proposed_solution: row.proposed_solution,
        target_area: row.target_area,
        priority_level: row.priority_level,
        status: row.status,
        created_at: row.created_at,
        tracked_bills: [],
        related_explainers: [],
        related_policies: [],
        related_promises: [],
      });
    }

    for (const row of trackedRows) {
      const bill = bills.get(row.id);
      if (!bill) continue;

      if (row.tracked_id && !bill.tracked_bills.some((item) => item.id === row.tracked_id)) {
        const sponsors = sponsorsByTrackedId.get(row.tracked_id) || [];
        const actions = actionsByTrackedId.get(row.tracked_id) || [];
        const legislators = legislatorsByTrackedId.get(row.tracked_id) || [];
        const normalizedSponsors =
          sponsors.length > 0
            ? sponsors
            : row.sponsor_name
              ? [
                  {
                    id: `fallback-sponsor-${row.tracked_id}`,
                    name: row.sponsor_name,
                    party: row.sponsor_party,
                    state: row.sponsor_state,
                    role: "Primary Sponsor",
                    is_fallback: true,
                  },
                ]
              : [];
        const normalizedActions =
          actions.length > 0
            ? actions
            : row.last_action || row.latest_action_date
              ? [
                  {
                    id: `fallback-action-${row.tracked_id}`,
                    date: row.latest_action_date,
                    text: row.last_action || "Tracked bill record created",
                    type: row.bill_status || "Tracked",
                    chamber: row.chamber,
                    committee_name: null,
                    source_url: row.bill_url,
                    is_fallback: true,
                  },
                ]
              : [];

        bill.tracked_bills.push({
          id: row.tracked_id,
          link_id: row.link_id,
          link_type: row.link_type,
          link_notes: row.link_notes,
          jurisdiction: row.jurisdiction,
          chamber: row.chamber,
          session_label: row.session_label,
          bill_number: row.bill_number,
          title: row.bill_title,
          status: row.bill_status,
          sponsor: row.sponsor_name,
          sponsor_party: row.sponsor_party,
          sponsor_state: row.sponsor_state,
          official_summary: row.official_summary,
          url: row.bill_url,
          latest_action: row.last_action,
          introduced_date: row.introduced_date,
          date: row.latest_action_date,
          source_system: row.source_system,
          active: row.active,
          match_confidence: row.match_confidence,
          sponsors: normalizedSponsors,
          linked_legislators: legislators,
          actions: normalizedActions,
          sponsor_count: normalizedSponsors.length,
          legislator_count: legislators.length,
          action_count: normalizedActions.length,
          latest_update_label: buildLatestUpdateLabel(row.latest_action_date),
        });
      }
    }

    for (const row of explainerRows) {
      const bill = bills.get(row.future_bill_id);
      if (!bill) continue;

      if (row.explainer_id && !bill.related_explainers.some((item) => item.id === row.explainer_id)) {
        bill.related_explainers.push({
          id: row.explainer_id,
          slug: row.explainer_slug,
          title: row.explainer_title,
          summary: row.explainer_summary,
          category: row.explainer_category,
        });
      }
    }

    for (const row of policyRows) {
      const bill = bills.get(row.future_bill_id);
      if (!bill) continue;

      if (row.policy_id && !bill.related_policies.some((item) => item.id === row.policy_id)) {
        bill.related_policies.push({
          id: row.policy_id,
          title: row.policy_title,
          year_enacted: row.year_enacted,
          policy_type: row.policy_type,
          status: row.policy_status,
          impact_direction: row.impact_direction,
          president_slug: row.president_slug,
          president_name: row.president_name,
        });
      }
    }

    for (const row of promiseRows) {
      const bill = bills.get(row.future_bill_id);
      if (!bill || !row.promise_id) continue;

      const existing = bill.related_promises.find((item) => item.id === row.promise_id);
      if (existing) {
        if (existing.relationship_type !== "explainer_context" && row.relationship_type === "explainer_context") {
          existing.relationship_type = row.relationship_type;
        }
        continue;
      }

      bill.related_promises.push({
        id: row.promise_id,
        slug: row.promise_slug,
        title: row.promise_title,
        topic: row.promise_topic,
        status: row.promise_status,
        summary: row.promise_summary,
        president_slug: row.president_slug,
        president_name: row.president_name,
        relationship_type: row.relationship_type,
      });
    }

    const structured = Array.from(bills.values()).map((bill) => {
      const linkedLegislatorMap = new Map();

      for (const trackedBill of bill.tracked_bills) {
        for (const legislator of trackedBill.linked_legislators || []) {
          if (!linkedLegislatorMap.has(legislator.id)) {
            linkedLegislatorMap.set(legislator.id, {
              ...legislator,
              tracked_bill_count: 0,
              primary_sponsor_count: 0,
            });
          }

          const existing = linkedLegislatorMap.get(legislator.id);
          existing.tracked_bill_count += 1;
          if (legislator.role === "Primary Sponsor") {
            existing.primary_sponsor_count += 1;
          }
        }
      }

      return {
        ...bill,
        tracked_bills: bill.tracked_bills.sort((a, b) => {
        if (!a.date && !b.date) return String(a.bill_number).localeCompare(String(b.bill_number));
        if (!a.date) return 1;
        if (!b.date) return -1;
        return String(b.date).localeCompare(String(a.date));
        }),
        related_explainers: bill.related_explainers.sort((a, b) =>
          a.title.localeCompare(b.title)
        ),
        related_policies: bill.related_policies.sort((a, b) => {
          return (
            Number(b.year_enacted || 0) - Number(a.year_enacted || 0) ||
            a.title.localeCompare(b.title)
          );
        }),
        related_promises: bill.related_promises.sort((a, b) =>
          a.title.localeCompare(b.title)
        ),
        linked_legislators: Array.from(linkedLegislatorMap.values()).sort((left, right) => {
          return (
            Number(right.net_weighted_impact || 0) - Number(left.net_weighted_impact || 0) ||
            Number(right.primary_sponsor_count || 0) - Number(left.primary_sponsor_count || 0) ||
            left.full_name.localeCompare(right.full_name)
          );
        }),
        latest_tracked_update:
          bill.tracked_bills.find((item) => item.date)?.date || null,
      };
    });

    return NextResponse.json(structured);
  } catch (error) {
    console.error("Error fetching future bills:", error);
    return NextResponse.json(
      { error: "Failed to fetch future bills" },
      { status: 500 }
    );
  }
}
