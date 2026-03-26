import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const policyId = Number(id);
    const db = getDb();

    if (!Number.isFinite(policyId)) {
      return NextResponse.json({ error: "Invalid policy id" }, { status: 400 });
    }

    const [policyRows] = await db.query(
      `
      SELECT id, title, year_enacted, era_id, impact_direction
      FROM policies
      WHERE id = ? AND is_archived = 0
      `,
      [policyId]
    );

    if (policyRows.length === 0) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const policy = policyRows[0];

    const [categoryRows] = await db.query(
      `
      SELECT category_id
      FROM policy_policy_categories
      WHERE policy_id = ?
      `,
      [policyId]
    );

    const categoryIds = categoryRows.map((row) => row.category_id);

    if (categoryIds.length === 0) {
      return NextResponse.json([]);
    }

    const categoryPlaceholders = categoryIds.map(() => "?").join(",");

    const sql = `
      SELECT
        p.id,
        p.title,
        p.year_enacted,
        p.policy_type,
        e.name AS era,
        pa.name AS primary_party,
        p.impact_direction,
        COUNT(DISTINCT pc.category_id) AS shared_category_count,
        ABS(p.year_enacted - ?) AS year_distance,
        CASE WHEN p.era_id = ? THEN 1 ELSE 0 END AS same_era
      FROM policies p
      LEFT JOIN policy_policy_categories pc
        ON p.id = pc.policy_id
      LEFT JOIN parties pa
        ON p.primary_party_id = pa.id
      LEFT JOIN eras e
        ON p.era_id = e.id
      WHERE p.id != ?
        AND p.is_archived = 0
        AND pc.category_id IN (${categoryPlaceholders})
        AND (
          ABS(p.year_enacted - ?) <= 30
          OR p.era_id = ?
        )
        AND p.id NOT IN (
          SELECT related_policy_id
          FROM policy_relationships
          WHERE policy_id = ?
          UNION
          SELECT policy_id
          FROM policy_relationships
          WHERE related_policy_id = ?
        )
      GROUP BY
        p.id,
        p.title,
        p.year_enacted,
        p.policy_type,
        e.name,
        pa.name,
        p.impact_direction,
        p.era_id
      ORDER BY
        shared_category_count DESC,
        same_era DESC,
        year_distance ASC,
        p.year_enacted DESC
      LIMIT 8
    `;

    const queryParams = [
      policy.year_enacted, // for year_distance SELECT
      policy.era_id,       // for same_era SELECT
      policyId,            // p.id != ?
      ...categoryIds,      // category matches
      policy.year_enacted, // ABS(p.year_enacted - ?) <= 30
      policy.era_id,       // OR p.era_id = ?
      policyId,            // already-related exclusion
      policyId,            // already-related exclusion
    ];

    const [rows] = await db.query(sql, queryParams);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching suggested relationships:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggested relationships" },
      { status: 500 }
    );
  }
}
